import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Player, PlayerChoice, CategoryDefinition } from '../types/game';
import { sound } from '../utils/audio';
import { ArrowRight, Sparkles, Check } from 'lucide-react';

interface RevealScreenProps {
  winner: Player;
  p1: Player;
  p2: Player;
  p1Card: PlayerChoice;
  p2Card: PlayerChoice;
  category: CategoryDefinition;
  correctGuess: string;
  onNextRound: () => void;
  lang: 'ar' | 'en';
}

export const RevealScreen: React.FC<RevealScreenProps> = ({
  winner,
  p1,
  p2,
  p1Card,
  p2Card,
  category,
  correctGuess,
  onNextRound,
  lang,
}) => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  useEffect(() => {
    sound.playVictoryFanfare();

    // Trigger celebratory flip animation after 250ms
    const flipTimer = setTimeout(() => {
      setIsFlipped(true);
      sound.playCardFlip();
    }, 300);

    // Warm playful confetti
    try {
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6C5CE7', '#FF5C8A', '#4ED7B0', '#FFD166', '#171717'],
      });
    } catch {}

    return () => clearTimeout(flipTimer);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto py-4 sm:py-6 px-4 text-center animate-scale-up space-y-4">
      {/* 1. Playful Big Headline */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#4ED7B0] text-[#171717] border-2 border-[#171717] text-xs font-black rounded-full shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>+1 POINT</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-[#171717] tracking-tight">
          {lang === 'ar' ? `${winner.name} عرفـها! 🎉` : `${winner.name} GUESSED IT! 🎉`}
        </h2>

        <p className="text-xs text-slate-500 font-bold">
          {lang === 'ar' ? `التخمين الصحيح: "${correctGuess}"` : `Solution: "${correctGuess}"`}
        </p>
      </div>

      {/* 2. THE REVEAL: Real Playing Cards Side by Side with 3D Flip */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {/* CARD 1: P1 Card */}
        <div className="flex flex-col items-center space-y-2">
          <div className="text-xs font-black text-[#6C5CE7] uppercase">
            {p1.name}
          </div>

          <div className="perspective-1000 w-full aspect-[3/4] max-w-[200px]">
            <div
              className={`relative w-full h-full rounded-3xl transition-transform duration-700 preserve-3d border-2 border-[#171717] game-card-shadow-lg ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Card Back (Locked mystery state) */}
              <div className="absolute inset-0 bg-[#171717] text-white rounded-3xl p-4 flex flex-col items-center justify-center backface-hidden">
                <span className="text-3xl mb-1 text-[#FFD166]">🔒</span>
                <span className="font-mono font-black text-2xl">???</span>
              </div>

              {/* Card Front (Revealed Item) */}
              <div className="absolute inset-0 bg-white text-[#171717] rounded-3xl p-3 flex flex-col items-center justify-between backface-hidden rotate-y-180">
                <div className="w-full text-end text-[10px] font-black text-slate-400">
                  {p1Card.category}
                </div>

                <div className="aspect-square w-full rounded-2xl bg-[#F5F3EE] flex items-center justify-center p-2 overflow-hidden">
                  <img
                    src={p1Card.imageUrl}
                    alt={p1Card.title}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="text-sm font-black text-[#171717] uppercase tracking-wide truncate max-w-full">
                  {p1Card.title}
                </div>
              </div>
            </div>
          </div>

          {winner.id === p1.id && (
            <div className="inline-flex items-center gap-1 text-xs font-black text-[#4ED7B0] bg-[#171717] px-2.5 py-0.5 rounded-full">
              <Check className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'فائز الجولة' : 'Round Winner'}</span>
            </div>
          )}
        </div>

        {/* CARD 2: P2 Card */}
        <div className="flex flex-col items-center space-y-2">
          <div className="text-xs font-black text-[#FF5C8A] uppercase">
            {p2.name}
          </div>

          <div className="perspective-1000 w-full aspect-[3/4] max-w-[200px]">
            <div
              className={`relative w-full h-full rounded-3xl transition-transform duration-700 preserve-3d border-2 border-[#171717] game-card-shadow-lg ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Card Back */}
              <div className="absolute inset-0 bg-[#171717] text-white rounded-3xl p-4 flex flex-col items-center justify-center backface-hidden">
                <span className="text-3xl mb-1 text-[#FFD166]">🔒</span>
                <span className="font-mono font-black text-2xl">???</span>
              </div>

              {/* Card Front */}
              <div className="absolute inset-0 bg-white text-[#171717] rounded-3xl p-3 flex flex-col items-center justify-between backface-hidden rotate-y-180">
                <div className="w-full text-end text-[10px] font-black text-slate-400">
                  {p2Card.category}
                </div>

                <div className="aspect-square w-full rounded-2xl bg-[#F5F3EE] flex items-center justify-center p-2 overflow-hidden">
                  <img
                    src={p2Card.imageUrl}
                    alt={p2Card.title}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="text-sm font-black text-[#171717] uppercase tracking-wide truncate max-w-full">
                  {p2Card.title}
                </div>
              </div>
            </div>
          </div>

          {winner.id === p2.id && (
            <div className="inline-flex items-center gap-1 text-xs font-black text-[#4ED7B0] bg-[#171717] px-2.5 py-0.5 rounded-full">
              <Check className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'فائز الجولة' : 'Round Winner'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Next Round Big Tactile CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onNextRound();
          }}
          className="w-full h-14 bg-[#6C5CE7] hover:bg-[#5b4bc4] text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-[#6C5CE7]/25 transition-all cursor-pointer active:scale-98"
        >
          <span>{lang === 'ar' ? 'الجولة التالية' : 'Next Round'}</span>
          <ArrowRight className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
