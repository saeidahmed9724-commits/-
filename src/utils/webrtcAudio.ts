// Voice Engine — WebRTC peer-to-peer live voice chat for every ONLINE room (2, 3 or 4 players).
//
// One engine, one infrastructure: a full mesh with ONE RTCPeerConnection per pair of players.
// (2 players = 1 connection, 3 = 3, 4 = 6.) It is completely separate from the Game Engine:
// nothing about turns, questions, answers, cards, scores or rounds ever touches the microphone.
// The mic keeps the last state the player chose until the player changes it, or the room ends.
// The same-device mode never uses this engine at all.
//
//   join(selfId) + setPeers(ids): enter the room's voice channel. Everyone can HEAR everyone
//                      immediately; the player's own mic stays OFF until they open it.
//   startMic()/stopMic(): open/close only the player's own mic. Uses replaceTrack() on the
//                      EXISTING connections — no new connection, no renegotiation.
//   stop():            room ended / player left: stop tracks, close every connection, free all.
//
// Signaling goes through the game server, which never carries audio. Per pair, the player with
// the smaller id is the offerer (deterministic, so there is never offer "glare"):
//   offerer: createOffer -> setLocalDescription -> send offer
//   answerer: setRemoteDescription -> createAnswer -> setLocalDescription -> send answer
//   offerer: setRemoteDescription        (+ ICE candidates both ways)
// Messages carry a per-connection session id (sid) so stale messages are ignored, and an
// ICE-restart offer reuses the answerer's live connection.
//
// Recovery (per pair): connect timeout -> retry; 'disconnected'/'failed' -> ICE restart; repeated
// failure -> full rebuild; after MAX_ATTEMPTS that pair is 'error' and the UI offers a retry.
//
// ICE servers (STUN + TURN) come from the backend (/api/ice-servers) so TURN secrets never ship
// in the frontend bundle. Add ?relay=1 to the page URL to force TURN-only (to test the relay).

import { useSyncExternalStore } from 'react';

export type VoiceState = 'disconnected' | 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type MicResult = 'ok' | 'denied' | 'unsupported' | 'error';

export interface PeerVoice {
  state: VoiceState;
  /** The other player's mic is open (they told us over signaling). */
  mic: boolean;
  /** The other player is actually talking right now (measured on the received audio). */
  speaking: boolean;
}

export interface VoiceSnapshot {
  /** Overall status: 'waiting' = nobody else is in the voice channel yet. */
  state: VoiceState;
  micOn: boolean;
  localSpeaking: boolean;
  remoteSpeaking: boolean;
  peers: Record<string, PeerVoice>;
  peerCount: number;
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

/** Everything about the connection with ONE other player. */
class PeerLink {
  pc: RTCPeerConnection | null = null;
  sender: RTCRtpSender | null = null;
  sid: string | null = null;
  pending: RTCIceCandidateInit[] = [];
  state: VoiceState = 'waiting';
  attempts = 0;
  everConnected = false;
  peerReady = false;
  lastOfferAt = 0;
  connectTimer: ReturnType<typeof setTimeout> | null = null;
  graceTimer: ReturnType<typeof setTimeout> | null = null;
  audioEl: HTMLAudioElement | null = null;
  watch: LevelWatcher | null = null;
  remoteMic = false;
  speaking = false;
  chain: Promise<void> = Promise.resolve();
  constructor(public id: string, public initiator: boolean) {}
}

export class VoiceEngine {
  private selfId: string | null = null;
  private joined = false;
  private joinPromise: Promise<void> | null = null;
  private links = new Map<string, PeerLink>();
  private desiredPeers: string[] = [];
  private earlyReady = new Set<string>();
  private onSignalCallback?: (toId: string, signal: any) => void;

  private localStream: MediaStream | null = null;
  private micPending = false;

  private iceServers: RTCIceServer[] = FALLBACK_ICE;
  private iceFetchedAt = 0;

