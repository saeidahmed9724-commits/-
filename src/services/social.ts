// Friends system, browser side.
//
// - The account (id + secret token) is created once and kept in localStorage.
// - One long-lived WebSocket (/ws/social) stays open while the app is open: it carries the friend list,
//   presence and invitations. It is independent from the game socket (services/onlineGame.ts), which
//   is opened/closed per match.
// - React components read the state with useSocial() and call the methods on `social`.

import { useSyncExternalStore } from 'react';
import type { Presence } from '../../social/shared';

export type { Presence };

export interface SocialProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
}
export interface FriendView extends SocialProfile {
  status: Presence;
}
export interface RequestView {
  id: string;
  user: SocialProfile;
  at: number;
}
export interface InviteView {
  id: string;
  from: SocialProfile;
  maxPlayers: number;
  createdAt: number;
}
/** What happened to an invitation I sent (per room code, per friend). */
export type SentStatus = 'sent' | 'accepted' | 'declined' | 'expired';
export type Connection = 'idle' | 'connecting' | 'online' | 'offline';

export interface SocialSnapshot {
  account: SocialProfile | null;
  connection: Connection;
  friends: FriendView[];
  incoming: RequestView[];
  outgoing: RequestView[];
  recent: FriendView[];
  invites: InviteView[];
  sent: Record<string, Record<string, SentStatus>>;
}

export type SocialEvent = { type: 'INVITE'; invite: InviteView } | { type: 'REQUEST'; from: SocialProfile };

export interface InviteResult {
  toId: string;
  inviteId?: string;
  result: 'sent' | 'already_pending' | 'not_friend';
  presence?: Presence;
}

export class SocialError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const STORAGE_KEY = 'khmn.account.v1';
const EMPTY: SocialSnapshot = { account: null, connection: 'idle', friends: [], incoming: [], outgoing: [], recent: [], invites: [], sent: {} };

interface StoredAccount extends SocialProfile {
  token: string;
}

function loadAccount(): StoredAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const a = raw ? JSON.parse(raw) : null;
    return a && typeof a.id === 'string' && typeof a.token === 'string' ? a : null;
  } catch {
    return null;
  }
}
function saveAccount(a: StoredAccount | null) {
  try {
    if (a) localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode: the account lives for this session only
  }
}

