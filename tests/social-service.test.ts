import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SocialStore } from '../social/store';
import { SocialService, SocialError, LIMITS } from '../social/service';

const make = () => new SocialService(new SocialStore(null));
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof SocialError ? e.code : 'OTHER:' + e;
  }
  return 'NO_ERROR';
};

test('register: name cleaned, username validated and unique, token only stored hashed', () => {
  const s = make();
  const a = s.register('  Saeed   ', '@Saeed123');
  assert.equal(a.user.username, 'saeed123');
  assert.equal(a.user.name, 'Saeed');
  assert.notEqual(a.user.tokenHash, a.token);
  assert.equal(code(() => s.register('x', 'SAEED123')), 'USERNAME_TAKEN');
  assert.equal(code(() => s.register('x', 'a b')), 'INVALID_USERNAME');
  assert.equal(code(() => s.register('x', 'ab')), 'INVALID_USERNAME');
  assert.equal(code(() => s.register('   ', 'okname')), 'INVALID_NAME');
  assert.equal(code(() => s.register('\u202E\u200B', 'okname2')), 'INVALID_NAME'); // only control/bidi chars
});

test('register: missing username is generated; Arabic-only names still get a valid one', () => {
  const s = make();
  const a = s.register('سعيد');
  const b = s.register('Ahmed Ali');
  assert.match(a.user.username, /^player\d{4,}$/);
  assert.match(b.user.username, /^ahmedali\d{4,}$/);
});

test('authenticate: right token ok, wrong token / unknown user / junk rejected', () => {
  const s = make();
  const { user, token } = s.register('A', 'aaa');
  assert.equal(s.authenticate(user.id, token)?.id, user.id);
  assert.equal(s.authenticate(user.id, token + 'x'), null);
  assert.equal(s.authenticate('u_nope', token), null);
  assert.equal(s.authenticate(user.id, ''), null);
  assert.equal(s.authenticate(undefined, undefined), null);
  assert.equal(s.authenticate(user.id, 'x'.repeat(500)), null);
});

test('friend request -> accept makes a two-way friendship and clears the request', () => {
  const s = make();
  const a = s.register('A', 'alice').user;
  const b = s.register('B', 'bobby').user;
  const r = s.sendRequest(a.id, '@Bobby');
  assert.equal(r.kind, 'requested');
  assert.equal(s.incoming(b.id).length, 1);
  assert.equal(s.outgoing(a.id).length, 1);
  assert.equal(s.areFriends(a.id, b.id), false);
  s.acceptRequest(b.id, r.request!.id);
  assert.ok(s.areFriends(a.id, b.id) && s.areFriends(b.id, a.id));
  assert.equal(s.incoming(b.id).length + s.outgoing(a.id).length, 0);
});

test('only the addressee can accept/decline, only the sender can cancel', () => {
  const s = make();
  const a = s.register('A', 'alice').user;
  const b = s.register('B', 'bobby').user;
  const c = s.register('C', 'carol').user;
  const r = s.sendRequest(a.id, 'bobby').request!;
  assert.equal(code(() => s.acceptRequest(a.id, r.id)), 'NOT_FOUND'); // sender cannot accept their own
  assert.equal(code(() => s.acceptRequest(c.id, r.id)), 'NOT_FOUND'); // stranger cannot accept
  assert.equal(code(() => s.declineRequest(c.id, r.id)), 'NOT_FOUND');
  assert.equal(code(() => s.cancelRequest(b.id, r.id)), 'NOT_FOUND'); // addressee cannot "cancel"
  assert.equal(s.cancelRequest(a.id, r.id), b.id);
  assert.equal(s.incoming(b.id).length, 0);
});