  private audioCtx: AudioContext | null = null;
  private localWatch: LevelWatcher | null = null;
  private localSpeaking = false;
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  private gestureArmed = false;

  private listeners = new Set<() => void>();
  private snapshotKey = '';
  private snapshot: VoiceSnapshot = {
    state: 'disconnected',
    micOn: false,
    localSpeaking: false,
    remoteSpeaking: false,
    peers: {},
    peerCount: 0,
  };

  // ---------- public API ----------

  /** Where outgoing signaling messages go: (toPlayerId, signal). */
  setSignalCallback(cb: (toId: string, signal: any) => void) {
    this.onSignalCallback = cb;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): VoiceSnapshot => this.snapshot;
  getState = (): VoiceState => this.snapshot.state;
  isActive = (): boolean => this.joined;
  isMicOn = (): boolean => this.localStream !== null;
  getSelfId = (): string | null => this.selfId;

  /** Join the room's voice channel as `selfId` (no mic needed). Safe to call more than once. */
  join(selfId: string): Promise<void> {
    if (this.joined && this.selfId === selfId) return this.joinPromise ?? Promise.resolve();
    if (this.joined) this.stop(); // different identity (e.g. new room): start clean
    this.joined = true;
    this.selfId = selfId;
    this.armGestureUnlock();
    this.publish();
    this.joinPromise = (async () => {
      try {
        await this.ensureIce();
        if (!this.joined) return;
        this.syncLinks();
      } catch (err) {
        console.warn('Voice join error:', err);
      }
    })();
    return this.joinPromise;
  }

  /** The other players currently in the room (add/remove connections as players come and go). */
  setPeers(ids: string[]) {
    this.desiredPeers = ids.filter((id) => id !== this.selfId);
    if (this.joined && !this.joinPromiseStillPending()) this.syncLinks();
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
        stream.getTracks().forEach((t) => t.stop()); // room ended while the prompt was open
        return 'error';
      }
      this.localStream = stream;
      const track = stream.getAudioTracks()[0];
      track.onended = () => {
        if (this.localStream === stream) this.stopMic(); // OS/browser killed the mic: don't lie
      };
      await Promise.all(
        [...this.links.values()].map((l) => l.sender?.replaceTrack(track).catch((e) => console.warn('replaceTrack failed:', e)))
      );
      this.watchLocal(stream);
      this.resumeAudio();
      this.broadcast({ type: 'mic', on: true });
      this.publish();
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

  /** Close only this player's mic. Connections stay alive: they keep hearing everyone. */
  stopMic() {
    const had = this.localStream !== null;
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      this.localStream = null;
    }
    this.links.forEach((l) => l.sender?.replaceTrack(null).catch(() => {}));
    this.unwatchLocal();
    this.localSpeaking = false;
    if (had) this.broadcast({ type: 'mic', on: false });
    this.publish();
  }

  /** Manual retry for every connection that is not working. */
  retry() {
    if (!this.joined) return;
    this.links.forEach((l) => {
      if (l.state === 'connected') return;
      l.attempts = 0;
      if (l.initiator) {
        this.recover(l, true);
      } else {
        this.buildPeer(l);
        this.send(l, { type: 'ready' });
      }
    });
  }

