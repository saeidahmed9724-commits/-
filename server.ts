import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { normalizeText, isCorrectGuess } from './src/utils/normalize';
import { mpHandle, mpClose, mpRoomInfo, type MpCtx } from './mpRooms';
import { SocialStore } from './social/store';
import { SocialService } from './social/service';
import { SocialHub, type RoomInfo } from './social/hub';
import { registerSocialRoutes } from './social/routes';
import { searchAllProviders, type SearchImageResult } from './imageProviders';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Friends system: permanent accounts/friendships (JSON file in DATA_DIR) + the always-on
// /ws/social channel for presence and invitations. Rooms themselves stay in memory.
// ---------------------------------------------------------------------------
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, 'data');
const socialStore = new SocialStore(path.join(DATA_DIR, 'social.json'));
const socialService = new SocialService(socialStore);
registerSocialRoutes(app, socialService);

const imageSearchCache = new Map<string, { timestamp: number; data: SearchImageResult[] }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

const ARABIC_KEYWORDS_MAP: Record<string, string> = {
  برجر: 'burger hamburger',
  همبرجر: 'hamburger',
  بيتزا: 'pizza',
  بطاطس: 'french fries',
  سوشي: 'sushi',
  شاورما: 'shawarma',
  فراخ: 'fried chicken',
  دجاج: 'chicken',
  لحمة: 'steak beef',
  كيك: 'cake dessert',
  دونات: 'donut',
  'ايس كريم': 'ice cream',
  'آيس كريم': 'ice cream',
  تاكو: 'taco',
  باستا: 'pasta',
  سلطة: 'salad',
  فاكهة: 'fruit',
  تفاح: 'apple',
  تفاحة: 'apple',
  موز: 'banana',
  فراولة: 'strawberry',
  برتقال: 'orange fruit',
  مانجو: 'mango',
  شوكولاتة: 'chocolate',
  قهوة: 'coffee',
  شاي: 'tea',
  أسد: 'lion',
  نمر: 'tiger',
  فهد: 'cheetah leopard',
  قطة: 'cat kitten',
  بسة: 'cat',
  كلب: 'dog puppy',
  فيل: 'elephant',
  زرافة: 'giraffe',
  باندا: 'giant panda',
  دب: 'bear',
  حصان: 'horse',
  حمار: 'donkey',
  قرد: 'monkey',
  ثعلب: 'fox',
  ذئب: 'wolf',
  أرنب: 'rabbit bunny',
  غزال: 'deer gazelle',
  دلفين: 'dolphin',
  حوت: 'whale',
  قرش: 'shark',
  أخطبوط: 'octopus',
  طائر: 'bird',
  عصفور: 'sparrow bird',
  نسر: 'eagle',
  صقر: 'falcon',
  بومة: 'owl',
  بطريق: 'penguin',
  سيارة: 'car automobile',
  عربية: 'car',
  طيارة: 'airplane',
  طائرة: 'airplane',
  قطار: 'train locomotive',
  سفينة: 'ship boat',
  قارب: 'boat',
  دراجة: 'bicycle bike',
  عجلة: 'bicycle',
  موتوسيكل: 'motorcycle',
  هاتف: 'smartphone iphone',
  موبايل: 'smartphone',
  آيفون: 'iphone',
  كمبيوتر: 'computer laptop',
  لابتوب: 'laptop',
  تلفزيون: 'television',
  شاشة: 'screen monitor',
  كورة: 'football soccer ball',
  'كرة قدم': 'soccer ball',
  ساعة: 'wristwatch',
  نظارة: 'glasses sunglasses',
  حذاء: 'sneakers shoes',
  شنطة: 'backpack bag',
  كاميرا: 'camera',
  جيتار: 'guitar',
  بيانو: 'piano',
  موسيقى: 'music instrument',
  كتاب: 'book',
  قلم: 'pen pencil',
  بيت: 'house building',
  شجرة: 'tree',
  وردة: 'flower rose',
  شمس: 'sun',
  قمر: 'moon',
  نجمة: 'star',
  'برج خليفة': 'Burj Khalifa',
  'برج إيفل': 'Eiffel Tower',
  الأهرامات: 'Giza Pyramids',
  ميسي: 'Lionel Messi',
  رونالدو: 'Cristiano Ronaldo',
};

