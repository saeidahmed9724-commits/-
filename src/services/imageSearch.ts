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

/**
 * Searches images using the backend proxy endpoint, with direct client fallback to Wikimedia Commons
 */
export async function searchImages(
  query: string,
  offset: number = 0,
  limit: number = 60
): Promise<{ items: SearchImageItem[]; hasMore: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return { items: [], hasMore: false };

  // Try backend proxy first
  try {
    const res = await fetch(
      `/api/search-images?q=${encodeURIComponent(trimmed)}&offset=${offset}&limit=${limit}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return { items: data.results, hasMore: Boolean(data.hasMore) };
      }
    }
  } catch (e) {
    console.warn('Backend image search failed, trying direct client fetch...', e);
  }

  // Fallback: Direct Wikimedia Commons query (CORS enabled by origin=*)
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      trimmed
    )}&gsrnamespace=6&gsrlimit=${Math.min(limit, 60)}&gsroffset=${offset}&prop=imageinfo&iiprop=url|size&iiurlwidth=500&format=json&origin=*`;
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
      return { items: results, hasMore: results.length >= 20 };
    }
  } catch (err) {
    console.error('Direct commons search failed', err);
  }

  return { items: [], hasMore: false };
}