  /** Room ended / player left: free the mic, every connection and every listener. */
  stop() {
    if (this.joined) this.broadcast({ type: 'bye' });
    this.joined = false;
    this.joinPromise = null;
    this.selfId = null;
    this.desiredPeers = [];
    this.earlyReady.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      this.localStream = null;
    }
    [...this.links.values()].forEach((l) => this.destroyLink(l));
    this.links.clear();
    this.unwatchLocal();
    this.localSpeaking = false;
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.publish();
  }

  /** Incoming signaling message from player `fromId` (relayed by the server). */
  handleSignal(fromId: string, signal: any): Promise<void> {
    const link = this.links.get(fromId);
    if (!link) {
      // Their 'ready' can arrive before we know about them: remember it.
      if (signal?.type === 'ready') this.earlyReady.add(fromId);
      if (signal?.type === 'bye') this.earlyReady.delete(fromId);
      return Promise.resolve();
    }
    // Serialize per pair: offer/answer/candidate handling is async and must not interleave.
    link.chain = link.chain
      .then(() => this.processSignal(link, signal))
      .catch((err) => console.warn('Voice signal error:', err));
    return link.chain;
  }

  // ---------- links (one per other player) ----------

  private joinPromiseStillPending() {
    return this.iceFetchedAt === 0;
  }

  private syncLinks() {
    if (!this.joined || !this.selfId) return;
    const want = new Set(this.desiredPeers);
    [...this.links.keys()].forEach((id) => {
      if (!want.has(id)) {
        const l = this.links.get(id)!;
        this.destroyLink(l);
        this.links.delete(id);
      }
    });
    want.forEach((id) => {
      if (this.links.has(id)) return;
      const link = new PeerLink(id, this.selfId! < id);
      link.peerReady = this.earlyReady.has(id);
      this.links.set(id, link);
      this.buildPeer(link);
      this.send(link, { type: 'ready' });
      if (link.peerReady) {
        this.setLinkState(link, 'connecting');
        if (link.initiator) this.beginOffer(link).catch((e) => console.warn('Offer failed:', e));
      }
    });
    this.publish();
  }

  private destroyLink(l: PeerLink) {
    this.clearTimers(l);
    this.closePeer(l);
    if (l.watch) {
      try {
        l.watch.source.disconnect();
      } catch {}
      l.watch = null;
    }
    if (l.audioEl) {
      l.audioEl.srcObject = null;
      l.audioEl.remove();
      l.audioEl = null;
    }
  }

  private send(l: PeerLink, signal: any) {
    try {
      this.onSignalCallback?.(l.id, signal);
    } catch (err) {
      console.warn('Voice signal send failed:', err);
    }
  }

  private broadcast(signal: any) {
    this.links.forEach((l) => this.send(l, signal));
  }

  private setLinkState(l: PeerLink, state: VoiceState) {
    if (l.state === state) return;
    l.state = state;
    this.publish();
  }

  // ---------- ICE servers ----------

  private async ensureIce() {
    if (Date.now() - this.iceFetchedAt < ICE_CACHE_MS && this.iceFetchedAt !== 0) return;
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

  // ---------- audio output ----------

  private ensureAudioEl(l: PeerLink) {
    if (l.audioEl) return l.audioEl;
    const el = document.createElement('audio');
    el.autoplay = true;
    (el as any).playsInline = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    l.audioEl = el;
    return el;
  }

  private playRemote(l: PeerLink) {
    l.audioEl?.play().catch(() => this.armGestureUnlock());
  }

  /** Browsers block autoplay / AudioContext until a user gesture: unlock on the next tap. */
  private armGestureUnlock() {
    if (this.gestureArmed) return;
    this.gestureArmed = true;
    const unlock = () => {
      this.gestureArmed = false;
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      this.links.forEach((l) => l.audioEl?.play().catch(() => {}));
      this.resumeAudio();
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
  }

  private resumeAudio() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
  }

  // ---------- RTCPeerConnection per pair ----------

  private closePeer(l: PeerLink) {
    if (l.pc) {
      l.pc.onicecandidate = null;
      l.pc.ontrack = null;
      l.pc.onconnectionstatechange = null;
      l.pc.oniceconnectionstatechange = null;
      l.pc.close();
      l.pc = null;
    }
    l.sender = null;
    l.pending = [];
  }

  /** Create a fresh RTCPeerConnection for this pair (the only place one is created). */
  private buildPeer(l: PeerLink) {
    this.closePeer(l);
    const forceRelay = typeof location !== 'undefined' && new URLSearchParams(location.search).get('relay') === '1';
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: forceRelay ? 'relay' : 'all',
    });
    l.pc = pc;

    // Only the OFFERER creates the transceiver. The answerer must use the one that comes from
    // the offer (adoptOfferedTransceiver): a second, locally-created one would never be
    // negotiated and the answerer's voice would silently never be sent.
    if (l.initiator) {
      const t = pc.addTransceiver('audio', { direction: 'sendrecv' });
      l.sender = t.sender;
      const track = this.localStream?.getAudioTracks()[0];
      if (track) l.sender.replaceTrack(track).catch((e) => console.warn('replaceTrack failed:', e));
    }

    pc.ontrack = (event) => {
      const el = this.ensureAudioEl(l);
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      el.srcObject = stream;
      this.playRemote(l);
      this.watchRemote(l, stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) this.send(l, { type: 'candidate', sid: l.sid, candidate: event.candidate.toJSON() });
    };

    // An ICE restart on a live connection does not fire connectionState 'connected' again,
    // so also watch the ICE state to leave 'reconnecting'.
    pc.oniceconnectionstatechange = () => {
      if (l.pc !== pc || !this.joined) return;
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') this.markConnectedIfLive(l, pc);
    };

    pc.onconnectionstatechange = () => {
      if (l.pc !== pc || !this.joined) return;
      const s = pc.connectionState;
      if (s === 'connected') {
        this.markConnectedIfLive(l, pc) || this.finishConnected(l);
      } else if (s === 'disconnected') {
        this.setLinkState(l, 'reconnecting');
        if (l.graceTimer) clearTimeout(l.graceTimer);
        // Brief network blips often heal by themselves; recover if they do not.
        l.graceTimer = setTimeout(() => {
          if (l.pc === pc && !this.markConnectedIfLive(l, pc)) this.recover(l, false);
        }, DISCONNECT_GRACE_MS);
      } else if (s === 'failed') {
        this.recover(l, false);
      }
    };
  }

  private finishConnected(l: PeerLink) {
    this.clearTimers(l);
    l.attempts = 0;
    l.everConnected = true;
    this.setLinkState(l, 'connected');
    // New/restored connection: let them know whether our mic is open.
    this.send(l, { type: 'mic', on: this.localStream !== null });
  }

  private markConnectedIfLive(l: PeerLink, pc: RTCPeerConnection | null): boolean {
    if (!pc || l.pc !== pc || !this.joined) return false;
    const ice = pc.iceConnectionState;
    if (pc.connectionState === 'connected' && (ice === 'connected' || ice === 'completed')) {
      if (l.state !== 'connected') this.finishConnected(l);
      return true;
    }
    return false;
  }

  /** Offerer only: new connection + new session id, then offer. */
  private async beginOffer(l: PeerLink) {
    await this.ensureIce();
    this.buildPeer(l);
    l.sid = uid();
    await this.makeOffer(l, false);
    this.armConnectTimer(l);
  }

  private async makeOffer(l: PeerLink, iceRestart: boolean) {
    const pc = l.pc;
    if (!pc) return;
    if (!l.sid) l.sid = uid();
    l.lastOfferAt = Date.now();
    const offer = await pc.createOffer({ iceRestart });
    await pc.setLocalDescription(offer);
    this.send(l, { type: 'offer', sid: l.sid, offer: pc.localDescription ?? offer });
  }

  /** Answerer: make the offered audio m-line two-way and use its sender for our mic. */
  private async adoptOfferedTransceiver(l: PeerLink, pc: RTCPeerConnection) {
    const t = pc.getTransceivers().find((x) => x.receiver.track.kind === 'audio');
    if (!t) return;
    t.direction = 'sendrecv';
    l.sender = t.sender;
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      try {
        await t.sender.replaceTrack(track);
      } catch (err) {
        console.warn('replaceTrack failed:', err);
      }
    }
  }

  private async flushCandidates(l: PeerLink) {
    const pc = l.pc;
    if (!pc || !pc.remoteDescription) return;
    const queued = l.pending;
    l.pending = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch (err) {
        console.warn('addIceCandidate failed:', err);
      }
    }
  }

  private clearTimers(l: PeerLink) {
    if (l.connectTimer) clearTimeout(l.connectTimer);
    if (l.graceTimer) clearTimeout(l.graceTimer);
    l.connectTimer = null;
    l.graceTimer = null;
  }

  private armConnectTimer(l: PeerLink) {
    if (l.connectTimer) clearTimeout(l.connectTimer);
    l.connectTimer = setTimeout(() => {
      if (!this.joined || l.state === 'connected' || !l.peerReady) return;
      if (this.markConnectedIfLive(l, l.pc)) return;
      this.recover(l, l.attempts >= 1);
    }, CONNECT_TIMEOUT_MS);
  }

  /** Timeout / disconnected / failed -> retry. 'hard' rebuilds the connection from scratch. */
  private recover(l: PeerLink, hard: boolean) {
    if (!this.joined) return;
    l.attempts += 1;
    if (l.attempts > MAX_ATTEMPTS) {
      this.clearTimers(l);
      this.setLinkState(l, 'error');
      return;
    }
    this.setLinkState(l, l.everConnected ? 'reconnecting' : 'connecting');
    if (l.initiator) {
      if (hard || !l.pc) {
        this.buildPeer(l);
        l.sid = uid();
        this.makeOffer(l, false).catch((e) => console.warn('Offer failed:', e));
      } else {
        this.makeOffer(l, true).catch((e) => console.warn('ICE restart failed:', e));
      }
    } else {
      this.send(l, { type: 'retry' }); // only the offerer creates offers: ask it to re-offer
    }
    this.armConnectTimer(l);
  }

  private async processSignal(l: PeerLink, signal: any) {
    if (this.joinPromise) await this.joinPromise;
    if (!this.joined || this.links.get(l.id) !== l) return;
    switch (signal?.type) {
      case 'ready':
        l.peerReady = true;
        if (l.state === 'waiting') this.setLinkState(l, 'connecting');
        if (l.initiator) {
          // Ignore the duplicate 'ready' of the same handshake.
          if (Date.now() - l.lastOfferAt < 1500 && l.state !== 'connected') return;
          if (l.everConnected) this.setLinkState(l, 'reconnecting');
          await this.beginOffer(l);
        } else {
          this.send(l, { type: 'ready' }); // tell the offerer we are here
        }
        break;

      case 'retry':
        if (l.initiator) this.recover(l, false);
        break;

      case 'mic':
        l.remoteMic = Boolean(signal.on);
        this.publish();
        break;

      case 'bye':
        // They left: wait cleanly for them to come back (no timers, no error).
        l.peerReady = false;
        l.attempts = 0;
        l.remoteMic = false;
        l.speaking = false;
        this.clearTimers(l);
        if (l.watch) {
          try {
            l.watch.source.disconnect();
          } catch {}
          l.watch = null;
        }
        if (l.audioEl) l.audioEl.srcObject = null;
        this.buildPeer(l);
        l.sid = null;
        this.setLinkState(l, 'waiting');
        this.publish();
        break;

      case 'offer': {
        if (l.initiator) return; // we are the offerer for this pair
        l.peerReady = true;
        await this.ensureIce();
        const same = l.pc && l.sid === signal.sid && l.pc.connectionState !== 'closed';
        if (!same) {
          // New session -> new connection. Same session (ICE restart) -> keep it alive.
          this.buildPeer(l);
          l.sid = signal.sid;
        }
        const pc = l.pc;
        if (!pc) return;
        if (l.state === 'waiting') this.setLinkState(l, 'connecting');
        await pc.setRemoteDescription(signal.offer);
        await this.adoptOfferedTransceiver(l, pc);
        await this.flushCandidates(l);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send(l, { type: 'answer', sid: l.sid, answer: pc.localDescription ?? answer });
        if (l.state !== 'connected') this.armConnectTimer(l);
        break;
      }

      case 'answer':
        if (!l.pc || !l.initiator) return;
        if (signal.sid !== l.sid) return; // stale answer from a dead session
        if (l.pc.signalingState !== 'have-local-offer') return;
        await l.pc.setRemoteDescription(signal.answer);
        await this.flushCandidates(l);
        this.markConnectedIfLive(l, l.pc);
        break;

      case 'candidate':
        if (!l.pc || !signal.candidate) return;
        if (signal.sid && l.sid && signal.sid !== l.sid) return; // stale
        if (l.pc.remoteDescription) {
          try {
            await l.pc.addIceCandidate(signal.candidate);
          } catch (err) {
            console.warn('addIceCandidate failed:', err);
          }
        } else {
          l.pending.push(signal.candidate);
        }
        break;
    }
  }

  // ---------- "speaking" indicators (local mic + each remote player) ----------

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
      source.connect(analyser); // analysis only, not connected to destination: no echo
      return { source, analyser, buf: new Uint8Array(analyser.fftSize), lastLoud: 0 };
    } catch {
      return null;
    }
  }

  private watchLocal(stream: MediaStream) {
    this.unwatchLocal();
    this.localWatch = this.makeWatcher(stream);
    this.startLevelTimer();
  }

  private unwatchLocal() {
    if (this.localWatch) {
      try {
        this.localWatch.source.disconnect();
      } catch {}
      this.localWatch = null;
    }
  }

  private watchRemote(l: PeerLink, stream: MediaStream) {
    if (l.watch) {
      try {
        l.watch.source.disconnect();
      } catch {}
    }
    l.watch = this.makeWatcher(stream);
    this.startLevelTimer();
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
      this.localSpeaking = this.localStream !== null && measure(this.localWatch);
      this.links.forEach((l) => {
        l.speaking = measure(l.watch);
      });
      this.publish();
    }, 120);
  }

  // ---------- snapshot for the UI ----------

  private publish() {
    const peers: Record<string, PeerVoice> = {};
    let total = 0;
    let connected = 0;
    let errored = 0;
    let reconnecting = false;
    let anySpeaking = false;
    this.links.forEach((l) => {
      peers[l.id] = { state: l.state, mic: l.remoteMic, speaking: l.speaking };
      if (l.speaking) anySpeaking = true;
      if (l.state === 'waiting') return; // that player is not in the voice channel (yet)
      total += 1;
      if (l.state === 'connected') connected += 1;
      else if (l.state === 'error') errored += 1;
      else if (l.state === 'reconnecting') reconnecting = true;
    });

    let state: VoiceState;
    if (!this.joined) state = 'disconnected';
    else if (total === 0) state = 'waiting';
    else if (connected === total) state = 'connected';
    else if (errored > 0 && errored === total - connected) state = 'error';
    else if (reconnecting) state = 'reconnecting';
    else state = 'connecting';

    const next: VoiceSnapshot = {
      state,
      micOn: this.localStream !== null,
      localSpeaking: this.localSpeaking,
      remoteSpeaking: anySpeaking,
      peers,
      peerCount: this.links.size,
    };
    const key = JSON.stringify(next);
    if (key === this.snapshotKey) return;
    this.snapshotKey = key;
    this.snapshot = next;
    this.listeners.forEach((fn) => fn());
  }
}

export const liveVoiceManager = new VoiceEngine();

/** React hook: live voice state (connections, mic on/off, who is speaking). */
export function useVoiceChat(): VoiceSnapshot {
  return useSyncExternalStore(liveVoiceManager.subscribe, liveVoiceManager.getSnapshot);
}
