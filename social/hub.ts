// The always-on "social" channel (path /ws/social).
//
// Why a separate socket: the game socket (server.ts / mpRooms.ts) is opened when a room is created
// or joined and closed when the player leaves it. Presence and invitations have to keep working on
// the home screen, between matches, so they get their own long-lived connection.
//
// Protocol (all JSON):
//   client -> server   F_AUTH {userId, token}                      first message, within 10 s
//                      F_STATUS {status:'online'|'playing'}        what the player is doing (cosmetic)
//                      requests with a reqId, answered by F_REPLY {reqId, ok, code?, data?}:
//                        F_ADD {username}  F_ACCEPT {requestId}  F_DECLINE {requestId}
//                        F_CANCEL {requestId}  F_REMOVE {userId}  F_PROFILE {name, avatar}
//                        F_INVITE {code, to:[userId]}  F_INVITE_ACCEPT {inviteId}  F_INVITE_DECLINE {inviteId}
//   server -> client   F_AUTH_OK {me} / F_AUTH_FAIL            F_STATE {...snapshot}
//                      F_PRESENCE {userId, status}              F_REQUEST {from}
//                      F_INVITE {invite}   F_INVITE_GONE {inviteId}   F_INVITE_UPDATE {inviteId, code, toId, status}
//
// Invitations are NOT stored on disk: they point at a room, and rooms live in memory only.

import crypto from 'crypto';
import { WebSocket } from 'ws';
import { SocialService, SocialError, toProfile, Profile } from './service';
import { Presence } from './shared';

export interface RoomInfo {
  exists: boolean;
  /** true while the room is in its lobby and has a free seat */
  joinable: boolean;
  maxPlayers: number;
  seatsLeft: number;
}

export interface HubOptions {
  getRoomInfo: (code: string) => RoomInfo;
  now?: () => number;
  inviteTtlMs?: number;
}

type ReportedStatus = 'online' | 'playing';

interface Conn {
  ws: WebSocket;
  userId: string | null;
  status: ReportedStatus;
  alive: boolean;
  authTimer?: ReturnType<typeof setTimeout>;
}

interface Invite {
  id: string;
  code: string;
  fromId: string;
  toId: string;
  maxPlayers: number;
  createdAt: number;
}

type InviteEnd = 'accepted' | 'declined' | 'expired';

const send = (ws: WebSocket, payload: unknown) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
};

/** Sliding-window rate limiter, keyed by string. */
class Limiter {
  private hits = new Map<string, number[]>();
  allow(key: string, max: number, windowMs: number, now: number): boolean {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
  sweep(now: number, windowMs = 120_000) {
    for (const [k, list] of this.hits) {
      const fresh = list.filter((t) => now - t < windowMs);
      if (fresh.length) this.hits.set(k, fresh);
      else this.hits.delete(k);
    }
  }
}

export class SocialHub {
  private conns = new Set<Conn>();
  private byUser = new Map<string, Set<Conn>>();
  private lastPresence = new Map<string, Presence>();
  private invites = new Map<string, Invite>();
  /** room code -> players already known to be in it (the inviter + accepted invitees), for "recent players" */
  private roomMembers = new Map<string, Set<string>>();
  private limiter = new Limiter();
  private timers: ReturnType<typeof setInterval>[] = [];
  private now: () => number;
  private ttl: number;

