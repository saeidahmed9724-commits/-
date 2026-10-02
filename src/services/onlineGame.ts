import { CategoryDefinition, AnswerType } from '../types/game';
import { unifiedVoiceEngine } from './voiceEngine';

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
    askedByRole?: 'host' | 'guest';
    answeredByRole?: 'host' | 'guest';
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
    askedByRole?: 'host' | 'guest';
    answeredByRole?: 'host' | 'guest';
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
  peerId?: string;
  name?: string;
  signal?: any;
  fromPlayerId?: string;
  playerId?: string;
  isMuted?: boolean;
  isSpeaking?: boolean;
}) => void;

class OnlineGameService {
  private socket: WebSocket | null = null;
  private listeners: Set<OnlineEventCallback> = new Set();
  public userRole: 'host' | 'guest' | null = null;
  public roomCode: string | null = null;
  public myPlayerId: string | null = null;
  public maxPlayers: number = 2;

  constructor() {
    // Hook unified voice engine to send signals via websocket
    unifiedVoiceEngine.setCallbacks(
      (signalPayload) => {
        this.send({
          type: 'VOICE_SIGNAL',
          ...signalPayload,
        });
      },
      (statusPayload) => {
        this.send({
          type: 'VOICE_STATUS',
          ...statusPayload,
        });
      }
    );
  }

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

            if (data.type === 'ROOM_CREATED' || data.type === 'ROOM_JOINED') {
              if (data.playerId) this.myPlayerId = data.playerId;
              if (data.maxPlayers) this.maxPlayers = data.maxPlayers;
            }

            // WebRTC peer connections orchestration
            if (data.type === 'PEER_JOINED' && data.peerId) {
              // Existing peer connects to the newly joined peer as initiator
              unifiedVoiceEngine.connectToPeer(data.peerId, true);
            } else if (data.type === 'VOICE_SIGNAL' && data.signal) {
              const fromId = data.fromPlayerId || (data.fromRole === 'host' ? 'p1' : 'p2');
              unifiedVoiceEngine.handleSignal(fromId, data.signal);
            } else if (data.type === 'PLAYER_VOICE_STATUS' && data.playerId) {
              unifiedVoiceEngine.handlePeerStatus(data.playerId, data.isMuted, data.isSpeaking);
            } else if (data.type === 'PEER_LEFT' && data.peerId) {
              unifiedVoiceEngine.removePeer(data.peerId);
            }

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
    targetScore: number,
    maxPlayers: number = 2
  ) {
    await this.connect();
    this.roomCode = code.toUpperCase();
    this.userRole = 'host';
    this.maxPlayers = maxPlayers;
    this.send({
      type: 'CREATE_ROOM',
      code: this.roomCode,
      playerName,
      category,
      targetScore,
      maxPlayers,
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

  askQuestion(question: string, isVoice?: boolean, audioData?: string, targetPlayerId?: string) {
    this.send({
      type: 'ASK_QUESTION',
      question,
      isVoice: Boolean(isVoice),
      audioData,
      targetPlayerId,
    });
  }

  sendVoiceSignal(signal: any, targetPlayerId?: string) {
    this.send({
      type: 'VOICE_SIGNAL',
      signal,
      targetPlayerId,
    });
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
    this.myPlayerId = null;
    unifiedVoiceEngine.destroy();
  }
}

export const onlineService = new OnlineGameService();

