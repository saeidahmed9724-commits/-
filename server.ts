import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { normalizeText, isCorrectGuess } from './src/utils/normalize';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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
  winnerRole?: 'host' | 'guest';
  correctGuess?: string;
}

const rooms = new Map<string, OnlineRoom>();

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

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

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

      // 5. Ask Question
      else if (msg.type === 'ASK_QUESTION') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room || room.phase !== 'PLAYING') return;

        const newQ = {
          id: 'q-' + Date.now(),
          question: msg.question,
          askedByRole: userRole,
          answeredByRole: userRole === 'host' ? ('guest' as const) : ('host' as const),
          answer: 'PENDING' as any,
          timestamp: Date.now(),
        };

        // Broadcast question to both so respondent can answer
        const payload = JSON.stringify({ type: 'QUESTION_PENDING', questionRecord: newQ });
        room.host.ws?.send(payload);
        room.guest?.ws?.send(payload);
      }

      // 6. Answer Question
      else if (msg.type === 'ANSWER_QUESTION') {
        if (!userRoomCode || !userRole) return;
        const room = rooms.get(userRoomCode);
        if (!room || room.phase !== 'PLAYING') return;

        const record = {
          id: msg.questionId || 'q-' + Date.now(),
          question: msg.question,
          askedByRole: userRole === 'host' ? ('guest' as const) : ('host' as const),
          answeredByRole: userRole,
          answer: msg.answer,
          note: msg.note ? String(msg.note).trim() : undefined,
          timestamp: Date.now(),
        };

        room.questions.unshift(record);
        // Switch turn to respondent
        room.activePlayerRole = userRole;
        broadcastRoomState(room);
      }

      // 7. Make a Guess (Sent to opponent for manual confirmation)
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
          // No penalty / loss of match: game continues normally
          room.pendingGuess = undefined;
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
    if (userRoomCode) {
      const room = rooms.get(userRoomCode);
      if (room) {
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
