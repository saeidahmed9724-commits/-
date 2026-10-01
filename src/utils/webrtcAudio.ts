// WebRTC Peer-to-Peer Live Voice Chat Manager
//
// Model: the voice connection and the microphone are independent.
//   - join():     connects the two players' audio channel as soon as both are in the room.
//                 Everyone can HEAR the opponent immediately, even with their own mic closed.
//   - startMic() / stopMic(): each player opens/closes their own mic whenever they want.
//                 It only swaps the audio track on the existing connection (replaceTrack),
//                 so there is no renegotiation and both sides can talk at the same time.
//   - stop():     leaves the voice channel (mic off + connection closed).
//
// Handshake:
//   - Each side sends { type: 'ready' } when it joins; the host creates the offer once the
//     guest is ready (the host remembers 'ready' even if it has not joined yet).
//   - { type: 'bye' } on leave makes the other side reset to a clean connection.
//   - ICE candidates that arrive before the remote description are queued.
//
// Optional TURN relay (needed when players are on different mobile networks / CGNAT):
//   VITE_TURN_URL        e.g. "turn:global.relay.metered.ca:80,turns:global.relay.metered.ca:443?transport=tcp"
//   VITE_TURN_USERNAME
//   VITE_TURN_CREDENTIAL

export type VoiceState = 'disconnected' | 'connecting' | 'connected' | 'error';

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;
  if (env.VITE_TURN_URL) {
    servers.push({
      urls: env.VITE_TURN_URL.split(',').map((u) => u.trim()).filter(Boolean),
      username: env.VITE_TURN_USERNAME,
      credential: env.VITE_TURN_CREDENTIAL,
    });
  }
  return servers;
}

export class WebRTCAudioManager {
  private pc: RTCPeerConnection | null = null;
  private sender: RTCRtpSender | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private onSignalCallback?: (signal: any) => void;
  private onStateChangeCallback?: (state: VoiceState) => void;
  private joined = false;
  private isInitiator = false;
  private peerReady = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private playRetryArmed = false;
  private state: VoiceState = 'disconnected';

  setSignalCallback(cb: (signal: any) => void) {
    this.onSignalCallback = cb;
  }

  setStateChangeCallback(cb: (state: VoiceState) => void) {
    this.onStateChangeCallback = cb;
  }

  /** True while this player is part of the voice channel (mic may still be closed). */
  isActive(): boolean {
    return this.joined;
  }

  isMicOn(): boolean {
    return this.localStream !== null;
  }

  getState(): VoiceState {
    return this.state;
  }

  private setState(state: VoiceState) {
    this.state = state;
    this.onStateChangeCallback?.(state);
  }

  private sendSignal(signal: any) {
    try {
      this.onSignalCallback?.(signal);
    } catch (err) {
      console.warn('WebRTC signal send failed:', err);
    }
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
    const el = this.remoteAudio;
    if (!el) return;
    el.play().catch(() => {
      // Autoplay was blocked: retry on the next tap/click anywhere.
      if (this.playRetryArmed) return;
      this.playRetryArmed = true;
      const retry = () => {
        this.playRetryArmed = false;
        document.removeEventListener('click', retry);
        document.removeEventListener('touchstart', retry);
        el.play().catch(() => {});
      };
      document.addEventListener('click', retry);
      document.addEventListener('touchstart', retry);
    });
  }

  private closePeer() {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.sender = null;
    this.pendingCandidates = [];
  }

  private createPeer() {
    this.closePeer();

    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    this.pc = pc;

    // One permanent two-way audio channel. The mic is attached/detached later with replaceTrack.
    const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
    this.sender = transceiver.sender;
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      this.sender.replaceTrack(track).catch((err) => console.warn('replaceTrack failed:', err));
    }

