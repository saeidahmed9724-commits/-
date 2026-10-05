import React from 'react';
import { sound } from '../utils/audio';
import { Users, Wifi, Smartphone, Sparkles, X, Mic } from 'lucide-react';

export type SelectedGameSetupMode = 'ONLINE_2' | 'ONLINE_3' | 'ONLINE_4' | 'PASS_AND_PLAY_2';

interface PlayerCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode?: (mode: SelectedGameSetupMode) => void;
  onSelectCount?: (count: 2 | 3 | 4) => void;
  lang: 'ar' | 'en';
}

export const PlayerCountModal: React.FC<PlayerCountModalProps> = ({
  isOpen,
  onClose,
  onSelectMode,
  onSelectCount,
  lang,
}) => {
  if (!isOpen) return null;

  const handlePick = (mode: SelectedGameSetupMode, count: 2 | 3 | 4) => {
    sound.playTurnChime();
    if (onSelectMode) onSelectMode(mode);
    if (onSelectCount) onSelectCount(count);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm bg-[#141a45]/95 border-2 border-indigo-300/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 animate-scale-up relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onClose();
          }}
          className="absolute top-4 end-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto text-xl mb-1 shadow-sm">
            <Wifi className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'ابدأ اللعبة — أونلاين عن بعد 🌐' : 'Start Game — Online Remote 🌐'}
          </h3>
          <p className="text-xs text-slate-300 font-bold leading-relaxed px-2">
            {lang === 'ar'
              ? 'كل لاعب يلعب من جهازه ومكانه الخاص 📱، وتدخلون نفس الغرفة بكود الدعوة'
              : 'Each player plays from their own device 📱, joining the same room via invite code'}
          </p>
        </div>

        {/* Section: Online Multiplayer Options (All are Remote Online) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[11px] font-black text-blue-300 uppercase tracking-wider">
              {lang === 'ar' ? 'اختر عدد اللاعبين للغرفة الأونلاين:' : 'Select Player Count for Online Room:'}
            </span>
          </div>

          {/* MODE 1: 2 Players Online */}
          <button
            type="button"
            onClick={() => handlePick('ONLINE_2', 2)}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/50 via-[#1E293B] to-[#0F172A] border-2 border-blue-500/40 hover:border-blue-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center text-xl font-black group-hover:scale-110 transition-transform shrink-0">
                🎮
              </div>
              <div>
                <div className="text-sm font-black text-white flex items-center gap-2">
                  <span>{lang === 'ar' ? '2 Players Online' : '2 Players Online'}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    <span>Live Mic</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium">
                  {lang === 'ar'
                    ? 'لاعبان عن بعد — كود غرفة ودعوة + شات صوتي لايف'
                    : '2 players remote — Room code + live voice chat'}
                </div>
              </div>
            </div>
            <span className="text-blue-400 font-bold text-base rtl:rotate-180">→</span>
          </button>

          {/* MODE 2: 3 Players Online */}
          <button
            type="button"
            onClick={() => handlePick('ONLINE_3', 3)}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/50 via-[#1E293B] to-[#0F172A] border-2 border-purple-500/40 hover:border-purple-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center text-xl font-black group-hover:scale-110 transition-transform shrink-0">
                👥
              </div>
              <div>
                <div className="text-sm font-black text-white flex items-center gap-2">
                  <span>{lang === 'ar' ? '3 Players Online' : '3 Players Online'}</span>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    <span>Live Mic</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium">
                  {lang === 'ar'
                    ? '3 لاعبين — كل لاعب من جهازه الخاص بنفس كود الغرفة'
                    : '3 players — Each from own device via same room code'}
                </div>
              </div>
            </div>
            <span className="text-purple-400 font-bold text-base rtl:rotate-180">→</span>
          </button>

          {/* MODE 3: 4 Players Online */}
          <button
            type="button"
            onClick={() => handlePick('ONLINE_4', 4)}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-[#1E293B] to-[#0F172A] border-2 border-emerald-500/40 hover:border-emerald-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xl font-black group-hover:scale-110 transition-transform shrink-0">
                👥👥
              </div>
              <div>
                <div className="text-sm font-black text-white flex items-center gap-2">
                  <span>{lang === 'ar' ? '4 Players Online' : '4 Players Online'}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    <span>Live Mic</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium">
                  {lang === 'ar'
                    ? '4 لاعبين — 4 أجهزة عن بعد بنفس الغرفة بكود الدعوة'
                    : '4 players — 4 remote devices via invite code'}
                </div>
              </div>
            </div>
            <span className="text-emerald-400 font-bold text-base rtl:rotate-180">→</span>
          </button>
        </div>

        {/* Informative Note about Same Device Mode */}
        <div className="pt-1">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center gap-2 text-start">
            <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-[11px] text-slate-300 font-medium leading-tight">
              {lang === 'ar'
                ? '📱 تريد اللعب مع صديق على نفس الموبايل؟ استخدم زر «وضع لاعبين (جهاز واحد)» من الشاشة الرئيسية مباشرة.'
                : '📱 Want to play on the same phone? Use the "2 Players — Same Device" button directly on the Home screen.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

