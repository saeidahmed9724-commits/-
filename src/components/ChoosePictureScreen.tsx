import React, { useState, useEffect, useRef } from 'react';
import { CategoryDefinition, CategoryPresetItem, PlayerChoice } from '../types/game';
import { sound } from '../utils/audio';
import { Image as ImageIcon, X, ArrowRight, Upload, Sparkles, Clipboard, Lock } from 'lucide-react';

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
  const [selectedImage, setSelectedImage] = useState<string | null>(
    category.presetItems.length > 0 ? category.presetItems[0].imageUrl : null
  );
  const [selectedTitle, setSelectedTitle] = useState<string>(
    category.presetItems.length > 0 ? category.presetItems[0].nameAr : 'عنصر سري'
  );
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
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
        setSelectedTitle(rawName || 'عنصر سري');
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

      {/* Top Bar with Category & Game Badge */}
      <div className="flex items-center justify-between text-xs font-black">
        <div className="bg-white px-3 py-1 rounded-full border border-[#E8E4DA] flex items-center gap-1.5 shadow-2xs">
          <span>{category.icon}</span>
          <span className="text-[#171717]">{lang === 'ar' ? category.nameAr : category.nameEn}</span>
        </div>

        <div className="flex items-center gap-1 text-[#6C5CE7]">
          <span>🎮</span>
          <span>{lang === 'ar' ? 'مين في إيدي؟' : "Who's In My Hand?"}</span>
        </div>
      </div>

      {isWaitingForRemoteOpponent ? (
        <div className="bg-white rounded-3xl p-8 border border-[#E8E4DA] game-card-shadow-lg space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#4ED7B0]/20 text-[#0F6F54] border-2 border-[#0F6F54] flex items-center justify-center mx-auto text-2xl font-black">
            ✓
          </div>

          <h3 className="text-2xl font-black text-[#171717]">
            {lang === 'ar' ? 'تم قفل وتأمين الصورة! 🔒' : 'Picture Locked! 🔒'}
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 font-bold max-w-xs mx-auto">
            {lang === 'ar'
              ? `صورتك لـ ${opponentName} محفوظة بسريّة تامة. بانتظار أن يختار هو صورتك...`
              : `Picture securely locked for ${opponentName}. Waiting for them to pick yours...`}
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD166] text-[#171717] rounded-full text-xs font-black border border-[#171717]">
            <span className="w-2 h-2 rounded-full bg-[#171717] animate-ping" />
            <span>{lang === 'ar' ? 'مزامنة مباشرة...' : 'Live Syncing...'}</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E8E4DA] game-card-shadow-lg space-y-4">
          {/* Header Title with Secret Warning */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1 text-[11px] font-black text-[#FF5C8A] bg-[#FF5C8A]/10 px-3 py-1 rounded-full mb-1">
              <Lock className="w-3 h-3" />
              <span>{lang === 'ar' ? 'سرية تامة' : 'Top Secret'}</span>
            </div>

            <h2 className="text-2xl font-black text-[#171717] tracking-tight">
              {lang === 'ar' ? `اختر صورة لـ ${opponentName}` : `Choose for ${opponentName}`}
            </h2>
            <p className="text-xs text-slate-500 font-bold">
              {lang === 'ar'
                ? `أنت تختار الصورة التي سيحاول ${opponentName} تخمينها!`
                : `You are choosing the secret image ${opponentName} must deduce!`}
            </p>
          </div>

          {/* Selected Picture Preview Card */}
          <div className="bg-[#FAF8F5] rounded-2xl p-3.5 border border-[#E8E4DA] flex flex-col items-center justify-center text-center relative">
            {selectedImage ? (
              <div className="w-full flex flex-col items-center space-y-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  title="Remove"
                  className="absolute top-2.5 end-2.5 w-7 h-7 rounded-full bg-white text-slate-500 hover:text-[#171717] border border-[#E8E4DA] flex items-center justify-center cursor-pointer shadow-2xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <div className="w-32 h-32 rounded-2xl overflow-hidden bg-white border border-[#E8E4DA] flex items-center justify-center p-2 shadow-sm">
                  <img
                    src={selectedImage}
                    alt={selectedTitle}
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>

                <div className="w-full max-w-xs space-y-1">
                  <div className="text-[11px] font-black text-emerald-600 flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{lang === 'ar' ? 'الصورة جاهزة' : 'Image Ready'}</span>
                  </div>

                  <input
                    type="text"
                    value={selectedTitle}
                    onChange={(e) => setSelectedTitle(e.target.value)}
                    placeholder={lang === 'ar' ? 'اسم العنصر...' : 'Item name...'}
                    className="w-full bg-white border border-[#E8E4DA] focus:border-[#6C5CE7] rounded-xl px-3 py-2 text-xs font-black text-center text-[#171717] focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="py-8 flex flex-col items-center justify-center text-slate-400 cursor-pointer"
              >
                <ImageIcon className="w-10 h-10 mb-2 opacity-50 text-[#6C5CE7]" />
                <span className="text-xs font-bold">
                  {lang === 'ar' ? 'اضغط لاختيار صورة من هاتفك' : 'Tap to upload from phone'}
                </span>
              </div>
            )}
          </div>

          {/* Upload & Paste Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-50 text-[#171717] text-xs font-black rounded-xl border border-[#E8E4DA] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-[#6C5CE7]" />
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
                  // Fallback prompt
                  alert(lang === 'ar' ? 'الصق الصورة بالضغط على Ctrl+V' : 'Press Ctrl+V to paste');
                }
              }}
              className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-50 text-[#171717] text-xs font-black rounded-xl border border-[#E8E4DA] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <Clipboard className="w-3.5 h-3.5 text-[#FF5C8A]" />
              <span>{lang === 'ar' ? 'لصق الصورة (Ctrl+V)' : 'Paste Image'}</span>
            </button>
          </div>

          {/* Quick Presets Grid from Category */}
          {category.presetItems.length > 0 && (
            <div className="pt-2 border-t border-[#E8E4DA]">
              <div className="text-[11px] font-black text-slate-500 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#FFD166]" />
                <span>{lang === 'ar' ? `أو اختر عنصراً جاهزاً من (${category.nameAr}):` : 'Or pick a preset:'}</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {category.presetItems.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPreset(item)}
                    className="p-1.5 bg-[#FAF8F5] hover:bg-[#FFD166]/30 border border-[#E8E4DA] rounded-xl text-center transition-all cursor-pointer flex flex-col items-center active:scale-95"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.nameAr}
                      className="w-9 h-9 object-contain mb-1"
                    />
                    <span className="text-[10px] font-black text-[#171717] truncate max-w-full">
                      {lang === 'ar' ? item.nameAr : item.nameEn}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Confirm Button (Large Thumb Target) */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!selectedImage}
              onClick={handleConfirm}
              className="w-full h-14 bg-[#6C5CE7] hover:bg-[#5b4bc4] disabled:opacity-40 text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-[#6C5CE7]/25 transition-all cursor-pointer active:scale-98"
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
