// Single Unified WebRTC Mesh Voice Engine for ALL Online Game Modes (2, 3, 4 Players)
// Independent from Game Logic and Turns

export interface PeerVoiceState {
  playerId: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
}

export type VoiceStateListener = (state: {
  isMicOn: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  error: string | null;
  peers: Record<string, PeerVoiceState>;
}) => void;

class UnifiedVoiceEngine {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private remoteAudios: Map<string, HTMLAudioElement> = new Map();

  private myPlayerId: string = '';
  private roomCode: string = '';
  private isOnlineActive: boolean = false;

  private isMicOn: boolean = false;
  private isSpeaking: boolean = false;
  private isConnecting: boolean = false;
  private error: string | null = null;
  private peerStates: Record<string, PeerVoiceState> = {};

  private listeners: Set<VoiceStateListener> = new Set();
  private sendSignalCallback?: (signalPayload: any) => void;
  private sendStatusCallback?: (statusPayload: { isMuted: boolean; isSpeaking: boolean }) => void;

  private lastSpeakingBroadcast: number = 0;

  getSnapshot() {
    return {
      isMicOn: this.isMicOn,
      isSpeaking: this.isSpeaking,
      isConnecting: this.isConnecting,
      error: this.error,
      peers: { ...this.peerStates },
    };
  }

  subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((l) => l(snapshot));
  }

  setCallbacks(
    sendSignal: (signalPayload: any) => void,
    sendStatus: (statusPayload: { isMuted: boolean; isSpeaking: boolean }) => void
  ) {
    this.sendSignalCallback = sendSignal;
    this.sendStatusCallback = sendStatus;
  }

  // Initialize for an online room
  initRoom(myPlayerId: string, roomCode: string) {
    if (this.isOnlineActive && this.myPlayerId === myPlayerId && this.roomCode === roomCode) {
      return; // Already initialized for this room!
    }
    this.destroy(); // cleanup any prior session
    this.myPlayerId = myPlayerId;
    this.roomCode = roomCode;
    this.isOnlineActive = true;
    this.isMicOn = false;
    this.isSpeaking = false;
    this.error = null;
    this.emit();
  }

  // Ensure local audio stream is acquired
  private async getLocalStream(): Promise<MediaStream | null> {
    if (this.localStream && this.localStream.active) {
      return this.localStream;
    }

    try {
      this.isConnecting = true;
      this.emit();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.localStream = stream;
      // Start muted initially until player actively turns it on
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = this.isMicOn;
      });

      this.setupVAD(stream);
      this.isConnecting = false;
      this.error = null;
      return stream;
    } catch (err: any) {
      console.warn('Microphone permission or hardware error:', err);
      this.isConnecting = false;
      this.error = 'Microphone permission denied or unavailable';
      this.isMicOn = false;
      this.emit();
      return null;
    }
  }

  // Voice Activity Detection (VAD) via AudioContext
  private setupVAD(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!this.analyser || !this.isMicOn) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.emit();
            this.broadcastStatus(true, false);
          }
          this.animFrameId = requestAnimationFrame(checkAudioLevel);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const nowSpeaking = avg > 14;

        if (nowSpeaking !== this.isSpeaking) {
          this.isSpeaking = nowSpeaking;
          this.emit();
        }

        const now = Date.now();
        if (now - this.lastSpeakingBroadcast > 350) {
          this.lastSpeakingBroadcast = now;
          this.broadcastStatus(!this.isMicOn, this.isSpeaking);
        }

        this.animFrameId = requestAnimationFrame(checkAudioLevel);
      };

      this.animFrameId = requestAnimationFrame(checkAudioLevel);
    } catch (e) {
      console.warn('VAD setup failed:', e);
    }
  }

  // Connect to a new peer in the room
  async connectToPeer(remotePlayerId: string, isInitiator: boolean) {
    if (!this.isOnlineActive || remotePlayerId === this.myPlayerId) return;
    if (this.peers.has(remotePlayerId)) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      this.peers.set(remotePlayerId, pc);

      // Add local audio tracks if we have stream
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, this.localStream!);
        });
      }

      // Handle remote incoming audio
      pc.ontrack = (event) => {
        let audioEl = this.remoteAudios.get(remotePlayerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          this.remoteAudios.set(remotePlayerId, audioEl);
        }
        if (event.streams && event.streams[0]) {
          audioEl.srcObject = event.streams[0];
          audioEl.play().catch(() => {});
        }
      };

      // Send ICE candidates to specific peer
      pc.onicecandidate = (event) => {
        if (event.candidate && this.sendSignalCallback) {
          this.sendSignalCallback({
            targetPlayerId: remotePlayerId,
            signal: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (this.sendSignalCallback) {
          this.sendSignalCallback({
            targetPlayerId: remotePlayerId,
            signal: { type: 'offer', offer },
          });
        }
      }
    } catch (err) {
      console.warn('Error connecting to peer:', remotePlayerId, err);
    }
  }

  // Handle incoming signaling message
  async handleSignal(fromPlayerId: string, signal: any) {
    if (!this.isOnlineActive || fromPlayerId === this.myPlayerId) return;

    let pc = this.peers.get(fromPlayerId);
    if (!pc) {
      await this.connectToPeer(fromPlayerId, false);
      pc = this.peers.get(fromPlayerId);
    }
    if (!pc) return;

    try {
      if (signal.type === 'offer') {
        // Ensure local stream is attached
        if (!this.localStream) {
          await this.getLocalStream();
        }
        if (this.localStream) {
          this.localStream.getAudioTracks().forEach((track) => {
            const senders = pc!.getSenders();
            const hasTrack = senders.some((s) => s.track === track);
            if (!hasTrack) {
              pc!.addTrack(track, this.localStream!);
            }
          });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (this.sendSignalCallback) {
          this.sendSignalCallback({
            targetPlayerId: fromPlayerId,
            signal: { type: 'answer', answer },
          });
        }
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
      } else if (signal.type === 'candidate' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.warn('Signal handling error:', err);
    }
  }

  // Handle peer voice status update (isMuted, isSpeaking)
  handlePeerStatus(playerId: string, isMuted: boolean, isSpeaking: boolean) {
    if (playerId === this.myPlayerId) return;
    this.peerStates[playerId] = {
      playerId,
      name: this.peerStates[playerId]?.name || '',
      isMuted,
      isSpeaking,
    };
    this.emit();
  }

  // Remove peer when left
  removePeer(playerId: string) {
    const pc = this.peers.get(playerId);
    if (pc) {
      pc.close();
      this.peers.delete(playerId);
    }
    const audioEl = this.remoteAudios.get(playerId);
    if (audioEl) {
      audioEl.srcObject = null;
      this.remoteAudios.delete(playerId);
    }
    delete this.peerStates[playerId];
    this.emit();
  }

  // Manual Toggle Microphone (Tap to Open / Tap to Close)
  async toggleMic(): Promise<boolean> {
    if (!this.isOnlineActive) return false;

    if (!this.localStream) {
      const stream = await this.getLocalStream();
      if (!stream) return false;
    }

    const nextState = !this.isMicOn;
    this.isMicOn = nextState;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });

      // Attach tracks to all existing peer connections if not yet attached
      this.peers.forEach((pc) => {
        this.localStream!.getAudioTracks().forEach((track) => {
          const senders = pc.getSenders();
          const hasTrack = senders.some((s) => s.track === track);
          if (!hasTrack) {
            pc.addTrack(track, this.localStream!);
          }
        });
      });
    }

    if (!nextState) {
      this.isSpeaking = false;
    }

    this.broadcastStatus(!nextState, false);
    this.emit();
    return nextState;
  }

  private broadcastStatus(isMuted: boolean, isSpeaking: boolean) {
    if (this.sendStatusCallback && this.isOnlineActive) {
      this.sendStatusCallback({ isMuted, isSpeaking });
    }
  }

  destroy() {
    if (!this.isOnlineActive && !this.localStream && this.peers.size === 0) {
      return; // Already inactive and clean
    }

    this.isOnlineActive = false;
    this.isMicOn = false;
    this.isSpeaking = false;
    this.error = null;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.analyser = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    this.peers.forEach((pc) => pc.close());
    this.peers.clear();

    this.remoteAudios.forEach((audio) => {
      audio.srcObject = null;
    });
    this.remoteAudios.clear();
    this.peerStates = {};
    this.emit();
  }
}

export const unifiedVoiceEngine = new UnifiedVoiceEngine();