class SocialClient {
  private snap: SocialSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: SocialEvent) => void>();
  private stored: StoredAccount | null = null;
  private ws: WebSocket | null = null;
  private authed = false;
  private stopped = true;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private reqCounter = 0;
  private status: 'online' | 'playing' = 'online';
  private waiters: Array<() => void> = [];

  // ---- store plumbing (useSyncExternalStore) ----
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };
  getSnapshot = () => this.snap;
  onEvent(cb: (e: SocialEvent) => void) {
    this.eventListeners.add(cb);
    return () => {
      this.eventListeners.delete(cb);
    };
  }
  private set(patch: Partial<SocialSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }
  private emit(e: SocialEvent) {
    this.eventListeners.forEach((l) => l(e));
  }

  getAccount(): SocialProfile | null {
    return this.snap.account;
  }

  // ---- lifecycle ----

  /** Call once when the app opens: reconnects an existing account. Does nothing if there is none. */
  start() {
    if (!this.stopped) return;
    this.stored = this.stored ?? loadAccount();
    if (!this.stored) return;
    const { token: _t, ...profile } = this.stored;
    this.set({ account: profile });
    this.stopped = false;
    this.attempt = 0;
    this.connect();
    document.addEventListener('visibilitychange', this.onWake);
    window.addEventListener('online', this.onWake);
  }

  private onWake = () => {
    if (this.stopped || document.visibilityState === 'hidden') return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.attempt = 0;
      this.connect();
    }
  };

  private connect() {
    if (this.stopped || !this.stored) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.set({ connection: this.attempt === 0 ? 'connecting' : 'offline' });

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/social`);
    this.ws = ws;
    this.authed = false;
    const acct = this.stored;

    ws.onopen = () => ws.send(JSON.stringify({ type: 'F_AUTH', userId: acct.id, token: acct.token }));
    ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(ev.data));
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.authed = false;
      this.rejectAll('OFFLINE');
      if (ev.code === 4003) return this.forgetAccount(); // the server does not know this account/token (e.g. data was reset)
      this.set({ connection: 'offline' });
      if (this.stopped) return;
      const delay = Math.min(15_000, 1000 * 2 ** Math.min(this.attempt++, 4));
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {};
  }

  private onMessage(m: any) {
    switch (m.type) {
      case 'F_AUTH_OK':
        this.authed = true;
        this.attempt = 0;
        if (this.stored) {
          this.stored = { ...this.stored, ...m.me };
          saveAccount(this.stored);
        }
        this.set({ connection: 'online', account: m.me });
        this.sendRaw({ type: 'F_STATUS', status: this.status });
        this.waiters.splice(0).forEach((w) => w());
        break;
      case 'F_AUTH_FAIL':
        this.forgetAccount();
        break;
      case 'F_STATE':
        this.set({
          account: m.me,
          friends: m.friends,
          incoming: m.incoming,
          outgoing: m.outgoing,
          recent: m.recent,
          invites: m.invites,
        });
        break;
      case 'F_PRESENCE': {
        const patch = (list: FriendView[]) => list.map((f) => (f.id === m.userId ? { ...f, status: m.status as Presence } : f));
        this.set({ friends: patch(this.snap.friends), recent: patch(this.snap.recent) });
        break;
      }
      case 'F_REQUEST':
        this.emit({ type: 'REQUEST', from: m.from });
        break;
      case 'F_INVITE': {
        const invite: InviteView = m.invite;
        if (!this.snap.invites.some((i) => i.id === invite.id)) {
          this.set({ invites: [invite, ...this.snap.invites] });
          this.emit({ type: 'INVITE', invite });
        }
        break;
      }
      case 'F_INVITE_GONE':
        this.set({ invites: this.snap.invites.filter((i) => i.id !== m.inviteId) });
        break;
      case 'F_INVITE_UPDATE':
        this.markSent(m.code, m.toId, m.status);
        break;
      case 'F_REPLY': {
        const p = this.pending.get(m.reqId);
        if (!p) break;
        this.pending.delete(m.reqId);
        clearTimeout(p.timer);
        if (m.ok) p.resolve(m.data);
        else p.reject(new SocialError(m.code || 'SERVER_ERROR'));
        break;
      }
    }
  }

  private forgetAccount() {
    this.stopped = true;
    this.stored = null;
    saveAccount(null);
    this.ws?.close();
    this.ws = null;
    this.set({ ...EMPTY });
  }

  private sendRaw(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private rejectAll(code: string) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new SocialError(code));
    }
    this.pending.clear();
  }

  /** Wait (briefly) for the connection: a tap right after opening the app should not fail. */
  private ready(ms = 4000): Promise<void> {
    if (this.authed) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== done);
        reject(new SocialError('OFFLINE'));
      }, ms);
      const done = () => {
        clearTimeout(t);
        resolve();
      };
      this.waiters.push(done);
    });
  }

  private async request<T = any>(payload: Record<string, unknown>): Promise<T> {
    if (!this.stored) throw new SocialError('NO_ACCOUNT');
    await this.ready();
    return new Promise<T>((resolve, reject) => {
      const reqId = `r${++this.reqCounter}`;
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new SocialError('TIMEOUT'));
      }, 8000);
      this.pending.set(reqId, { resolve, reject, timer });
      this.sendRaw({ ...payload, reqId });
    });
  }

  private markSent(code: string, toId: string, status: SentStatus) {
    const room = { ...(this.snap.sent[code] ?? {}), [toId]: status };
    this.set({ sent: { ...this.snap.sent, [code]: room } });
  }

  // ---- account ----

  async register(name: string, username?: string, avatar?: string): Promise<SocialProfile> {
    let res: Response;
    try {
      res = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username: username || undefined, avatar }),
      });
    } catch {
      throw new SocialError('OFFLINE');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new SocialError(data.error || 'SERVER_ERROR');
    this.stored = { ...data.user, token: data.token };
    saveAccount(this.stored);
    this.stopped = true; // let start() run its full setup
    this.start();
    return data.user;
  }

  async checkUsername(u: string): Promise<boolean> {
    try {
      const r = await fetch(`/api/account/username-available?u=${encodeURIComponent(u)}`);
      return Boolean((await r.json()).available);
    } catch {
      return true; // the server has the final word at register time
    }
  }

  async updateProfile(name: string, avatar: string) {
    await this.request({ type: 'F_PROFILE', name, avatar });
  }

  /** What am I doing right now? Friends see it next to my name. */
  setStatus(status: 'online' | 'playing') {
    if (this.status === status) return;
    this.status = status;
    this.sendRaw({ type: 'F_STATUS', status });
  }

  // ---- friends ----

  addFriend(username: string): Promise<{ kind: 'requested' | 'friends'; user: SocialProfile }> {
    return this.request({ type: 'F_ADD', username });
  }
  acceptRequest(requestId: string) {
    return this.request({ type: 'F_ACCEPT', requestId });
  }
  declineRequest(requestId: string) {
    return this.request({ type: 'F_DECLINE', requestId });
  }
  cancelRequest(requestId: string) {
    return this.request({ type: 'F_CANCEL', requestId });
  }
  removeFriend(userId: string) {
    return this.request({ type: 'F_REMOVE', userId });
  }

  // ---- invitations ----

  /** Invite friends into a room I am already in. */
  async invite(code: string, userIds: string[]): Promise<InviteResult[]> {
    const data = await this.request<{ results: InviteResult[] }>({ type: 'F_INVITE', code, to: userIds });
    for (const r of data.results) if (r.result !== 'not_friend') this.markSent(code, r.toId, 'sent');
    return data.results;
  }
  /** Returns the room code to join (the player then joins exactly like with a typed code). */
  async acceptInvite(inviteId: string): Promise<string> {
    try {
      const data = await this.request<{ code: string }>({ type: 'F_INVITE_ACCEPT', inviteId });
      this.set({ invites: this.snap.invites.filter((i) => i.id !== inviteId) });
      return data.code;
    } catch (e) {
      if (e instanceof SocialError && (e.code === 'INVITE_EXPIRED' || e.code === 'INVITE_NOT_FOUND')) {
        this.set({ invites: this.snap.invites.filter((i) => i.id !== inviteId) });
      }
      throw e;
    }
  }
  async declineInvite(inviteId: string) {
    this.set({ invites: this.snap.invites.filter((i) => i.id !== inviteId) });
    try {
      await this.request({ type: 'F_INVITE_DECLINE', inviteId });
    } catch {
      /* already gone */
    }
  }
}

export const social = new SocialClient();

export function useSocial(): SocialSnapshot {
  return useSyncExternalStore(social.subscribe, social.getSnapshot, social.getSnapshot);
}

// ---- texts ----

const ERRORS: Record<string, [string, string]> = {
  NOT_FOUND: ['مفيش لاعب بالـ ID ده', 'No player with that ID'],
  SELF: ['ده الـ ID بتاعك أنت 😄', "That's your own ID 😄"],
  ALREADY_FRIENDS: ['انتوا أصحاب بالفعل', 'You are already friends'],
  ALREADY_REQUESTED: ['الطلب اتبعت قبل كده', 'Request already sent'],
  FRIENDS_LIMIT: ['وصلت للحد الأقصى من الأصدقاء', 'Friend limit reached'],
  TOO_MANY_PENDING: ['عندك طلبات معلّقة كتير، استنى شوية', 'Too many pending requests'],
  CANNOT_REQUEST: ['مش ممكن تبعت طلب للاعب ده دلوقتي', "Can't send a request to this player right now"],
  RATE_LIMIT: ['كتير أوي، حاول تاني بعد شوية', 'Too many attempts, try again in a moment'],
  USERNAME_TAKEN: ['الـ ID ده واخده حد، جرّب غيره', 'That ID is taken, try another'],
  INVALID_USERNAME: ['الـ ID لازم 3–20 حرف إنجليزي صغير أو رقم أو _', 'ID must be 3–20 lowercase letters, digits or _'],
  INVALID_NAME: ['اكتب اسمك', 'Enter your name'],
  OFFLINE: ['مفيش اتصال بالسيرفر، حاول تاني', 'Not connected, try again'],
  TIMEOUT: ['السيرفر اتأخر في الرد، حاول تاني', 'The server took too long, try again'],
  ROOM_NOT_AVAILABLE: ['الغرفة مش متاحة للانضمام', 'The room is not available'],
  INVITE_EXPIRED: ['الدعوة انتهت', 'The invitation expired'],
  INVITE_NOT_FOUND: ['الدعوة انتهت', 'The invitation expired'],
  TOO_MANY_INVITES: ['دعوات كتير للغرفة دي', 'Too many invitations for this room'],
  // errors from joining the room itself (the game server's messages)
  'Room is full': ['الغرفة اتملت', 'The room is full'],
  'Game already started': ['اللعبة بدأت بالفعل', 'The game already started'],
  'Room not found': ['الغرفة اتقفلت', 'The room was closed'],
  'Name already taken in this room': ['الاسم مستخدم في الغرفة', 'That name is taken in this room'],
};

export function socialErrorText(e: unknown, ar: boolean): string {
  const code = e instanceof SocialError ? e.code : e instanceof Error ? e.message : '';
  const hit = ERRORS[code];
  if (hit) return ar ? hit[0] : hit[1];
  return ar ? 'حصل خطأ، حاول تاني' : 'Something went wrong, try again';
}

export const statusText = (s: Presence, ar: boolean) =>
  s === 'online' ? (ar ? 'متصل' : 'Online') : s === 'playing' ? (ar ? 'يلعب الآن' : 'Playing now') : ar ? 'غير متصل' : 'Offline';
