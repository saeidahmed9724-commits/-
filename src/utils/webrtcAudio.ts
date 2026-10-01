// WebRTC Peer-to-Peer Live Voice Chat Manager
//
// Handshake (works no matter which player opens the mic first):
//   - Every side that opens its mic sends { type: 'ready' } to the opponent.
//   - The host is always the one who creates the offer, but only once the guest
//     has announced 'ready' (the host remembers it even if its own mic is still off).
//   - When a side closes its mic it sends { type: 'bye' } so the other side
//     resets to a clean connection and can renegotiate the next time.
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
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private onSignalCallback?: (signal: any) => void;
  private onStateChangeCallback?: (state: VoiceState) => void;
  private isMuted = false;
  private active = false;
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

  isActive(): boolean {
    return this.active;
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

  // Created lazily so it is born inside the user's click (needed by iOS/Safari autoplay rules).
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

  private createPeer() {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
    }
    this.pendingCandidates = [];

    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    this.pc = pc;

    this.localStream?.getAudioTracks().forEach((track) => {
      pc.addTrack(track, this.localStream as MediaStream);
    });

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
      if (this.pc !== pc || !this.active) return;
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

  async start(isInitiator: boolean): Promise<boolean> {
    // Always begin from a clean slate (e.g. a mic left on from a previous match).
    this.releaseLocal();
    try {
      this.setState('connecting');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia is unavailable (needs HTTPS and a supported browser)');
      }
      this.ensureRemoteAudio();
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.isInitiator = isInitiator;
      this.isMuted = false;
      this.active = true;
      this.createPeer();

      // Tell the opponent we are here; the host offers as soon as the guest is ready.
      this.sendSignal({ type: 'ready' });
      if (this.isInitiator && this.peerReady) {
        await this.makeOffer();
      }
      return true;
    } catch (err) {
      console.warn('WebRTC audio start error:', err);
      this.releaseLocal();
      this.setState('error');
      return false;
    }
  }

  async handleSignal(signal: any) {
    try {
      switch (signal?.type) {
        case 'ready':
          this.peerReady = true;
          if (this.active && this.isInitiator) {
            // The guest (re)opened its mic: build a fresh connection and offer.
            this.createPeer();
            this.setState('connecting');
            await this.makeOffer();
          }
          break;

        case 'bye':
          this.peerReady = false;
          if (this.remoteAudio) this.remoteAudio.srcObject = null;
          if (this.active) {
            this.createPeer();
            this.setState('connecting');
          }
          break;

        case 'offer': {
          if (!this.active) return;
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

  toggleMute(): boolean {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
    return this.isMuted;
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  private releaseLocal() {
    this.active = false;
    this.pendingCandidates = [];
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
    }
  }

  stop() {
    const wasActive = this.active;
    if (wasActive) this.sendSignal({ type: 'bye' });
    this.releaseLocal();
    this.setState('disconnected');
  }
}

export const liveVoiceManager = new WebRTCAudioManager();