  constructor(
    private svc: SocialService,
    private opts: HubOptions
  ) {
    this.now = opts.now ?? Date.now;
    this.ttl = opts.inviteTtlMs ?? 15 * 60_000;

    // Mobile networks drop connections silently: ping so a vanished player does not stay "online".
    const heartbeat = setInterval(() => {
      for (const c of this.conns) {
        if (!c.alive) {
          c.ws.terminate();
          continue;
        }
        c.alive = false;
        try {
          c.ws.ping();
        } catch {}
      }
    }, 25_000);
    const sweep = setInterval(() => this.sweepInvites(), 20_000);
    this.timers.push(heartbeat, sweep);
    this.timers.forEach((t) => t.unref?.());
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  // ---------------------------------------------------------------- connection lifecycle

  handleConnection(ws: WebSocket) {
    const conn: Conn = { ws, userId: null, status: 'online', alive: true };
    this.conns.add(conn);
    conn.authTimer = setTimeout(() => {
      if (!conn.userId) ws.close(4001, 'auth timeout');
    }, 10_000);

    ws.on('pong', () => {
      conn.alive = true;
    });
    ws.on('message', (data) => {
      conn.alive = true;
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg && typeof msg === 'object') this.onMessage(conn, msg);
    });
    ws.on('close', () => this.onClose(conn));
    ws.on('error', () => {});
  }

  private onClose(conn: Conn) {
    if (conn.authTimer) clearTimeout(conn.authTimer);
    this.conns.delete(conn);
    const uid = conn.userId;
    if (!uid) return;
    const set = this.byUser.get(uid);
    set?.delete(conn);
    if (set && set.size === 0) {
      this.byUser.delete(uid);
      this.svc.touch(uid);
    }
    this.refreshPresence(uid);
  }

  // ---------------------------------------------------------------- presence

  statusOf(userId: string): Presence {
    const set = this.byUser.get(userId);
    if (!set || set.size === 0) return 'offline';
    for (const c of set) if (c.status === 'playing') return 'playing';
    return 'online';
  }

  /** Tell the user's friends if (and only if) the user's status changed. */
  private refreshPresence(userId: string) {
    const status = this.statusOf(userId);
    const prev = this.lastPresence.get(userId) ?? 'offline';
    if (status === prev) return;
    if (status === 'offline') this.lastPresence.delete(userId);
    else this.lastPresence.set(userId, status);
    for (const fid of this.svc.friendsOf(userId)) this.sendToUser(fid, { type: 'F_PRESENCE', userId, status });
  }

  // ---------------------------------------------------------------- sending helpers

  private sendToUser(userId: string, payload: unknown) {
    const set = this.byUser.get(userId);
    if (set) for (const c of set) send(c.ws, payload);
  }

  private profile(id: string): Profile | null {
    const u = this.svc.getUser(id);
    return u ? toProfile(u) : null;
  }

  private friendView(id: string) {
    const p = this.profile(id);
    return p ? { ...p, status: this.statusOf(id) } : null;
  }

  private buildState(userId: string) {
    const me = this.profile(userId)!;
    const notNull = <T>(x: T | null): x is T => x !== null;
    return {
      type: 'F_STATE',
      me,
      friends: this.svc.friendsOf(userId).map((id) => this.friendView(id)).filter(notNull),
      incoming: this.svc
        .incoming(userId)
        .map((r) => ({ id: r.id, at: r.at, user: this.profile(r.from) }))
        .filter((r) => r.user),
      outgoing: this.svc
        .outgoing(userId)
        .map((r) => ({ id: r.id, at: r.at, user: this.profile(r.to) }))
        .filter((r) => r.user),
      recent: this.svc.recentOf(userId).map((id) => this.friendView(id)).filter(notNull),
      invites: this.validInvitesFor(userId).map((i) => this.inviteView(i)),
    };
  }

  pushState(userId: string) {
    if (this.byUser.has(userId)) this.sendToUser(userId, this.buildState(userId));
  }

  // ---------------------------------------------------------------- messages

