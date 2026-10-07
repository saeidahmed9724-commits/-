// End-to-end test of the friends system against a REAL server: accounts over HTTP, presence and
// invitations over /ws/social, and the invitations actually landing in REAL game rooms (2 and 3 players).
import WebSocket from 'ws';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PORT = 3201;
const BASE = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-e2e-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n + (ok ? '' : ' ' + extra)); };

let srv;
function startServer() {
  srv = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: process.env.TEST_VERBOSE ? 'inherit' : 'ignore' });
  return waitUp();
}
async function stopServer() { srv.kill('SIGTERM'); await new Promise((r) => srv.once('exit', r)); }
async function waitUp() { for (let i = 0; i < 80; i++) { try { const r = await fetch(`${BASE}/api/ice-servers`); if (r.ok) return; } catch {} await sleep(250); } throw new Error('server did not start'); }

const post = (url, body) => fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));

/** A social-channel client that records everything the server sends. */
function social(acct, { auth = true } = {}) {
  const c = { acct, events: [], state: null, closed: null, ws: new WebSocket(`ws://localhost:${PORT}/ws/social`), n: 0, pending: new Map() };
  c.ws.on('message', (d) => {
    const m = JSON.parse(d); c.events.push(m);
    if (m.type === 'F_STATE') c.state = m;
    if (m.type === 'F_REPLY' && c.pending.has(m.reqId)) { c.pending.get(m.reqId)(m); c.pending.delete(m.reqId); }
  });
  c.ws.on('close', (code) => { c.closed = code; });
  c.open = new Promise((r) => c.ws.on('open', r));
  c.raw = (o) => c.ws.send(JSON.stringify(o));
  c.req = (o) => new Promise((res) => { const reqId = 'r' + ++c.n; c.pending.set(reqId, res); c.raw({ ...o, reqId }); });
  c.has = (type, pred = () => true) => c.events.some((e) => e.type === type && pred(e));
  c.last = (type) => [...c.events].reverse().find((e) => e.type === type);
  c.until = async (fn, ms = 2500) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(30); } return false; };
  if (auth) c.open.then(() => c.raw({ type: 'F_AUTH', userId: acct.user.id, token: acct.token }));
  return c;
}
/** A game-channel client (same socket the game already uses). */
function game() {
  const c = { events: [], ws: new WebSocket(`ws://localhost:${PORT}`) };
  c.ws.on('message', (d) => c.events.push(JSON.parse(d)));
  c.open = new Promise((r) => c.ws.on('open', r));
  c.send = (o) => c.ws.send(JSON.stringify(o));
  c.has = (type) => c.events.some((e) => e.type === type);
  c.lastRoom = () => { const e = [...c.events].reverse().find((x) => x.type === 'ROOM_UPDATE' || x.type === 'MP_STATE'); return e?.room; };
  return c;
}
const cat = { id: 'general', presetItems: [] };

