// Voice Note Recorder & Player Utility
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<boolean> {
    try {
      this.audioChunks = [];
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Prefer audio/webm or audio/mp4 depending on browser
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      return true;
    } catch (err) {
      console.warn('Microphone access failed:', err);
      return false;
    }
  }

  stop(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanup();
        resolve('');
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();

        // Convert to Base64 data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve((reader.result as string) || '');
        };
        reader.readAsDataURL(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  cancel() {
    this.cleanup();
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

export const voiceRecorder = new VoiceRecorder();

export function playAudioData(audioDataUrl: string): HTMLAudioElement | null {
  if (!audioDataUrl) return null;
  try {
    const audio = new Audio(audioDataUrl);
    audio.play().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}