function getExpandedQueries(rawQuery: string): string[] {
  const trimmed = rawQuery.trim();
  const lower = trimmed.toLowerCase();
  const queries: string[] = [];

  // If in mapping directly
  if (ARABIC_KEYWORDS_MAP[lower]) {
    queries.push(ARABIC_KEYWORDS_MAP[lower]);
  } else {
    // Check partial contains
    for (const [ar, en] of Object.entries(ARABIC_KEYWORDS_MAP)) {
      if (lower.includes(ar)) {
        queries.push(en);
        break;
      }
    }
  }

  // Always include original query
  if (!queries.includes(trimmed)) {
    queries.push(trimmed);
  }

  return queries;
}

// Per-IP limit so one player cannot burn the free API quotas (Pexels: 200 requests/hour).
const searchHits = new Map<string, { count: number; resetAt: number }>();
const SEARCH_LIMIT_PER_MIN = 40;
const MAX_CACHE_ENTRIES = 500;

app.get('/api/search-images', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
  const limit = Math.min(parseInt(req.query.limit as string) || 60, 100);

  if (!query) {
    return res.json({ results: [], hasMore: false });
  }

  const cacheKey = `${query.toLowerCase()}_off${offset}_lim${limit}`;
  const cached = imageSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ results: cached.data, hasMore: cached.data.length >= 20 });
  }

  const ip = req.ip || 'unknown';
  const now = Date.now();
  const hit = searchHits.get(ip);
  if (!hit || hit.resetAt < now) searchHits.set(ip, { count: 1, resetAt: now + 60_000 });
  else if (++hit.count > SEARCH_LIMIT_PER_MIN) {
    return res.status(429).json({ results: [], hasMore: false, error: 'Too many searches, wait a minute' });
  }

  const outcome = await searchAllProviders({ fetch, env: process.env }, query, offset, limit, getExpandedQueries);
  console.log(`[image-search] "${query}" ->`, outcome.results.length, JSON.stringify(outcome.providers));

  if (outcome.results.length > 0) {
    imageSearchCache.set(cacheKey, { timestamp: now, data: outcome.results });
    if (imageSearchCache.size > MAX_CACHE_ENTRIES) {
      const oldest = imageSearchCache.keys().next().value;
      if (oldest !== undefined) imageSearchCache.delete(oldest);
    }
  }
  return res.json({ results: outcome.results, hasMore: outcome.hasMore });
});

const server = http.createServer(app);
// Two socket servers share the HTTP server: the game (any path, as before) and /ws/social (friends).
const wss = new WebSocketServer({ noServer: true });
const socialWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const target = pathname === '/ws/social' ? socialWss : wss;
  target.handleUpgrade(req, socket, head, (ws) => target.emit('connection', ws, req));
});

interface RoomPlayer {
  ws?: WebSocket;
  id: string;
  name: string;
  score: number;
}

