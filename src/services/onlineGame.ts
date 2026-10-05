import { CategoryDefinition, AnswerType } from '../types/game';

export interface OnlineRoomPlayerSummary {
  id: string;
  name: string;
  score: number;
  roleIndex: number;
  isHost: boolean;
  isReady: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
}

export interface OnlineRoomData {
  code: string;
  maxPlayers: number;
  category: CategoryDefinition;
  targetScore: number;
  roundNumber: number;
  phase: 'LOBBY' | 'CHOOSING' | 'COUNTDOWN' | 'PLAYING' | 'REVEAL' | 'GAMEOVER';
  activePlayerRole?: 'host' | 'guest';
  activePlayerIndex?: number;
  activePlayerId?: string;
  myPlayerId?: string;
  questions: Array<{
    id: string;
    question: string;
    isVoice?: boolean;
    isVoiceAnswer?: boolean;
    audioData?: string;
    askerId?: string;
    askerName?: string;
    targetPlayerId?: string;
    targetPlayerName?: string;
    askedByRole: 'host' | 'guest';
    answeredByRole: 'host' | 'guest';
    answer: AnswerType;
    note?: string;
    timestamp: number;
    wasWinningGuess?: boolean;
  }>;
  pendingGuess?: {
    guesserRole: 'host' | 'guest';
    guesserId?: string;
    guesserName: string;
    guessText: string;
  };
  pendingQuestion?: {
    id: string;
    question: string;
    isVoice?: boolean;
    audioData?: string;
    askerId?: string;
    askerName?: string;
    targetPlayerId?: string;
    targetPlayerName?: string;
    askedByRole: 'host' | 'guest';
    answeredByRole: 'host' | 'guest';
  };
  winnerRole?: 'host' | 'guest';
  winnerPlayerId?: string;
  winnerPlayerName?: string;
  correctGuess?: string;
  players?: OnlineRoomPlayerSummary[];
  host?: { id?: string; name: string; score: number; isReady: boolean };
  guest?: { id?: string; name: string; score: number; isReady: boolean };
  mySecretCard?: { isSecret?: boolean; chosenBy?: string; imageUrl?: string; title?: string };
  opponentVisibleCard?: { imageUrl: string; title: string };
  targets?: Array<{ ownerId: string; ownerName: string; isSolved: boolean; revealedImage?: { imageUrl: string; title: string } }>;
}

export type OnlineEventCallback = (event: {
  type: string;
  room?: OnlineRoomData;
  message?: string;
  questionRecord?: any;
  guesserRole?: string;
  guess?: string;
  nextRole?: string;
  from?: string;
  fromRole?: string;
  signal?: any;
  mpRoom?: any;
}) => void;

class OnlineGameService {
  private socket: WebSocket | null = null;
  private listeners: Set<OnlineEventCallback> = new Set();
  public userRole: 'host' | 'guest' | null = null;
  public roomCode: string | null = null;
  /** My seat id in a 3/4-player room (also my voice id). Null in the 2-player system. */
  public mpPlayerId: string | null = null;

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

  async createRoom(
    code: string,
    playerName: string,
    category: CategoryDefinition,
    targetScore: number
  ) {
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

  /**
   * Join a room by code. The same code box serves 2-player and 3/4-player rooms: the server
   * answers with ROOM_JOINED (2 players) or MP_JOINED (3/4 players), or an ERROR (rejected).
   */
  async joinRoom(code: string, playerName: string): Promise<'ROOM_JOINED' | 'MP_JOINED'> {
    await this.connect();
    this.roomCode = code.toUpperCase();
    this.userRole = 'guest';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('timeout'));
      }, 6000);
      const off = this.subscribe((e) => {
        if (e.type === 'ROOM_JOINED' || e.type === 'MP_JOINED') {
          clearTimeout(timer);
          off();
          this.mpPlayerId = e.type === 'MP_JOINED' ? (e as any).playerId : null;
          resolve(e.type);
        } else if (e.type === 'ERROR') {
          clearTimeout(timer);
          off();
          reject(new Error(e.message || 'error'));
        }
      });
      this.send({ type: 'JOIN_ROOM', code: this.roomCode, playerName });
    });
  }

  // ---- 3 / 4 players online ----

  async mpCreateRoom(code: string, playerName: string, category: CategoryDefinition, maxPlayers: 3 | 4): Promise<void> {
    await this.connect();
    this.roomCode = code.toUpperCase();
    this.userRole = 'host';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('timeout'));
      }, 6000);
      const off = this.subscribe((e) => {
        if (e.type === 'MP_JOINED') {
          clearTimeout(timer);
          off();
          this.mpPlayerId = (e as any).playerId;
          resolve();
        } else if (e.type === 'ERROR') {
          clearTimeout(timer);
          off();
          reject(new Error(e.message || 'error'));
        }
      });
      this.send({ type: 'MP_CREATE', code: this.roomCode, playerName, category, maxPlayers });
    });
  }

  mpStart() {
    this.send({ type: 'MP_START' });
  }
  mpSubmitPicture(imageUrl: string, title: string) {
    this.send({ type: 'MP_SUBMIT_PICTURE', imageUrl, title });
  }
  /** The server decides who is asked (the turn schedule); the question always goes to the assigned target. */
  mpAsk(question: string) {
    this.send({ type: 'MP_ASK', question });
  }
  mpAnswer(answer: AnswerType, note?: string) {
    this.send({ type: 'MP_ANSWER', answer, note });
  }
  mpDeclareWin() {
    this.send({ type: 'MP_DECLARE_WIN' });
  }
  mpPlayAgain() {
    this.send({ type: 'MP_PLAY_AGAIN' });
  }
  mpEndGame() {
    this.send({ type: 'MP_END_GAME' });
  }
  mpLeave() {
    this.send({ type: 'MP_LEAVE' });
    this.mpPlayerId = null;
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

  askQuestion(question: string, isVoice?: boolean, audioData?: string, targetPlayerId?: string) {
    this.send({
      type: 'ASK_QUESTION',
      question,
      isVoice: Boolean(isVoice),
      audioData,
      targetPlayerId,
    });
  }

  /** Voice signaling (never audio). In 3/4-player rooms it is addressed to one player. */
  sendVoiceSignal(signal: any, toId?: string) {
    this.send({ type: 'VOICE_SIGNAL', to: toId, signal });
  }

  sendVoiceStatus(isMuted: boolean, isSpeaking: boolean) {
    this.send({
      type: 'VOICE_STATUS',
      isMuted,
      isSpeaking,
    });
  }

  answerQuestion(
    question: string,
    answer: AnswerType,
    note?: string,
    questionId?: string,
    isVoiceAnswer?: boolean,
    wasWinningGuess?: boolean
  ) {
    this.send({
      type: 'ANSWER_QUESTION',
      question,
      answer,
      note,
      questionId,
      isVoiceAnswer: Boolean(isVoiceAnswer),
      wasWinningGuess: Boolean(wasWinningGuess),
    });
  }

  declareWin(question?: string, askerId?: string) {
    this.send({
      type: 'DECLARE_WIN',
      question,
      askerId,
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
    this.mpPlayerId = null;
  }
}

export const onlineService = new OnlineGameService();

