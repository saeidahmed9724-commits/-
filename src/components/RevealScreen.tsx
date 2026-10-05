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
      {/* 1. Headline */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-slate-950 text-xs font-black rounded-full shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>+1 POINT</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {lang === 'ar' ? `${winner.name} عرفـها! 🎉` : `${winner.name} GUESSED IT! 🎉`}
        </h2>

        <p className="text-xs text-slate-400 font-bold">
          {lang === 'ar' ? `التخمين الصحيح: "${correctGuess}"` : `Solution: "${correctGuess}"`}
        </p>
      </div>

      {/* 2. THE REVEAL: Cards Side by Side with 3D Flip */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {/* CARD 1: P1 Card */}
        <div className="flex flex-col items-center space-y-2">
          <div className="text-xs font-bold text-blue-400 uppercase">
            {p1.name}
          </div>

          <div
            className="perspective-1000 w-full aspect-[3/4] max-w-[200px] cursor-pointer"
            onClick={() => {
              setIsFlipped(!isFlipped);
              sound.playCardFlip();
            }}
            title={lang === 'ar' ? 'اضغط لقلب البطاقة' : 'Tap to flip card'}
          >
            <div
              className={`relative w-full h-full rounded-2xl transition-transform duration-700 shadow-xl ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
              style={{
                transformStyle: 'preserve-3d',
                WebkitTransformStyle: 'preserve-3d',
              }}
            >
              {/* Card Back (Locked mystery state) */}
              <div
                className="absolute inset-0 bg-[#1b2150]/60 backdrop-blur-md text-white rounded-2xl p-4 flex flex-col items-center justify-center border-2 border-amber-500/40 shadow-xl"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <span className="text-4xl mb-1 text-amber-400 animate-pulse">🔒</span>
                <span className="font-mono font-black text-2xl text-amber-400">???</span>
                <span className="text-[10px] text-slate-400 mt-1 font-bold">
                  {lang === 'ar' ? 'اضغط للقلب' : 'Tap to flip'}
                </span>
              </div>

              {/* Card Front (Revealed Item) */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white rounded-2xl p-3 flex flex-col items-center justify-between border-2 border-blue-500/50 shadow-2xl rotate-y-180"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <div className="w-full text-end text-[10px] font-bold text-blue-300">
                  {p1Card.category}
                </div>

                <div className="aspect-square w-full rounded-xl bg-[#0B132B] border border-slate-700/80 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                  <img
                    src={p1Card.imageUrl}
                    alt={p1Card.title}
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                </div>

                <div className="text-sm font-black text-amber-300 uppercase tracking-wide truncate max-w-full drop-shadow-sm">
                  {p1Card.title}
                </div>
              </div>
            </div>
          </div>

          {winner.id === p1.id && (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <Check className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'فائز الجولة' : 'Round Winner'}</span>
            </div>
          )}
        </div>

        {/* CARD 2: P2 Card */}
        <div className="flex flex-col items-center space-y-2">
          <div className="text-xs font-bold text-purple-400 uppercase">
            {p2.name}
          </div>

          <div
            className="perspective-1000 w-full aspect-[3/4] max-w-[200px] cursor-pointer"
            onClick={() => {
              setIsFlipped(!isFlipped);
              sound.playCardFlip();
            }}
            title={lang === 'ar' ? 'اضغط لقلب البطاقة' : 'Tap to flip card'}
          >
            <div
              className={`relative w-full h-full rounded-2xl transition-transform duration-700 shadow-xl ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
              style={{
                transformStyle: 'preserve-3d',
                WebkitTransformStyle: 'preserve-3d',
              }}
            >
              {/* Card Back */}
              <div
                className="absolute inset-0 bg-[#1b2150]/60 backdrop-blur-md text-white rounded-2xl p-4 flex flex-col items-center justify-center border-2 border-amber-500/40 shadow-xl"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <span className="text-4xl mb-1 text-amber-400 animate-pulse">🔒</span>
                <span className="font-mono font-black text-2xl text-amber-400">???</span>
                <span className="text-[10px] text-slate-400 mt-1 font-bold">
                  {lang === 'ar' ? 'اضغط للقلب' : 'Tap to flip'}
                </span>
              </div>

              {/* Card Front */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white rounded-2xl p-3 flex flex-col items-center justify-between border-2 border-purple-500/50 shadow-2xl rotate-y-180"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <div className="w-full text-end text-[10px] font-bold text-purple-300">
                  {p2Card.category}
                </div>

                <div className="aspect-square w-full rounded-xl bg-[#0B132B] border border-slate-700/80 flex items-center justify-center p-2 overflow-hidden shadow-inner">
                  <img
                    src={p2Card.imageUrl}
                    alt={p2Card.title}
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                </div>

                <div className="text-sm font-black text-amber-300 uppercase tracking-wide truncate max-w-full drop-shadow-sm">
                  {p2Card.title}
                </div>
              </div>
            </div>
          </div>

          {winner.id === p2.id && (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <Check className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'فائز الجولة' : 'Round Winner'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Card Flip Button */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => {
            setIsFlipped(!isFlipped);
            sound.playCardFlip();
          }}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1b2150]/60 hover:bg-slate-700 border border-indigo-300/30 rounded-full text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          <span>🔄</span>
          <span>{lang === 'ar' ? (isFlipped ? 'إخفاء البطاقات 🔒' : 'اقلب واكشف البطاقات 👁️') : 'Flip Cards 🔄'}</span>
        </button>
      </div>

      {/* 3. Next Round Big Tactile CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            sound.playTurnChime();
            onNextRound();
          }}
          className="w-full h-14 btn-premium-gold font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-98"
        >
          <span>{lang === 'ar' ? 'الجولة التالية' : 'Next Round'}</span>
          <ArrowRight className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
