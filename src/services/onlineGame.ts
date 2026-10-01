import { CategoryDefinition, AnswerType } from '../types/game';

export interface OnlineRoomData {
  code: string;
  category: CategoryDefinition;
  targetScore: number;
  roundNumber: number;
  phase: 'LOBBY' | 'CHOOSING' | 'COUNTDOWN' | 'PLAYING' | 'REVEAL' | 'GAMEOVER';
  activePlayerRole: 'host' | 'guest';
  questions: Array<{
    id: string;
    question: string;
    isVoice?: boolean;
    audioData?: string;
    askedByRole: 'host' | 'guest';
    answeredByRole: 'host' | 'guest';
    answer: AnswerType;
    note?: string;
    timestamp: number;
  }>;
  pendingGuess?: {
    guesserRole: 'host' | 'guest';
    guesserName: string;
    guessText: string;
  };
  pendingQuestion?: {
    id: string;
    question: string;
    isVoice?: boolean;
    audioData?: string;
    askedByRole: 'host' | 'guest';
    answeredByRole: 'host' | 'guest';
  };
  winnerRole?: 'host' | 'guest';
  correctGuess?: string;
  host: { name: string; score: number; isReady: boolean };
  guest?: { name: string; score: number; isReady: boolean };
  mySecretCard: { isSecret: boolean; chosenBy?: string; imageUrl?: string; title?: string };
  opponentVisibleCard?: { imageUrl: string; title: string };
}

export type OnlineEventCallback = (event: {
  type: string;
  room?: OnlineRoomData;
  message?: string;
  questionRecord?: any;
  guesserRole?: string;
  guess?: string;
  nextRole?: string;
}) => void;

class OnlineGameService {
  private socket: WebSocket | null = null;
  private listeners: Set<OnlineEventCallback> = new Set();
  public userRole: 'host' | 'guest' | null = null;
  public roomCode: string | null = null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}`;

      try {
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          resolve();
        };

        this.socket.onerror = (err) => {
          reject(err);
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.notify(data);
          } catch {
            // ignore
          }
        };

        this.socket.onclose = () => {
          // auto reconnect or handle disconnect
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  subscribe(callback: OnlineEventCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(data: any) {
    this.listeners.forEach((cb) => cb(data));
  }

  private send(payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  async createRoom(code: string, playerName: string, category: CategoryDefinition, targetScore: number) {
    await this.connect();
    this.roomCode = code.toUpperCase();
    this.userRole = 'host';
    this.send({
      type: 'CREATE_ROOM',
      code: this.roomCode,
      playerName,
      category,
      targetScore,
    });
  }

  async joinRoom(code: string, playerName: string) {
    await this.connect();
    this.roomCode = code.toUpperCase();
    this.userRole = 'guest';
    this.send({
      type: 'JOIN_ROOM',
      code: this.roomCode,
      playerName,
    });
  }

  startChoosing() {
    this.send({ type: 'START_CHOOSING' });
  }

  submitPicture(imageUrl: string, title: string) {
    this.send({
      type: 'SUBMIT_PICTURE',
      imageUrl,
      title,
    });
  }

  askQuestion(question: string, isVoice?: boolean, audioData?: string) {
    this.send({
      type: 'ASK_QUESTION',
      question,
      isVoice: Boolean(isVoice),
      audioData,
    });
  }

  sendVoiceSignal(signal: any) {
    this.send({
      type: 'VOICE_SIGNAL',
      signal,
    });
  }

  answerQuestion(
    question: string,
    answer: AnswerType,
    note?: string,
    questionId?: string,
    isVoiceAnswer?: boolean
  ) {
    this.send({
      type: 'ANSWER_QUESTION',
      question,
      answer,
      note,
      questionId,
      isVoiceAnswer: Boolean(isVoiceAnswer),
    });
  }

  declareWin(question?: string) {
    this.send({
      type: 'DECLARE_WIN',
      question,
    });
  }

  makeGuess(guess: string) {
    this.send({
      type: 'MAKE_GUESS',
      guess,
    });
  }

  resolveGuess(isCorrect: boolean) {
    this.send({
      type: 'RESOLVE_GUESS',
      isCorrect,
    });
  }

  nextRound() {
    this.send({ type: 'NEXT_ROUND' });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.roomCode = null;
    this.userRole = null;
  }
}

export const onlineService = new OnlineGameService();
