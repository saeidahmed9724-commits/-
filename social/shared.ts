// Pure constants/helpers shared by the server (social/*) and the browser (src/services/social.ts).
// No Node imports here: this file is bundled into the frontend too.

export const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🐧', '🐨', '🦉', '🐲', '🤖'];

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const NAME_MAX = 24;

export type Presence = 'online' | 'playing' | 'offline';

/** "@Saeed123 " -> "saeed123" */
export const normalizeUsername = (s: string) => String(s ?? '').trim().replace(/^@+/, '').toLowerCase();
