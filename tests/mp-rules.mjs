import WebSocket from 'ws';
import { spawn } from 'child_process';
const srv = spawn('npx', ['tsx', 'server.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: '3200', RESUME_GRACE_MS: '900' }, stdio: 'ignore', detached: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n + (ok ? '' : ' ' + extra)); };
async function waitUp() { for (let i = 0; i < 60; i++) { try { const r = await fetch('http://localhost:3200/api/ice-servers'); if (r.ok) return; } catch {} await sleep(500); } }
function client(name) {
  const c = { name, state: null, id: null, events: [], voice: [], ws: new WebSocket('ws://localhost:3200') };
  c.ws.on('message', (d) => { const m = JSON.parse(d); c.events.push(m);
    if (m.type === 'MP_STATE') c.state = m.room; if (m.type === 'MP_JOINED') c.id = m.playerId; if (m.type === 'VOICE_SIGNAL') c.voice.push(m);
    if (m.token) c.token = m.token; if (m.type === 'ROOM_UPDATE') c.room2 = m.room; });
  c.send = (o) => c.ws.send(JSON.stringify(o));
  c.open = new Promise((r) => c.ws.on('open', r));
  return c;
}
const cat = { id: 'food', presetItems: [] };
async function room(n) {
  await waitUp();
  const code = 'T' + n + Math.floor(Math.random() * 1000);
  const cs = Array.from({ length: n }, (_, i) => client('P' + (i + 1)));
  await Promise.all(cs.map((c) => c.open));
  cs[0].send({ type: 'MP_CREATE', code, playerName: 'P1', category: cat, maxPlayers: n }); await sleep(150);
  for (let i = 1; i < n; i++) { cs[i].send({ type: 'JOIN_ROOM', code, playerName: 'P' + (i + 1) }); await sleep(100); }
  return { code, cs };
}
try {
  for (const n of [3, 4]) {
    console.log(`\n== ${n} players ==`);
    const { code, cs } = await room(n);
    check(`${n}p: all seated, distinct ids`, new Set(cs.map((c) => c.id)).size === n && cs.every((c) => c.state?.players.length === n));
    cs[1].send({ type: 'MP_START' }); await sleep(100);
    check(`${n}p: non-host cannot start`, cs[0].state.phase === 'LOBBY');
    cs[0].send({ type: 'MP_START' }); await sleep(150);
    check(`${n}p: host starts -> CHOOSING`, cs.every((c) => c.state.phase === 'CHOOSING'));
    cs[0].send({ type: 'MP_SUBMIT_PICTURE', imageUrl: 'javascript:alert(1)', title: 'x' }); await sleep(80);
    check(`${n}p: unsafe image URL (javascript:) rejected`, !cs[0].state.mySecret);
    cs[0].send({ type: 'MP_SUBMIT_PICTURE', imageUrl: 'data:image/png;base64,' + 'A'.repeat(310000), title: 'big' }); await sleep(150);
    check(`${n}p: oversized image data rejected`, !cs[0].state.mySecret);
    const SMALL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    for (let i = 0; i < n; i++) { cs[i].send({ type: 'MP_SUBMIT_PICTURE', imageUrl: i === 0 ? SMALL_PNG : 'https://example.com/' + i + '.png', title: 'T' + i }); await sleep(80); }
    check(`${n}p: uploaded (data URL) and searched (https) pictures are both accepted`, cs[0].state.mySecret?.imageUrl === SMALL_PNG && cs[1].state.mySecret?.imageUrl.startsWith('https://'));
    check(`${n}p: all picked -> PLAYING`, cs.every((c) => c.state.phase === 'PLAYING'));
    check(`${n}p: secrets are private (others cannot see my picture)`, cs.every((c) => c.state.players.every((p) => p.secret === undefined)) && cs[0].state.mySecret?.title === 'T0');
    const active = () => cs.find((c) => c.state.activePlayerId === c.id);
    let a = active(); check(`${n}p: exactly one active player, P1 first`, a === cs[0]);
    // wrong player asking is rejected
    cs[1].send({ type: 'MP_ASK', targetId: cs[2].id, question: 'x?' }); await sleep(80);
    check(`${n}p: non-active player cannot ask`, !cs[0].state.pendingQuestion);
    // MANDATORY ORGANISATION: the game assigns the target; a forged targetId (even yourself) is ignored
    const t1 = cs[0].state.turn;
    check(`${n}p: server publishes who asks whom (P1 -> P2)`, t1?.askerId === cs[0].id && t1?.targetId === cs[1].id);
    check(`${n}p: everyone sees the same turn + an up-next list`, cs.every((c) => c.state.turn?.targetId === t1.targetId) && cs[0].state.upcoming.length > 0);
    cs[0].send({ type: 'MP_ASK', targetId: cs[0].id, question: 'Is it red?' }); await sleep(100);
    check(`${n}p: question reaches everyone`, cs.every((c) => c.state.pendingQuestion?.question === 'Is it red?'));
    check(`${n}p: forged targetId ignored - question goes to the assigned target`, cs[0].state.pendingQuestion.targetOwnerId === cs[1].id);
    cs[0].send({ type: 'MP_ASK', question: 'second?' }); await sleep(60);
    check(`${n}p: second question while one is pending is refused (BUSY)`, cs[0].events.some((e) => e.type === 'MP_ERROR' && e.code === 'BUSY') && cs[0].state.pendingQuestion.question === 'Is it red?');
    cs[2].send({ type: 'MP_ANSWER', answer: 'YES' }); await sleep(80);
    check(`${n}p: only the target owner can answer`, Boolean(cs[0].state.pendingQuestion) && cs[2].events.some((e) => e.type === 'MP_ERROR' && e.code === 'NOT_YOUR_QUESTION'));
    cs[0].send({ type: 'MP_ANSWER', answer: 'YES' }); cs[2].send({ type: 'MP_DECLARE_WIN' }); await sleep(80);
    check(`${n}p: asker / bystander can neither answer nor declare the win`, Boolean(cs[0].state.pendingQuestion) && cs[0].state.players.every((p) => p.score === 0));
    cs[1].send({ type: 'MP_ANSWER', answer: 'MAYBE' }); await sleep(60);
    check(`${n}p: invalid answer refused`, cs[1].events.some((e) => e.type === 'MP_ERROR' && e.code === 'BAD_ANSWER') && Boolean(cs[0].state.pendingQuestion));
    cs[1].send({ type: 'MP_ANSWER', answer: 'NO', note: 'nope' }); await sleep(100);
    check(`${n}p: answer logged, turn passes to P2`, cs[0].state.questions[0].answer === 'NO' && cs[0].state.activePlayerId === cs[1].id);
    // P2 asks the target the game assigned and that target declares the win
    const t2 = cs[1].state.turn; const tc = cs.find((c) => c.id === t2.targetId); const ti = cs.indexOf(tc);
    check(`${n}p: fair rotation - P2 is given someone P1 did not ask (P3)`, t2.askerId === cs[1].id && t2.targetId === cs[2].id);
    for (const type of ['MP_SKIP_TURN', 'MP_SET_TARGET', 'MP_SWAP_TURN']) cs[1].send({ type, targetId: cs[0].id });
    await sleep(80);
    check(`${n}p: no message exists to skip / swap a turn`, cs[1].events.filter((e) => e.type === 'MP_ERROR' && e.code === 'UNKNOWN_MESSAGE').length === 3 && cs[0].state.turn.targetId === t2.targetId);
    cs[1].send({ type: 'MP_ASK', targetId: cs[0].id, question: 'Is it that?' }); await sleep(100);
    tc.send({ type: 'MP_DECLARE_WIN' }); await sleep(100);
    const p2 = cs[0].state.players.find((p) => p.id === cs[1].id);
    check(`${n}p: win -> +1 for asker and picture revealed to all`, p2.score === 1 && p2.solved[tc.id]?.title === 'T' + ti && cs[0].state.lastSolved?.title === 'T' + ti);
    // solved target cannot be asked again by P2 -> after P3's turn
    const nextActive = cs.find((c) => c.id === cs[0].state.activePlayerId);
    check(`${n}p: turn advanced after win`, nextActive && nextActive !== cs[1]);
    // voice signaling relay (to a specific player)
    cs[0].send({ type: 'VOICE_SIGNAL', to: cs[2].id, signal: { type: 'ready' } }); await sleep(100);
    check(`${n}p: voice signal reaches only the addressed player`, cs[2].voice.some((v) => v.from === cs[0].id && v.signal.type === 'ready') && !cs[1].voice.some((v) => v.signal.type === 'ready' && v.from === cs[0].id));
    // disconnect + rejoin mid-game
    const dropped = cs[2]; dropped.ws.close(); await sleep(250);
    check(`${n}p: dropped player flagged disconnected, others notified (bye)`, cs[0].state.players.find((p) => p.id === dropped.id).connected === false && cs[0].voice.some((v) => v.signal.type === 'bye' && v.from === dropped.id));
    const back0 = client('P3'); await back0.open; back0.send({ type: 'JOIN_ROOM', code, playerName: 'P3' }); await sleep(250);
    check(`${n}p: same name rejoins the same seat with its secret`, back0.id === dropped.id && back0.state?.mySecret?.title === 'T2');
    // REFRESH: new socket + the secret token takes the seat back even while the old socket is still open
    const back = client('P3'); await back.open; back.send({ type: 'MP_RESUME', code, token: back0.token }); await sleep(250);
    check(`${n}p: token resume restores the seat, secret and score`, back.id === dropped.id && back.state?.mySecret?.title === 'T2' && cs[0].state.players.find((p) => p.id === dropped.id).connected === true);
    back0.ws.close(); await sleep(250);
    check(`${n}p: the stale socket closing does not disconnect the resumed player`, cs[0].state.players.find((p) => p.id === dropped.id).connected === true);
    const bad = client('bad'); await bad.open;
    bad.send({ type: 'MP_RESUME', code, token: 'not-a-real-token' }); await sleep(100);
    check(`${n}p: a wrong token cannot take a seat`, bad.events.some((e) => e.type === 'RESUME_FAILED') && !bad.id);
    bad.send({ type: 'MP_RESUME', code: 'NOROOM', token: back.token }); await sleep(100);
    check(`${n}p: resuming a room that does not exist fails cleanly`, bad.events.filter((e) => e.type === 'RESUME_FAILED').length === 2);
    bad.ws.close();
    // extra joiner rejected
    const late = client('late'); await late.open; late.send({ type: 'JOIN_ROOM', code, playerName: 'Late' }); await sleep(150);
    check(`${n}p: late joiner rejected after start`, late.events.some((e) => e.type === 'ERROR'));
    late.ws.close();
    // play it out: each active asks first unsolved candidate, owner declares win
    cs[2] = back; let guard = 0;
    while (cs[0].state.phase === 'PLAYING' && guard++ < 40) {
      const act = cs.find((c) => c.state && c.state.activePlayerId === c.id);
      if (!act) break;
      const me = act.state.players.find((p) => p.id === act.id);
      const tgt = act.state.players.find((p) => p.id === act.state.turn.targetId);
      if (me.solved[tgt.id]) { check(`${n}p: a solved picture is never assigned again`, false); break; }
      act.send({ type: 'MP_ASK', question: 'q' }); await sleep(60);
      cs.find((c) => c.id === tgt.id).send({ type: 'MP_DECLARE_WIN' }); await sleep(60);
    }
    const final = cs[0].state;
    check(`${n}p: match ends in GAMEOVER when nothing is left`, final.phase === 'GAMEOVER');
    check(`${n}p: everyone scored n-1 and secrets revealed`, final.players.every((p) => p.score === n - 1 && p.secret));
    cs[0].send({ type: 'MP_PLAY_AGAIN' }); await sleep(150);
    check(`${n}p: play again -> CHOOSING with scores reset`, cs[0].state.phase === 'CHOOSING' && cs[0].state.players.every((p) => p.score === 0 && !p.hasPicked));
    cs.forEach((c) => c.ws.close()); await sleep(100);
  }
  // lobby: leaving on purpose frees the seat / closes the room right away
  const { code, cs } = await room(3);
  cs[0].send({ type: 'MP_LEAVE' }); await sleep(200);
  check('lobby: host leaves on purpose -> others get ROOM_CLOSED', cs[1].events.some((e) => e.type === 'MP_ROOM_CLOSED'));
  const L0 = await room(3);
  L0.cs[2].send({ type: 'MP_LEAVE' }); await sleep(200);
  check('lobby: guest leaves on purpose -> seat freed immediately', L0.cs[0].state.players.length === 2);
  L0.cs.forEach((c) => c.ws.close());
  // lobby: a refresh (abrupt close) keeps the seat for a grace period
  const L = await room(3);
  L.cs[1].ws.close(); await sleep(250);
  check('lobby: dropped guest keeps the seat (flagged disconnected)', L.cs[0].state.players.length === 3 && L.cs[0].state.players[1].connected === false);
  L.cs[0].send({ type: 'MP_START' }); await sleep(100);
  check('lobby: the game cannot start while a seated player is disconnected', L.cs[0].state.phase === 'LOBBY');
  const r1 = client('P2'); await r1.open; r1.send({ type: 'MP_RESUME', code: L.code, token: L.cs[1].token }); await sleep(200);
  check('lobby: token resume gives the seat back', r1.id === L.cs[1].id && L.cs[0].state.players[1].connected === true && r1.state.players.length === 3);
  L.cs[0].ws.close(); await sleep(250);
  check('lobby: host refresh does not close the room', !r1.events.some((e) => e.type === 'MP_ROOM_CLOSED') && r1.state.players[0].connected === false);
  const h2 = client('P1'); await h2.open; h2.send({ type: 'MP_RESUME', code: L.code, token: L.cs[0].token }); await sleep(200);
  check('lobby: host resumes and is still the host', h2.state?.hostId === h2.id && h2.state.players.length === 3);
  h2.ws.close(); await sleep(1400);
  check('lobby: host never returns -> room closes after the grace period', r1.events.some((e) => e.type === 'MP_ROOM_CLOSED'));
  L.cs.forEach((c) => c.ws.close()); r1.ws.close();
  // a match in progress: refresh = a moment of absence; the game waits for the player, then moves on
  console.log('\n== 3 players: refresh during a match ==');
  const M = await room(3);
  M.cs[0].send({ type: 'MP_START' }); await sleep(120);
  for (let i = 0; i < 3; i++) { M.cs[i].send({ type: 'MP_SUBMIT_PICTURE', imageUrl: 'https://example.com/m' + i + '.png', title: 'M' + i }); await sleep(60); }
  const live = () => M.cs.filter((c) => c.ws.readyState === 1);
  const act = live().find((c) => c.state.activePlayerId === c.id);
  act.send({ type: 'MP_ASK', question: 'pending?' }); await sleep(100);
  const tid = act.state.pendingQuestion.targetOwnerId; const tgt = M.cs.find((c) => c.id === tid);
  tgt.ws.close(); await sleep(250);
  check('match: target dropped -> the question is kept (not auto-answered) during the grace period', Boolean(act.state.pendingQuestion) && act.state.questions.length === 0 && act.state.players.find((p) => p.id === tid).connected === false);
  const tgt2 = client('T'); await tgt2.open; tgt2.send({ type: 'MP_RESUME', code: M.code, token: tgt.token }); await sleep(200);
  M.cs[M.cs.indexOf(tgt)] = tgt2;
  check('match: the target resumes and still sees the pending question', tgt2.id === tid && tgt2.state.pendingQuestion?.question === 'pending?' && tgt2.state.mySecret?.title === 'M' + (M.cs.indexOf(tgt2)));
  tgt2.send({ type: 'MP_ANSWER', answer: 'YES' }); await sleep(120);
  check('match: the resumed target answers and the game moves on', act.state.questions.length === 1 && act.state.activePlayerId !== act.id);
  // the asker refreshes before asking: it is still their turn afterwards
  const asker2 = live().find((c) => c.state.activePlayerId === c.id);
  const turnBefore = asker2.state.turn;
  asker2.ws.close(); await sleep(250);
  const asker2b = client('A'); await asker2b.open; asker2b.send({ type: 'MP_RESUME', code: M.code, token: asker2.token }); await sleep(200);
  M.cs[M.cs.indexOf(asker2)] = asker2b;
  check('match: asker refresh -> same turn, same assigned target', asker2b.state.activePlayerId === asker2b.id && asker2b.state.turn.targetId === turnBefore.targetId);
  // a target that never comes back: after the grace period the question is closed as 'not sure' and the turn moves on
  asker2b.send({ type: 'MP_ASK', question: 'gone?' }); await sleep(100);
  const tid2 = asker2b.state.pendingQuestion.targetOwnerId; const gone = M.cs.find((c) => c.id === tid2);
  gone.ws.close(); await sleep(1400);
  const watcher = live()[0];
  check('match: target never returns -> question closed as not-sure after the grace period, turn moves on', !watcher.state.pendingQuestion && watcher.state.questions[0].note === '📴' && watcher.state.activePlayerId !== undefined);
  M.cs.forEach((c) => { try { c.ws.close(); } catch {} });
  // invalid count
  const x = client('x'); await x.open; x.send({ type: 'MP_CREATE', code: 'BAD1', playerName: 'x', category: cat, maxPlayers: 2 }); await sleep(100);
  check('create with 2 is not an MP room (rejected)', x.events.some((e) => e.type === 'ERROR'));
  // legacy 2-player flow still works
  const h = client('h'), g = client('g'); await Promise.all([h.open, g.open]);
  h.send({ type: 'CREATE_ROOM', code: 'LEG2', playerName: 'H', category: cat, targetScore: 3 }); await sleep(100);
  g.send({ type: 'JOIN_ROOM', code: 'LEG2', playerName: 'G' }); await sleep(150);
  check('2p legacy room unaffected (host/guest join)', h.events.some((e) => e.type === 'ROOM_UPDATE' && e.room.guest) && g.events.some((e) => e.type === 'ROOM_JOINED'));
  h.send({ type: 'VOICE_SIGNAL', signal: { type: 'ready' } }); await sleep(100);
  check('2p voice relay carries `from`', g.voice.some((v) => v.from === 'host'));

  // ---- 2-player rooms: refresh / dropped connection keeps the match ----
  console.log('\n== 2 players: refresh keeps the match ==');
  const RC = 'RS' + Math.floor(Math.random() * 9000 + 1000);
  const H = client('H'), G = client('G'); await Promise.all([H.open, G.open]);
  H.send({ type: 'CREATE_ROOM', code: RC, playerName: 'Hana', category: cat, targetScore: 3 }); await sleep(120);
  G.send({ type: 'JOIN_ROOM', code: RC, playerName: 'Gad' }); await sleep(150);
  check('2p: host and guest each get a secret token', Boolean(H.token) && Boolean(G.token) && H.token !== G.token);
  const intruder = client('X'); await intruder.open;
  intruder.send({ type: 'JOIN_ROOM', code: RC, playerName: 'Other' }); await sleep(120);
  check('2p: a third person cannot take the guest seat', intruder.events.some((e) => e.type === 'ERROR') && H.room2.guest.name === 'Gad');
  intruder.ws.close();
  H.send({ type: 'START_CHOOSING' }); await sleep(80);
  H.send({ type: 'SUBMIT_PICTURE', imageUrl: 'https://example.com/a.png', title: 'A' }); G.send({ type: 'SUBMIT_PICTURE', imageUrl: 'https://example.com/b.png', title: 'B' });
  await sleep(3700);
  check('2p: both picked -> PLAYING', H.room2.phase === 'PLAYING' && G.room2.phase === 'PLAYING');
  H.send({ type: 'ASK_QUESTION', question: 'q1' }); await sleep(100);
  G.send({ type: 'ANSWER_QUESTION', question: 'q1', answer: 'YES' }); await sleep(120);
  check('2p: question answered, turn passed to the guest', H.room2.questions.length === 1 && H.room2.activePlayerRole === 'guest');
  // the guest refreshes the page
  G.ws.close(); await sleep(250);
  check('2p: host sees the guest as disconnected but still seated', H.room2.guest?.name === 'Gad' && H.room2.guest.connected === false);
  check('2p: host voice engine is told to reset (bye)', H.voice.some((v) => v.signal.type === 'bye' && v.from === 'guest'));
  const G2 = client('G'); await G2.open; G2.send({ type: 'RESUME_ROOM', code: RC, token: G.token }); await sleep(200);
  check('2p: guest resumes into the same match (phase, history, turn)', G2.events.some((e) => e.type === 'ROOM_RESUMED' && e.role === 'guest') && G2.room2?.phase === 'PLAYING' && G2.room2.questions.length === 1 && G2.room2.activePlayerRole === 'guest' && G2.room2.guest.name === 'Gad');
  check('2p: host sees the guest connected again', H.room2.guest.connected === true);
  const bad2 = client('bad'); await bad2.open;
  bad2.send({ type: 'RESUME_ROOM', code: RC, token: 'wrong' }); bad2.send({ type: 'RESUME_ROOM', code: 'NOPE1', token: G.token }); await sleep(120);
  check('2p: wrong token / unknown room cannot resume', bad2.events.filter((e) => e.type === 'RESUME_FAILED').length === 2 && !bad2.room2);
  bad2.ws.close();
  // the host resumes on a new socket while the old one is still open: the old one is dropped, nobody is kicked
  const H2 = client('H'); await H2.open; H2.send({ type: 'RESUME_ROOM', code: RC, token: H.token }); await sleep(250);
  check('2p: host token resume works while the old socket is open', H2.room2?.phase === 'PLAYING' && G2.room2.host.connected === true);
  // the guest leaves on purpose: the seat is freed right away
  G2.send({ type: 'LEAVE_ROOM' }); await sleep(150);
  check('2p: guest leaves on purpose -> seat freed immediately', H2.room2.guest === undefined);
  // a new guest, then the host disappears for good
  const G3 = client('G3'); await G3.open; G3.send({ type: 'JOIN_ROOM', code: RC, playerName: 'Gina' }); await sleep(150);
  check('2p: after leaving, the seat can be taken by someone else', G3.events.some((e) => e.type === 'ROOM_JOINED'));
  H2.ws.close(); await sleep(1400);
  check('2p: host never returns -> guest is told and the room is deleted', G3.events.some((e) => e.type === 'HOST_DISCONNECTED') && (await fetch(`http://localhost:3200/api/room/${RC}`)).status === 404);
  [H, G, G2, G3, H2].forEach((c) => { try { c.ws.close(); } catch {} });
} finally { try { process.kill(-srv.pid, 9); } catch {} console.log(`\nSUMMARY: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0); }
