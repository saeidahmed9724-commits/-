import WebSocket from 'ws';
import { spawn } from 'child_process';
const srv = spawn('npx', ['tsx', 'server.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: '3200' }, stdio: 'ignore', detached: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n + (ok ? '' : ' ' + extra)); };
async function waitUp() { for (let i = 0; i < 60; i++) { try { const r = await fetch('http://localhost:3200/api/ice-servers'); if (r.ok) return; } catch {} await sleep(500); } }
function client(name) {
  const c = { name, state: null, id: null, events: [], voice: [], ws: new WebSocket('ws://localhost:3200') };
  c.ws.on('message', (d) => { const m = JSON.parse(d); c.events.push(m);
    if (m.type === 'MP_STATE') c.state = m.room; if (m.type === 'MP_JOINED') c.id = m.playerId; if (m.type === 'VOICE_SIGNAL') c.voice.push(m); });
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
    // cannot target self
    cs[0].send({ type: 'MP_ASK', targetId: cs[0].id, question: 'self?' }); await sleep(80);
    check(`${n}p: cannot target yourself`, !cs[0].state.pendingQuestion);
    cs[0].send({ type: 'MP_ASK', targetId: cs[1].id, question: 'Is it red?' }); await sleep(100);
    check(`${n}p: question reaches everyone`, cs.every((c) => c.state.pendingQuestion?.question === 'Is it red?'));
    cs[2].send({ type: 'MP_ANSWER', answer: 'YES' }); await sleep(80);
    check(`${n}p: only the target owner can answer`, Boolean(cs[0].state.pendingQuestion));
    cs[1].send({ type: 'MP_ANSWER', answer: 'NO', note: 'nope' }); await sleep(100);
    check(`${n}p: answer logged, turn passes to P2`, cs[0].state.questions[0].answer === 'NO' && cs[0].state.activePlayerId === cs[1].id);
    // P2 asks P1 and P1 declares win
    cs[1].send({ type: 'MP_ASK', targetId: cs[0].id, question: 'Is it T0?' }); await sleep(100);
    cs[0].send({ type: 'MP_DECLARE_WIN' }); await sleep(100);
    const p2 = cs[0].state.players.find((p) => p.id === cs[1].id);
    check(`${n}p: win -> +1 for asker and picture revealed to all`, p2.score === 1 && p2.solved[cs[0].id]?.title === 'T0' && cs[2].state.lastSolved?.title === 'T0');
    // solved target cannot be asked again by P2 -> after P3's turn
    const nextActive = cs.find((c) => c.id === cs[0].state.activePlayerId);
    check(`${n}p: turn advanced after win`, nextActive && nextActive !== cs[1]);
    // voice signaling relay (to a specific player)
    cs[0].send({ type: 'VOICE_SIGNAL', to: cs[2].id, signal: { type: 'ready' } }); await sleep(100);
    check(`${n}p: voice signal reaches only the addressed player`, cs[2].voice.some((v) => v.from === cs[0].id && v.signal.type === 'ready') && !cs[1].voice.some((v) => v.signal.type === 'ready' && v.from === cs[0].id));
    // disconnect + rejoin mid-game
    const dropped = cs[2]; dropped.ws.close(); await sleep(250);
    check(`${n}p: dropped player flagged disconnected, others notified (bye)`, cs[0].state.players.find((p) => p.id === dropped.id).connected === false && cs[0].voice.some((v) => v.signal.type === 'bye' && v.from === dropped.id));
    const back = client('P3'); await back.open; back.send({ type: 'JOIN_ROOM', code, playerName: 'P3' }); await sleep(250);
    check(`${n}p: same name rejoins the same seat with its secret`, back.id === dropped.id && back.state?.mySecret?.title === 'T2');
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
      const tgt = act.state.players.find((p) => p.id !== act.id && !me.solved[p.id]);
      act.send({ type: 'MP_ASK', targetId: tgt.id, question: 'q' }); await sleep(60);
      cs.find((c) => c.id === tgt.id).send({ type: 'MP_DECLARE_WIN' }); await sleep(60);
    }
    const final = cs[0].state;
    check(`${n}p: match ends in GAMEOVER when nothing is left`, final.phase === 'GAMEOVER');
    check(`${n}p: everyone scored n-1 and secrets revealed`, final.players.every((p) => p.score === n - 1 && p.secret));
    cs[0].send({ type: 'MP_PLAY_AGAIN' }); await sleep(150);
    check(`${n}p: play again -> CHOOSING with scores reset`, cs[0].state.phase === 'CHOOSING' && cs[0].state.players.every((p) => p.score === 0 && !p.hasPicked));
    cs.forEach((c) => c.ws.close()); await sleep(100);
  }
  // lobby host leaves -> room closed
  const { code, cs } = await room(3);
  cs[0].ws.close(); await sleep(200);
  check('lobby: host leaves -> others get ROOM_CLOSED', cs[1].events.some((e) => e.type === 'MP_ROOM_CLOSED'));
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
} finally { try { process.kill(-srv.pid, 9); } catch {} console.log(`\nSUMMARY: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0); }
