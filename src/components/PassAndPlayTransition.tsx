import React from 'react';
import { EyeOff, Smartphone, ArrowRight, Lock } from 'lucide-react';
import { sound } from '../utils/audio';

interface PassAndPlayTransitionProps {
  fromPlayer: string;
  toPlayer: string;
  stageTitle: string;
  onProceed: () => void;
  lang: 'ar' | 'en';
}

export const PassAndPlayTransition: React.FC<PassAndPlayTransitionProps> = ({
  fromPlayer,
  toPlayer,
  stageTitle,
  onProceed,
  lang,
}) => {
  return (
    <div className="w-full max-w-md mx-auto py-4 sm:py-6 px-4 text-center animate-scale-up">
      <div className="bg-white border-2 border-[#171717] rounded-3xl p-6 sm:p-7 game-card-shadow-lg space-y-4">
        {/* Animated Handover Icon */}
        <div className="w-20 h-20 rounded-3xl bg-[#FFD166] border-2 border-[#171717] flex items-center justify-center mx-auto text-[#171717] shadow-sm">
          <Smartphone className="w-10 h-10 animate-bounce" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 text-xs font-black rounded-full mb-3 border border-rose-200">
            <EyeOff className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'حاجز السرية والخصوصية' : 'Privacy Shield'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[#171717] tracking-tight">
            {lang === 'ar' ? `مرّر الجهاز إلى: ${toPlayer}` : `Pass the device to: ${toPlayer}`}
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-xs mx-auto font-medium">
            {lang === 'ar'
              ? `يا ${fromPlayer}، لا تنظر إلى الشاشة! حان دور ${toPlayer} لاختيار صورته السرية.`
              : `${fromPlayer}, look away! It is now ${toPlayer}'s turn.`}
          </p>
        </div>

        <div className="bg-[#F5F3EE] border border-[#E5E1D8] rounded-2xl p-3.5 text-xs text-slate-700 font-bold flex items-center gap-2 text-start">
          <Lock className="w-4 h-4 text-[#6C5CE7] shrink-0" />
          <span>{stageTitle}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onProceed();
          }}
          className="w-full py-4 bg-[#6C5CE7] hover:bg-[#5b4bc4] text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-[#6C5CE7]/25 transition-all cursor-pointer active:scale-98"
        >
          <span>
            {lang === 'ar'
              ? `أنا ${toPlayer} ومعي الجهاز بمفردي 👍`
              : `I am ${toPlayer}, ready 👍`}
          </span>
          <ArrowRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
