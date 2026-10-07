// Keeps the game alive across a page refresh.
//
//  - Same-device games (pass & play, vs bot) have no server, so the whole match is saved on the device.
//  - Online games are restored from the server (see onlineGame.ts: saved seat token); nothing of
//    the match itself is stored here.
//  - Language and sound choices are remembered too.
//
// Everything is wrapped in try/catch: private mode or a full storage must never break the game.

import type { CategoryDefinition, GameMode, GamePhase, Player, PlayerChoice, PlayerCount, QuestionRecord } from '../types/game';
import { CATEGORIES, GENERAL_CATEGORY } from '../data/categories';

const OFFLINE_KEY = 'wih-offline-game';
/** Per-arena extras of a same-device match (a question waiting for its answer, whose turn to look). */
export const LOCAL_ARENA_KEY = 'wih-local-arena';
const PREFS_KEY = 'wih-prefs';
const OFFLINE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Phases of a same-device match worth restoring (everything before/after them starts from home). */
const RESTORABLE_PHASES: GamePhase[] = [
  'CHOOSE_PICTURE_P1',
  'CHOOSE_PICTURE_P2',
  'PICTURES_LOCKED_COUNTDOWN',
  'PLAYING',
  'ROUND_REVEAL',
  'GAME_OVER',
];
const NEEDS_BOTH_CARDS: GamePhase[] = ['PLAYING', 'ROUND_REVEAL', 'PICTURES_LOCKED_COUNTDOWN'];

export const isRestorablePhase = (phase: GamePhase) => RESTORABLE_PHASES.includes(phase);

export interface OfflineSave {
  v: 1;
  savedAt: number;
  gameMode: Exclude<GameMode, 'ROOM_CODE'>;
  playerCount: PlayerCount;
  gamePhase: GamePhase;
  categoryId: string;
  targetScore: number;
  roundNumber: number;
  player1: Player;
  player2: Player;
  p1Card: PlayerChoice | null;
  p2Card: PlayerChoice | null;
  activePlayerId: string;
  questions: QuestionRecord[];
  roundWinnerId: string | null;
  correctGuessWord: string;
  showHandoffToP2: boolean;
}

export const categoryById = (id: string): CategoryDefinition =>
  [...CATEGORIES, GENERAL_CATEGORY].find((c) => c.id === id) ?? GENERAL_CATEGORY;

export function loadOffline(): OfflineSave | null {
  try {
    const raw = window.localStorage.getItem(OFFLINE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as OfflineSave;
    const ok =
      s &&
      s.v === 1 &&
      (s.gameMode === 'PASS_AND_PLAY' || s.gameMode === 'VS_BOT') &&
      isRestorablePhase(s.gamePhase) &&
      Date.now() - Number(s.savedAt) < OFFLINE_MAX_AGE_MS &&
      s.player1?.name &&
      s.player2?.name &&
      Array.isArray(s.questions) &&
      (!NEEDS_BOTH_CARDS.includes(s.gamePhase) || (s.p1Card && s.p2Card));
    if (!ok) {
      clearOffline();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveOffline(s: OfflineSave) {
  try {
    window.localStorage.setItem(OFFLINE_KEY, JSON.stringify(s));
  } catch {
    // storage full / blocked: the match just will not survive a refresh
  }
}

export function clearOffline() {
  try {
    window.localStorage.removeItem(OFFLINE_KEY);
    window.localStorage.removeItem(LOCAL_ARENA_KEY);
  } catch {
    // ignore
  }
}

// ---- small per-arena state of a same-device match ----

export interface LocalArenaSave {
  /** The match this belongs to (round + names), so a stale entry is never applied to another match. */
  matchKey: string;
  viewerId: string;
  passAndPlayHandoff: boolean;
  pending: { id: string; question: string; isVoice?: boolean; audioData?: string; askedById: string; answeredById: string } | null;
}

export function loadLocalArena(matchKey: string): LocalArenaSave | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_ARENA_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LocalArenaSave;
    return s && s.matchKey === matchKey ? s : null;
  } catch {
    return null;
  }
}

export function saveLocalArena(s: LocalArenaSave) {
  try {
    window.localStorage.setItem(LOCAL_ARENA_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ---- language / sound ----

export function loadPrefs(): { lang: 'ar' | 'en'; soundEnabled: boolean } {
  try {
    const p = JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}');
    return { lang: p.lang === 'en' ? 'en' : 'ar', soundEnabled: p.soundEnabled !== false };
  } catch {
    return { lang: 'ar', soundEnabled: true };
  }
}

export function savePrefs(p: { lang: 'ar' | 'en'; soundEnabled: boolean }) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}
