import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    sound.playTurnChime();
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          sound.playCardFlip();
          setTimeout(onCountdownComplete, 400);
          return 0;
        }
        sound.playTurnChime();
        return prev - 1;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [onCountdownComplete]);

  return (
    <div className="w-full max-w-md mx-auto py-6 sm:py-10 px-4 text-center animate-scale-up space-y-6 relative">
      {/* Top Logo */}
      <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#6C5CE7]">
        <span>🎮</span>
        <span>{lang === 'ar' ? 'مين في إيدي؟' : "Who's In My Hand?"}</span>
      </div>

      {/* Main Card (Matching Screen 5 in Collage) */}
      <div className="bg-white rounded-3xl p-8 border border-[#E8E4DA] game-card-shadow-lg space-y-6 relative overflow-hidden">
        {/* Visual: Two tilted physical playing cards leaning against each other */}
        <div className="flex items-center justify-center -space-x-6 rtl:space-x-reverse pt-2 pb-4">
          {/* Card 1: Mystery Card (Tilted Left) */}
          <div className="w-28 h-38 rounded-2xl bg-gradient-to-br from-[#1E1B4B] via-[#2E1065] to-[#171717] border-2 border-white text-white flex flex-col items-center justify-center shadow-xl transform -rotate-12 hover:-rotate-6 transition-transform z-10">
            <span className="font-mono font-black text-5xl text-[#FFD166] drop-shadow-md">
              ?
            </span>
          </div>

          {/* Card 2: Burger Card (Tilted Right) */}
          <div className="w-28 h-38 rounded-2xl bg-[#FFF8E7] border-2 border-[#171717] flex flex-col items-center justify-center shadow-xl transform rotate-12 hover:rotate-6 transition-transform p-3 z-0">
            <span className="text-5xl drop-shadow-md">🍔</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-3xl sm:text-4xl font-black text-[#171717] tracking-tight">
            {lang === 'ar' ? 'الصور جاهزة!' : 'Pictures Ready!'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-bold">
            {lang === 'ar'
              ? 'تم اختيار الصور من كلا اللاعبين. استعدوا للبدء...'
              : 'Both secret pictures are locked. Get ready...'}
          </p>
        </div>

        {/* Animated Countdown Pills (Collage Screen 5: 3 - 2 - 1) */}
        <div className="flex items-center justify-center gap-3 pt-2">
          {[3, 2, 1].map((num) => {
            const isCurrent = count === num;
            return (
              <div
                key={num}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-2xl transition-all ${
                  isCurrent
                    ? 'bg-[#FFD166] text-[#171717] border-2 border-[#171717] scale-110 shadow-md animate-pulse'
                    : 'bg-[#FAF8F5] text-slate-400 border border-[#E8E4DA]'
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
