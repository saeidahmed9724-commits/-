import React, { useState, useEffect, useRef } from 'react';
import { CategoryDefinition } from '../types/game';
import { searchImages, SearchImageItem, CATEGORY_SUGGESTIONS } from '../services/imageSearch';
import { sound } from '../utils/audio';
import {
  Search,
  X,
  Lock,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAndLock: (image: { imageUrl: string; title: string }) => void;
  category: CategoryDefinition;
  opponentName: string;
  lang: 'ar' | 'en';
  initialQuery?: string;
}

export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectAndLock,
  category,
  opponentName,
  lang,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [results, setResults] = useState<SearchImageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<SearchImageItem | null>(null);
  const [itemTitle, setItemTitle] = useState<string>('');
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Suggestions for this category
  const suggestions =
    CATEGORY_SUGGESTIONS[category.id] ||
    CATEGORY_SUGGESTIONS['food'] ||
    [];

  // Auto focus input on open and perform default search if query or first suggestion provided
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      const defaultSearch = initialQuery || (category.id === 'food' ? 'Pizza' : category.id === 'animals' ? 'Lion' : 'Car');
      if (!hasSearched && !query) {
        setQuery(defaultSearch);
        executeSearch(defaultSearch);
      } else if (query && !hasSearched) {
        executeSearch(query);
      }
    }
  }, [isOpen]);

  const executeSearch = async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    setLoading(true);
    setHasSearched(true);
    setSelectedItem(null);

    try {
      const items = await searchImages(trimmed);
      setResults(items);
      // Auto-set the item title draft to the search term (clean Arabic/English)
      setItemTitle(trimmed);
    } catch (e) {
      console.error('Image search failed:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (sugQuery: string, sugTitle: string) => {
    sound.playCardFlip();
    setQuery(sugQuery);
    setItemTitle(lang === 'ar' ? sugTitle : sugQuery);
    executeSearch(sugQuery);
  };

  const handleSelectItem = (item: SearchImageItem) => {
    sound.playCardFlip();
    setSelectedItem(item);
    // If user hasn't typed a custom title, prefill with search query or clean title
    if (!itemTitle.trim() || itemTitle === query) {
      setItemTitle(query.trim() || item.title);
    }
    // Scroll preview into view smoothly on mobile
    setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
  };

  const handleConfirmAndLock = () => {
    if (!selectedItem) return;
    sound.playYesSound();
    onSelectAndLock({
      imageUrl: selectedItem.fullUrl || selectedItem.thumbUrl,
      title: itemTitle.trim() || query.trim() || (lang === 'ar' ? 'عنصر سري' : 'Secret Item'),
    });
  };

  const handleImageError = (id: string) => {
    setFailedImages((prev) => new Set(prev).add(id));
  };

  if (!isOpen) return null;

  const validResults = results.filter((r) => !failedImages.has(r.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-[430px] h-[92vh] max-h-[820px] bg-[#F5F3EE] rounded-3xl sm:rounded-[32px] border-2 border-[#171717] shadow-2xl flex flex-col overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="p-4 bg-white border-b border-[#E8E4DA] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center font-black">
              🔍
            </div>
            <div>
              <h3 className="text-base font-black text-[#171717] leading-tight">
                {lang === 'ar' ? `اختر صورة لـ ${opponentName}` : `Choose for ${opponentName}`}
              </h3>
              <p className="text-[11px] text-slate-500 font-bold">
                {lang === 'ar' ? 'بحث صور مباشر وسريع داخل اللعبة' : 'Instant in-game image search'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
            title={lang === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-3 bg-white border-b border-[#E8E4DA] shrink-0 space-y-2.5">
          <form onSubmit={handleFormSubmit} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'ابحث عن حاجة... (مثلاً: Pizza أو بيتزا)'
                    : 'Search for anything... (e.g. Pizza)'
                }
                className="w-full h-11 bg-[#FAF8F5] border border-[#E8E4DA] focus:border-[#6C5CE7] rounded-xl ps-9 pe-8 text-xs font-black text-[#171717] placeholder:text-slate-400 focus:outline-none transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="h-11 px-4 bg-[#6C5CE7] hover:bg-[#5b4bc4] disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'بحث' : 'Search'}</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Suggestions Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] font-black text-slate-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[#FFD166]" />
              <span>{lang === 'ar' ? 'أفكار سريعة:' : 'Quick:'}</span>
            </span>
            {suggestions.map((sug) => (
              <button
                key={sug.query}
                type="button"
                onClick={() => handleSuggestionClick(sug.query, sug.labelAr)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
                  query.toLowerCase() === sug.query.toLowerCase()
                    ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]'
                    : 'bg-[#FAF8F5] text-slate-700 hover:bg-[#FFD166]/20 border-[#E8E4DA]'
                }`}
              >
                <span>{sug.icon}</span>
                <span>{lang === 'ar' ? sug.labelAr : sug.labelEn}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content Body (Results & Preview) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Loading State */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#6C5CE7]/15 text-[#6C5CE7] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <p className="text-xs font-black text-slate-700">
                {lang === 'ar' ? 'جاري البحث عن صور حقيقية... 🔎' : 'Searching for high-res images...'}
              </p>
              <p className="text-[11px] text-slate-400 font-bold">
                {lang === 'ar' ? 'تجهيز أفضل النتائج في ثوانٍ' : 'Gathering top matching results'}
              </p>
            </div>
          )}

          {/* Empty / No Results State */}
          {!loading && hasSearched && validResults.length === 0 && (
            <div className="py-10 px-4 bg-white rounded-2xl border border-[#E8E4DA] text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-[#171717]">
                {lang === 'ar' ? `لم نعثر على نتائج لـ "${query}"` : `No images found for "${query}"`}
              </h4>
              <p className="text-xs text-slate-500 font-bold max-w-xs mx-auto">
                {lang === 'ar'
                  ? 'جرّب كتابة كلمة أخرى بالعربية أو الإنجليزية، أو اختر من الاقتراحات السريعة بالأعلى.'
                  : 'Try typing in English (e.g. "Pizza", "Lion", "Car") or tap one of the suggestion chips above.'}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {suggestions.slice(0, 4).map((sug) => (
                  <button
                    key={sug.query}
                    type="button"
                    onClick={() => handleSuggestionClick(sug.query, sug.labelAr)}
                    className="text-xs font-black px-3 py-1.5 bg-[#FAF8F5] border border-[#E8E4DA] hover:bg-[#FFD166]/30 rounded-xl cursor-pointer"
                  >
                    {sug.icon} {lang === 'ar' ? sug.labelAr : sug.labelEn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Initial Pre-Search Prompt */}
          {!loading && !hasSearched && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-[#E8E4DA] flex items-center justify-center mx-auto text-2xl shadow-xs">
                🖼️
              </div>
              <h4 className="text-sm font-black text-[#171717]">
                {lang === 'ar' ? 'ابحث عن أي شيء تريده بالاسم' : 'Search for any picture by name'}
              </h4>
              <p className="text-xs text-slate-500 font-bold max-w-xs mx-auto">
                {lang === 'ar'
                  ? 'اكتب مثلاً: Pizza، برجر، قطة، سيارة، وسنعرض لك صوراً فورية تختار منها مباشرة دون مغادرة اللعبة.'
                  : 'Type Pizza, Lion, Car, etc. to pick a secret photo without ever leaving the app.'}
              </p>
            </div>
          )}

          {/* Image Results Grid */}
          {!loading && validResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black text-slate-500 px-1">
                <span>
                  {lang === 'ar'
                    ? `نتائج البحث عن "${query}" (${validResults.length} صورة):`
                    : `Results for "${query}" (${validResults.length}):`}
                </span>
                <span className="text-[#6C5CE7]">{lang === 'ar' ? 'اضغط لاختيار صورة 👇' : 'Tap to select'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {validResults.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={`relative aspect-square rounded-2xl overflow-hidden bg-white border-2 transition-all cursor-pointer group active:scale-95 ${
                        isSelected
                          ? 'border-[#6C5CE7] ring-4 ring-[#6C5CE7]/25 shadow-md scale-102 z-10'
                          : 'border-[#E8E4DA] hover:border-slate-400'
                      }`}
                    >
                      <img
                        src={item.thumbUrl}
                        alt={item.title}
                        loading="lazy"
                        onError={() => handleImageError(item.id)}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />

                      {/* Selected Overlay Checkmark */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#6C5CE7]/30 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-white text-[#6C5CE7] flex items-center justify-center shadow-lg font-black">
                            <CheckCircle2 className="w-5 h-5 fill-[#6C5CE7] text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Item Preview & Lock Drawer */}
          {selectedItem && (
            <div
              ref={previewRef}
              className="bg-white rounded-2xl p-4 border-2 border-[#6C5CE7] shadow-xl space-y-3 animate-slide-up"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#6C5CE7]">
                  <CheckCircle2 className="w-4 h-4 fill-[#6C5CE7] text-white" />
                  <span>{lang === 'ar' ? 'معاينة الصورة المختارة' : 'Selected Picture Preview'}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {lang === 'ar' ? 'جاهزة للتثبيت' : 'Ready to lock'}
                </span>
              </div>

              <div className="flex gap-3 items-center">
                {/* Image Thumbnail Preview */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#FAF8F5] border border-[#E8E4DA] shrink-0 p-1 flex items-center justify-center shadow-xs">
                  <img
                    src={selectedItem.thumbUrl}
                    alt={selectedItem.title}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>

                {/* Title & Secret Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <label className="text-[11px] font-black text-slate-600 block">
                    {lang === 'ar' ? 'اسم العنصر السري:' : 'Secret Item Name:'}
                  </label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    placeholder={lang === 'ar' ? 'اسم العنصر...' : 'Item name...'}
                    className="w-full bg-[#FAF8F5] border border-[#E8E4DA] focus:border-[#6C5CE7] rounded-xl px-3 py-1.5 text-xs font-black text-[#171717] focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 font-bold truncate">
                    {lang === 'ar'
                      ? `سيحاول ${opponentName} تخمين هذه الصورة 🤫`
                      : `${opponentName} will deduce this picture`}
                  </p>
                </div>
              </div>

              {/* Confirm & Lock CTA */}
              <button
                type="button"
                onClick={handleConfirmAndLock}
                className="w-full h-13 bg-[#6C5CE7] hover:bg-[#5b4bc4] text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#6C5CE7]/30 transition-all cursor-pointer active:scale-98"
              >
                <Lock className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تثبيت الصورة 🔒' : 'Lock Picture 🔒'}</span>
                <ArrowRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="p-2.5 bg-white border-t border-[#E8E4DA] text-center text-[10px] text-slate-400 font-bold shrink-0">
          {lang === 'ar'
            ? '🔒 الصورة محفوظة بسرية تامة ولن يراها خصمك إطلاقاً حتى تنتهي الجولة'
            : '🔒 Picture is top secret and hidden from your opponent until round ends'}
        </div>
      </div>
    </div>
  );
};