test('requests: unknown user, self, duplicate, already friends', () => {
  const s = make();
  const a = s.register('A', 'alice').user;
  const b = s.register('B', 'bobby').user;
  assert.equal(code(() => s.sendRequest(a.id, 'ghost')), 'NOT_FOUND');
  assert.equal(code(() => s.sendRequest(a.id, 'alice')), 'SELF');
  s.sendRequest(a.id, 'bobby');
  assert.equal(code(() => s.sendRequest(a.id, 'bobby')), 'ALREADY_REQUESTED');
  s.acceptRequest(b.id, s.incoming(b.id)[0].id);
  assert.equal(code(() => s.sendRequest(a.id, 'bobby')), 'ALREADY_FRIENDS');
});

test('both ask each other -> instantly friends, no leftover requests', () => {
  const s = make();
  const a = s.register('A', 'alice').user;
  const b = s.register('B', 'bobby').user;
  s.sendRequest(a.id, 'bobby');
  const r = s.sendRequest(b.id, 'alice');
  assert.equal(r.kind, 'friends');
  assert.ok(s.areFriends(a.id, b.id));
  assert.equal(Object.keys(s['d'].requests).length, 0);
});

test('declined request can be sent again; removing a friend is two-way', () => {
  const s = make();
  const a = s.register('A', 'alice').user;
  const b = s.register('B', 'bobby').user;
  const r = s.sendRequest(a.id, 'bobby').request!;
  s.declineRequest(b.id, r.id);
  const r2 = s.sendRequest(a.id, 'bobby');
  s.acceptRequest(b.id, r2.request!.id);
  assert.equal(s.removeFriend(a.id, b.id), true);
  assert.equal(s.areFriends(a.id, b.id) || s.areFriends(b.id, a.id), false);
  assert.equal(s.removeFriend(a.id, b.id), false);
});

test('limits: outgoing pending requests are capped', () => {
  const s = make();
  const a = s.register('A', 'alice').user;
  for (let i = 0; i < LIMITS.MAX_OUTGOING; i++) {
    s.register('U' + i, 'user' + String(i).padStart(3, '0'));
    s.sendRequest(a.id, 'user' + String(i).padStart(3, '0'));
  }
  s.register('Z', 'zzzzz');
  assert.equal(code(() => s.sendRequest(a.id, 'zzzzz')), 'TOO_MANY_PENDING');
});

test('recent players: newest first, deduped, only people who are still friends', () => {
  const s = make();
  const [a, b, c] = ['alice', 'bobby', 'carol'].map((u) => s.register(u, u).user);
  for (const o of [b, c]) {
    const r = s.sendRequest(a.id, o.username).request!;
    s.acceptRequest(o.id, r.id);
  }
  s.recordPlayedTogether(a.id, b.id);
  s.recordPlayedTogether(a.id, c.id);
  s.recordPlayedTogether(a.id, b.id);
  assert.deepEqual(s.recentOf(a.id), [b.id, c.id]);
  s.removeFriend(a.id, b.id);
  assert.deepEqual(s.recentOf(a.id), [c.id]);
});

test('PERSISTENCE: accounts, friendships and tokens survive a restart (new store, same file)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-'));
  const file = path.join(dir, 'social.json');
  const s1 = new SocialService(new SocialStore(file));
  const a = s1.register('A', 'alice');
  const b = s1.register('B', 'bobby');
  s1.acceptRequest(b.user.id, s1.sendRequest(a.user.id, 'bobby').request!.id);
  s1['store'].flush();

  const s2 = new SocialService(new SocialStore(file));
  assert.equal(s2.authenticate(a.user.id, a.token)?.username, 'alice');
  assert.ok(s2.areFriends(a.user.id, b.user.id));
  assert.equal(code(() => s2.register('X', 'alice')), 'USERNAME_TAKEN'); // username index rebuilt too
  fs.rmSync(dir, { recursive: true });
});

test('a corrupt data file is kept aside, never overwritten, and the store starts empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-'));
  const file = path.join(dir, 'social.json');
  fs.writeFileSync(file, '{ not json');
  const store = new SocialStore(file);
  assert.deepEqual(Object.keys(store.data.users), []);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('social.json.corrupt-')));
  fs.rmSync(dir, { recursive: true });
});
