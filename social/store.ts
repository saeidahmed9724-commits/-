// Permanent storage for the social system (accounts, friendships, friend requests, recent players).
//
// Rooms stay in memory (mpRooms.ts / server.ts); everything in here must survive a restart, so it
// lives in a JSON file that is written atomically (temp file + rename), debounced so a burst of
// changes costs one write.
//
// IMPORTANT for hosting: the file lives in DATA_DIR. On hosts with an ephemeral disk (Render free
// tier, Cloud Run) it is wiped on every deploy/restart unless DATA_DIR points at a persistent disk.
// The rest of the system only talks to SocialStore, so swapping this for Postgres/SQLite later
// means rewriting this one file.

import fs from 'fs';
import path from 'path';

export interface UserRecord {
  id: string;
  name: string;
  /** lowercase, unique ("saeed123"); shown to people as @saeed123 */
  username: string;
  avatar: string;
  /** sha256(token) — the raw token only ever lives on the player's device */
  tokenHash: string;
  createdAt: number;
  lastSeen: number;
}

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  at: number;
}

export interface SocialData {
  version: 1;
  users: Record<string, UserRecord>;
  friends: Record<string, string[]>;
  requests: Record<string, FriendRequest>;
  /** userId -> people they recently played with (newest first) */
  recent: Record<string, Array<{ id: string; at: number }>>;
}

const emptyData = (): SocialData => ({ version: 1, users: {}, friends: {}, requests: {}, recent: {} });

export class SocialStore {
  data: SocialData;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  /** `file = null` keeps everything in memory only (tests). */
  constructor(private file: string | null) {
    this.data = this.load();
  }

  private load(): SocialData {
    if (!this.file || !fs.existsSync(this.file)) return emptyData();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return { ...emptyData(), ...parsed };
    } catch (err) {
      // Never overwrite a file we could not read: keep it aside so nothing is silently lost.
      const aside = `${this.file}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(this.file, aside);
      } catch {}
      console.error(`[social] could not read ${this.file} (${err}). Kept as ${aside}; starting with an empty store.`);
      return emptyData();
    }
  }

  /** Mark the data as changed; the actual write is debounced. */
  save() {
    if (!this.file) return;
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 250);
    this.timer.unref?.();
  }

  /** Write now (also called on shutdown). */
  flush() {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      this.dirty = true;
      console.error('[social] save failed:', err);
    }
  }
}
