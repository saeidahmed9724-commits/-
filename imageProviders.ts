// Server-side image search: several FREE sources queried in parallel and merged.
//
//   1. Wikipedia (Arabic or English, no key)  - the lead picture of the article: best for anything
//      well known (animals, foods, places, brands, people) and it understands Arabic natively. Its
//      interlanguage links also translate an Arabic query into English for the providers below.
//   2. Pexels  (free key PEXELS_API_KEY)     - clean everyday photos.
//   3. Openverse (no key; optional free OAuth) - openly licensed photos.
//   4. Wikimedia Commons (no key)             - last-resort filler.
//
// Not used on purpose: Pixabay (its terms forbid hotlinking its image URLs), Bing (API retired in
// 2025) and Google Custom Search (closed to new customers, shut down on 2027-01-01).
//
// Every provider is optional: a missing key, a timeout, a 429 or any error only drops that source.

export interface SearchImageResult {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  source: string;
  width?: number;
  height?: number;
  /** Photographer / author, when the source asks for attribution. */
  credit?: string;
  creditUrl?: string;
}

export interface SearchEnv {
  PEXELS_API_KEY?: string;
  OPENVERSE_CLIENT_ID?: string;
  OPENVERSE_CLIENT_SECRET?: string;
}

export interface SearchDeps {
  fetch: typeof fetch;
  env: SearchEnv;
}

const UA = 'GuessWhoGame/1.0 (https://github.com/saeidahmed9724-commits/-; party game image search)';
const TIMEOUT_MS = 5000;
const PER_PROVIDER = 30;

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

async function getJson(deps: SearchDeps, url: string, init: RequestInit = {}): Promise<any> {
  const res = await deps.fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers as Record<string, string>) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}`);
  return res.json();
}

// ---------------------------------------------------------------------------------------------
// Wikipedia
// ---------------------------------------------------------------------------------------------
interface WikiOut {
  results: SearchImageResult[];
  englishTitles: string[];
}

export async function wikipediaSearch(deps: SearchDeps, lang: 'ar' | 'en', q: string, offset: number, limit: number): Promise<WikiOut> {
  const n = String(Math.min(limit, PER_PROVIDER));
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '0',
    gsrlimit: n,
    gsroffset: String(offset),
    prop: 'pageimages|langlinks',
    piprop: 'thumbnail',
    pithumbsize: '640',
    pilimit: n,
    redirects: '1',
  });
  if (lang !== 'en') {
    params.set('lllang', 'en'); // gives us the English title for the same article
    params.set('lllimit', 'max');
  }
  const data = await getJson(deps, `https://${lang}.wikipedia.org/w/api.php?${params}`);
  const pages: any[] = Array.isArray(data?.query?.pages) ? data.query.pages : [];
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0)); // search rank

  const results: SearchImageResult[] = [];
  const englishTitles: string[] = [];
  for (const p of pages) {
    const en = p.langlinks?.[0]?.title ?? p.langlinks?.[0]?.['*'];
    if (en && englishTitles.length < 3) englishTitles.push(String(en));
    const t = p.thumbnail;
    if (!t?.source) continue;
    results.push({
      id: `wp-${lang}-${p.pageid}`,
      title: String(p.title ?? q),
      thumbUrl: t.source,
      fullUrl: t.source,
      source: lang === 'ar' ? 'ويكيبيديا' : 'Wikipedia',
      width: t.width,
      height: t.height,
      credit: 'Wikipedia',
      creditUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(p.title ?? '').replace(/ /g, '_'))}`,
    });
  }
  return { results, englishTitles };
}

// ---------------------------------------------------------------------------------------------
// Pexels (needs PEXELS_API_KEY; the UI shows the required link back to Pexels)
// ---------------------------------------------------------------------------------------------
export async function pexelsSearch(deps: SearchDeps, q: string, offset: number, limit: number): Promise<SearchImageResult[]> {
  const key = deps.env.PEXELS_API_KEY;
  if (!key) return [];
  const perPage = Math.min(limit, PER_PROVIDER);
  const page = Math.floor(offset / perPage) + 1;
  const data = await getJson(
    deps,
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`,
    { headers: { Authorization: key } }
  );
  const photos: any[] = Array.isArray(data?.photos) ? data.photos : [];
  return photos
    .filter((p) => p?.src?.medium)
    .map((p) => ({
      id: `px-${p.id}`,
      title: String(p.alt || q).slice(0, 80),
      thumbUrl: p.src.medium,
      fullUrl: p.src.large || p.src.medium,
      source: 'Pexels',
      width: p.width,
      height: p.height,
      credit: p.photographer,
      creditUrl: p.url,
    }));
}

// ---------------------------------------------------------------------------------------------
// Openverse (anonymous works but has small limits; free OAuth credentials raise them)
// ---------------------------------------------------------------------------------------------
let openverseToken: { value: string; expiresAt: number } | null = null;

