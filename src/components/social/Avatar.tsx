import React from 'react';
import { Presence, statusText } from '../../services/social';

const DOT: Record<Presence, string> = { online: 'bg-emerald-400', playing: 'bg-amber-400', offline: 'bg-slate-500' };
const TEXT: Record<Presence, string> = { online: 'text-emerald-300', playing: 'text-amber-300', offline: 'text-slate-400' };

/** Emoji avatar with an optional presence dot. */
export const Avatar: React.FC<{ emoji: string; status?: Presence; size?: number }> = ({ emoji, status, size = 44 }) => (
  <div className="relative shrink-0" style={{ width: size, height: size }}>
    <div
      className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-500/40 to-purple-600/40 border border-indigo-300/40 flex items-center justify-center"
      style={{ fontSize: size * 0.52 }}
      aria-hidden
    >
      {emoji}
    </div>
    {status && <span className={`absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#141a45] ${DOT[status]}`} />}
  </div>
);

export const StatusLine: React.FC<{ status: Presence; ar: boolean }> = ({ status, ar }) => (
  <span className={`text-[11px] font-bold ${TEXT[status]}`}>
    {status === 'online' ? '🟢 ' : status === 'playing' ? '🎮 ' : '⚪ '}
    {statusText(status, ar)}
  </span>
);

export const presenceRank = (s: Presence) => (s === 'online' ? 0 : s === 'playing' ? 1 : 2);
