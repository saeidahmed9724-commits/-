// Accounts + friendships. Pure logic on top of SocialStore: no sockets in here, so it is easy to test.

import crypto from 'crypto';
import { SocialStore, UserRecord, FriendRequest } from './store';
import { AVATARS, NAME_MAX, USERNAME_RE, normalizeUsername } from './shared';

export class SocialError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export const LIMITS = { MAX_FRIENDS: 100, MAX_OUTGOING: 30, MAX_INCOMING: 50, RECENT: 12 };

export interface Profile {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

export const toProfile = (u: UserRecord): Profile => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar });

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Trim, collapse spaces, drop control + bidi-override characters (used to spoof names). */
function cleanName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

const pickAvatar = (raw: unknown) => (AVATARS.includes(raw as string) ? (raw as string) : AVATARS[Math.floor(Math.random() * AVATARS.length)]);

export class SocialService {
  private byUsername = new Map<string, string>();

  constructor(
    private store: SocialStore,
    private now: () => number = Date.now
  ) {
    for (const u of Object.values(store.data.users)) this.byUsername.set(u.username, u.id);
  }

  private get d() {
    return this.store.data;
  }

  // ---------------------------------------------------------------- accounts

  /** Create an anonymous account. The returned token is shown ONCE: only its hash is stored. */
  register(rawName: unknown, rawUsername?: unknown, rawAvatar?: unknown): { user: UserRecord; token: string } {
    const name = cleanName(rawName);
    if (!name) throw new SocialError('INVALID_NAME');

    let username: string;
    if (typeof rawUsername === 'string' && rawUsername.trim()) {
      username = normalizeUsername(rawUsername);
      if (!USERNAME_RE.test(username)) throw new SocialError('INVALID_USERNAME');
      if (this.byUsername.has(username)) throw new SocialError('USERNAME_TAKEN');
    } else {
      username = this.generateUsername(name);
    }

    const token = crypto.randomBytes(24).toString('hex');
    const user: UserRecord = {
      id: 'u_' + crypto.randomBytes(8).toString('hex'),
      name,
      username,
      avatar: pickAvatar(rawAvatar),
      tokenHash: sha256(token),
      createdAt: this.now(),
      lastSeen: this.now(),
    };
    this.d.users[user.id] = user;
    this.byUsername.set(username, user.id);
    this.d.friends[user.id] = [];
    this.store.save();
    return { user, token };
  }

  usernameAvailable(raw: unknown): boolean {
    const u = normalizeUsername(String(raw ?? ''));
    return USERNAME_RE.test(u) && !this.byUsername.has(u);
  }

  private generateUsername(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    const stem = base.length >= 3 ? base : 'player';
    for (let digits = 4; digits <= 8; digits++) {
      for (let i = 0; i < 20; i++) {
        const n = crypto.randomInt(0, 10 ** digits).toString().padStart(digits, '0');
        const candidate = `${stem}${n}`.slice(0, 20);
        if (!this.byUsername.has(candidate)) return candidate;
      }
    }
    throw new SocialError('SERVER_ERROR');
  }