async function openverseAuthHeader(deps: SearchDeps): Promise<Record<string, string>> {
  const { OPENVERSE_CLIENT_ID: id, OPENVERSE_CLIENT_SECRET: secret } = deps.env;
  if (!id || !secret) return {};
  if (openverseToken && openverseToken.expiresAt > Date.now() + 60_000) {
    return { Authorization: `Bearer ${openverseToken.value}` };
  }
  try {
    const res = await deps.fetch('https://api.openverse.org/v1/auth_tokens/token/', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return {};
    const t: any = await res.json();
    if (!t?.access_token) return {};
    openverseToken = { value: t.access_token, expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000 };
    return { Authorization: `Bearer ${openverseToken.value}` };
  } catch {
    return {}; // fall back to anonymous
  }
}

export function resetOpenverseTokenForTests() {
  openverseToken = null;
}

export async function openverseSearch(deps: SearchDeps, q: string, offset: number, limit: number): Promise<SearchImageResult[]> {
  const size = Math.min(limit, PER_PROVIDER);
  const page = Math.floor(offset / size) + 1;
  const data = await getJson(
    deps,
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${size}&page=${page}`,
    { headers: await openverseAuthHeader(deps) }
  );
  const items: any[] = Array.isArray(data?.results) ? data.results : [];
  return items
    .filter((i) => i?.thumbnail || i?.url)
    .map((i) => ({
      id: `ov-${i.id}`,
      title: String(i.title || q).slice(0, 80),
      thumbUrl: i.thumbnail || i.url,
      fullUrl: i.url || i.thumbnail,
      source: 'Openverse',
      width: i.width,
      height: i.height,
      credit: i.creator || undefined,
      creditUrl: i.foreign_landing_url || undefined,
    }));
}

// ---------------------------------------------------------------------------------------------
// Wikimedia Commons (files search; noisy, so it is only filler)
// ---------------------------------------------------------------------------------------------
export async function commonsSearch(deps: SearchDeps, q: string, offset: number, limit: number): Promise<SearchImageResult[]> {
  const n = String(Math.min(limit, PER_PROVIDER));
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '6',
    gsrlimit: n,
    gsroffset: String(offset),
    prop: 'imageinfo',
    iiprop: 'url|size',
    iiurlwidth: '500',
  });
  const data = await getJson(deps, `https://commons.wikimedia.org/w/api.php?${params}`);
  const pages: any[] = Array.isArray(data?.query?.pages) ? data.query.pages : [];
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out: SearchImageResult[] = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    const thumbUrl = info?.thumburl || info?.url;
    const fullUrl = info?.url || thumbUrl;
    if (!thumbUrl || /\.(pdf|ogg|ogv|webm|djvu|tiff?|svg)$/i.test(fullUrl)) continue;
    const title = String(p.title || '').replace(/^File:/i, '').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
    out.push({
      id: `cm-${p.pageid}`,
      title: (title.length > 50 ? title.slice(0, 50) + '...' : title) || q,
      thumbUrl,
      fullUrl,
      source: 'Wikimedia',
      width: info?.thumbwidth,
      height: info?.thumbheight,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------------------------
export interface SearchOutcome {
  results: SearchImageResult[];
  hasMore: boolean;
  /** For server logs: how many results each source gave, or why it was skipped. */
  providers: Record<string, number | string>;
}

const settled = async <T>(name: string, p: Promise<T>, log: Record<string, number | string>, count: (v: T) => number) => {
  try {
    const v = await p;
    log[name] = count(v);
    return v;
  } catch (err: any) {
    log[name] = `error: ${err?.message ?? err}`;
    return null;
  }
};

/** Round-robin merge so the first screen shows variety from every source. */
function interleave(lists: SearchImageResult[][], limit: number): SearchImageResult[] {
  const out: SearchImageResult[] = [];
  const seen = new Set<string>();
  const idx = lists.map(() => 0);
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (let i = 0; i < lists.length && out.length < limit; i++) {
      while (idx[i] < lists[i].length) {
        const item = lists[i][idx[i]++];
        if (seen.has(item.thumbUrl)) continue;
        seen.add(item.thumbUrl);
        out.push(item);
        progressed = true;
        break;
      }
    }
  }
  return out;
}

/**
 * @param expand  returns known English search terms for the query (the built-in Arabic dictionary)
 */
export async function searchAllProviders(
  deps: SearchDeps,
  rawQuery: string,
  offset: number,
  limit: number,
  expand: (q: string) => string[] = () => []
): Promise<SearchOutcome> {
  const q = rawQuery.trim();
  const log: Record<string, number | string> = {};
  const arabic = hasArabic(q);

  // 1) Wikipedia in the player's language. It also tells us the English title of what they meant.
  const primary =
    (await settled(arabic ? 'wikipedia-ar' : 'wikipedia-en', wikipediaSearch(deps, arabic ? 'ar' : 'en', q, offset, limit), log, (v) => v.results.length)) ??
    ({ results: [], englishTitles: [] } as WikiOut);

  // 2) English terms for the providers that only understand English.
  const englishTerms = Array.from(
    new Set([...expand(q).filter((t) => !hasArabic(t)), ...primary.englishTitles, ...(arabic ? [] : [q])])
  );
  const term = englishTerms[0] ?? null;

  const none = Promise.resolve<SearchImageResult[]>([]);
  const [wikiEn, pexels, openverse, commons] = await Promise.all([
    arabic && term
      ? settled('wikipedia-en', wikipediaSearch(deps, 'en', term, offset, limit).then((v) => v.results), log, (v) => v.length)
      : none,
    term && deps.env.PEXELS_API_KEY ? settled('pexels', pexelsSearch(deps, term, offset, limit), log, (v) => v.length) : none,
    term ? settled('openverse', openverseSearch(deps, term, offset, limit), log, (v) => v.length) : none,
    settled('commons', commonsSearch(deps, term ?? q, offset, limit), log, (v) => v.length),
  ]);
  if (!deps.env.PEXELS_API_KEY) log['pexels'] = 'skipped (no PEXELS_API_KEY)';

  const lists = [primary.results, pexels ?? [], wikiEn ?? [], openverse ?? [], commons ?? []];
  const results = interleave(lists, limit);
  const perPage = Math.min(limit, PER_PROVIDER);
  const hasMore = lists.some((l) => l.length >= perPage - 5);
  return { results, hasMore, providers: log };
}