    pc.ontrack = (event) => {
      this.ensureRemoteAudio();
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      if (this.remoteAudio) {
        this.remoteAudio.srcObject = stream;
        this.playRemote();
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ type: 'candidate', candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.pc !== pc || !this.joined) return;
      const s = pc.connectionState;
      if (s === 'connected') {
        this.setState('connected');
      } else if (s === 'disconnected') {
        this.setState('connecting');
      } else if (s === 'failed') {
        this.setState('error');
        if (this.isInitiator) {
          this.makeOffer(true).catch((err) => console.warn('ICE restart failed:', err));
        }
      }
    };
  }

  private async makeOffer(iceRestart = false) {
    const pc = this.pc;
    if (!pc) return;
    const offer = await pc.createOffer({ iceRestart });
    await pc.setLocalDescription(offer);
    this.sendSignal({ type: 'offer', offer: pc.localDescription ?? offer });
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

  /** Join the room's voice channel (no mic needed). Safe to call more than once. */
  async join(isInitiator: boolean): Promise<void> {
    if (this.joined) return;
    try {
      this.isInitiator = isInitiator;
      this.joined = true;
      this.ensureRemoteAudio();
      this.createPeer();
      this.setState('connecting');
      this.sendSignal({ type: 'ready' });
      if (this.isInitiator && this.peerReady) {
        await this.makeOffer();
      }
    } catch (err) {
      console.warn('WebRTC join error:', err);
      this.stop();
      this.setState('error');
    }
  }

  /** Open this player's own mic. Does not affect what the opponent can do. */
  async startMic(): Promise<boolean> {
    if (!this.joined) return false;
    if (this.localStream) return true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia is unavailable (needs HTTPS and a supported browser)');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!this.joined) {
        // Left the room while the permission prompt was open.
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      this.localStream = stream;
      await this.sender?.replaceTrack(stream.getAudioTracks()[0]);
      return true;
    } catch (err) {
      console.warn('Microphone start error:', err);
      return false;
    }
  }

  /** Close this player's own mic but stay connected so the opponent can still be heard. */
  stopMic() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.sender?.replaceTrack(null).catch(() => {});
  }

  async handleSignal(signal: any) {
    try {
      switch (signal?.type) {
        case 'ready':
          this.peerReady = true;
          if (this.joined && this.isInitiator) {
            // The guest (re)joined: build a fresh connection and offer.
            this.createPeer();
            this.setState('connecting');
            await this.makeOffer();
          }
          break;

        case 'bye':
          this.peerReady = false;
          if (this.remoteAudio) this.remoteAudio.srcObject = null;
          if (this.joined) {
            this.createPeer();
            this.setState('connecting');
          }
          break;

        case 'offer': {
          if (!this.joined) return;
          // A fresh connection per offer keeps renegotiation simple and reliable.
          this.createPeer();
          const pc = this.pc;
          if (!pc) return;
          await pc.setRemoteDescription(signal.offer);
          await this.flushCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignal({ type: 'answer', answer: pc.localDescription ?? answer });
          break;
        }

        case 'answer':
          if (!this.pc || this.pc.signalingState !== 'have-local-offer') return;
          await this.pc.setRemoteDescription(signal.answer);
          await this.flushCandidates();
          break;

        case 'candidate':
          if (!this.pc || !signal.candidate) return;
          if (this.pc.remoteDescription) {
            await this.pc.addIceCandidate(signal.candidate);
          } else {
            this.pendingCandidates.push(signal.candidate);
          }
          break;
      }
    } catch (err) {
      console.warn('Error handling WebRTC signal:', err);
    }
  }

  /** Leave the voice channel: mic off, connection closed. */
  stop() {
    const wasJoined = this.joined;
    if (wasJoined) this.sendSignal({ type: 'bye' });
    this.joined = false;
    this.peerReady = false;
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.closePeer();
    if (this.remoteAudio) this.remoteAudio.srcObject = null;
    this.setState('disconnected');
  }
}

export const liveVoiceManager = new WebRTCAudioManager();
