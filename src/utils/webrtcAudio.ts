// Voice Engine — WebRTC peer-to-peer live voice chat (Online rooms only).
//
// Completely separate from the Game Engine: nothing about turns, questions, answers, cards,
// scores or rounds ever touches the microphone. The mic keeps the last state the player chose
// until the player changes it, or the room ends.
//
// Model: the voice connection and the microphone are independent.
//   join():            connects the audio channel when the player enters the room. The player can
//                      HEAR others immediately; their own mic stays OFF.
//   startMic()/stopMic(): opens/closes only the player's own mic. Uses replaceTrack() on the
//                      existing RTCPeerConnection — no new connection, no renegotiation.
//   stop():            room ended / player left: stop tracks, close the connection, free everything.
//
// Signaling (via the game server, which never carries audio):
//   host: createOffer -> setLocalDescription -> send offer
//   guest: setRemoteDescription -> createAnswer -> setLocalDescription -> send answer
//   host: setRemoteDescription        (+ ICE candidates both ways)
//   Offers/answers/candidates carry a session id (sid) so stale messages from a dead
//   connection are ignored, and an ICE-restart offer reuses the guest's live connection.
//
// Recovery: connect timeout -> retry; 'disconnected'/'failed' -> ICE restart; repeated failure ->
//   full rebuild; after MAX_ATTEMPTS the state becomes 'error' and the UI offers a manual retry.
//
// ICE servers (STUN + TURN) come from the backend (/api/ice-servers) so TURN secrets never ship
// in the frontend bundle. Add ?relay=1 to the page URL to force TURN-only (to test the relay).

import { useSyncExternalStore } from 'react';

export type VoiceState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type MicResult = 'ok' | 'denied' | 'unsupported' | 'error';

export interface VoiceSnapshot {
  state: VoiceState;
  micOn: boolean;
  localSpeaking: boolean;
  remoteSpeaking: boolean;
}

const CONNECT_TIMEOUT_MS = 15000;
const DISCONNECT_GRACE_MS = 3500;
const MAX_ATTEMPTS = 4;
const ICE_CACHE_MS = 20 * 60 * 1000;
const SPEAK_THRESHOLD = 0.02;
const SPEAK_HOLD_MS = 350;

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

interface LevelWatcher {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buf: Uint8Array;
  lastLoud: number;
}

export class WebRTCAudioManager {
  private pc: RTCPeerConnection | null = null;
  private sender: RTCRtpSender | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private onSignalCallback?: (signal: any) => void;

  private joined = false;
  private isInitiator = false;
  private peerReady = false;
  private sid: string | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private lastOfferAt = 0;

  private iceServers: RTCIceServer[] = FALLBACK_ICE;
  private iceFetchedAt = 0;
  private joinPromise: Promise<void> | null = null;
  private signalChain: Promise<void> = Promise.resolve();
  private micPending = false;

  private attempts = 0;
  private everConnected = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  private audioCtx: AudioContext | null = null;
  private localWatch: LevelWatcher | null = null;
  private remoteWatch: LevelWatcher | null = null;
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  private gestureArmed = false;

  private listeners = new Set<() => void>();
  private snapshot: VoiceSnapshot = {
    state: 'disconnected',
    micOn: false,
    localSpeaking: false,
    remoteSpeaking: false,
  };

  // ---------- public API ----------

  setSignalCallback(cb: (signal: any) => void) {
    this.onSignalCallback = cb;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): VoiceSnapshot => this.snapshot;

  isActive(): boolean {
    return this.joined;
  }

  isMicOn(): boolean {
    return this.localStream !== null;
  }

  getState(): VoiceState {
    return this.snapshot.state;
  }

  /** Join the room's voice channel (no mic needed). Safe to call more than once. */
  join(isInitiator: boolean): Promise<void> {
    if (this.joined) return this.joinPromise ?? Promise.resolve();
    this.joined = true;
    this.isInitiator = isInitiator;
    this.attempts = 0;
    this.everConnected = false;
    this.update({ state: 'connecting' });
    this.armGestureUnlock();
    this.joinPromise = (async () => {
      try {
        await this.ensureIce();
        if (!this.joined) return;
        this.ensureRemoteAudio();
        this.buildPeer();
        this.sendSignal({ type: 'ready' });
        if (this.isInitiator && this.peerReady) await this.makeOffer(false);
        this.armConnectTimer();
      } catch (err) {
        console.warn('Voice join error:', err);
        this.update({ state: 'error' });
      }
    })();
    return this.joinPromise;
  }