  private onMessage(conn: Conn, msg: any) {
    const reqId = typeof msg.reqId === 'string' ? msg.reqId.slice(0, 40) : undefined;
    const reply = (ok: boolean, extra: Record<string, unknown> = {}) => {
      if (reqId) send(conn.ws, { type: 'F_REPLY', reqId, ok, ...extra });
    };

    try {
      if (msg.type === 'F_AUTH') {
        if (conn.userId) return;
        const user = this.svc.authenticate(msg.userId, msg.token);
        if (!user) {
          send(conn.ws, { type: 'F_AUTH_FAIL' });
          conn.ws.close(4003, 'auth failed');
          return;
        }
        if (conn.authTimer) clearTimeout(conn.authTimer);
        conn.userId = user.id;
        let set = this.byUser.get(user.id);
        if (!set) this.byUser.set(user.id, (set = new Set()));
        set.add(conn);
        send(conn.ws, { type: 'F_AUTH_OK', me: toProfile(user) });
        send(conn.ws, this.buildState(user.id));
        this.refreshPresence(user.id);
        return;
      }

      const me = conn.userId;
      if (!me) throw new SocialError('UNAUTHENTICATED');

      switch (msg.type) {
        case 'F_STATUS': {
          if (msg.status !== 'online' && msg.status !== 'playing') return;
          conn.status = msg.status;
          this.refreshPresence(me);
          return;
        }

        case 'F_ADD': {
          this.rateLimit(`add:${me}`, 10, 60_000);
          const res = this.svc.sendRequest(me, msg.username);
          this.pushState(me);
          this.pushState(res.other.id);
          if (res.kind === 'requested') {
            this.sendToUser(res.other.id, { type: 'F_REQUEST', from: this.profile(me) });
          }
          return reply(true, { data: { kind: res.kind, user: toProfile(res.other) } });
        }

        case 'F_ACCEPT': {
          const other = this.svc.acceptRequest(me, msg.requestId);
          this.pushState(me);
          this.pushState(other);
          return reply(true);
        }

        case 'F_DECLINE': {
          const other = this.svc.declineRequest(me, msg.requestId);
          this.pushState(me);
          this.pushState(other);
          return reply(true);
        }

        case 'F_CANCEL': {
          const other = this.svc.cancelRequest(me, msg.requestId);
          this.pushState(me);
          this.pushState(other);
          return reply(true);
        }

        case 'F_REMOVE': {
          const other = String(msg.userId ?? '');
          if (this.svc.removeFriend(me, other)) {
            for (const inv of [...this.invites.values()]) {
              if ((inv.fromId === me && inv.toId === other) || (inv.fromId === other && inv.toId === me)) this.dropInvite(inv, 'expired');
            }
            this.pushState(me);
            this.pushState(other);
          }
          return reply(true);
        }

        case 'F_PROFILE': {
          this.rateLimit(`profile:${me}`, 10, 60_000);
          this.svc.updateProfile(me, msg.name, msg.avatar);
          this.pushState(me);
          for (const fid of this.svc.friendsOf(me)) this.pushState(fid);
          return reply(true, { data: { me: this.profile(me) } });
        }

        case 'F_INVITE':
          return reply(true, { data: this.createInvites(me, msg) });

        case 'F_INVITE_ACCEPT':
          return reply(true, { data: this.acceptInvite(me, msg.inviteId) });

        case 'F_INVITE_DECLINE': {
          const inv = this.invites.get(String(msg.inviteId));
          if (!inv || inv.toId !== me) throw new SocialError('INVITE_NOT_FOUND');
          this.dropInvite(inv, 'declined');
          return reply(true);
        }

        default:
          return reply(false, { code: 'UNKNOWN_MESSAGE' });
      }
    } catch (err) {
      if (err instanceof SocialError) return reply(false, { code: err.code });
      console.error('[social] error handling message:', err);
      return reply(false, { code: 'SERVER_ERROR' });
    }
  }

  private rateLimit(key: string, max: number, windowMs: number) {
    if (!this.limiter.allow(key, max, windowMs, this.now())) throw new SocialError('RATE_LIMIT');
  }

  // ---------------------------------------------------------------- invitations

  private inviteView(inv: Invite) {
    return { id: inv.id, from: this.profile(inv.fromId), maxPlayers: inv.maxPlayers, createdAt: inv.createdAt };
  }

  private isLive(inv: Invite): boolean {
    if (this.now() - inv.createdAt > this.ttl) return false;
    const info = this.opts.getRoomInfo(inv.code);
    return info.exists && info.joinable;
  }

