import React, { useState, useEffect, useRef } from 'react';
import { CategoryDefinition } from '../types/game';
import { searchImages, SearchImageItem } from '../services/imageSearch';
import { sound } from '../utils/audio';
import {
  Search,
  X,
  Lock,
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
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<SearchImageItem | null>(null);
  const [itemTitle, setItemTitle] = useState<string>('');
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Auto focus input on open and perform default search if query or first suggestion provided
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      // No suggested/default search: start empty unless we were given a query to refine.
      if (initialQuery && !hasSearched && !query) {
        setQuery(initialQuery);
        executeSearch(initialQuery);
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
    setHasMore(true);

    try {
      const res = await searchImages(trimmed, 0, 60);
      setResults(res.items);
      setHasMore(res.hasMore && res.items.length >= 20);
      // Auto-set the item title draft to the search term (clean Arabic/English)
      setItemTitle(trimmed);
    } catch (e) {
      console.error('Image search failed:', e);
      setResults([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreImages = async () => {
    if (loadingMore || !query.trim()) return;
    setLoadingMore(true);

    try {
      const res = await searchImages(query.trim(), results.length, 50);
      if (res.items.length > 0) {
        setResults((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const existingUrls = new Set(prev.map((i) => i.thumbUrl));
          const uniqueNew = res.items.filter(
            (i) => !existingIds.has(i.id) && !existingUrls.has(i.thumbUrl)
          );
          return [...prev, ...uniqueNew];
        });
        setHasMore(res.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more images:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-[440px] h-[92vh] max-h-[820px] bg-[#0F172A] border border-slate-700/80 rounded-3xl flex flex-col overflow-hidden animate-scale-up shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="p-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-lg shadow-sm">
              🔍
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-tight">
                {lang === 'ar' ? `اختر صورة لـ ${opponentName}` : `Choose for ${opponentName}`}
              </h3>
              <p className="text-[11px] text-slate-400 font-bold">
                {lang === 'ar' ? 'بحث صور فوري داخل اللعبة' : 'Instant in-game image search'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl btn-premium-surface text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            title={lang === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-3 bg-[#0F172A] border-b border-slate-800 shrink-0 space-y-2.5">
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
                    ? 'ابحث عن أي شيء...'
                    : 'Search for anything...'
                }
                className="w-full h-12 bg-[#1E293B] border border-slate-700 focus:border-blue-500 rounded-xl ps-9 pe-8 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none transition-colors shadow-inner"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="h-12 px-5 btn-premium-blue disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
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

        </div>

        {/* Scrollable Content Body (Results & Preview) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Loading State */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <p className="text-xs font-bold text-slate-200">
                {lang === 'ar' ? 'جاري البحث عن صور عالية الدقة... 🔎' : 'Searching for high-res images...'}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                {lang === 'ar' ? 'تجهيز أفضل النتائج في ثوانٍ' : 'Gathering top matching results'}
              </p>
            </div>
          )}

          {/* Empty / No Results State */}
          {!loading && hasSearched && validResults.length === 0 && (
            <div className="py-10 px-4 bg-[#1E293B] rounded-2xl border border-slate-700 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-white">
                {lang === 'ar' ? `لم نعثر على نتائج لـ "${query}"` : `No images found for "${query}"`}
              </h4>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                {lang === 'ar'
                  ? 'جرّب كتابة كلمة أخرى بالعربية أو الإنجليزية.'
                  : 'Try another word, in English or Arabic.'}
              </p>
            </div>
          )}

          {/* Initial Pre-Search Prompt */}
          {!loading && !hasSearched && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#1E293B] border border-slate-700 flex items-center justify-center mx-auto text-2xl shadow-sm">
                🖼️
              </div>
              <h4 className="text-sm font-black text-white">
                {lang === 'ar' ? 'ابحث عن أي شيء تريده بالاسم' : 'Search for any picture by name'}
              </h4>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                {lang === 'ar'
                  ? 'اكتب اسم أي شيء وسنعرض لك صوراً فورية تختار منها مباشرة دون مغادرة اللعبة.'
                  : 'Type the name of anything to pick a secret photo without ever leaving the app.'}
              </p>
            </div>
          )}

          {/* Image Results Grid */}
          {!loading && validResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                <span>
                  {lang === 'ar'
                    ? `نتائج البحث عن "${query}" (${validResults.length} صورة):`
                    : `Results for "${query}" (${validResults.length}):`}
                </span>
                <span className="text-amber-400">{lang === 'ar' ? 'اضغط لاختيار صورة 👇' : 'Tap to select'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {validResults.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={`relative aspect-square rounded-2xl overflow-hidden bg-[#1E293B] border-2 transition-all cursor-pointer group active:scale-95 ${
                        isSelected
                          ? 'border-amber-400 ring-4 ring-amber-400/20 shadow-md scale-102 z-10'
                          : 'border-slate-700/80 hover:border-slate-500'
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
                        <div className="absolute inset-0 bg-amber-400/25 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center shadow-lg font-black">
                            <CheckCircle2 className="w-5 h-5 fill-amber-400 text-slate-900" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Source credit (Pexels requires a visible link back to Pexels) */}
              <div className="pt-2 text-[10px] font-bold text-slate-500 text-center leading-relaxed" data-testid="search-sources">
                {lang === 'ar' ? 'مصادر الصور: ' : 'Image sources: '}
                {[
                  { name: 'Wikipedia', url: 'https://www.wikipedia.org', has: validResults.some((r) => r.source === 'Wikipedia' || r.source === 'ويكيبيديا') },
                  { name: 'Pexels', url: 'https://www.pexels.com', has: validResults.some((r) => r.source === 'Pexels') },
                  { name: 'Openverse', url: 'https://openverse.org', has: validResults.some((r) => r.source === 'Openverse') },
                  { name: 'Wikimedia', url: 'https://commons.wikimedia.org', has: validResults.some((r) => r.source === 'Wikimedia') },
                ]
                  .filter((x) => x.has)
                  .map((x, i) => (
                    <React.Fragment key={x.name}>
                      {i > 0 && ' · '}
                      <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 underline">
                        {x.name}
                      </a>
                    </React.Fragment>
                  ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="pt-2 pb-1 text-center">
                  <button
                    type="button"
                    onClick={loadMoreImages}
                    disabled={loadingMore}
                    className="w-full py-3 px-4 btn-premium-surface text-blue-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 transition-all disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        <span>{lang === 'ar' ? 'جاري تحميل المزيد...' : 'Loading more images...'}</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'ar'
                            ? `عرض المزيد من صور "${query}" (+50 صورة إضافية)`
                            : `Load more pictures for "${query}" (+50 more)`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Selected Item Preview & Lock Drawer */}
          {selectedItem && (
            <div
              ref={previewRef}
              className="bg-[#1E293B] rounded-2xl p-4 border border-amber-400/60 shadow-xl space-y-3 animate-slide-up"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <CheckCircle2 className="w-4 h-4 fill-amber-400 text-slate-950" />
                  <span>{lang === 'ar' ? 'معاينة الصورة المختارة' : 'Selected Picture Preview'}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {lang === 'ar' ? 'جاهزة للتثبيت' : 'Ready to lock'}
                </span>
              </div>

              <div className="flex gap-3 items-center">
                {/* Image Thumbnail Preview */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#0F172A] border border-slate-700 shrink-0 p-1 flex items-center justify-center shadow-xs">
                  <img
                    src={selectedItem.thumbUrl}
                    alt={selectedItem.title}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>

                {/* Title & Secret Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  {selectedItem.credit && (
                    <div className="text-[10px] font-bold text-slate-500 truncate">
                      📷{' '}
                      {selectedItem.creditUrl ? (
                        <a href={selectedItem.creditUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          {selectedItem.credit}
                        </a>
                      ) : (
                        selectedItem.credit
                      )}{' '}
                      · {selectedItem.source}
                    </div>
                  )}
                  <label className="text-[11px] font-bold text-slate-300 block">
                    {lang === 'ar' ? 'اسم العنصر السري:' : 'Secret Item Name:'}
                  </label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    placeholder={lang === 'ar' ? 'اسم العنصر...' : 'Item name...'}
                    className="w-full bg-[#0F172A] border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 font-medium truncate">
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
                className="w-full h-14 btn-premium-gold rounded-2xl font-black text-base flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer active:scale-98 text-slate-950"
              >
                <Lock className="w-5 h-5 text-slate-950" />
                <span>{lang === 'ar' ? 'تثبيت الصورة 🔒' : 'Lock Picture 🔒'}</span>
                <ArrowRight className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="p-2.5 bg-[#0F172A] border-t border-slate-800 text-center text-[10px] text-slate-400 font-medium shrink-0">
          {lang === 'ar'
            ? '🔒 الصورة محفوظة بسرية تامة ولن يراها خصمك إطلاقاً حتى تنتهي الجولة'
            : '🔒 Picture is top secret and hidden from your opponent until round ends'}
        </div>
      </div>
    </div>
  );
};
