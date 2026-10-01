import React from 'react';
import { sound } from '../utils/audio';
import { Users, User, Trophy, Sparkles, X } from 'lucide-react';
import { PlayerCount } from '../types/game';

interface PlayerCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCount: (count: PlayerCount) => void;
  lang: 'ar' | 'en';
}

export const PlayerCountModal: React.FC<PlayerCountModalProps> = ({
  isOpen,
  onClose,
  onSelectCount,
  lang,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm bg-[#0F172A] border-2 border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up relative">
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
        <div className="text-center space-y-1 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto text-2xl mb-1 shadow-sm">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'اختر عدد اللاعبين' : 'Select Player Count'}
          </h3>
          <p className="text-xs text-slate-400 font-bold">
            {lang === 'ar'
              ? 'العب بالنظام الكلاسيكي أو نظام المتعدد الجديد'
              : 'Choose Classic 2-player or Multiplayer'}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2.5 pt-1">
          {/* OPTION 1: 2 PLAYERS (CLASSIC SYSTEM) */}
          <button
            type="button"
            onClick={() => {
              sound.playTurnChime();
              onSelectCount(2);
            }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#1E293B] to-[#0F172A] border-2 border-slate-700 hover:border-blue-500 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center text-xl font-black group-hover:scale-110 transition-transform">
                👤👤
              </div>
              <div>
                <div className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>{lang === 'ar' ? 'لاعبين (2 Players)' : '2 Players'}</span>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/30">
                    {lang === 'ar' ? 'الكلاسيكي' : 'Classic'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {lang === 'ar'
                    ? 'كل لاعب يختار للآخر، وتخمين متبادل'
                    : 'Each picks for the other, head-to-head'}
                </div>
              </div>
            </div>
            <span className="text-blue-400 font-bold text-sm rtl:rotate-180">→</span>
          </button>

          {/* MULTIPLAYER SECTION DIVIDER */}
          <div className="flex items-center gap-2 pt-1 pb-0.5 px-1">
            <div className="h-px bg-slate-800 flex-1" />
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {lang === 'ar' ? 'نظام الـ Multiplayer الجديد' : 'New Multiplayer System'}
            </span>
            <div className="h-px bg-slate-800 flex-1" />
          </div>

          {/* OPTION 2: 3 PLAYERS */}
          <button
            type="button"
            onClick={() => {
              sound.playTurnChime();
              onSelectCount(3);
            }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#1E293B] to-[#0F172A] border-2 border-purple-500/50 hover:border-purple-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center text-lg font-black group-hover:scale-110 transition-transform">
                👤👤👤
              </div>
              <div>
                <div className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>{lang === 'ar' ? '3 لاعبين (3 Players)' : '3 Players'}</span>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/30">
                    {lang === 'ar' ? 'جديد 👥' : 'New 👥'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {lang === 'ar'
                    ? 'كل لاعب يختار صورته ويخمن صور الآخرين (2 أهداف)'
                    : 'Each picks own photo & guesses 2 others'}
                </div>
              </div>
            </div>
            <span className="text-purple-400 font-bold text-sm rtl:rotate-180">→</span>
          </button>

          {/* OPTION 3: 4 PLAYERS */}
          <button
            type="button"
            onClick={() => {
              sound.playTurnChime();
              onSelectCount(4);
            }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#1E293B] to-[#0F172A] border-2 border-emerald-500/50 hover:border-emerald-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-base font-black group-hover:scale-110 transition-transform">
                👤👤👤👤
              </div>
              <div>
                <div className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>{lang === 'ar' ? '4 لاعبين (4 Players)' : '4 Players'}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/15 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    {lang === 'ar' ? 'حماسي 🔥' : 'Party 🔥'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {lang === 'ar'
                    ? 'تحدي رباعي: كل لاعب يكتشف 3 صور للمنافسين'
                    : '4-player challenge: discover 3 secret photos'}
                </div>
              </div>
            </div>
            <span className="text-emerald-400 font-bold text-sm rtl:rotate-180">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
