import React, { useState, useEffect, useRef } from 'react';
import { CategoryDefinition, CategoryPresetItem, PlayerChoice } from '../types/game';
import { sound } from '../utils/audio';
import { ImageSearchModal } from './ImageSearchModal';
import {
  Image as ImageIcon,
  X,
  ArrowRight,
  Upload,
  Sparkles,
  Clipboard,
  Lock,
  Search,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface ChoosePictureScreenProps {
  chooserName: string;
  opponentName: string;
  category: CategoryDefinition;
  onConfirmPicture: (choice: PlayerChoice) => void;
  isWaitingForRemoteOpponent?: boolean;
  lang: 'ar' | 'en';
}

export const ChoosePictureScreen: React.FC<ChoosePictureScreenProps> = ({
  chooserName,
  opponentName,
  category,
  onConfirmPicture,
  isWaitingForRemoteOpponent = false,
  lang,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+V paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleFile(file);
            sound.playCardFlip();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = e.target?.result as string;
      if (res) {
        setSelectedImage(res);
        const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setSelectedTitle(rawName || (lang === 'ar' ? 'عنصر سري' : 'Secret Item'));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (item: CategoryPresetItem) => {
    sound.playCardFlip();
    setSelectedImage(item.imageUrl);
    setSelectedTitle(lang === 'ar' ? item.nameAr : item.nameEn);
  };

  const handleConfirm = () => {
    if (!selectedImage) return;
    sound.playYesSound();
    onConfirmPicture({
      imageUrl: selectedImage,
      title: selectedTitle.trim() || (lang === 'ar' ? 'عنصر سري' : 'Secret Item'),
      category: category.id,
      chosenByPlayerId: chooserName,
      heldByPlayerId: opponentName,
    });
  };

  // Direct lock from inside the search modal
  const handleSearchModalLock = (chosen: { imageUrl: string; title: string }) => {
    setSelectedImage(chosen.imageUrl);
    setSelectedTitle(chosen.title);
    setIsSearchModalOpen(false);

    // Lock and proceed directly back to game flow!
    onConfirmPicture({
      imageUrl: chosen.imageUrl,
      title: chosen.title.trim() || (lang === 'ar' ? 'عنصر سري' : 'Secret Item'),
      category: category.id,
      chosenByPlayerId: chooserName,
      heldByPlayerId: opponentName,
    });
  };

  const openSearchWithQuery = (q: string = '') => {
    sound.playCardFlip();
    setSearchInitialQuery(q);
    setIsSearchModalOpen(true);
  };

  return (
    <div className="w-full max-w-md mx-auto py-2 sm:py-4 px-4 animate-scale-up space-y-3.5 pb-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* In-Game Integrated Image Search Modal */}
      <ImageSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectAndLock={handleSearchModalLock}
        category={category}
        opponentName={opponentName}
        lang={lang}
        initialQuery={searchInitialQuery}
      />

      {/* Top Bar with Category & Game Badge */}
      <div className="flex items-center justify-between text-xs font-black">
        <div className="bg-[#1E293B] px-3.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 shadow-sm">
          <span>{category.icon}</span>
          <span className="text-slate-200">{lang === 'ar' ? category.nameAr : category.nameEn}</span>
        </div>

        <div className="flex items-center gap-1.5 text-blue-400 font-bold">
          <span>🎮</span>
          <span>{lang === 'ar' ? 'إيه اللي معايا؟' : 'What Do I Have?'}</span>
        </div>
      </div>

      {isWaitingForRemoteOpponent ? (
        <div className="game-card-surface p-8 space-y-4 text-center border border-slate-700/60">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-2xl font-black shadow-inner">
            ✓
          </div>

          <h3 className="text-2xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'تم قفل وتأمين الصورة! 🔒' : 'Picture Locked! 🔒'}
          </h3>

          <p className="text-xs sm:text-sm text-slate-400 font-bold max-w-xs mx-auto leading-relaxed">
            {lang === 'ar'
              ? `صورتك لـ ${opponentName} محفوظة بسريّة تامة. بانتظار أن يختار هو صورتك...`
              : `Picture securely locked for ${opponentName}. Waiting for them to pick yours...`}
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 text-slate-900 rounded-xl text-xs font-black shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 animate-ping" />
            <span>{lang === 'ar' ? 'مزامنة مباشرة...' : 'Live Syncing...'}</span>
          </div>
        </div>
      ) : (
        <div className="game-card-surface p-5 sm:p-6 space-y-4 border border-slate-700/60">
          {/* Header Title with Secret Warning */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1 text-[11px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full mb-1">
              <Lock className="w-3 h-3 text-rose-400" />
              <span>{lang === 'ar' ? 'سرية تامة' : 'Top Secret'}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {lang === 'ar' ? `اختر صورة لـ ${opponentName}` : `Choose for ${opponentName}`}
            </h2>
            <p className="text-xs text-slate-400 font-bold">
              {lang === 'ar'
                ? `أنت تختار الصورة التي سيحاول ${opponentName} استنتاجها وتخمينها!`
                : `You are choosing the secret image ${opponentName} must deduce!`}
            </p>
          </div>

          {/* Primary Action: In-Game Image Search Button (Modern Premium Purple) */}
          <button
            type="button"
            onClick={() => openSearchWithQuery('')}
            className="w-full h-16 btn-premium-purple rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all active:scale-98 group"
          >
            <div className="flex items-center gap-3 text-start">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                🔍
              </div>
              <div>
                <div className="text-sm font-black flex items-center gap-1.5 leading-tight text-white">
                  <span>{lang === 'ar' ? 'اختار صورة (بحث مباشر)' : 'Choose Picture (Live Search)'}</span>
                  <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                    {lang === 'ar' ? 'فوري ⚡' : 'INSTANT ⚡'}
                  </span>
                </div>
                <div className="text-[11px] text-purple-200 font-medium">
                  {lang === 'ar'
                    ? 'ابحث عن أي شيء (مثل Pizza أو برجر) واختره بضغطة'
                    : 'Search for anything inside the game with 1 tap'}
                </div>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ArrowRight className={`w-4 h-4 text-white ${lang === 'ar' ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Selected Picture Preview Card or Fallback State */}
          <div className="bg-[#0F172A] rounded-2xl p-4 border border-slate-700/80 flex flex-col items-center justify-center text-center relative shadow-inner">
            {selectedImage ? (
              <div className="w-full flex flex-col items-center space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  title="Remove"
                  className="absolute top-2.5 end-2.5 w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer border border-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="w-36 h-36 rounded-2xl overflow-hidden bg-[#1E293B] border border-slate-700 flex items-center justify-center p-2 shadow-md">
                  <img
                    src={selectedImage}
                    alt={selectedTitle}
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>

                <div className="w-full max-w-xs space-y-1.5">
                  <div className="text-[11px] font-black text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-slate-900" />
                    <span>{lang === 'ar' ? 'الصورة جاهزة للتثبيت' : 'Image Ready to Lock'}</span>
                  </div>

                  <input
                    type="text"
                    value={selectedTitle}
                    onChange={(e) => setSelectedTitle(e.target.value)}
                    placeholder={lang === 'ar' ? 'اسم العنصر...' : 'Item name...'}
                    className="w-full bg-[#1E293B] border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold text-center text-white focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => openSearchWithQuery(selectedTitle)}
                    className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1 mx-auto cursor-pointer pt-0.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'تغيير الصورة بالبحث' : 'Change image via search'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => openSearchWithQuery('')}
                className="py-6 flex flex-col items-center justify-center text-slate-400 cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <Search className="w-7 h-7" />
                </div>
                <span className="text-sm font-bold text-slate-200">
                  {lang === 'ar' ? 'اضغط هنا للبحث عن صورة' : 'Tap here to search for an image'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {lang === 'ar' ? 'دون الحاجة لحفظ صور على هاتفك' : 'No need to save pictures to your device'}
                </span>
              </div>
            )}
          </div>

          {/* Secondary Action: Upload & Paste Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 px-3 btn-premium-surface text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>{lang === 'ar' ? 'رفع من الهاتف' : 'Upload File'}</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  const clipItems = await navigator.clipboard.read();
                  for (const item of clipItems) {
                    const imgType = item.types.find((t) => t.startsWith('image/'));
                    if (imgType) {
                      const blob = await item.getType(imgType);
                      handleFile(new File([blob], 'pasted-image.png', { type: imgType }));
                      sound.playCardFlip();
                      break;
                    }
                  }
                } catch {
                  // Fallback
                }
              }}
              className="flex-1 py-2.5 px-3 btn-premium-surface text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Clipboard className="w-3.5 h-3.5 text-slate-400" />
              <span>{lang === 'ar' ? 'لصق (Ctrl+V)' : 'Paste Image'}</span>
            </button>
          </div>

          {/* Quick Presets Grid from Category */}
          {category.presetItems.length > 0 && (
            <div className="pt-2 border-t border-slate-700/60">
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>
                  {lang === 'ar' ? `أو اختر عنصراً جاهزاً من (${category.nameAr}):` : 'Or pick a preset:'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {category.presetItems.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPreset(item)}
                    className="p-2 bg-[#0F172A] hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/80 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center active:scale-95 shadow-sm"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.nameAr}
                      className="w-9 h-9 object-contain mb-1"
                    />
                    <span className="text-[10px] font-bold text-slate-300 truncate max-w-full">
                      {lang === 'ar' ? item.nameAr : item.nameEn}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Confirm Button: Big Modern Tactile Gold Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!selectedImage}
              onClick={handleConfirm}
              className="w-full h-14 btn-premium-gold disabled:opacity-40 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-98"
            >
              <span>{lang === 'ar' ? 'تثبيت الصورة السرية 🔒' : 'Lock Secret Picture 🔒'}</span>
              <ArrowRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
