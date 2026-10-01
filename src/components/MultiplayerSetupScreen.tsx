import React, { useState } from 'react';
import { CATEGORIES } from '../data/categories';
import { CategoryDefinition, PlayerCount } from '../types/game';
import { sound } from '../utils/audio';
import { ArrowLeft, User, Sparkles, Users } from 'lucide-react';
import { GameLogoBanner } from './GameLogoBanner';

interface MultiplayerSetupScreenProps {
  playerCount: PlayerCount;
  onConfirmSetup: (data: {
    playerNames: string[];
    category: CategoryDefinition;
  }) => void;
  onBack: () => void;
  lang: 'ar' | 'en';
}

const DEFAULT_AVATARS = [
  'from-emerald-500 to-emerald-700',
  'from-purple-500 to-indigo-700',
  'from-amber-500 to-orange-700',
  'from-rose-500 to-pink-700',
];

export const MultiplayerSetupScreen: React.FC<MultiplayerSetupScreenProps> = ({
  playerCount,
  onConfirmSetup,
  onBack,
  lang,
}) => {
  const [names, setNames] = useState<string[]>([
    lang === 'ar' ? 'سعيد' : 'Player 1',
    lang === 'ar' ? 'حامد' : 'Player 2',
    lang === 'ar' ? 'عبدالكريم' : 'Player 3',
    ...(playerCount === 4 ? [lang === 'ar' ? 'محمد' : 'Player 4'] : []),
  ]);

  const [selectedCatId, setSelectedCatId] = useState<string>('food');
  const selectedCategory = CATEGORIES.find((c) => c.id === selectedCatId) || CATEGORIES[0];

  const handleNameChange = (index: number, val: string) => {
    setNames((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playTurnChime();
    const finalNames = names.map((n, i) => n.trim() || (lang === 'ar' ? `اللاعب ${i + 1}` : `Player ${i + 1}`));
    onConfirmSetup({
      playerNames: finalNames,
      category: selectedCategory,
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
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer active:scale-95 transition-colors"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
        </button>

        <GameLogoBanner size="sm" className="max-w-[100px]" />
      </div>

      {/* Main Elevated Card Surface */}
      <div className="game-card-surface p-5 sm:p-6 space-y-5 border border-purple-500/40 shadow-2xl">
        {/* Header Title */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-black">
            <Users className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? `نظام ${playerCount} لاعبين` : `${playerCount}-Player Multiplayer`}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'إعداد أسماء اللاعبين' : 'Player Setup'}
          </h2>
          <p className="text-xs text-slate-400 font-bold">
            {lang === 'ar'
              ? 'كل لاعب سيختار صورة سرية ويحاول اكتشاف صور زملائه'
              : 'Each player picks a secret photo & tries to guess the others'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dynamic Player Name Input Fields */}
          <div className="space-y-2.5">
            <span className="block text-xs font-black text-slate-300 px-1">
              {lang === 'ar' ? 'أسماء اللاعبين:' : 'Player Names:'}
            </span>

            {names.map((name, index) => (
              <div key={index} className="relative">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${DEFAULT_AVATARS[index % DEFAULT_AVATARS.length]} flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0`}>
                    {index + 1}
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      placeholder={lang === 'ar' ? `اسم اللاعب ${index + 1}...` : `Player ${index + 1} name...`}
                      className="w-full h-11 bg-[#0F172A] border border-slate-700 focus:border-purple-500 rounded-xl ps-3 pe-8 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none transition-colors"
                    />
                    <User className="w-3.5 h-3.5 text-slate-500 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Broad Category Selection: Modern 2-Column Grid */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span>{lang === 'ar' ? 'تصنيف الصور' : 'Category'}</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </span>
              <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
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
                    className={`p-3 rounded-2xl flex items-center gap-2.5 transition-all cursor-pointer text-start active:scale-95 ${
                      isSelected
                        ? 'bg-purple-500/20 border-2 border-purple-500 text-white shadow-md'
                        : 'bg-[#0F172A] hover:bg-slate-800/80 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-xl shrink-0">{cat.icon}</span>
                    <div className="truncate">
                      <div className="text-xs font-black truncate">
                        {lang === 'ar' ? cat.nameAr : cat.nameEn}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {cat.presetItems.length} {lang === 'ar' ? 'عنصر' : 'items'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            className="w-full h-13 btn-premium-purple rounded-2xl font-black text-sm sm:text-base shadow-lg transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2 mt-2"
          >
            <span>{lang === 'ar' ? 'متابعة لاختيار الصور السرية ←' : 'Continue to Pick Secret Photos →'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
