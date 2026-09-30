import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Player } from '../types/game';
import { sound } from '../utils/audio';
import { Crown, RotateCcw, Home } from 'lucide-react';

interface GameOverScreenProps {
  player1: Player;
  player2: Player;
  onPlayAgain: () => void;
  onBackToHome: () => void;
  lang: 'ar' | 'en';
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  player1,
  player2,
  onPlayAgain,
  onBackToHome,
  lang,
}) => {
  const winner = player1.score > player2.score ? player1 : player2;
  const loser = player1.score > player2.score ? player2 : player1;

  useEffect(() => {
    sound.playVictoryFanfare();
    try {
      const end = Date.now() + 2.5 * 1000;
      (function frame() {
        confetti({
          particleCount: 6,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#6C5CE7', '#FF5C8A', '#4ED7B0', '#FFD166'],
        });
        confetti({
          particleCount: 6,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#6C5CE7', '#FF5C8A', '#4ED7B0', '#FFD166'],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    } catch {}
  }, []);

  return (
    <div className="w-full max-w-md mx-auto py-4 sm:py-6 px-4 text-center animate-scale-up space-y-4">
      <h2 className="text-3xl sm:text-4xl font-black text-[#171717] tracking-tight">
        {lang === 'ar' ? 'نهاية المباراة! 🏆' : 'GAME OVER! 🏆'}
      </h2>

      {/* Main Score Box */}
      <div className="bg-white border-2 border-[#171717] rounded-3xl p-5 sm:p-6 game-card-shadow-lg space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#FFD166] text-[#171717] border-2 border-[#171717] rounded-full text-sm font-black shadow-xs">
          <Crown className="w-4 h-4" />
          <span>{lang === 'ar' ? `البطل: ${winner.name}!` : `Winner: ${winner.name}!`}</span>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3 py-1">
          {/* Winner */}
          <div className="p-3.5 bg-[#F5F3EE] rounded-2xl border-2 border-[#171717] text-center">
            <div className="text-xs font-black text-[#6C5CE7] uppercase tracking-wider mb-0.5 truncate">
              {winner.name}
            </div>
            <div className="text-5xl font-black text-[#171717] font-mono tabular-nums">
              {winner.score}
            </div>
          </div>

          {/* Loser */}
          <div className="p-3.5 bg-[#F5F3EE] rounded-2xl border border-[#E5E1D8] text-center">
            <div className="text-xs font-black text-[#FF5C8A] uppercase tracking-wider mb-0.5 truncate">
              {loser.name}
            </div>
            <div className="text-5xl font-black text-slate-400 font-mono tabular-nums">
              {loser.score}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              sound.playTurnChime();
              onPlayAgain();
            }}
            className="w-full h-14 bg-[#6C5CE7] hover:bg-[#5b4bc4] text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-[#6C5CE7]/25 transition-all cursor-pointer active:scale-98"
          >
            <RotateCcw className="w-5 h-5" />
            <span>{lang === 'ar' ? 'لعب مباراة جديدة' : 'Play Again'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playCardFlip();
              onBackToHome();
            }}
            className="w-full h-12 bg-white hover:bg-slate-50 text-[#171717] font-black rounded-2xl border-2 border-[#171717] flex items-center justify-center gap-2 text-sm transition-all cursor-pointer active:scale-98"
          >
            <Home className="w-4 h-4" />
            <span>{lang === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
