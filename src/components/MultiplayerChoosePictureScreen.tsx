import React, { useState } from 'react';
import { CategoryDefinition, CategoryPresetItem, MultiplayerSecretImage } from '../types/game';
import { sound } from '../utils/audio';
import { Check, Lock, Smartphone, Search, Sparkles } from 'lucide-react';

interface MultiplayerChoosePictureScreenProps {
  playerNames: string[];
  category: CategoryDefinition;
  onAllPicturesChosen: (secretImages: MultiplayerSecretImage[]) => void;
  lang: 'ar' | 'en';
}

export const MultiplayerChoosePictureScreen: React.FC<MultiplayerChoosePictureScreenProps> = ({
  playerNames,
  category,
  onAllPicturesChosen,
  lang,
}) => {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [chosenImages, setChosenImages] = useState<MultiplayerSecretImage[]>([]);
  const [selectedItem, setSelectedItem] = useState<CategoryPresetItem | null>(null);
  const [showHandoff, setShowHandoff] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentPlayerName = playerNames[currentPlayerIndex];
  const nextPlayerName = playerNames[currentPlayerIndex + 1];

  const filteredItems = category.presetItems.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.nameAr.toLowerCase().includes(q) ||
      item.nameEn.toLowerCase().includes(q)
    );
  });

  const handleConfirmChoice = () => {
    if (!selectedItem) return;
    sound.playCardFlip();

    const newSecretImage: MultiplayerSecretImage = {
      id: `img-${currentPlayerIndex}-${selectedItem.id}`,
      ownerId: `p-${currentPlayerIndex + 1}`,
      ownerName: currentPlayerName,
      title: lang === 'ar' ? selectedItem.nameAr : selectedItem.nameEn,
      imageUrl: selectedItem.imageUrl,
      category: category.id,
    };

    const nextChosen = [...chosenImages, newSecretImage];
    setChosenImages(nextChosen);
    setSelectedItem(null);
    setSearchQuery('');

    if (currentPlayerIndex < playerNames.length - 1) {
      // Show handoff to the next player
      setShowHandoff(true);
    } else {
      // All players have chosen!
      sound.playTurnChime();
      onAllPicturesChosen(nextChosen);
    }
  };

  const handleProceedHandoff = () => {
    sound.playTurnChime();
    setCurrentPlayerIndex((prev) => prev + 1);
    setShowHandoff(false);
  };

  // PRIVACY INTERSTITIAL HANDOFF SCREEN
  if (showHandoff) {
    return (
      <div className="w-full max-w-md mx-auto py-8 px-4 text-center space-y-6 animate-scale-up select-none">
        <div className="w-20 h-20 rounded-3xl bg-purple-500/15 border-2 border-purple-500/40 text-purple-400 flex items-center justify-center mx-auto text-4xl shadow-xl animate-pulse">
          <Smartphone className="w-10 h-10 text-purple-400" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-black text-purple-400 uppercase tracking-widest bg-purple-500/15 px-3 py-1 rounded-full border border-purple-500/30">
            {lang === 'ar' ? 'حماية سرية الصور 🔒' : 'Pass the Phone 🔒'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {lang === 'ar' ? `مرر الهاتف لـ ${nextPlayerName}!` : `Pass the phone to ${nextPlayerName}!`}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-bold max-w-xs mx-auto">
            {lang === 'ar'
              ? `دور ${nextPlayerName} ليختار صورته السرية دون أن يراها باقي اللاعبين.`
              : `${nextPlayerName}'s turn to pick their secret picture privately.`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleProceedHandoff}
          className="w-full h-14 btn-premium-purple rounded-2xl font-black text-base shadow-xl transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
        >
          <span>
            {lang === 'ar'
              ? `أنا ${nextPlayerName}، معي الهاتف وجاهز للاختيار ←`
              : `I am ${nextPlayerName}, ready to choose →`}
          </span>
        </button>
      </div>
    );
  }

  // ACTIVE PLAYER PICKS THEIR SECRET PICTURE
  return (
    <div className="w-full max-w-md mx-auto py-2 px-3 animate-scale-up space-y-3 pb-6 select-none">
      {/* Top Banner */}
      <div className="game-card-surface p-4 border border-purple-500/40 space-y-2 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
            <h3 className="text-sm sm:text-base font-black text-white">
              {lang === 'ar' ? `دور ${currentPlayerName} 🔒` : `${currentPlayerName}'s Turn 🔒`}
            </h3>
          </div>
          <span className="text-[11px] font-bold text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-500/30">
            {currentPlayerIndex + 1} / {playerNames.length}
          </span>
        </div>

        <p className="text-xs text-amber-300 font-bold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-center">
          {lang === 'ar'
            ? `اختر صورتك السرية الخاصة بك من تصنيف (${category.nameAr}) دون أن يراها أحد!`
            : `Pick your secret picture from (${category.nameEn}) privately!`}
        </p>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث في العناصر...' : 'Search items...'}
            className="w-full h-10 bg-[#0F172A] border border-slate-700 focus:border-purple-500 rounded-xl ps-9 pe-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Grid of Preset Items */}
      <div className="grid grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pe-1">
        {filteredItems.map((item) => {
          const isSelected = selectedItem?.id === item.id;
          const title = lang === 'ar' ? item.nameAr : item.nameEn;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                sound.playCardFlip();
                setSelectedItem(item);
              }}
              className={`p-2.5 rounded-2xl border-2 flex flex-col items-center gap-2 cursor-pointer transition-all active:scale-95 text-center relative ${
                isSelected
                  ? 'bg-purple-600/25 border-purple-500 ring-2 ring-purple-400 shadow-lg scale-102'
                  : 'bg-[#0F172A] hover:bg-slate-800/80 border-slate-800 text-slate-300'
              }`}
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-900/60 p-2 flex items-center justify-center relative">
                <img
                  src={item.imageUrl}
                  alt={title}
                  className="w-full h-full object-contain drop-shadow-md rounded-lg"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute top-1 end-1 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>
              <div className="text-xs font-black text-white truncate w-full px-1">
                {title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Item Confirmation Drawer */}
      <div className="game-card-surface p-3 border border-slate-700/80 space-y-2">
        <div className="text-xs font-bold text-center text-slate-300">
          {selectedItem ? (
            <span>
              {lang === 'ar' ? 'صورتك المختارة: ' : 'Selected: '}
              <strong className="text-purple-400 font-black">
                «{lang === 'ar' ? selectedItem.nameAr : selectedItem.nameEn}»
              </strong>
            </span>
          ) : (
            <span className="text-slate-500">
              {lang === 'ar' ? 'اضغط على أي صورة بالأعلى لاختيارها' : 'Tap any picture above to choose'}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!selectedItem}
          onClick={handleConfirmChoice}
          className="w-full h-13 btn-premium-purple rounded-2xl font-black text-sm sm:text-base shadow-lg transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Lock className="w-4 h-4" />
          <span>
            {lang === 'ar'
              ? `قفل صورتي السرية لـ ${currentPlayerName} 🔒`
              : `Lock Secret Photo for ${currentPlayerName} 🔒`}
          </span>
        </button>
      </div>
    </div>
  );
};
