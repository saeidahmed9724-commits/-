import React from 'react';
import { Volume2, VolumeX, HelpCircle, RotateCcw } from 'lucide-react';
import { sound } from '../utils/audio';

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
}) => {
  return (
    <header className="w-full bg-[#F5F3EE]/95 backdrop-blur-md border-b border-[#E8E4DA] sticky top-0 z-40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
        {/* Game Mini Brand */}
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-xl bg-[#6C5CE7] text-white flex items-center justify-center font-black text-xs shadow-xs">
            ?
          </div>
          <span className="font-black text-sm text-[#171717] tracking-tight">
            {lang === 'ar' ? 'مين في إيدي؟' : "Who's In My Hand?"}
          </span>
        </div>

        {/* Center: Mobile Round & Score Pill */}
        {showScore && nameP1 && nameP2 ? (
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-[#E8E4DA] shadow-xs text-xs font-black">
            {roundNumber && (
              <span className="text-slate-500 font-mono text-[11px]">
                {lang === 'ar' ? `جـ ${roundNumber}` : `R${roundNumber}`}
              </span>
            )}
            <span className="text-[#E8E4DA]">|</span>
            <div className="flex items-center gap-1 font-mono tabular-nums text-xs">
              <span className="text-[#6C5CE7] truncate max-w-[65px]">{nameP1} {scoreP1}</span>
              <span className="text-slate-300">-</span>
              <span className="text-[#FF5C8A] truncate max-w-[65px]">{nameP2} {scoreP2}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-[#E8E4DA] shadow-xs text-xs font-black text-slate-700 font-mono">
            <span>{lang === 'ar' ? `الجولة ${roundNumber || 1}` : `Round ${roundNumber || 1}`}</span>
          </div>
        )}

        {/* Utility Icons (Compact for Mobile) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenRules}
            aria-label="Rules"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-[#171717] hover:bg-white active:bg-slate-200 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleSound();
              sound.playTurnChime();
            }}
            aria-label="Sound Toggle"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-[#171717] hover:bg-white active:bg-slate-200 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#4ED7B0]" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onRestartMatch}
            aria-label="Restart Match"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-rose-500 hover:bg-white active:bg-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
