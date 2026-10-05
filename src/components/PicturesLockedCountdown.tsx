import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../utils/audio';

interface PicturesLockedCountdownProps {
  onCountdownComplete: () => void;
  lang: 'ar' | 'en';
}

export const PicturesLockedCountdown: React.FC<PicturesLockedCountdownProps> = ({
  onCountdownComplete,
  lang,
}) => {
  const [count, setCount] = useState<number>(3);
  const onCompleteRef = useRef(onCountdownComplete);
  onCompleteRef.current = onCountdownComplete;

  useEffect(() => {
    sound.playTurnChime();
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          sound.playCardFlip();
          setTimeout(() => onCompleteRef.current(), 400);
          return 0;
        }
        sound.playTurnChime();
        return prev - 1;
      });
    }, 900);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto py-6 sm:py-10 px-4 text-center animate-scale-up space-y-6 relative">
      {/* Top Logo */}
      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-400">
        <span>🎮</span>
        <span>{lang === 'ar' ? 'إيه اللي معايا؟' : 'What Do I Have?'}</span>
      </div>

      {/* Main Card */}
      <div className="game-card-surface rounded-3xl p-8 border border-slate-700/60 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Visual: Two physical cards leaning against each other */}
        <div className="flex items-center justify-center -space-x-6 rtl:space-x-reverse pt-2 pb-4">
          {/* Card 1: Mystery Card (Tilted Left) */}
          <div className="w-28 h-38 rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#020617] border border-amber-500/40 text-white flex flex-col items-center justify-center shadow-xl transform -rotate-12 hover:-rotate-6 transition-transform z-10">
            <span className="font-mono font-black text-5xl text-amber-400 drop-shadow-md">
              ?
            </span>
          </div>

          {/* Card 2: Clue Card (Tilted Right) */}
          <div className="w-28 h-38 rounded-2xl bg-[#1b2150]/60 backdrop-blur-md border border-blue-500/40 flex flex-col items-center justify-center shadow-xl transform rotate-12 hover:rotate-6 transition-transform p-3 z-0">
            <span className="text-5xl drop-shadow-md">🍕</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'الصور جاهزة!' : 'Pictures Ready!'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-bold">
            {lang === 'ar'
              ? 'تم اختيار الصور من كلا اللاعبين. استعدوا للبدء...'
              : 'Both secret pictures are locked. Get ready...'}
          </p>
        </div>

        {/* Animated Countdown Pills */}
        <div className="flex items-center justify-center gap-3 pt-2">
          {[3, 2, 1].map((num) => {
            const isCurrent = count === num;
            return (
              <div
                key={num}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-2xl transition-all ${
                  isCurrent
                    ? 'bg-amber-400 text-slate-950 scale-110 shadow-lg'
                    : 'bg-[#1b2150]/60 backdrop-blur-md text-slate-500 border border-indigo-300/30'
                }`}
              >
                {num}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