  private validInvitesFor(userId: string): Invite[] {
    return [...this.invites.values()].filter((i) => i.toId === userId && this.isLive(i)).sort((a, b) => b.createdAt - a.createdAt);
  }

  private createInvites(me: string, msg: any) {
    this.rateLimit(`invite:${me}`, 20, 60_000);
    const code = String(msg.code ?? '').toUpperCase().slice(0, 8);
    const to: string[] = Array.isArray(msg.to) ? [...new Set<string>(msg.to.filter((x: unknown) => typeof x === 'string'))].slice(0, 3) : [];
    if (!code || to.length === 0) throw new SocialError('INVALID_REQUEST');

    const info = this.opts.getRoomInfo(code);
    if (!info.exists || !info.joinable) throw new SocialError('ROOM_NOT_AVAILABLE');
    if ([...this.invites.values()].filter((i) => i.code === code).length >= 8) throw new SocialError('TOO_MANY_INVITES');

    const now = this.now();
    // the inviter is part of the room: remember it so "recent players" works for the whole group
    if (!this.roomMembers.has(code)) this.roomMembers.set(code, new Set([me]));

    const results = to.map((toId) => {
      if (toId === me || !this.svc.areFriends(me, toId)) return { toId, result: 'not_friend' as const };

      const presence = this.statusOf(toId);
      let inv = [...this.invites.values()].find((i) => i.fromId === me && i.toId === toId && i.code === code);
      if (inv && now - inv.createdAt < 20_000) return { toId, inviteId: inv.id, result: 'already_pending' as const, presence };

      if (inv) {
        inv.createdAt = now; // a re-send refreshes the invite instead of piling up copies
      } else {
        inv = { id: 'i_' + crypto.randomBytes(6).toString('hex'), code, fromId: me, toId, maxPlayers: info.maxPlayers, createdAt: now };
        this.invites.set(inv.id, inv);
      }
      // Online or not, it is stored: an offline friend gets it in their F_STATE as soon as they connect.
      this.sendToUser(toId, { type: 'F_INVITE', invite: this.inviteView(inv) });
      return { toId, inviteId: inv.id, result: 'sent' as const, presence };
    });
    return { results };
  }

  /** Validates the invite and hands the room code to the person accepting (they then join like with a code). */
  private acceptInvite(me: string, inviteId: unknown) {
    const inv = this.invites.get(String(inviteId));
    if (!inv || inv.toId !== me) throw new SocialError('INVITE_NOT_FOUND');
    if (!this.isLive(inv)) {
      this.dropInvite(inv, 'expired');
      throw new SocialError('INVITE_EXPIRED');
    }

    // everyone already in that room becomes a "recent player" of the newcomer (and vice versa)
    const members = this.roomMembers.get(inv.code) ?? new Set([inv.fromId]);
    for (const m of members) this.svc.recordPlayedTogether(m, me);
    members.add(me);
    this.roomMembers.set(inv.code, members);
    for (const m of members) this.pushState(m);

    this.dropInvite(inv, 'accepted');
    // the same person may have been invited to this room by several friends: those are settled too
    for (const other of [...this.invites.values()]) {
      if (other.toId === me && other.code === inv.code) this.dropInvite(other, 'accepted');
    }
    return { code: inv.code };
  }

  private dropInvite(inv: Invite, why: InviteEnd) {
    if (!this.invites.delete(inv.id)) return;
    this.sendToUser(inv.toId, { type: 'F_INVITE_GONE', inviteId: inv.id });
    this.sendToUser(inv.fromId, { type: 'F_INVITE_UPDATE', inviteId: inv.id, code: inv.code, toId: inv.toId, status: why });
  }

  private sweepInvites() {
    for (const inv of [...this.invites.values()]) if (!this.isLive(inv)) this.dropInvite(inv, 'expired');
    for (const code of [...this.roomMembers.keys()]) if (!this.opts.getRoomInfo(code).exists) this.roomMembers.delete(code);
    this.limiter.sweep(this.now());
  }

  /** Test hook. */
  _sweepNow() {
    this.sweepInvites();
  }
}
