export interface SearchImageItem {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  source?: string;
  width?: number;
  height?: number;
}

// Popular quick-search queries per category for instant discovery
export const CATEGORY_SUGGESTIONS: Record<string, Array<{ labelAr: string; labelEn: string; query: string; icon: string }>> = {
  food: [
    { labelAr: 'بيتزا', labelEn: 'Pizza', query: 'Pizza', icon: '🍕' },
    { labelAr: 'برجر', labelEn: 'Burger', query: 'Burger', icon: '🍔' },
    { labelAr: 'بطاطس مقلية', labelEn: 'Fries', query: 'French fries', icon: '🍟' },
    { labelAr: 'سوشي', labelEn: 'Sushi', query: 'Sushi', icon: '🍣' },
    { labelAr: 'شاورما', labelEn: 'Shawarma', query: 'Shawarma', icon: '🌯' },
    { labelAr: 'فراخ مقلية', labelEn: 'Fried Chicken', query: 'Fried chicken', icon: '🍗' },
    { labelAr: 'دونات', labelEn: 'Donut', query: 'Donut', icon: '🍩' },
    { labelAr: 'كيك شوكولاتة', labelEn: 'Cake', query: 'Chocolate cake', icon: '🍰' },
    { labelAr: 'آيس كريم', labelEn: 'Ice Cream', query: 'Ice cream', icon: '🍦' },
    { labelAr: 'تاكو', labelEn: 'Taco', query: 'Taco', icon: '🌮' },
    { labelAr: 'بان كيك', labelEn: 'Pancake', query: 'Pancake', icon: '🥞' },
    { labelAr: 'باستا', labelEn: 'Pasta', query: 'Pasta', icon: '🍝' },
  ],
  animals: [
    { labelAr: 'أسد', labelEn: 'Lion', query: 'Lion', icon: '🦁' },
    { labelAr: 'نمر', labelEn: 'Tiger', query: 'Tiger', icon: '🐯' },
    { labelAr: 'قطة', labelEn: 'Cat', query: 'Cat kitten', icon: '🐱' },
    { labelAr: 'كلب', labelEn: 'Dog', query: 'Dog puppy', icon: '🐶' },
    { labelAr: 'فيل', labelEn: 'Elephant', query: 'Elephant', icon: '🐘' },
    { labelAr: 'باندا', labelEn: 'Panda', query: 'Giant panda', icon: '🐼' },
    { labelAr: 'زرافة', labelEn: 'Giraffe', query: 'Giraffe', icon: '🦒' },
    { labelAr: 'دلفين', labelEn: 'Dolphin', query: 'Dolphin', icon: '🐬' },
    { labelAr: 'نسر', labelEn: 'Eagle', query: 'Eagle', icon: '🦅' },
    { labelAr: 'بطريق', labelEn: 'Penguin', query: 'Penguin', icon: '🐧' },
    { labelAr: 'أرنب', labelEn: 'Rabbit', query: 'Rabbit', icon: '🐰' },
    { labelAr: 'حصان', labelEn: 'Horse', query: 'Horse', icon: '🐴' },
  ],
  general: [
    { labelAr: 'سيارة رياضية', labelEn: 'Sports Car', query: 'Sports car', icon: '🏎️' },
    { labelAr: 'طائرة', labelEn: 'Airplane', query: 'Airplane', icon: '✈️' },
    { labelAr: 'آيفون', labelEn: 'iPhone', query: 'iPhone', icon: '📱' },
    { labelAr: 'كرة قدم', labelEn: 'Football', query: 'Football soccer ball', icon: '⚽' },
    { labelAr: 'ساعة يد', labelEn: 'Wristwatch', query: 'Wristwatch', icon: '⌚' },
    { labelAr: 'جيتار', labelEn: 'Guitar', query: 'Acoustic guitar', icon: '🎸' },
    { labelAr: 'دراجة نارية', labelEn: 'Motorcycle', query: 'Motorcycle', icon: '🏍️' },
    { labelAr: 'كاميرا', labelEn: 'Camera', query: 'DSLR camera', icon: '📷' },
    { labelAr: 'برج إيفل', labelEn: 'Eiffel Tower', query: 'Eiffel Tower', icon: '🗼' },
    { labelAr: 'الأهرامات', labelEn: 'Pyramids', query: 'Giza Pyramids', icon: '🏛️' },
  ],
};

/**
 * Searches images using the backend proxy endpoint, with direct client fallback to Wikimedia Commons
 */
export async function searchImages(query: string): Promise<SearchImageItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Try backend proxy first
  try {
    const res = await fetch(`/api/search-images?q=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results;
      }
    }
  } catch (e) {
    console.warn('Backend image search failed, trying direct client fetch...', e);
  }

  // Fallback: Direct Wikimedia Commons query (CORS enabled by origin=*)
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      trimmed
    )}&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url|size&iiurlwidth=500&format=json&origin=*`;
    const res = await fetch(commonsUrl);
    if (res.ok) {
      const data = await res.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      const results: SearchImageItem[] = [];
      const seen = new Set<string>();

      for (const p of pages as any[]) {
        const info = p.imageinfo?.[0];
        const thumbUrl = info?.thumburl || info?.url;
        const fullUrl = info?.url || thumbUrl;
        if (
          thumbUrl &&
          !seen.has(thumbUrl) &&
          !/\.(pdf|ogg|ogv|webm|djvu|tiff?)$/i.test(fullUrl)
        ) {
          seen.add(thumbUrl);
          const rawTitle = (p.title || '')
            .replace(/^File:/i, '')
            .replace(/\.[^/.]+$/, '')
            .replace(/[-_]/g, ' ')
            .trim();
          results.push({
            id: 'client-' + p.pageid,
            title: rawTitle.length > 50 ? rawTitle.slice(0, 50) + '...' : rawTitle || trimmed,
            thumbUrl,
            fullUrl,
            source: 'Wikimedia Commons',
            width: info?.thumbwidth,
            height: info?.thumbheight,
          });
        }
      }
      return results;
    }
  } catch (err) {
    console.error('Direct commons search failed', err);
  }

  return [];
}