interface OnlineRoom {
  code: string;
  host: RoomPlayer;
  guest?: RoomPlayer;
  category: any;
  targetScore: number;
  roundNumber: number;
  phase: 'LOBBY' | 'CHOOSING' | 'COUNTDOWN' | 'PLAYING' | 'REVEAL' | 'GAMEOVER';
  // Secret image choices:
  // hostChosenForGuest: picked by host FOR guest (held by guest, secret to guest, visible to host)
  hostChosenForGuest?: { imageUrl: string; title: string };
  // guestChosenForHost: picked by guest FOR host (held by host, secret to host, visible to guest)
  guestChosenForHost?: { imageUrl: string; title: string };
  activePlayerRole: 'host' | 'guest';
  questions: Array<{
    id: string;
    question: string;
    isVoice?: boolean;
    isVoiceAnswer?: boolean;
    audioData?: string;
    askedByRole: 'host' | 'guest';
    answeredByRole: 'host' | 'guest';
    answer: 'YES' | 'NO' | 'SOMETIMES' | 'NOT_SURE';
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
}

const rooms = new Map<string, OnlineRoom>();

/** Lets the invitation system ask "can someone still join this room?" for both room systems. */
function getRoomInfo(code: string): RoomInfo {
  const c = String(code).toUpperCase();
  const mp = mpRoomInfo(c);
  if (mp) return mp;
  const room = rooms.get(c);
  const hostHere = room?.host.ws?.readyState === WebSocket.OPEN;
  if (!room || !hostHere) return { exists: false, joinable: false, maxPlayers: 2, seatsLeft: 0 };
  const guestHere = room.guest?.ws?.readyState === WebSocket.OPEN;
  return { exists: true, joinable: room.phase === 'LOBBY' && !guestHere, maxPlayers: 2, seatsLeft: guestHere ? 0 : 1 };
}

const socialHub = new SocialHub(socialService, { getRoomInfo });
socialWss.on('connection', (ws) => socialHub.handleConnection(ws));

const shutdown = () => {
  socialStore.flush();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Helper to broadcast personalized sanitized view to each player
function broadcastRoomState(room: OnlineRoom) {
  const isPlaying = room.phase === 'PLAYING';
  const isReveal = room.phase === 'REVEAL' || room.phase === 'GAMEOVER';

  // 1. Payload for Host
  if (room.host.ws && room.host.ws.readyState === WebSocket.OPEN) {
    const hostPayload = {
      type: 'ROOM_UPDATE',
      room: {
        code: room.code,
        category: room.category,
        targetScore: room.targetScore,
        roundNumber: room.roundNumber,
        phase: room.phase,
        activePlayerRole: room.activePlayerRole,
        questions: room.questions,
        winnerRole: room.winnerRole,
        correctGuess: room.correctGuess,
        host: { name: room.host.name, score: room.host.score, isReady: Boolean(room.hostChosenForGuest) },
        guest: room.guest ? { name: room.guest.name, score: room.guest.score, isReady: Boolean(room.guestChosenForHost) } : undefined,
        pendingGuess: room.pendingGuess,
        pendingQuestion: room.pendingQuestion,
        // Secret picture held by Host (secret to host unless REVEAL):
        mySecretCard: isReveal
          ? room.guestChosenForHost
          : { isSecret: true, chosenBy: room.guest?.name || 'Guest' },
        // Opponent's picture (visible to Host):
        opponentVisibleCard: room.hostChosenForGuest,
      },
    };
    room.host.ws.send(JSON.stringify(hostPayload));
  }

  // 2. Payload for Guest
  if (room.guest?.ws && room.guest.ws.readyState === WebSocket.OPEN) {
    const guestPayload = {
      type: 'ROOM_UPDATE',
      room: {
        code: room.code,
        category: room.category,
        targetScore: room.targetScore,
        roundNumber: room.roundNumber,
        phase: room.phase,
        activePlayerRole: room.activePlayerRole,
        questions: room.questions,
        winnerRole: room.winnerRole,
        correctGuess: room.correctGuess,
        host: { name: room.host.name, score: room.host.score, isReady: Boolean(room.hostChosenForGuest) },
        guest: { name: room.guest.name, score: room.guest.score, isReady: Boolean(room.guestChosenForHost) },
        pendingGuess: room.pendingGuess,
        pendingQuestion: room.pendingQuestion,
        // Secret picture held by Guest (secret to guest unless REVEAL):
        mySecretCard: isReveal
          ? room.hostChosenForGuest
          : { isSecret: true, chosenBy: room.host.name },
        // Opponent's picture (visible to Guest):
        opponentVisibleCard: room.guestChosenForHost,
      },
    };
    room.guest.ws.send(JSON.stringify(guestPayload));
  }
}


// ---------------------------------------------------------------------------
// Voice chat ICE servers (STUN + TURN). TURN credentials are created here, on the
// backend, so they never ship inside the frontend bundle. Configure ONE of:
//
//  A) Metered.ca (managed TURN, simplest):
//       METERED_DOMAIN=yourapp.metered.live   METERED_API_KEY=...
//  B) Your own coturn with `use-auth-secret` / `static-auth-secret=...`
//       TURN_URLS="turn:turn.example.com:3478,turns:turn.example.com:5349?transport=tcp"
//       TURN_SECRET=...            (temporary credentials are generated per request)
//  C) A fixed TURN account (any provider):
//       TURN_URLS=...  TURN_USERNAME=...  TURN_CREDENTIAL=...
//
// Without any of these only STUN is returned (works on easy networks, NOT on mobile data/CGNAT).
// Render does not provide TURN: use one of the options above.
// ---------------------------------------------------------------------------
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

app.get(['/api/ice-servers', '/api/voice/ice-servers'], async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const iceServers: any[] = [...STUN_SERVERS];
  let turn: 'metered' | 'coturn-temp' | 'static' | 'none' = 'none';

  try {
    const { METERED_DOMAIN, METERED_API_KEY, TURN_URLS, TURN_SECRET, TURN_USERNAME, TURN_CREDENTIAL } = process.env;
    if (METERED_DOMAIN && METERED_API_KEY) {
      const r = await fetch(
        `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(METERED_API_KEY)}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (r.ok) {
        const list = await r.json();
        if (Array.isArray(list)) {
          iceServers.push(...list);
          turn = 'metered';
        }
      } else {
        console.warn('Metered TURN request failed:', r.status);
      }
    } else if (TURN_URLS && TURN_SECRET) {
      // coturn REST-API style temporary credentials: username = expiry timestamp.
      const username = String(Math.floor(Date.now() / 1000) + 6 * 3600);
      const credential = crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64');
      iceServers.push({ urls: TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean), username, credential });
      turn = 'coturn-temp';
    } else if (TURN_URLS && TURN_USERNAME && TURN_CREDENTIAL) {
      iceServers.push({
        urls: TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean),
        username: TURN_USERNAME,
        credential: TURN_CREDENTIAL,
      });
      turn = 'static';
    }
  } catch (err) {
    console.warn('TURN credential error:', err);
  }

  res.json({ iceServers, turn: turn !== 'none' });
});

// REST endpoints
app.get('/api/room/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ exists: false, error: 'Room not found' });
  }
  return res.json({
    exists: true,
    code: room.code,
    hostName: room.host.name,
    guestName: room.guest?.name,
    category: room.category,
    hasGuest: Boolean(room.guest),
  });
});

// WebSocket Connection Management
wss.on('connection', (ws) => {
  let userRoomCode: string | null = null;
  let userRole: 'host' | 'guest' | null = null;
  // Seat in a 3/4-player online room (see mpRooms.ts). The 2-player system below is unchanged.
  const mpCtx: MpCtx = { code: null, playerId: null };

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // 3 / 4 players online (and the voice signaling between them)
      if (mpHandle(ws, mpCtx, msg)) return;

      // 1. Host creates room
      if (msg.type === 'CREATE_ROOM') {
        const code = (msg.code || Math.random().toString(36).substring(2, 7)).toUpperCase();
        userRoomCode = code;
        userRole = 'host';

        const newRoom: OnlineRoom = {
          code,
          host: { ws, id: 'host-' + Date.now(), name: msg.playerName || 'Player 1', score: 0 },
          category: msg.category,
          targetScore: msg.targetScore || 3,
          roundNumber: 1,
          phase: 'LOBBY',
          activePlayerRole: 'host',
          questions: [],
        };

        rooms.set(code, newRoom);
        ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomCode: code, role: 'host' }));
        broadcastRoomState(newRoom);
      }

      // 2. Guest joins room
      else if (msg.type === 'JOIN_ROOM') {
        const code = msg.code?.toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
          return;
        }

        userRoomCode = code;
        userRole = 'guest';

        room.guest = {
          ws,
          id: 'guest-' + Date.now(),
          name: msg.playerName || 'Player 2',
          score: 0,
        };

        ws.send(JSON.stringify({ type: 'ROOM_JOINED', roomCode: code, role: 'guest' }));
        broadcastRoomState(room);
      }

      // 3. Start Secret Picture Selection Phase
      else if (msg.type === 'START_CHOOSING') {
        if (!userRoomCode) return;
        const room = rooms.get(userRoomCode);
        if (!room) return;

        room.phase = 'CHOOSING';
        room.hostChosenForGuest = undefined;
        room.guestChosenForHost = undefined;
        room.questions = [];
        room.winnerRole = undefined;
        room.correctGuess = undefined;
        broadcastRoomState(room);
      }

      // 4. Player Submits Secret Picture for Opponent
      else if (msg.type === 'SUBMIT_PICTURE') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room) return;

        if (userRole === 'host') {
          room.hostChosenForGuest = { imageUrl: msg.imageUrl, title: msg.title };
        } else if (userRole === 'guest') {
          room.guestChosenForHost = { imageUrl: msg.imageUrl, title: msg.title };
        }

        // When both players have submitted their secret pictures:
        if (room.hostChosenForGuest && room.guestChosenForHost) {
          room.phase = 'COUNTDOWN';
          broadcastRoomState(room);

          // Transition to PLAYING after brief countdown
          setTimeout(() => {
            if (room.phase === 'COUNTDOWN') {
              room.phase = 'PLAYING';
              room.activePlayerRole = room.roundNumber % 2 === 1 ? 'host' : 'guest';
              broadcastRoomState(room);
            }
          }, 3200);
        } else {
          broadcastRoomState(room);
        }
      }

      // 5. Ask Question (Voice or Text)
      else if (msg.type === 'ASK_QUESTION') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room || room.phase !== 'PLAYING') return;

        room.pendingQuestion = {
          id: 'q-' + Date.now(),
          question: msg.question || (msg.isVoice ? '🎙️ سؤال صوتي' : 'سؤال'),
          isVoice: Boolean(msg.isVoice),
          audioData: msg.audioData,
          askedByRole: userRole,
          answeredByRole: userRole === 'host' ? ('guest' as const) : ('host' as const),
        };

        broadcastRoomState(room);
      }

      // 6. Answer Question
      else if (msg.type === 'ANSWER_QUESTION') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room || room.phase !== 'PLAYING') return;

        const record = {
          id: msg.questionId || 'q-' + Date.now(),
          question: msg.question || (room.pendingQuestion?.isVoice ? '🎙️ سؤال صوتي' : 'سؤال'),
          isVoice: Boolean(msg.isVoice || room.pendingQuestion?.isVoice),
          isVoiceAnswer: Boolean(msg.isVoiceAnswer),
          audioData: msg.audioData || room.pendingQuestion?.audioData,
          askedByRole: userRole === 'host' ? ('guest' as const) : ('host' as const),
          answeredByRole: userRole,
          answer: msg.answer,
          note: msg.note ? String(msg.note).trim() : undefined,
          timestamp: Date.now(),
        };

        room.questions.unshift(record);
        room.pendingQuestion = undefined;
        // Switch turn to respondent to ask their own question!
        room.activePlayerRole = userRole;
        broadcastRoomState(room);
      }

      // 6B. Real-time Live Voice WebRTC signaling
      else if (msg.type === 'VOICE_SIGNAL') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room) return;
        const targetWs = userRole === 'host' ? room.guest?.ws : room.host.ws;
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({
            type: 'VOICE_SIGNAL',
            from: userRole,
            fromRole: userRole,
            signal: msg.signal,
          }));
        }
      }

      // 7. CONFIRM_WIN / DECLARE_WIN: Secret card owner confirms that the asker's question was the winning guess!
      else if (msg.type === 'CONFIRM_WIN' || msg.type === 'DECLARE_WIN') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room || room.phase !== 'PLAYING') return;

        // The asker is the other player
        const winnerRole = userRole === 'host' ? 'guest' : 'host';
        const guessText = msg.question || room.pendingQuestion?.question || '';

        room.phase = 'REVEAL';
        room.winnerRole = winnerRole;
        room.correctGuess = guessText;
        room.pendingQuestion = undefined;
        room.pendingGuess = undefined;

        if (winnerRole === 'host') room.host.score += 1;
        else if (room.guest) room.guest.score += 1;

        if (room.host.score >= room.targetScore || (room.guest && room.guest.score >= room.targetScore)) {
          room.phase = 'GAMEOVER';
        }

        broadcastRoomState(room);
      }

      // 7B. Make a Guess (Legacy fallback)
      else if (msg.type === 'MAKE_GUESS') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room || room.phase !== 'PLAYING') return;

        // The opponent who chose the image is responsible for judging the guess
        room.pendingGuess = {
          guesserRole: userRole,
          guesserName: userRole === 'host' ? room.host.name : (room.guest?.name || 'Player 2'),
          guessText: msg.guess,
        };

        broadcastRoomState(room);
      }

      // 7B. Resolve Guess (Judged by Opponent)
      else if (msg.type === 'RESOLVE_GUESS') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room || !room.pendingGuess) return;

        const guesserRole = room.pendingGuess.guesserRole;
        const guessText = room.pendingGuess.guessText;

        if (msg.isCorrect) {
          // Opponent confirmed: Correct! Round won immediately
          room.phase = 'REVEAL';
          room.winnerRole = guesserRole;
          room.correctGuess = guessText;

          if (guesserRole === 'host') room.host.score += 1;
          else if (room.guest) room.guest.score += 1;

          room.pendingGuess = undefined;

          // Check if match over
          if (room.host.score >= room.targetScore || (room.guest && room.guest.score >= room.targetScore)) {
            room.phase = 'GAMEOVER';
          }

          broadcastRoomState(room);
        } else {
          // Opponent indicated: Wrong guess!
          // No penalty: turn passes to opponent so they can ask their question!
          room.pendingGuess = undefined;
          room.activePlayerRole = guesserRole === 'host' ? 'guest' : 'host';
          const rejectionPayload = JSON.stringify({
            type: 'GUESS_REJECTED',
            guesserRole,
            guess: guessText,
            message: 'التخمين غير صحيح، وتستمر اللعبة!',
          });
          room.host.ws?.send(rejectionPayload);
          room.guest?.ws?.send(rejectionPayload);
          broadcastRoomState(room);
        }
      }

      // 8. Next Round
      else if (msg.type === 'NEXT_ROUND') {
        if (!userRoomCode) return;
        const room = rooms.get(userRoomCode);
        if (!room) return;

        if (room.phase === 'GAMEOVER') {
          // Reset match
          room.host.score = 0;
          if (room.guest) room.guest.score = 0;
          room.roundNumber = 1;
        } else {
          room.roundNumber += 1;
        }

        room.phase = 'CHOOSING';
        room.hostChosenForGuest = undefined;
        room.guestChosenForHost = undefined;
        room.questions = [];
        room.winnerRole = undefined;
        room.correctGuess = undefined;
        broadcastRoomState(room);
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    mpClose(mpCtx);
    if (userRoomCode) {
      const room = rooms.get(userRoomCode);
      if (room) {
        // Abrupt disconnect: tell the other player's voice engine so it resets cleanly
        // and waits for this player to come back (no stale connection, no endless spinner).
        const otherWs = userRole === 'host' ? room.guest?.ws : room.host.ws;
        if (otherWs && otherWs.readyState === WebSocket.OPEN) {
          otherWs.send(JSON.stringify({ type: 'VOICE_SIGNAL', from: userRole, fromRole: userRole, signal: { type: 'bye' } }));
        }
        if (userRole === 'host') {
          // If host leaves, notify guest
          room.guest?.ws?.send(JSON.stringify({ type: 'HOST_DISCONNECTED' }));
        } else if (userRole === 'guest') {
          room.guest = undefined;
          broadcastRoomState(room);
        }
      }
    }
  });
});

// Mount Vite in dev mode or serve static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
