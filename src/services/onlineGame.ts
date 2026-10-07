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

// ---- Saved online session: lets a page refresh / dropped connection return to the same room ----

const SESSION_KEY = 'wih-online-session';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface SavedSession {
  kind: '2p' | 'mp';
  role: 'host' | 'guest';
  code: string;
  /** Secret given by the server: proves this browser owns the seat. */
  token: string;
  name: string;
  maxPlayers?: 3 | 4;
  savedAt: number;
}

export function loadSession(): SavedSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedSession;
    const valid =
      s && (s.kind === '2p' || s.kind === 'mp') && (s.role === 'host' || s.role === 'guest') &&
      typeof s.code === 'string' && s.code && typeof s.token === 'string' && s.token &&
      Date.now() - Number(s.savedAt) < SESSION_MAX_AGE_MS;
    if (!valid) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function saveSession(s: SavedSession) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // private mode / storage full: the game still works, it just cannot survive a refresh
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
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

  // What we need to remember about the room we are entering (saved once the server gives us a token).
  private pendingName = '';
  /** True after the player chose to leave: no automatic reconnection. */
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempts = 0;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      this.intentionalClose = false;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}`;

      try {
        const socket = new WebSocket(url);
        this.socket = socket;

        socket.onopen = () => {
          resolve();
        };

        socket.onerror = (err) => {
          reject(err);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.captureSession(data);
            this.notify(data);
          } catch {
            // ignore
          }
        };

        socket.onclose = () => {
          if (this.socket === socket) this.socket = null;
          // Connection lost (not on purpose): keep trying to take our seat back.
          if (!this.intentionalClose && loadSession()) this.scheduleReconnect();
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  /** Remember the seat as soon as the server hands out its token; forget it when the room is gone. */
  private captureSession(d: any) {
    if ((d.type === 'ROOM_CREATED' || d.type === 'ROOM_JOINED' || d.type === 'MP_JOINED') && d.token && this.roomCode && this.userRole) {
      const mp = d.type === 'MP_JOINED';
      saveSession({
        kind: mp ? 'mp' : '2p',
        role: this.userRole,
        code: this.roomCode,
        token: String(d.token),
        name: this.pendingName,
        maxPlayers: mp ? (d.maxPlayers === 4 ? 4 : 3) : undefined,
        savedAt: Date.now(),
      });
    } else if (d.type === 'MP_ROOM_CLOSED' || d.type === 'HOST_DISCONNECTED' || d.type === 'RESUME_FAILED') {
      clearSession();
    }
  }

  /**
   * Take our seat back in the room saved on this device (after a refresh or a dropped connection).
   * Resolves when the server accepted the token; the room state follows as usual.
   */
  async resume(): Promise<SavedSession> {
    const saved = loadSession();
    if (!saved) throw new Error('no-session');
    await this.connect();
    this.roomCode = saved.code;
    this.userRole = saved.role;
    this.pendingName = saved.name;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('timeout'));
      }, 6000);
      const off = this.subscribe((e) => {
        if (e.type === 'ROOM_RESUMED' || e.type === 'MP_JOINED') {
          clearTimeout(timer);
          off();
          if (e.type === 'MP_JOINED') this.mpPlayerId = (e as any).playerId;
          this.reconnectAttempts = 0;
          resolve(saved);
        } else if (e.type === 'RESUME_FAILED' || e.type === 'ERROR') {
          clearTimeout(timer);
          off();
          clearSession();
          reject(new Error(e.type === 'ERROR' ? e.message || 'error' : 'RESUME_FAILED'));
        }
      });
      this.send({ type: saved.kind === 'mp' ? 'MP_RESUME' : 'RESUME_ROOM', code: saved.code, token: saved.token });
    });
  }

  private scheduleReconnect(delayMs?: number) {
    if (this.reconnectTimer || this.intentionalClose) return;
    const attempt = ++this.reconnectAttempts;
    if (attempt > 40) return; // give up quietly; a refresh will still resume
    const delay = delayMs ?? Math.min(800 * attempt, 5000);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      if (this.intentionalClose || !loadSession()) return;
      try {
        await this.resume();
      } catch {
        if (loadSession()) this.scheduleReconnect();
      }
    }, delay);
  }

  /** Call when the page becomes visible / the network is back: reconnect right away if we were dropped. */
  ensureConnected() {
    if (this.intentionalClose || !loadSession()) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.reconnectAttempts = 0;
    this.scheduleReconnect(0);
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
    this.pendingName = playerName;
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
    this.pendingName = playerName;
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
    this.pendingName = playerName;
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
  /** Leave a 2-player room on purpose (frees the seat right away). */
  leaveRoom() {
    this.send({ type: 'LEAVE_ROOM' });
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

  /** Leave for good: closes the socket and forgets the saved seat (no automatic reconnection). */
  disconnect() {
    this.intentionalClose = true;
    clearSession();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.reconnectAttempts = 0;
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

