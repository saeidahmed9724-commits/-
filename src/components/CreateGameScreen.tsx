import React, { useState } from 'react';
import { GENERAL_CATEGORY } from '../data/categories';
import { CategoryDefinition, GameMode } from '../types/game';
import { sound } from '../utils/audio';
import { ArrowLeft, User, Play } from 'lucide-react';
import { GameLogoBanner } from './GameLogoBanner';

interface CreateGameScreenProps {
  mode: GameMode;
  playerCount?: number;
  onConfirmCreate: (data: {
    playerName: string;
    opponentName: string;
    category: CategoryDefinition;
    targetScore: number;
  }) => void;
  onBack: () => void;
  lang: 'ar' | 'en';
}

export const CreateGameScreen: React.FC<CreateGameScreenProps> = ({
  mode,
  playerCount = 2,
  onConfirmCreate,
  onBack,
  lang,
}) => {
  const [playerName, setPlayerName] = useState<string>('');
  const [opponentName, setOpponentName] = useState<string>(
    mode === 'VS_BOT' ? (lang === 'ar' ? 'الروبوت 🤖' : 'Smart Bot 🤖') : ''
  );
  const [targetScore] = useState<number>(3);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playTurnChime();
    onConfirmCreate({
      playerName: playerName.trim() || (lang === 'ar' ? 'اللاعب 1' : 'Player 1'),
      opponentName:
        mode === 'VS_BOT'
          ? (lang === 'ar' ? 'الروبوت 🤖' : 'Bot 🤖')
          : opponentName.trim() || (lang === 'ar' ? 'اللاعب 2' : 'Player 2'),
      category: GENERAL_CATEGORY,
      targetScore,
    });
  };

  return (
    <div className="w-full max-w-md mx-auto py-2 px-3 animate-scale-up space-y-4 pb-6 select-none">
      {/* Top Bar: Back & Mini Logo */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onBack();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-indigo-300/30 cursor-pointer active:scale-95 transition-colors"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
        </button>

        <GameLogoBanner size="sm" className="max-w-[100px]" />
      </div>

      {/* Main Elevated Card Surface */}
      <div className="game-card-surface p-5 sm:p-6 space-y-5 border border-slate-700/60">
        {/* Header Title (Clean, Modern Typography) */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {mode === 'ROOM_CODE'
              ? (lang === 'ar' ? `إنشاء غرفة أونلاين (${playerCount} لاعبين) 📱` : `Create Online Room (${playerCount} Players) 📱`)
              : mode === 'PASS_AND_PLAY'
              ? (lang === 'ar' ? '2 Players — Same Device 📱' : '2 Players — Same Device 📱')
              : (lang === 'ar' ? 'لعب ضد الروبوت 🤖' : 'Solo vs Bot 🤖')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-bold">
            {mode === 'ROOM_CODE'
              ? (lang === 'ar' ? 'ستحصل على كود الغرفة لمشاركته مع أصدقائك لينضم كل لاعب من جهازه' : 'You will get a room code so friends join from their own devices')
              : mode === 'PASS_AND_PLAY'
              ? (lang === 'ar' ? 'تناوب اللعب على نفس الموبايل/الجهاز (بدون مايك وبدون إنترنت)' : 'Pass and play on this device (no mic needed)')
              : (lang === 'ar' ? 'العب وتحدى الذكاء الاصطناعي' : 'Play and challenge the AI')}
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Player Name Input Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 px-1">
                {lang === 'ar' ? 'اسمك' : 'Your Name'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={lang === 'ar' ? 'اكتب اسمك هنا...' : 'Enter your name...'}
                  className="w-full h-12 bg-[#1b2150]/60 backdrop-blur-md border border-indigo-300/30 focus:border-blue-500 rounded-xl ps-4 pe-10 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none transition-colors"
                />
                <User className="w-4 h-4 text-slate-500 absolute end-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {mode === 'PASS_AND_PLAY' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 px-1">
                  {lang === 'ar' ? 'اسم خصمك' : 'Opponent Name'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                    placeholder={lang === 'ar' ? 'اكتب اسم خصمك هنا...' : 'Enter opponent name...'}
                    className="w-full h-12 bg-[#1b2150]/60 backdrop-blur-md border border-indigo-300/30 focus:border-purple-500 rounded-xl ps-4 pe-10 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none transition-colors"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute end-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Primary CTA Button: Modern, High-Contrast */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-14 btn-premium-gold rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-98"
            >
              <Play className="w-4 h-4 fill-slate-900 text-slate-900" />
              <span>{lang === 'ar' ? 'بدء اللعبة' : 'Start Match'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
