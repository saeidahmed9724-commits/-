import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Play, UserPlus } from 'lucide-react';
import { useSocial } from '../../services/social';
import { sound } from '../../utils/audio';
import { Avatar, StatusLine, presenceRank } from './Avatar';

interface Props {
  lang: 'ar' | 'en';
  onBack: () => void;
  /** the chosen friends (1-3): the game is created with them and the invitations go out */
  onStart: (friendIds: string[]) => Promise<void>;
  onOpenFriends: () => void;
  /** the fallback: play with a room code instead */
  onUseCode: () => void;
}

const GLASS = 'rounded-[26px] border border-indigo-300/30 bg-[#1b2150]/60 backdrop-blur-md shadow-[0_0_28px_rgba(99,102,241,0.22)]';
const MAX_FRIENDS = 3; // 4 players maximum, one of them is me

/** "🎮 اختر أصدقاء للعب": pick 1-3 friends, press start, they get the invitation. */
export const FriendsSetupScreen: React.FC<Props> = ({ lang, onBack, onStart, onOpenFriends, onUseCode }) => {
  const ar = lang === 'ar';
  const s = useSocial();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const friends = [...s.friends].sort((a, b) => presenceRank(a.status) - presenceRank(b.status) || a.name.localeCompare(b.name));
  const players = picked.length + 1;

  const toggle = (id: string) => {
    sound.playCardFlip();
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_FRIENDS ? [...p, id] : p));
  };

  const start = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    sound.playTurnChime();
    try {
      await onStart(picked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto px-3 py-3 space-y-3 animate-fade-in pb-8">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => { sound.playCardFlip(); onBack(); }} className="px-5 h-11 rounded-full border border-indigo-300/30 bg-[#1b2150]/60 text-white text-sm font-black flex items-center gap-2 cursor-pointer active:scale-95">
          <ArrowLeft className={`w-4 h-4 ${ar ? 'rotate-180' : ''}`} />
          {ar ? 'رجوع' : 'Back'}
        </button>
        <h1 className="text-lg font-black text-white">{ar ? '🎮 اختر أصدقاء للعب' : '🎮 Pick friends to play'}</h1>
      </div>

      <div className={`${GLASS} p-3 space-y-2`}>
        {friends.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <div className="text-4xl">🫂</div>
            <div className="text-sm font-black text-white">{ar ? 'لسه ماضفتش أصدقاء' : "You haven't added friends yet"}</div>
            <button type="button" onClick={onOpenFriends} className="px-5 h-11 rounded-2xl bg-gradient-to-b from-blue-500 to-violet-600 border border-white/30 text-white text-sm font-black inline-flex items-center gap-2 cursor-pointer active:scale-95">
              <UserPlus className="w-4 h-4" />
              {ar ? 'إضافة صديق' : 'Add a friend'}
            </button>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold text-slate-400 px-1">
              {ar ? 'اختار من 1 لـ 3 أصدقاء. اللي مش متصل هتوصله الدعوة أول ما يفتح اللعبة.' : 'Pick 1–3 friends. Offline friends get the invitation when they open the game.'}
            </p>
            {friends.map((f) => {
              const on = picked.includes(f.id);
              const full = !on && picked.length >= MAX_FRIENDS;
              return (
                <button key={f.id} type="button" disabled={full} onClick={() => toggle(f.id)} aria-pressed={on} className={`w-full flex items-center gap-2.5 p-2 rounded-2xl border text-start cursor-pointer active:scale-[0.98] transition-colors disabled:opacity-40 ${on ? 'bg-emerald-500/15 border-emerald-400/70' : 'bg-[#0a1030]/50 border-transparent'}`}>
                  <Avatar emoji={f.avatar} status={f.status} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white truncate">{f.name}</div>
                    <StatusLine status={f.status} ar={ar} />
                  </div>
                  <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-sm font-black ${on ? 'bg-emerald-500 border-emerald-300 text-white' : 'border-slate-500 text-transparent'}`}>✓</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {friends.length > 0 && (
        <button type="button" disabled={!picked.length || busy} onClick={start} className="w-full h-16 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 text-indigo-950 text-lg font-black flex items-center justify-center gap-2.5 shadow-lg cursor-pointer active:scale-95 disabled:opacity-40">
          <Play className="w-5 h-5 fill-current" />
          {busy ? (ar ? 'ثواني...' : 'One moment...') : picked.length ? (ar ? `ابدأ اللعبة (${players} لاعبين)` : `Start game (${players} players)`) : ar ? 'اختار صديق واحد على الأقل' : 'Pick at least one friend'}
        </button>
      )}

      <button type="button" onClick={onUseCode} className="w-full py-2 text-slate-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
        <KeyRound className="w-3.5 h-3.5" />
        {ar ? 'مش في القايمة؟ العب بكود الغرفة' : "Not on the list? Play with a room code"}
      </button>
    </div>
  );
};
