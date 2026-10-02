// Online multiplayer rooms for 3 and 4 players (every player on their own device).
//
// The server is the single source of truth for the game rules. It also relays WebRTC voice
// signaling between any two players (it never carries audio). Voice is a separate concern:
// nothing in here reads or changes anybody's microphone state.
//
// Rules (same as the original same-device version):
//   - every player secretly picks ONE picture of their own;
//   - on your turn you pick another player's picture as the target and ask a question about it;
//   - the owner answers (yes / no / sometimes / not sure) or declares "you got it!" (+1 point
//     for the asker, that picture is revealed);
//   - the turn then passes to the next player; the match ends when nobody has anything left to guess.

import { WebSocket } from 'ws';

type Answer = 'YES' | 'NO' | 'SOMETIMES' | 'NOT_SURE';
const ANSWERS: Answer[] = ['YES', 'NO', 'SOMETIMES', 'NOT_SURE'];

interface MpPlayer {
  id: string;
  name: string;
  ws?: WebSocket;
  connected: boolean;
  score: number;
  secret?: { imageUrl: string; title: string };
  /** Pictures this player already discovered: ownerId -> picture. */
  solved: Record<string, { title: string; imageUrl: string }>;
}

interface MpQuestion {
  id: string;
  question: string;
  askerId: string;
  askerName: string;
  targetOwnerId: string;
  targetOwnerName: string;
  answer: Answer;
  note?: string;
  timestamp: number;
  wasWinningGuess?: boolean;
}

interface MpRoom {
  code: string;
  maxPlayers: 3 | 4;
  category: any;
  hostId: string;
  phase: 'LOBBY' | 'CHOOSING' | 'PLAYING' | 'GAMEOVER';
  players: MpPlayer[];
  nextSeq: number;
  activeId?: string;
  pendingQuestion?: {
    id: string;
    question: string;
    askerId: string;
    askerName: string;
    targetOwnerId: string;
    targetOwnerName: string;
  };
  questions: MpQuestion[];
  lastSolved?: { id: string; askerName: string; ownerName: string; title: string; imageUrl: string };
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

export interface MpCtx {
  code: string | null;
  playerId: string | null;
}

const rooms = new Map<string, MpRoom>();

export const mpHas = (code?: string) => Boolean(code && rooms.has(code.toUpperCase()));
export const mpRoomCount = () => rooms.size;

const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max);
const safeSend = (ws: WebSocket | undefined, payload: any) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
};

// ---------- state shown to each player ----------

function publicState(room: MpRoom, me: MpPlayer) {
  const over = room.phase === 'GAMEOVER';
  return {
    type: 'MP_STATE',
    room: {
      code: room.code,
      maxPlayers: room.maxPlayers,
      category: room.category,
      phase: room.phase,
      hostId: room.hostId,
      meId: me.id,
      activePlayerId: room.activeId,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        connected: p.connected,
        hasPicked: Boolean(p.secret),
        // Pictures this player discovered (public once revealed).
        solved: p.solved,
        // Everyone's secret is revealed at the end.
        secret: over ? p.secret : undefined,
      })),
      // Your own picture is visible only to you (you need it to answer).
      mySecret: me.secret,
      pendingQuestion: room.pendingQuestion,
      questions: room.questions,
      lastSolved: room.lastSolved,
    },
  };
}

function broadcast(room: MpRoom) {
  room.players.forEach((p) => {
    if (p.connected) safeSend(p.ws, publicState(room, p));
  });
}

// ---------- rules ----------

const candidateTargets = (room: MpRoom, asker: MpPlayer) =>
  room.players.filter((t) => t.id !== asker.id && t.connected && t.secret && !asker.solved[t.id]);

/** Next connected player (after `fromId`) who still has something to guess. */
function pickNextActive(room: MpRoom, fromId?: string): MpPlayer | undefined {
  const n = room.players.length;
  const start = fromId ? room.players.findIndex((p) => p.id === fromId) : -1;
  for (let i = 1; i <= n; i++) {
    const p = room.players[(start + i + n) % n];
    if (p.connected && candidateTargets(room, p).length > 0) return p;
  }
  return undefined;
}

function advanceTurn(room: MpRoom) {
  const next = pickNextActive(room, room.activeId);
  if (!next) {
    room.phase = 'GAMEOVER';
    room.activeId = undefined;
    room.pendingQuestion = undefined;
  } else {
    room.activeId = next.id;
  }
}

function startPlaying(room: MpRoom) {
  room.phase = 'PLAYING';
  room.questions = [];
  room.pendingQuestion = undefined;
  room.lastSolved = undefined;
  room.activeId = undefined;
  advanceTurn(room);
}

function maybeStartPlaying(room: MpRoom) {
  const connected = room.players.filter((p) => p.connected);
  if (room.phase === 'CHOOSING' && connected.length >= 2 && connected.every((p) => p.secret)) startPlaying(room);
}

function reassignHostIfNeeded(room: MpRoom) {
  const host = room.players.find((p) => p.id === room.hostId);
  if (host?.connected) return;
  const next = room.players.find((p) => p.connected);
  if (next) room.hostId = next.id;
}

