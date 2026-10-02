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
      <div className="w-full max-w-sm bg-[#0F172A] border-2 border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 animate-scale-up relative max-h-[90vh] overflow-y-auto">
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
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto text-xl mb-1 shadow-sm">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'اختر وضع وعدد اللاعبين' : 'Select Game Mode'}
          </h3>
          <p className="text-[11px] text-slate-400 font-bold">
            {lang === 'ar'
              ? 'أونلاين (كل لاعب من جهازه) أو جهاز واحد بالتناوب'
              : 'Online (each on own device) or Same Device'}
          </p>
        </div>

        {/* Section: Online Multiplayer (Each player from own phone/device) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Wifi className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-black text-blue-300 uppercase tracking-wider">
              {lang === 'ar' ? 'أونلاين — كل لاعب من جهازه الخاص 📱' : 'Online — Each from own device 📱'}
            </span>
          </div>

          {/* MODE 1: 2 Players Online */}
          <button
            type="button"
            onClick={() => handlePick('ONLINE_2', 2)}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-[#1E293B] to-[#0F172A] border-2 border-blue-500/40 hover:border-blue-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center text-lg font-black group-hover:scale-110 transition-transform">
                🎮
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <span>{lang === 'ar' ? '2 Players Online' : '2 Players Online'}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <Mic className="w-2.5 h-2.5" />
                    <span>Live Mic</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {lang === 'ar'
                    ? 'لاعبين أونلاين بكود الغرفة مع شات صوتي حي'
                    : '2 players online with live WebRTC voice chat'}
                </div>
              </div>
            </div>
            <span className="text-blue-400 font-bold text-sm rtl:rotate-180">→</span>
          </button>

          {/* MODE 2: 3 Players Online */}
          <button
            type="button"
            onClick={() => handlePick('ONLINE_3', 3)}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#1E293B] to-[#0F172A] border-2 border-purple-500/40 hover:border-purple-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center text-lg font-black group-hover:scale-110 transition-transform">
                👥
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <span>{lang === 'ar' ? '3 Players Online' : '3 Players Online'}</span>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                    <Mic className="w-2.5 h-2.5" />
                    <span>Live Mic</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {lang === 'ar'
                    ? '3 أجهزة مختلفة بنفس الـ Room + نفس المايك الحي'
                    : '3 devices in same room + live WebRTC voice'}
                </div>
              </div>
            </div>
            <span className="text-purple-400 font-bold text-sm rtl:rotate-180">→</span>
          </button>

          {/* MODE 3: 4 Players Online */}
          <button
            type="button"
            onClick={() => handlePick('ONLINE_4', 4)}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#1E293B] to-[#0F172A] border-2 border-emerald-500/40 hover:border-emerald-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-lg font-black group-hover:scale-110 transition-transform">
                👥👥
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <span>{lang === 'ar' ? '4 Players Online' : '4 Players Online'}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <Mic className="w-2.5 h-2.5" />
                    <span>Live Mic</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {lang === 'ar'
                    ? '4 أجهزة مختلفة أونلاين بكود الغرفة + مايك حي'
                    : '4 devices online in room + live WebRTC voice'}
                </div>
              </div>
            </div>
            <span className="text-emerald-400 font-bold text-sm rtl:rotate-180">→</span>
          </button>
        </div>

        {/* Section: Local Same Device (Pass & Play) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 px-1">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
              {lang === 'ar' ? 'محلي — جهاز واحد بالتناوب 📱' : 'Local — Same Device 📱'}
            </span>
          </div>

          {/* MODE 4: 2 Players — Same Device */}
          <button
            type="button"
            onClick={() => handlePick('PASS_AND_PLAY_2', 2)}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-950/30 via-[#1E293B] to-[#0F172A] border-2 border-amber-500/40 hover:border-amber-400 text-start flex items-center justify-between transition-all cursor-pointer active:scale-98 group shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center text-lg font-black group-hover:scale-110 transition-transform">
                📱
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <span>{lang === 'ar' ? '2 Players — Same Device' : '2 Players — Same Device'}</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-700">
                    {lang === 'ar' ? 'بدون مايك' : 'No Mic'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {lang === 'ar'
                    ? 'لاعبان على نفس الجهاز يتبادلان الموبايل (لا يحتاج مايك)'
                    : 'Pass & play on one device (no WebRTC / no mic)'}
                </div>
              </div>
            </div>
            <span className="text-amber-400 font-bold text-sm rtl:rotate-180">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

