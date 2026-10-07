import React from 'react';
import { BookOpen, Bot, HelpCircle, Lock, Settings, Smartphone, Users, Volume2, VolumeX } from 'lucide-react';
import { sound } from '../utils/audio';
import { GameLogoBanner } from './GameLogoBanner';
import { Avatar } from './social/Avatar';
import type { FriendView } from '../services/social';

interface HomeScreenProps {
  onCreateOnlineGame: () => void;
  onJoinRoom: () => void;
  onPlayOffline: () => void;
  onPlayWithAI: () => void;
  onOpenRules: () => void;
  onOpenMultiplayer?: () => void;
  /** main button: pick friends and play (no codes) */
  onPlayWithFriends: () => void;
  onOpenFriends: () => void;
  /** pending friend requests + invitations, shown as a badge on the Friends button */
  friendsBadge?: number;
  /** people I played with recently (still friends): one tap = invite them to a 2-player game */
  recent?: FriendView[];
  onQuickPlay?: (friend: FriendView) => void;
  lang: 'ar' | 'en';
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

const GLASS =
  'rounded-[26px] border border-indigo-300/30 bg-[#1b2150]/60 backdrop-blur-md shadow-[0_0_28px_rgba(99,102,241,0.22)]';
const ROUND_BTN =
  'w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-300/40 text-white flex items-center justify-center cursor-pointer active:scale-95';

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onCreateOnlineGame,
  onJoinRoom,
  onPlayOffline,
  onPlayWithAI,
  onOpenRules,
  onPlayWithFriends,
  onOpenFriends,
  friendsBadge = 0,
  recent = [],
  onQuickPlay,
  lang,
  soundEnabled = true,
  onToggleSound,
}) => {
  const ar = lang === 'ar';
  const go = (fn: () => void, chime = false) => () => {
    chime ? sound.playTurnChime() : sound.playCardFlip();
    fn();
  };

  return (
    <div className="w-full max-w-[440px] mx-auto px-3 py-3 space-y-3 animate-fade-in select-none">
      {/* top bar */}
      <div dir="ltr" className={`${GLASS} px-3 py-2 flex items-center justify-between gap-2`}>
        <GameLogoBanner size="sm" className="shrink-0" />
        <div className="flex items-center gap-2">
          <button type="button" aria-label={ar ? 'طريقة اللعب والمساعدة' : 'Rules & Help'} onClick={go(onOpenRules)} className={ROUND_BTN}>
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label={soundEnabled ? (ar ? 'كتم الصوت' : 'Mute') : ar ? 'تشغيل الصوت' : 'Unmute'}
            onClick={() => {
              onToggleSound?.();
              sound.playTurnChime();
            }}
            className={ROUND_BTN}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* hero */}
      <div className={`${GLASS} px-5 py-6 text-center space-y-3`}>
        <img
          src="/art/cards-question.webp"
          alt=""
          aria-hidden
          width={176}
          height={143}
          className="mx-auto w-44 h-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)]"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <h1 className="text-2xl font-black text-white leading-snug">
          {ar ? (
            <>
              خمّن <span className="text-amber-400">صورتك المخفية</span>
            </>
          ) : (
            <>
              Guess your <span className="text-amber-400">hidden picture</span>
            </>
          )}
        </h1>
        <p className="text-sm font-bold text-slate-300">
          {ar ? 'اسأل أسئلة نعم / لا واكتشف الصورة قبل خصمك' : 'Ask yes / no questions and find the picture before your opponent'}
        </p>
      </div>

      {/* main button: play with friends (no room codes) */}
      <button
        type="button"
        onClick={go(onPlayWithFriends, true)}
        className="w-full h-16 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 text-indigo-950 text-xl font-black flex items-center justify-center gap-2.5 shadow-lg cursor-pointer active:scale-95"
      >
        <Users className="w-6 h-6" />
        {ar ? 'العب مع أصدقائك' : 'Play with Friends'}
      </button>

      {/* quick play: the people I played with last */}
      {recent.length > 0 && onQuickPlay && (
        <div className={`${GLASS} p-3 space-y-2`}>
          <div className="text-xs font-black text-slate-200 px-1">{ar ? 'العب مرة أخرى' : 'Play again'}</div>
          <div className="grid grid-cols-4 gap-2">
            {recent.slice(0, 4).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={go(() => onQuickPlay(f), true)}
                className="min-w-0 flex flex-col items-center gap-1 p-2 rounded-2xl bg-[#0a1030]/50 border border-indigo-300/20 cursor-pointer active:scale-95"
              >
                <Avatar emoji={f.avatar} status={f.status} size={44} />
                <span className="text-[11px] font-black text-white truncate max-w-full">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={go(onOpenFriends)}
        className={`${GLASS} relative w-full h-14 text-white text-base font-black flex items-center justify-center gap-2.5 cursor-pointer active:scale-95`}
      >
        <span>👥</span>
        {ar ? 'الأصدقاء' : 'Friends'}
        {friendsBadge > 0 && (
          <span className="absolute top-2 end-3 min-w-6 h-6 px-1.5 rounded-full bg-rose-500 text-white text-xs font-black flex items-center justify-center shadow-lg">
            {friendsBadge}
          </span>
        )}
      </button>

      {/* secondary buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={go(onPlayWithAI, true)}
          className={`${GLASS} h-16 px-2 text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer active:scale-95`}
        >
          <Bot className="w-5 h-5 text-sky-300 shrink-0" />
          {ar ? 'ضد الروبوت' : 'Solo vs Bot'}
        </button>
        <button
          type="button"
          onClick={go(onPlayOffline, true)}
          className={`${GLASS} h-16 px-2 text-white text-sm font-black leading-tight flex items-center justify-center gap-2 cursor-pointer active:scale-95`}
        >
          <Smartphone className="w-5 h-5 text-emerald-300 shrink-0" />
          {ar ? 'لاعبين بجهاز واحد' : 'Pass & Play (1 Device)'}
        </button>
      </div>

      {/* fallback: room code (for someone who is not on your friends list) */}
      <div className="rounded-2xl border border-dashed border-indigo-300/30 p-3 space-y-2">
        <div className="text-[11px] font-bold text-slate-400 text-center">
          {ar ? 'صاحبك مش في قايمة أصدقائك؟ العب بكود الغرفة' : 'Friend not on your list? Play with a room code'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={go(onCreateOnlineGame, true)}
            className="h-11 rounded-xl bg-[#1b2150]/60 border border-indigo-300/30 text-slate-100 text-xs font-black cursor-pointer active:scale-95"
          >
            {ar ? 'إنشاء غرفة بكود' : 'Create with code'}
          </button>
          <button
            type="button"
            onClick={go(onJoinRoom, true)}
            className="h-11 rounded-xl bg-[#1b2150]/60 border border-indigo-300/30 text-slate-100 text-xs font-black cursor-pointer active:scale-95"
          >
            {ar ? 'انضم بكود' : 'Join with code'}
          </button>
        </div>
      </div>

      {/* footer nav */}
      <div className={`${GLASS} grid grid-cols-3 py-2`}>
        {[
          { icon: <Settings className="w-5 h-5" />, label: ar ? 'الإعدادات والقواعد' : 'Settings & Rules', fn: onOpenRules },
          { icon: <Lock className="w-5 h-5" />, label: ar ? 'غرفة خاصة' : 'Private Room', fn: onCreateOnlineGame },
          { icon: <BookOpen className="w-5 h-5" />, label: ar ? 'طريقة اللعب' : 'How to Play', fn: onOpenRules },
        ].map((n) => (
          <button
            key={n.label}
            type="button"
            onClick={go(n.fn)}
            className="py-2 text-slate-200 text-[11px] font-black flex flex-col items-center gap-1 cursor-pointer active:scale-95"
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
};