// ---------- message handling ----------

/** Returns true when the message belonged to the multiplayer system (and was handled). */
export function mpHandle(ws: WebSocket, ctx: MpCtx, msg: any): boolean {
  const type: string = msg?.type;

  // Create
  if (type === 'MP_CREATE') {
    const code = clean(msg.code, 8).toUpperCase() || Math.random().toString(36).slice(2, 7).toUpperCase();
    const maxPlayers = msg.maxPlayers === 4 ? 4 : msg.maxPlayers === 3 ? 3 : null;
    if (!maxPlayers) {
      safeSend(ws, { type: 'ERROR', message: 'Invalid player count' });
      return true;
    }
    if (rooms.has(code)) {
      safeSend(ws, { type: 'ERROR', message: 'Room code already in use' });
      return true;
    }
    const host: MpPlayer = {
      id: 'p-1',
      name: clean(msg.playerName, 24) || 'Player 1',
      ws,
      connected: true,
      score: 0,
      solved: {},
    };
    const room: MpRoom = {
      code,
      maxPlayers,
      category: msg.category,
      hostId: host.id,
      phase: 'LOBBY',
      players: [host],
      nextSeq: 2,
      questions: [],
    };
    rooms.set(code, room);
    ctx.code = code;
    ctx.playerId = host.id;
    safeSend(ws, { type: 'MP_JOINED', roomCode: code, playerId: host.id, maxPlayers });
    broadcast(room);
    return true;
  }

  // Join (shared entry point with the 2-player system: same code box)
  if (type === 'JOIN_ROOM' && mpHas(msg.code)) {
    const room = rooms.get(String(msg.code).toUpperCase())!;
    const name = clean(msg.playerName, 24) || 'Player';

    // Rejoin: same name, was disconnected -> take the seat back (during or after a drop).
    const returning = room.players.find((p) => !p.connected && p.name === name);
    if (returning) {
      returning.ws = ws;
      returning.connected = true;
      if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
      ctx.code = room.code;
      ctx.playerId = returning.id;
      reassignHostIfNeeded(room);
      safeSend(ws, { type: 'MP_JOINED', roomCode: room.code, playerId: returning.id, maxPlayers: room.maxPlayers, rejoined: true });
      maybeStartPlaying(room);
      broadcast(room);
      return true;
    }
    if (room.phase !== 'LOBBY') {
      safeSend(ws, { type: 'ERROR', message: 'Game already started' });
      return true;
    }
    if (room.players.length >= room.maxPlayers) {
      safeSend(ws, { type: 'ERROR', message: 'Room is full' });
      return true;
    }
    if (room.players.some((p) => p.name === name)) {
      safeSend(ws, { type: 'ERROR', message: 'Name already taken in this room' });
      return true;
    }
    const player: MpPlayer = { id: `p-${room.nextSeq++}`, name, ws, connected: true, score: 0, solved: {} };
    room.players.push(player);
    ctx.code = room.code;
    ctx.playerId = player.id;
    safeSend(ws, { type: 'MP_JOINED', roomCode: room.code, playerId: player.id, maxPlayers: room.maxPlayers });
    broadcast(room);
    return true;
  }

  if (!type?.startsWith('MP_') && type !== 'VOICE_SIGNAL') return false;

  // Everything below needs an MP seat.
  const room = ctx.code ? rooms.get(ctx.code) : undefined;
  const me = room?.players.find((p) => p.id === ctx.playerId);
  if (!room || !me) return type === 'VOICE_SIGNAL' ? false : true;

  switch (type) {
    // Voice signaling: relayed to one specific player. The server never touches audio.
    case 'VOICE_SIGNAL': {
      const target = room.players.find((p) => p.id === msg.to && p.id !== me.id);
      if (target?.connected) safeSend(target.ws, { type: 'VOICE_SIGNAL', from: me.id, signal: msg.signal });
      return true;
    }

    case 'MP_START':
      if (room.phase === 'LOBBY' && me.id === room.hostId && room.players.length === room.maxPlayers) {
        room.phase = 'CHOOSING';
        broadcast(room);
      }
      return true;

    case 'MP_SUBMIT_PICTURE': {
      if (room.phase !== 'CHOOSING' && !(room.phase === 'PLAYING' && !me.secret)) return true;
      // A search result is an http(s) link; a phone upload/paste is a (client-shrunk) image data URL.
      const rawUrl = typeof msg.imageUrl === 'string' ? msg.imageUrl.trim() : '';
      const isLink = /^https?:\/\//i.test(rawUrl) && rawUrl.length <= 4000;
      const isData = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(rawUrl) && rawUrl.length <= 300_000;
      const imageUrl = isLink || isData ? rawUrl : '';
      const title = clean(msg.title, 80) || 'Secret';
      if (!imageUrl) return true;
      me.secret = { imageUrl, title };
      maybeStartPlaying(room);
      broadcast(room);
      return true;
    }

    case 'MP_ASK': {
      if (room.phase !== 'PLAYING' || room.activeId !== me.id || room.pendingQuestion) return true;
      const target = room.players.find((p) => p.id === msg.targetId);
      const question = clean(msg.question, 300);
      if (!target || !question) return true;
      if (!candidateTargets(room, me).some((t) => t.id === target.id)) return true;
      room.pendingQuestion = {
        id: 'mq-' + Date.now() + Math.random().toString(36).slice(2, 6),
        question,
        askerId: me.id,
        askerName: me.name,
        targetOwnerId: target.id,
        targetOwnerName: target.name,
      };
      broadcast(room);
      return true;
    }

    case 'MP_ANSWER': {
      const q = room.pendingQuestion;
      if (room.phase !== 'PLAYING' || !q || q.targetOwnerId !== me.id) return true;
      const answer: Answer = ANSWERS.includes(msg.answer) ? msg.answer : 'NOT_SURE';
      const note = clean(msg.note, 200) || undefined;
      room.questions.unshift({ ...q, answer, note, timestamp: Date.now() });
      room.pendingQuestion = undefined;
      advanceTurn(room);
      broadcast(room);
      return true;
    }

    case 'MP_DECLARE_WIN': {
      const q = room.pendingQuestion;
      if (room.phase !== 'PLAYING' || !q || q.targetOwnerId !== me.id || !me.secret) return true;
      const asker = room.players.find((p) => p.id === q.askerId);
      if (!asker) return true;
      asker.score += 1;
      asker.solved[me.id] = { title: me.secret.title, imageUrl: me.secret.imageUrl };
      room.questions.unshift({
        ...q,
        answer: 'YES',
        note: '🏆',
        timestamp: Date.now(),
        wasWinningGuess: true,
      });
      room.lastSolved = {
        id: q.id,
        askerName: asker.name,
        ownerName: me.name,
        title: me.secret.title,
        imageUrl: me.secret.imageUrl,
      };
      room.pendingQuestion = undefined;
      advanceTurn(room);
      broadcast(room);
      return true;
    }

    case 'MP_PLAY_AGAIN':
      if (room.phase === 'GAMEOVER' && me.id === room.hostId) {
        room.players = room.players.filter((p) => p.connected);
        room.players.forEach((p) => {
          p.score = 0;
          p.secret = undefined;
          p.solved = {};
        });
        room.questions = [];
        room.pendingQuestion = undefined;
        room.lastSolved = undefined;
        room.activeId = undefined;
        room.phase = room.players.length >= 2 ? 'CHOOSING' : 'LOBBY';
        broadcast(room);
      }
      return true;

    case 'MP_END_GAME':
      if (room.phase === 'PLAYING' && me.id === room.hostId) {
        room.phase = 'GAMEOVER';
        room.activeId = undefined;
        room.pendingQuestion = undefined;
        broadcast(room);
      }
      return true;

    case 'MP_LEAVE':
      mpClose(ctx);
      return true;
  }
  return true;
}