  authenticate(userId: unknown, token: unknown): UserRecord | null {
    if (typeof userId !== 'string' || typeof token !== 'string' || token.length === 0 || token.length > 200) return null;
    const user = this.d.users[userId];
    if (!user) return null;
    const a = Buffer.from(sha256(token), 'hex');
    const b = Buffer.from(user.tokenHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? user : null;
  }

  getUser(id: string): UserRecord | undefined {
    return this.d.users[id];
  }

  touch(userId: string) {
    const u = this.d.users[userId];
    if (u) {
      u.lastSeen = this.now();
      this.store.save();
    }
  }

  updateProfile(userId: string, rawName: unknown, rawAvatar: unknown): UserRecord {
    const u = this.d.users[userId];
    if (!u) throw new SocialError('NOT_FOUND');
    if (rawName !== undefined) {
      const name = cleanName(rawName);
      if (!name) throw new SocialError('INVALID_NAME');
      u.name = name;
    }
    if (typeof rawAvatar === 'string' && AVATARS.includes(rawAvatar)) u.avatar = rawAvatar;
    this.store.save();
    return u;
  }

  // ---------------------------------------------------------------- friends

  friendsOf(userId: string): string[] {
    return this.d.friends[userId] ?? [];
  }

  areFriends(a: string, b: string): boolean {
    return this.friendsOf(a).includes(b);
  }

  incoming(userId: string): FriendRequest[] {
    return Object.values(this.d.requests)
      .filter((r) => r.to === userId)
      .sort((x, y) => y.at - x.at);
  }

  outgoing(userId: string): FriendRequest[] {
    return Object.values(this.d.requests)
      .filter((r) => r.from === userId)
      .sort((x, y) => y.at - x.at);
  }

  /**
   * Ask someone (by @username) to be friends. If they already asked you, you simply become friends.
   */
  sendRequest(fromId: string, rawUsername: unknown): { kind: 'requested' | 'friends'; other: UserRecord; request?: FriendRequest } {
    const username = normalizeUsername(String(rawUsername ?? ''));
    const targetId = this.byUsername.get(username);
    const target = targetId ? this.d.users[targetId] : undefined;
    if (!target) throw new SocialError('NOT_FOUND');
    if (target.id === fromId) throw new SocialError('SELF');
    if (this.areFriends(fromId, target.id)) throw new SocialError('ALREADY_FRIENDS');

    const all = Object.values(this.d.requests);
    const reverse = all.find((r) => r.from === target.id && r.to === fromId);
    if (reverse) {
      this.makeFriends(fromId, target.id);
      return { kind: 'friends', other: target };
    }
    if (all.some((r) => r.from === fromId && r.to === target.id)) throw new SocialError('ALREADY_REQUESTED');
    if (this.friendsOf(fromId).length >= LIMITS.MAX_FRIENDS) throw new SocialError('FRIENDS_LIMIT');
    if (all.filter((r) => r.from === fromId).length >= LIMITS.MAX_OUTGOING) throw new SocialError('TOO_MANY_PENDING');
    if (all.filter((r) => r.to === target.id).length >= LIMITS.MAX_INCOMING) throw new SocialError('CANNOT_REQUEST');

    const request: FriendRequest = { id: 'r_' + crypto.randomBytes(6).toString('hex'), from: fromId, to: target.id, at: this.now() };
    this.d.requests[request.id] = request;
    this.store.save();
    return { kind: 'requested', other: target, request };
  }

  /** Returns the id of the person whose request was accepted. */
  acceptRequest(userId: string, requestId: unknown): string {
    const req = this.d.requests[String(requestId)];
    if (!req || req.to !== userId) throw new SocialError('NOT_FOUND');
    if (this.friendsOf(userId).length >= LIMITS.MAX_FRIENDS || this.friendsOf(req.from).length >= LIMITS.MAX_FRIENDS) {
      throw new SocialError('FRIENDS_LIMIT');
    }
    this.makeFriends(userId, req.from);
    return req.from;
  }

  /** Returns the id of the person who had sent it (so their screen can refresh). */
  declineRequest(userId: string, requestId: unknown): string {
    const req = this.d.requests[String(requestId)];
    if (!req || req.to !== userId) throw new SocialError('NOT_FOUND');
    delete this.d.requests[req.id];
    this.store.save();
    return req.from;
  }

  /** Returns the id of the person it was addressed to. */
  cancelRequest(userId: string, requestId: unknown): string {
    const req = this.d.requests[String(requestId)];
    if (!req || req.from !== userId) throw new SocialError('NOT_FOUND');
    delete this.d.requests[req.id];
    this.store.save();
    return req.to;
  }

  removeFriend(userId: string, friendId: unknown): boolean {
    const other = String(friendId);
    if (!this.areFriends(userId, other)) return false;
    this.d.friends[userId] = this.friendsOf(userId).filter((x) => x !== other);
    this.d.friends[other] = this.friendsOf(other).filter((x) => x !== userId);
    this.store.save();
    return true;
  }

  private makeFriends(a: string, b: string) {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const list = this.d.friends[x] ?? (this.d.friends[x] = []);
      if (!list.includes(y)) list.push(y);
    }
    // any pending request between the two (either direction) is now meaningless
    for (const r of Object.values(this.d.requests)) {
      if ((r.from === a && r.to === b) || (r.from === b && r.to === a)) delete this.d.requests[r.id];
    }
    this.store.save();
  }

  // ---------------------------------------------------------------- quick play

  recordPlayedTogether(a: string, b: string) {
    if (a === b) return;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const list = (this.d.recent[x] ?? []).filter((e) => e.id !== y);
      list.unshift({ id: y, at: this.now() });
      this.d.recent[x] = list.slice(0, LIMITS.RECENT);
    }
    this.store.save();
  }

  /** Recent co-players who are still friends, newest first. */
  recentOf(userId: string): string[] {
    return (this.d.recent[userId] ?? []).map((e) => e.id).filter((id) => this.areFriends(userId, id));
  }
}