try {
  await startServer();

  // ------------------------------------------------------------ accounts (HTTP)
  console.log('\n== accounts ==');
  const A = (await post('/api/account', { name: 'سعيد', username: 'Saeed123', avatar: '🦊' })).body;
  const B = (await post('/api/account', { name: 'Ahmed', username: 'ahmed' })).body;
  const C = (await post('/api/account', { name: 'Saida', username: 'saida' })).body;
  check('register: returns a profile (username normalised) and a token', A.user.username === 'saeed123' && A.user.avatar === '🦊' && A.token.length >= 32);
  const dup = await post('/api/account', { name: 'x', username: 'AHMED' });
  check('register: taken username -> 409 USERNAME_TAKEN', dup.status === 409 && dup.body.error === 'USERNAME_TAKEN');
  const bad = await post('/api/account', { name: 'x', username: 'a b' });
  check('register: invalid username -> 400', bad.status === 400 && bad.body.error === 'INVALID_USERNAME');
  const avail = await (await fetch(`${BASE}/api/account/username-available?u=ahmed`)).json();
  const avail2 = await (await fetch(`${BASE}/api/account/username-available?u=fresh_name`)).json();
  check('username-available works', avail.available === false && avail2.available === true);

  // ------------------------------------------------------------ auth on the social socket
  console.log('\n== social socket auth ==');
  const intruder = social({ user: A.user, token: 'wrong-token' });
  await intruder.until(() => intruder.closed !== null);
  check('wrong token -> F_AUTH_FAIL and the socket is closed (4003)', intruder.has('F_AUTH_FAIL') && intruder.closed === 4003);
  const anon = social(A, { auth: false });
  await anon.open;
  const un = await anon.req({ type: 'F_ADD', username: 'ahmed' });
  check('requests before F_AUTH are refused', un.ok === false && un.code === 'UNAUTHENTICATED');
  anon.ws.close();

  const a = social(A), b = social(B), c = social(C);
  await Promise.all([a, b, c].map((x) => x.until(() => x.state)));
  check('authenticated: each gets F_AUTH_OK + a snapshot', [a, b, c].every((x) => x.has('F_AUTH_OK') && x.state?.friends.length === 0));

  // ------------------------------------------------------------ friend requests
  console.log('\n== friend requests ==');
  const add = await a.req({ type: 'F_ADD', username: '@Ahmed' });
  check('A adds @Ahmed -> request created', add.ok && add.data.kind === 'requested');
  await b.until(() => b.has('F_REQUEST'));
  check('B is told live, and the request is in B\'s snapshot', b.last('F_REQUEST').from.username === 'saeed123' && b.state.incoming.length === 1 && a.state.outgoing.length === 1);
  check('adding yourself / a ghost / twice are refused', (await a.req({ type: 'F_ADD', username: 'saeed123' })).code === 'SELF' && (await a.req({ type: 'F_ADD', username: 'nobody' })).code === 'NOT_FOUND' && (await a.req({ type: 'F_ADD', username: 'ahmed' })).code === 'ALREADY_REQUESTED');
  const steal = await c.req({ type: 'F_ACCEPT', requestId: b.state.incoming[0].id });
  check('a stranger cannot accept someone else\'s request', steal.ok === false && steal.code === 'NOT_FOUND');
  const acc = await b.req({ type: 'F_ACCEPT', requestId: b.state.incoming[0].id });
  await a.until(() => a.state.friends.length === 1);
  check('B accepts -> both lists show each other, requests cleared', acc.ok && a.state.friends[0].username === 'ahmed' && b.state.friends[0].username === 'saeed123' && a.state.outgoing.length === 0 && b.state.incoming.length === 0);

  // C and A become friends too (so a 3-player room is possible); C sends, A accepts
  await c.req({ type: 'F_ADD', username: 'saeed123' });
  await a.until(() => a.state.incoming.length === 1);
  await a.req({ type: 'F_ACCEPT', requestId: a.state.incoming[0].id });
  await a.until(() => a.state.friends.length === 2);

  // ------------------------------------------------------------ presence
  console.log('\n== presence ==');
  check('A sees B and C online', a.state.friends.every((f) => f.status === 'online'));
  b.raw({ type: 'F_STATUS', status: 'playing' });
  await a.until(() => a.has('F_PRESENCE', (e) => e.status === 'playing'));
  check('B reports "playing" -> A is told', a.last('F_PRESENCE').userId === B.user.id && a.last('F_PRESENCE').status === 'playing');
  check('C (not B\'s friend) did NOT get B\'s presence', !c.has('F_PRESENCE', (e) => e.userId === B.user.id));
  b.raw({ type: 'F_STATUS', status: 'bogus' }); await sleep(100);
  check('invalid status ignored', a.events.filter((e) => e.type === 'F_PRESENCE' && e.userId === B.user.id).length === 1);
  b.raw({ type: 'F_STATUS', status: 'online' });
  await a.until(() => a.has('F_PRESENCE', (e) => e.status === 'online' && e.userId === B.user.id));
  c.ws.close();
  await a.until(() => a.has('F_PRESENCE', (e) => e.userId === C.user.id && e.status === 'offline'));
  check('C disconnects -> A sees C offline', a.last('F_PRESENCE').userId === C.user.id && a.last('F_PRESENCE').status === 'offline');

  // ------------------------------------------------------------ invitations -> REAL 2-player room
  console.log('\n== invitation -> real 2-player room ==');
  const gA = game(); await gA.open;
  const room2 = 'E2P01';
  gA.send({ type: 'CREATE_ROOM', code: room2, playerName: 'سعيد', category: cat, targetScore: 3 });
  await sleep(200);
  const notFriend = await a.req({ type: 'F_INVITE', code: room2, to: ['u_ghost'] });
  check('invite to a non-friend is not delivered', notFriend.data.results[0].result === 'not_friend');
  const noRoom = await a.req({ type: 'F_INVITE', code: 'NOPE1', to: [B.user.id] });
  check('invite to a room that does not exist is refused', noRoom.ok === false && noRoom.code === 'ROOM_NOT_AVAILABLE');
  const inv = await a.req({ type: 'F_INVITE', code: room2, to: [B.user.id, C.user.id] });
  check('invite sent; presence hint tells who is online/offline', inv.ok && inv.data.results[0].presence === 'online' && inv.data.results[1].presence === 'offline');
  await b.until(() => b.has('F_INVITE'));
  const invB = b.last('F_INVITE').invite;
  check('B receives the invite live (from @saeed123), WITHOUT the room code', invB.from.username === 'saeed123' && invB.maxPlayers === 2 && !JSON.stringify(invB).includes(room2));
  const acceptedByWrong = social(C); await acceptedByWrong.until(() => acceptedByWrong.state);
  const stolen = await acceptedByWrong.req({ type: 'F_INVITE_ACCEPT', inviteId: invB.id });
  check('someone else cannot accept B\'s invite', stolen.ok === false && stolen.code === 'INVITE_NOT_FOUND');

  const accept = await b.req({ type: 'F_INVITE_ACCEPT', inviteId: invB.id });
  check('B accepts -> server hands over the room code', accept.ok && accept.data.code === room2);
  await a.until(() => a.has('F_INVITE_UPDATE', (e) => e.status === 'accepted'));
  check('A (the host) is told B accepted', a.last('F_INVITE_UPDATE').toId === B.user.id);
  const gB = game(); await gB.open;
  gB.send({ type: 'JOIN_ROOM', code: accept.data.code, playerName: 'Ahmed' });
  await sleep(300);
  check('B joins the REAL room with that code: both are seated', gB.has('ROOM_JOINED') && gA.lastRoom()?.guest?.name === 'Ahmed');
  await a.until(() => a.state.recent.length === 1);
  check('"play again" list: B is now in A\'s recent players (and vice versa)', a.state.recent[0].username === 'ahmed' && b.state.recent[0].username === 'saeed123');

  // C (offline when invited) comes back: the invite is waiting, but the room is now FULL
  const c2 = social(C); await c2.until(() => c2.state);
  check('offline friend: invite waits for them, but is not offered once the room is full', c2.state.invites.length === 0);
  await a.until(() => a.has('F_INVITE_UPDATE', (e) => e.toId === C.user.id && e.status === 'expired'), 22000);
  check('host is told the full-room invite to C expired', a.has('F_INVITE_UPDATE', (e) => e.toId === C.user.id && e.status === 'expired'));

  // ------------------------------------------------------------ 3-player room, offline friend gets it on return, decline
  console.log('\n== invitation -> real 3-player room, offline delivery, decline ==');
  c2.ws.close(); acceptedByWrong.ws.close(); await sleep(250); // C must really be offline now (both of C's sockets closed)
  const gA3 = game(); await gA3.open;
  const room3 = 'E3P01';
  gA3.send({ type: 'MP_CREATE', code: room3, playerName: 'سعيد', category: cat, maxPlayers: 3 });
  await sleep(200);
  const inv3 = await a.req({ type: 'F_INVITE', code: room3, to: [B.user.id, C.user.id] });
  check('3p invite: B online, C offline', inv3.data.results[0].presence === 'online' && inv3.data.results[1].presence === 'offline');
  const dupe = await a.req({ type: 'F_INVITE', code: room3, to: [B.user.id] });
  check('re-inviting right away does not spam (already_pending)', dupe.data.results[0].result === 'already_pending');
  await b.until(() => b.has('F_INVITE', (e) => e.invite.maxPlayers === 3));
  const inv3B = b.last('F_INVITE').invite;
  const dec = await b.req({ type: 'F_INVITE_DECLINE', inviteId: inv3B.id });
  await a.until(() => a.has('F_INVITE_UPDATE', (e) => e.status === 'declined'));
  check('B declines -> host is told, invite disappears for B', dec.ok && a.last('F_INVITE_UPDATE').toId === B.user.id && b.has('F_INVITE_GONE'));

  const c3 = social(C); await c3.until(() => c3.state);
  check('C comes back online: the invite sent while offline is in their snapshot', c3.state.invites.length === 1 && c3.state.invites[0].from.username === 'saeed123');
  const accC = await c3.req({ type: 'F_INVITE_ACCEPT', inviteId: c3.state.invites[0].id });
  const gC = game(); await gC.open;
  gC.send({ type: 'JOIN_ROOM', code: accC.data.code, playerName: 'Saida' });
  await sleep(300);
  check('C joins the REAL 3-player room', gC.has('MP_JOINED') && gA3.lastRoom()?.players.length === 2);
  const reinv = await a.req({ type: 'F_INVITE', code: room3, to: [B.user.id] });
  await b.until(() => b.has('F_INVITE', (e) => e.invite.maxPlayers === 3 && e.invite.id !== inv3B.id) || b.state.invites.length > 0);
  check('host can re-invite someone who declined (e.g. to fill the last seat)', reinv.ok && reinv.data.results[0].result === 'sent');

  // ------------------------------------------------------------ profile edit
  console.log('\n== profile edit ==');
  const pr = await a.req({ type: 'F_PROFILE', name: '  سعيد الجديد  ', avatar: '🐼' });
  await b.until(() => b.state.friends.some((f) => f.name === 'سعيد الجديد'));
  check('rename + avatar: saved (trimmed) and friends see it live', pr.ok && b.state.friends.find((f) => f.id === A.user.id)?.name === 'سعيد الجديد' && b.state.friends.find((f) => f.id === A.user.id)?.avatar === '🐼');
  const prBad = await a.req({ type: 'F_PROFILE', name: '   ', avatar: '💀' });
  check('empty name refused; the @ID never changes', prBad.ok === false && prBad.code === 'INVALID_NAME' && a.state.me.username === 'saeed123');
  const prAv = await a.req({ type: 'F_PROFILE', avatar: '💀' });
  check('an avatar that is not in the allowed list is ignored', prAv.ok && a.state.me.avatar === '🐼');

  // ------------------------------------------------------------ unfriending cleans up
  console.log('\n== unfriend ==');
  await a.req({ type: 'F_REMOVE', userId: B.user.id });
  await b.until(() => b.state.friends.length === 0);
  check('unfriend is two-way and drops pending invites between them', a.state.friends.length === 1 && b.state.friends.length === 0 && b.state.invites.length === 0);
  const after = await a.req({ type: 'F_INVITE', code: room3, to: [B.user.id] });
  check('can no longer invite an ex-friend', after.data.results[0].result === 'not_friend');
  await a.req({ type: 'F_ADD', username: 'ahmed' }); await b.until(() => b.state.incoming.length === 1);
  await b.req({ type: 'F_ACCEPT', requestId: b.state.incoming[0].id });
  await a.until(() => a.state.friends.length === 2);

  // ------------------------------------------------------------ persistence across a real restart
  console.log('\n== persistence (server restart) ==');
  [gA, gB, gA3, gC, a, b, c3].forEach((x) => { try { x.ws.close(); } catch {} });
  await sleep(300);
  await stopServer();
  check('data file was written to DATA_DIR', fs.existsSync(path.join(dataDir, 'social.json')));
  await startServer();
  const a2 = social(A); await a2.until(() => a2.state);
  check('after restart the SAME token still logs in', a2.has('F_AUTH_OK') && !a2.has('F_AUTH_FAIL'));
  check('after restart friendships survived (and everyone shows offline)', a2.state.friends.length === 2 && a2.state.friends.every((f) => f.status === 'offline'));
  check('after restart recent players survived', a2.state.recent.some((f) => f.username === 'ahmed'));
  check('after restart rooms are gone, so old invites are gone too (rooms are in-memory)', a2.state.invites.length === 0);
  const taken = await post('/api/account', { name: 'x', username: 'saeed123' });
  check('after restart usernames are still reserved', taken.status === 409);
  a2.ws.close();
} catch (e) {
  console.error('TEST CRASHED:', e);
  fail++;
} finally {
  try { await stopServer(); } catch {}
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(`\nSUMMARY: ${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
