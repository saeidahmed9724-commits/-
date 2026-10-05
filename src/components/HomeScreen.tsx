import React from 'react';
import { BookOpen, Bot, HelpCircle, Link2, Lock, Play, Settings, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { sound } from '../utils/audio';
import { GameLogoBanner } from './GameLogoBanner';

interface HomeScreenProps {
  onCreateOnlineGame: () => void;
  onJoinRoom: () => void;
  onPlayOffline: () => void;
  onPlayWithAI: () => void;
  onOpenRules: () => void;
  onOpenMultiplayer?: () => void;
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
  onOpenMultiplayer,
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

      {/* 3-4 players */}
      {onOpenMultiplayer && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={go(onOpenMultiplayer, true)}
            className="px-4 h-9 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white text-xs font-black border border-purple-300/40 shadow-xl flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>👥</span>
            {ar ? 'طور 3–4 لاعبين' : '3-4 Players Mode'}
          </button>
        </div>
      )}

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

      {/* main buttons */}
      <button
        type="button"
        onClick={go(onCreateOnlineGame, true)}
        className="w-full h-16 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 text-indigo-950 text-xl font-black flex items-center justify-center gap-2.5 shadow-lg cursor-pointer active:scale-95"
      >
        <Play className="w-6 h-6 fill-current" />
        {ar ? 'ابدأ اللعبة' : 'Start Game'}
      </button>

      <button
        type="button"
        onClick={go(onJoinRoom, true)}
        className="w-full h-16 rounded-2xl bg-gradient-to-b from-blue-500 to-violet-600 border border-white/30 text-white text-xl font-black flex items-center justify-center gap-2.5 shadow-lg cursor-pointer active:scale-95"
      >
        <Link2 className="w-6 h-6" />
        {ar ? 'انضم بكود' : 'Join with Code'}
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
