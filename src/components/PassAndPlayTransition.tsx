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
      <div className="game-card-surface border border-slate-700/60 p-6 sm:p-7 shadow-2xl space-y-4">
        {/* Animated Handover Icon */}
        <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 shadow-sm">
          <Smartphone className="w-8 h-8 animate-bounce" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/15 text-rose-300 text-xs font-bold rounded-full mb-3 border border-rose-500/30">
            <EyeOff className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'حاجز السرية والخصوصية' : 'Privacy Shield'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {lang === 'ar' ? `مرّر الجهاز إلى: ${toPlayer}` : `Pass the device to: ${toPlayer}`}
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xs mx-auto font-medium leading-relaxed">
            {lang === 'ar'
              ? `يا ${fromPlayer}، لا تنظر إلى الشاشة! حان دور ${toPlayer} لاختيار صورته السرية.`
              : `${fromPlayer}, look away! It is now ${toPlayer}'s turn.`}
          </p>
        </div>

        <div className="bg-[#0F172A] border border-slate-700/80 rounded-xl p-3 text-xs text-slate-300 font-bold flex items-center gap-2 text-start">
          <Lock className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{stageTitle}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onProceed();
          }}
          className="w-full py-4 btn-premium-purple text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-98"
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
