// WebRTC Peer-to-Peer Live Voice Chat Manager
export class WebRTCAudioManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private onSignalCallback?: (signal: any) => void;
  private onStateChangeCallback?: (state: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  private isMuted: boolean = false;

  constructor() {
    this.remoteAudio = new Audio();
    this.remoteAudio.autoplay = true;
  }

  setSignalCallback(cb: (signal: any) => void) {
    this.onSignalCallback = cb;
  }

  setStateChangeCallback(cb: (state: 'disconnected' | 'connecting' | 'connected' | 'error') => void) {
    this.onStateChangeCallback = cb;
  }

  async start(isInitiator: boolean): Promise<boolean> {
    try {
      this.onStateChangeCallback?.('connecting');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      this.localStream.getAudioTracks().forEach((track) => {
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });

      this.pc.ontrack = (event) => {
        if (this.remoteAudio && event.streams[0]) {
          this.remoteAudio.srcObject = event.streams[0];
          this.remoteAudio.play().catch(() => {});
        }
      };

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.onSignalCallback) {
          this.onSignalCallback({ type: 'candidate', candidate: event.candidate });
        }
      };

      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected') {
          this.onStateChangeCallback?.('connected');
        } else if (state === 'failed' || state === 'disconnected') {
          this.onStateChangeCallback?.('disconnected');
        }
      };

      if (isInitiator) {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.onSignalCallback?.({ type: 'offer', offer });
      }

      return true;
    } catch (err) {
      console.warn('WebRTC audio start error:', err);
      this.onStateChangeCallback?.('error');
      return false;
    }
  }

  async handleSignal(signal: any) {
    try {
      if (!this.pc) return;

      if (signal.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.onSignalCallback?.({ type: 'answer', answer });
      } else if (signal.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
      } else if (signal.type === 'candidate') {
        await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
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

  stop() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
    }
    this.onStateChangeCallback?.('disconnected');
  }
}

export const liveVoiceManager = new WebRTCAudioManager();
