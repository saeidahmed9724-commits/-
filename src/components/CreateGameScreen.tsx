import React, { useState } from 'react';
import { CATEGORIES } from '../data/categories';
import { CategoryDefinition, GameMode } from '../types/game';
import { sound } from '../utils/audio';
import { ArrowLeft, User, ArrowRight, Sparkles } from 'lucide-react';

interface CreateGameScreenProps {
  mode: GameMode;
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
  onConfirmCreate,
  onBack,
  lang,
}) => {
  const [playerName, setPlayerName] = useState<string>('');
  const [opponentName, setOpponentName] = useState<string>(
    mode === 'VS_BOT' ? (lang === 'ar' ? 'الروبوت 🤖' : 'Smart Bot 🤖') : ''
  );
  const [selectedCatId, setSelectedCatId] = useState<string>('food');
  const [targetScore] = useState<number>(3);

  const selectedCategory = CATEGORIES.find((c) => c.id === selectedCatId) || CATEGORIES[0];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playTurnChime();
    onConfirmCreate({
      playerName: playerName.trim() || (lang === 'ar' ? 'اللاعب 1' : 'Player 1'),
      opponentName:
        mode === 'VS_BOT'
          ? (lang === 'ar' ? 'الروبوت 🤖' : 'Bot 🤖')
          : opponentName.trim() || (lang === 'ar' ? 'اللاعب 2' : 'Player 2'),
      category: selectedCategory,
      targetScore,
    });
  };

  return (
    <div className="w-full max-w-md mx-auto py-2 sm:py-4 px-4 animate-scale-up space-y-3.5 pb-4">
      {/* Top Bar: Back & Logo */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            sound.playCardFlip();
            onBack();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-black text-slate-600 hover:text-[#171717] bg-white px-3 py-1.5 rounded-full border border-[#E8E4DA] cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
        </button>

        <div className="flex items-center gap-1 text-xs font-black text-[#6C5CE7]">
          <span>🎮</span>
          <span>{lang === 'ar' ? 'مين في إيدي؟' : "Who's In My Hand?"}</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E8E4DA] game-card-shadow-lg space-y-4">
        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-[#171717] tracking-tight">
            {lang === 'ar' ? 'إعداد اللعبة الجديدة' : 'Set Up New Game'}
          </h2>
          <p className="text-xs text-slate-500 font-bold">
            {lang === 'ar'
              ? 'اختر التصنيف وأسماء اللاعبين للبدء'
              : 'Choose category and enter player names'}
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Name Inputs */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                {lang === 'ar' ? 'اسمك' : 'Your Name'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={lang === 'ar' ? 'اكتب اسمك هنا...' : 'Enter your name...'}
                  className="w-full bg-[#FAF8F5] border border-[#E8E4DA] focus:border-[#6C5CE7] rounded-2xl px-4 py-3 text-sm font-black text-[#171717] focus:outline-none transition-colors"
                />
                <User className="w-4 h-4 text-slate-400 absolute end-3.5 top-3.5" />
              </div>
            </div>

            {mode === 'PASS_AND_PLAY' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {lang === 'ar' ? 'اسم خصمك' : 'Opponent Name'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                    placeholder={lang === 'ar' ? 'اكتب اسم خصمك هنا...' : 'Enter opponent name...'}
                    className="w-full bg-[#FAF8F5] border border-[#E8E4DA] focus:border-[#FF5C8A] rounded-2xl px-4 py-3 text-sm font-black text-[#171717] focus:outline-none transition-colors"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute end-3.5 top-3.5" />
                </div>
              </div>
            )}
          </div>

          {/* Broad Category Selection: 4x2 Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-[#171717] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#FFD166]" />
                <span>{lang === 'ar' ? 'اختر تصنيف اللعبة' : 'Choose Category'}</span>
              </span>
              <span className="text-[11px] font-bold text-[#6C5CE7]">
                {selectedCategory.nameAr}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCatId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      sound.playCardFlip();
                      setSelectedCatId(cat.id);
                    }}
                    className={`p-3 rounded-2xl text-start transition-all cursor-pointer flex items-center gap-2.5 border active:scale-95 ${
                      isSelected
                        ? 'bg-[#FFD166] border-2 border-[#171717] text-[#171717] shadow-sm font-black'
                        : 'bg-[#FAF8F5] border-[#E8E4DA] hover:border-slate-400 text-slate-700 font-bold'
                    }`}
                  >
                    <span className="text-2xl drop-shadow-xs">{cat.icon}</span>
                    <div className="overflow-hidden">
                      <div className="text-xs font-black tracking-tight leading-tight truncate">
                        {lang === 'ar' ? cat.nameAr : cat.nameEn}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal truncate">
                        {cat.presetItems.length} عناصر
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Solid Purple Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-14 bg-[#6C5CE7] hover:bg-[#5b4bc4] text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-[#6C5CE7]/25 transition-all cursor-pointer active:scale-98"
            >
              <span>{lang === 'ar' ? 'بدء اللعبة' : 'Start Game'}</span>
              <ArrowRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