  /** Open this player's own mic (independent of turns, questions or rounds). */
  async startMic(): Promise<MicResult> {
    if (!this.joined) return 'error';
    if (this.localStream) return 'ok';
    if (this.micPending) return 'ok';
    this.micPending = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!this.joined) {
        // Room ended while the permission prompt was open.
        stream.getTracks().forEach((t) => t.stop());
        return 'error';
      }
      this.localStream = stream;
      const track = stream.getAudioTracks()[0];
      // If the OS / browser kills the mic, reflect it instead of showing a false "ON".
      track.onended = () => {
        if (this.localStream === stream) this.stopMic();
      };
      await this.sender?.replaceTrack(track);
      this.watchLocal(stream);
      this.resumeAudio();
      this.update({ micOn: true });
      return 'ok';
    } catch (err: any) {
      console.warn('Microphone start error:', err);
      const name = err?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
      if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'unsupported';
      return 'error';
    } finally {
      this.micPending = false;
    }
  }

  /** Close only this player's mic. The connection stays alive so they keep hearing others. */
  stopMic() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      this.localStream = null;
    }
    this.sender?.replaceTrack(null).catch(() => {});
    this.unwatch('local');
    this.update({ micOn: false, localSpeaking: false });
  }

  /** Manual retry after the 'error' state. */
  retry() {
    if (!this.joined) return;
    this.attempts = 0;
    this.update({ state: this.everConnected ? 'reconnecting' : 'connecting' });
    if (this.isInitiator) {
      this.recover(true);
    } else {
      this.buildPeer();
      this.sendSignal({ type: 'ready' });
      this.armConnectTimer();
    }
  }

  /** Room ended / player left: free the mic, the connection and every listener. */
  stop() {
    const wasJoined = this.joined;
    if (wasJoined) this.sendSignal({ type: 'bye' });
    this.joined = false;
    this.joinPromise = null;
    this.peerReady = false;
    this.sid = null;
    this.clearTimers();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      this.localStream = null;
    }
    this.closePeer();
    this.unwatch('local');
    this.unwatch('remote');
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
      this.remoteAudio.remove();
      this.remoteAudio = null;
    }
    this.update({ state: 'disconnected', micOn: false, localSpeaking: false, remoteSpeaking: false });
  }

  /** Incoming signaling message from the other player (relayed by the server). */
  handleSignal(signal: any): Promise<void> {
    // Serialize: offer/answer/candidate handling is async and must not interleave.
    this.signalChain = this.signalChain.then(() => this.processSignal(signal)).catch((err) => {
      console.warn('Voice signal error:', err);
    });
    return this.signalChain;
  }

  // ---------- internals ----------

  private update(patch: Partial<VoiceSnapshot>) {
    const next = { ...this.snapshot, ...patch };
    if (
      next.state === this.snapshot.state &&
      next.micOn === this.snapshot.micOn &&
      next.localSpeaking === this.snapshot.localSpeaking &&
      next.remoteSpeaking === this.snapshot.remoteSpeaking
    ) {
      return;
    }
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  private sendSignal(signal: any) {
    try {
      this.onSignalCallback?.(signal);
    } catch (err) {
      console.warn('Voice signal send failed:', err);
    }
  }

  private async ensureIce() {
    if (Date.now() - this.iceFetchedAt < ICE_CACHE_MS) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch('/api/ice-servers', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          this.iceServers = data.iceServers;
          this.iceFetchedAt = Date.now();
          return;
        }
      }
    } catch (err) {
      console.warn('ICE server fetch failed, using STUN only:', err);
    }
    this.iceServers = FALLBACK_ICE;
    this.iceFetchedAt = Date.now() - ICE_CACHE_MS + 30000; // retry the fetch in 30s
  }

  private ensureRemoteAudio() {
    if (this.remoteAudio) return;
    const el = document.createElement('audio');
    el.autoplay = true;
    (el as any).playsInline = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    this.remoteAudio = el;
  }

  private playRemote() {
    this.remoteAudio?.play().catch(() => this.armGestureUnlock());
  }

  /** Browsers block autoplay / AudioContext until a user gesture: unlock on the next tap. */
  private armGestureUnlock() {
    if (this.gestureArmed) return;
    this.gestureArmed = true;
    const unlock = () => {
      this.gestureArmed = false;
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      this.remoteAudio?.play().catch(() => {});
      this.resumeAudio();
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
  }

  private resumeAudio() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
  }

  private closePeer() {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.sender = null;
    this.pendingCandidates = [];
  }

  /** Create a fresh RTCPeerConnection (the only place one is created). */
  private buildPeer() {
    this.closePeer();
    const forceRelay = typeof location !== 'undefined' && new URLSearchParams(location.search).get('relay') === '1';
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: forceRelay ? 'relay' : 'all',
    });
    this.pc = pc;

    // One permanent two-way audio channel; the mic is attached/detached with replaceTrack.
    // Only the OFFERER creates the transceiver. The answerer must use the transceiver that comes
    // from the offer (see adoptOfferedTransceiver) — a second, locally-created one would never be
    // negotiated and the answerer's voice would silently never be sent.
    if (this.isInitiator) {
      const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      this.sender = transceiver.sender;
      const track = this.localStream?.getAudioTracks()[0];
      if (track) this.sender.replaceTrack(track).catch((err) => console.warn('replaceTrack failed:', err));
    }

    pc.ontrack = (event) => {
      this.ensureRemoteAudio();
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      if (this.remoteAudio) {
        this.remoteAudio.srcObject = stream;
        this.playRemote();
      }
      this.watchRemote(stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ type: 'candidate', sid: this.sid, candidate: event.candidate.toJSON() });
      }
    };

    // An ICE restart on a live connection does not fire connectionState 'connected' again,
    // so also watch the ICE state to leave 'reconnecting'.
    pc.oniceconnectionstatechange = () => {
      if (this.pc !== pc || !this.joined) return;
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.markConnectedIfLive(pc);
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.pc !== pc || !this.joined) return;
      const s = pc.connectionState;
      if (s === 'connected') {
        this.clearTimers();
        this.attempts = 0;
        this.everConnected = true;
        this.update({ state: 'connected' });
      } else if (s === 'disconnected') {
        this.update({ state: 'reconnecting' });
        if (this.graceTimer) clearTimeout(this.graceTimer);
        // Brief network blips often heal by themselves; recover if they do not.
        this.graceTimer = setTimeout(() => {
          if (this.pc === pc && !this.markConnectedIfLive(pc)) this.recover(false);
        }, DISCONNECT_GRACE_MS);
      } else if (s === 'failed') {
        this.recover(false);
      }
    };
  }

  private markConnectedIfLive(pc: RTCPeerConnection | null): boolean {
    if (!pc || this.pc !== pc || !this.joined) return false;
    const ice = pc.iceConnectionState;
    if (pc.connectionState === 'connected' && (ice === 'connected' || ice === 'completed')) {
      this.clearTimers();
      this.attempts = 0;
      this.everConnected = true;
      this.update({ state: 'connected' });
      return true;
    }
    return false;
  }

  /** Host only: new connection + new session id. */
  private buildPeerAsHost() {
    this.buildPeer();
    this.sid = uid();
  }

  private async makeOffer(iceRestart: boolean) {
    const pc = this.pc;
    if (!pc) return;
    if (!this.sid) this.sid = uid();
    this.lastOfferAt = Date.now();
    const offer = await pc.createOffer({ iceRestart });
    await pc.setLocalDescription(offer);
    this.sendSignal({ type: 'offer', sid: this.sid, offer: pc.localDescription ?? offer });
  }

  /** Answerer: make the offered audio m-line two-way and use its sender for our mic. */
  private async adoptOfferedTransceiver(pc: RTCPeerConnection) {
    const t = pc.getTransceivers().find((x) => x.receiver.track.kind === 'audio');
    if (!t) return;
    t.direction = 'sendrecv';
    this.sender = t.sender;
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      try {
        await t.sender.replaceTrack(track);
      } catch (err) {
        console.warn('replaceTrack failed:', err);
      }
    }
  }

  private async flushCandidates() {
    const pc = this.pc;
    if (!pc || !pc.remoteDescription) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch (err) {
        console.warn('addIceCandidate failed:', err);
      }
    }
  }

  private clearTimers() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.connectTimer = null;
    this.graceTimer = null;
  }

  private armConnectTimer() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      if (!this.joined || this.snapshot.state === 'connected') return;
      if (this.markConnectedIfLive(this.pc)) return;
      this.recover(this.attempts >= 1);
    }, CONNECT_TIMEOUT_MS);
  }

  /** Timeout / disconnected / failed -> retry. 'hard' rebuilds the connection from scratch. */
  private recover(hard: boolean) {
    if (!this.joined) return;
    this.attempts += 1;
    if (this.attempts > MAX_ATTEMPTS) {
      this.clearTimers();
      this.update({ state: 'error' });
      return;
    }
    this.update({ state: this.everConnected ? 'reconnecting' : 'connecting' });
    if (this.isInitiator) {
      if (hard || !this.pc) {
        this.buildPeerAsHost();
        this.makeOffer(false).catch((err) => console.warn('Offer failed:', err));
      } else {
        this.makeOffer(true).catch((err) => console.warn('ICE restart failed:', err));
      }
    } else {
      // Only the host creates offers: ask it to re-offer.
      this.sendSignal({ type: 'retry' });
    }
    this.armConnectTimer();
  }

  private async processSignal(signal: any) {
    if (this.joinPromise) await this.joinPromise;
    switch (signal?.type) {
      case 'ready':
        this.peerReady = true;
        if (!this.joined) return;
        if (this.isInitiator) {
          // The guest (re)joined. Ignore the duplicate 'ready' of the same handshake.
          if (Date.now() - this.lastOfferAt < 1500 && this.snapshot.state !== 'connected') return;
          await this.ensureIce();
          this.buildPeerAsHost();
          this.update({ state: this.everConnected ? 'reconnecting' : 'connecting' });
          await this.makeOffer(false);
          this.armConnectTimer();
        } else {
          // The host (re)joined: tell it we are here so it can offer.
          this.sendSignal({ type: 'ready' });
        }
        break;

      case 'retry':
        if (this.joined && this.isInitiator) this.recover(false);
        break;

      case 'bye':
        // The other player left. Wait cleanly for them to come back (no timers, no error).
        this.peerReady = false;
        this.clearTimers();
        this.attempts = 0;
        this.unwatch('remote');
        if (this.remoteAudio) this.remoteAudio.srcObject = null;
        if (this.joined) {
          this.buildPeer();
          this.sid = null;
          this.update({ state: 'connecting', remoteSpeaking: false });
        }
        break;

      case 'offer': {
        if (!this.joined || this.isInitiator) return;
        await this.ensureIce();
        const sameSession = this.pc && this.sid === signal.sid && this.pc.connectionState !== 'closed';
        if (!sameSession) {
          // New session from the host -> new connection. Same session (ICE restart) -> keep it alive.
          this.buildPeer();
          this.sid = signal.sid;
        }
        const pc = this.pc;
        if (!pc) return;
        await pc.setRemoteDescription(signal.offer);
        await this.adoptOfferedTransceiver(pc);
        await this.flushCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal({ type: 'answer', sid: this.sid, answer: pc.localDescription ?? answer });
        if (this.snapshot.state !== 'connected') this.armConnectTimer();
        break;
      }

      case 'answer':
        if (!this.pc || !this.isInitiator) return;
        if (signal.sid !== this.sid) return; // stale answer from a dead session
        if (this.pc.signalingState !== 'have-local-offer') return;
        await this.pc.setRemoteDescription(signal.answer);
        await this.flushCandidates();
        this.markConnectedIfLive(this.pc);
        break;

      case 'candidate':
        if (!this.pc || !signal.candidate) return;
        if (signal.sid && this.sid && signal.sid !== this.sid) return; // stale
        if (this.pc.remoteDescription) {
          try {
            await this.pc.addIceCandidate(signal.candidate);
          } catch (err) {
            console.warn('addIceCandidate failed:', err);
          }
        } else {
          this.pendingCandidates.push(signal.candidate);
        }
        break;
    }
  }

  // ---------- "speaking" indicators (local mic + remote audio levels) ----------

  private getCtx(): AudioContext | null {
    if (this.audioCtx) return this.audioCtx;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.audioCtx = new Ctor();
    } catch {
      return null;
    }
    return this.audioCtx;
  }

  private makeWatcher(stream: MediaStream): LevelWatcher | null {
    const ctx = this.getCtx();
    if (!ctx || stream.getAudioTracks().length === 0) return null;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser); // not connected to destination: analysis only, no echo
      return { source, analyser, buf: new Uint8Array(analyser.fftSize), lastLoud: 0 };
    } catch {
      return null;
    }
  }

  private watchLocal(stream: MediaStream) {
    this.unwatch('local');
    this.localWatch = this.makeWatcher(stream);
    this.startLevelTimer();
  }

  private watchRemote(stream: MediaStream) {
    this.unwatch('remote');
    this.remoteWatch = this.makeWatcher(stream);
    this.startLevelTimer();
  }

  private unwatch(which: 'local' | 'remote') {
    const w = which === 'local' ? this.localWatch : this.remoteWatch;
    if (w) {
      try {
        w.source.disconnect();
      } catch {}
    }
    if (which === 'local') this.localWatch = null;
    else this.remoteWatch = null;
  }

  private startLevelTimer() {
    if (this.levelTimer) return;
    this.levelTimer = setInterval(() => {
      const now = Date.now();
      const measure = (w: LevelWatcher | null) => {
        if (!w) return false;
        w.analyser.getByteTimeDomainData(w.buf as any);
        let sum = 0;
        for (let i = 0; i < w.buf.length; i++) {
          const v = (w.buf[i] - 128) / 128;
          sum += v * v;
        }
        if (Math.sqrt(sum / w.buf.length) > SPEAK_THRESHOLD) w.lastLoud = now;
        return now - w.lastLoud < SPEAK_HOLD_MS;
      };
      this.update({
        localSpeaking: this.snapshot.micOn && measure(this.localWatch),
        remoteSpeaking: measure(this.remoteWatch),
      });
    }, 120);
  }
}

export const liveVoiceManager = new WebRTCAudioManager();

/** React hook: live voice state (connection, mic on/off, who is speaking). */
export function useVoiceChat(): VoiceSnapshot {
  return useSyncExternalStore(liveVoiceManager.subscribe, liveVoiceManager.getSnapshot);
}