/** The player's socket closed or they left. */
export function mpClose(ctx: MpCtx) {
  const room = ctx.code ? rooms.get(ctx.code) : undefined;
  const me = room?.players.find((p) => p.id === ctx.playerId);
  ctx.code = null;
  ctx.playerId = null;
  if (!room || !me) return;

  // Tell the other players' voice engines so they reset cleanly (no stale connection).
  room.players.forEach((p) => {
    if (p.id !== me.id && p.connected) safeSend(p.ws, { type: 'VOICE_SIGNAL', from: me.id, signal: { type: 'bye' } });
  });

  if (room.phase === 'LOBBY') {
    if (me.id === room.hostId) {
      // Host left before the game: the room closes.
      room.players.forEach((p) => {
        if (p.id !== me.id) safeSend(p.ws, { type: 'MP_ROOM_CLOSED' });
      });
      rooms.delete(room.code);
      return;
    }
    room.players = room.players.filter((p) => p.id !== me.id);
    broadcast(room);
    return;
  }

  // Mid-game: keep the seat so the player can come back with the same name.
  me.connected = false;
  me.ws = undefined;
  reassignHostIfNeeded(room);

  if (room.phase === 'PLAYING') {
    const q = room.pendingQuestion;
    if (q && q.targetOwnerId === me.id) {
      room.questions.unshift({ ...q, answer: 'NOT_SURE', note: '📴', timestamp: Date.now() });
      room.pendingQuestion = undefined;
    } else if (q && q.askerId === me.id) {
      room.pendingQuestion = undefined;
    }
    if (room.activeId === me.id || !room.activeId) advanceTurn(room);
    else if (!room.pendingQuestion && !pickNextActive(room, room.activeId)) advanceTurn(room);
  }

  const anyone = room.players.some((p) => p.connected);
  if (!anyone) {
    room.cleanupTimer = setTimeout(() => {
      if (!room.players.some((p) => p.connected)) rooms.delete(room.code);
    }, 2 * 60 * 1000);
    return;
  }
  broadcast(room);
}
