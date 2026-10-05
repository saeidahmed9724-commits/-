import React from 'react';
import { Volume2, VolumeX, HelpCircle, RotateCcw, Mic, MicOff } from 'lucide-react';
import { sound } from '../utils/audio';
import { GameLogoBanner } from './GameLogoBanner';

interface HeaderProps {
  scoreP1: number;
  scoreP2: number;
  nameP1: string;
  nameP2: string;
  roundNumber?: number;
  categoryName?: string;
  categoryIcon?: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenRules: () => void;
  onRestartMatch: () => void;
  lang: 'ar' | 'en';
  onToggleLang: () => void;
  showScore?: boolean;
  // Online Voice Chat Props (Only displayed in Online modes, NEVER in Same Device!)
  isOnline?: boolean;
  isMicOn?: boolean;
  isSpeaking?: boolean;
  onToggleMic?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  scoreP1,
  scoreP2,
  nameP1,
  nameP2,
  roundNumber,
  soundEnabled,
  onToggleSound,
  onOpenRules,
  onRestartMatch,
  lang,
  showScore = true,
  isOnline = false,
  isMicOn = false,
  isSpeaking = false,
  onToggleMic,
}) => {
  return (
    <header className="mx-3 mt-3 rounded-[26px] border border-indigo-300/30 bg-[#1b2150]/60 backdrop-blur-md shadow-[0_0_28px_rgba(99,102,241,0.22)] sticky top-3 z-40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
        {/* Left Side: Modern Circle Utility Actions */}
        <div className="flex items-center gap-1.5">
          {/* 1. Restart Match */}
          <button
            type="button"
            onClick={onRestartMatch}
            aria-label="Restart Match"
            title={lang === 'ar' ? 'الرئيسية / إعادة' : 'Home / Restart'}
            className="w-9 h-9 rounded-xl btn-premium-icon flex items-center justify-center cursor-pointer text-slate-300 hover:text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* 2. Persistent Live Room Microphone Button (ONLY in Online modes, NEVER in Same Device!) */}
          {isOnline && onToggleMic && (
            <button
              type="button"
              onClick={() => {
                sound.playTurnChime();
                onToggleMic();
              }}
              aria-label="Toggle Microphone"
              title={
                isMicOn
                  ? (lang === 'ar' ? 'المايك شغال ومفتوح 🟢 (اضغط للقفل)' : 'Mic is Active 🟢 (Tap to mute)')
                  : (lang === 'ar' ? 'المايك مقفول 🔇 (اضغط للفتح)' : 'Mic is Muted 🔇 (Tap to unmute)')
              }
              className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 relative ${
                isMicOn
                  ? 'bg-emerald-500/25 border border-emerald-400/60 text-emerald-300 shadow-md shadow-emerald-500/25'
                  : 'bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isMicOn ? (
                <>
                  {isSpeaking && (
                    <span className="absolute inset-0 rounded-xl border border-emerald-400 animate-ping opacity-75 pointer-events-none" />
                  )}
                  <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
                </>
              ) : (
                <MicOff className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )}

          {/* 3. Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              onToggleSound();
              sound.playTurnChime();
            }}
            aria-label="Sound Toggle"
            title={lang === 'ar' ? 'الصوت' : 'Sound'}
            className="w-9 h-9 rounded-xl btn-premium-icon flex items-center justify-center cursor-pointer text-slate-300 hover:text-white"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* 4. Rules Modal */}
          <button
            type="button"
            onClick={onOpenRules}
            aria-label="Rules"
            title={lang === 'ar' ? 'طريقة اللعب' : 'Rules'}
            className="w-9 h-9 rounded-xl btn-premium-icon flex items-center justify-center cursor-pointer text-slate-300 hover:text-white"
          >
            <HelpCircle className="w-4 h-4 text-purple-400" />
          </button>
        </div>

        {/* Center: Sleek Modern Round / Score Badge */}
        <div className="flex items-center">
          {showScore && nameP1 && nameP2 ? (
            <div className="flex items-center gap-2 bg-[#1E293B] px-3.5 py-1.5 rounded-full border border-slate-700/80 shadow-inner text-xs font-black">
              {roundNumber && (
                <span className="text-amber-400 font-bold">
                  {lang === 'ar' ? `جـ ${roundNumber}` : `R${roundNumber}`}
                </span>
              )}
              <span className="text-slate-600">·</span>
              <div className="flex items-center gap-1.5 tabular-nums">
                <span className="text-blue-400 truncate max-w-[65px]">{nameP1} {scoreP1}</span>
                <span className="text-slate-500 font-bold">:</span>
                <span className="text-purple-400 truncate max-w-[65px]">{nameP2} {scoreP2}</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#1E293B] px-3.5 py-1 rounded-full border border-slate-700/80 text-xs font-bold text-slate-300">
              {lang === 'ar' ? `الجولة ${roundNumber || 1}` : `Round ${roundNumber || 1}`}
            </div>
          )}
        </div>

        {/* Right Side: Mini Official Logo */}
        <div className="flex items-center justify-end select-none">
          <GameLogoBanner size="sm" className="max-w-[110px]" />
        </div>
      </div>
    </header>
  );
};

