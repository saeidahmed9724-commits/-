// Offline tests for the image search providers (the API responses are mocked with the shapes
// documented by MediaWiki, Pexels and Openverse). Run: npm run test:search
import assert from 'node:assert/strict';
import { searchAllProviders, resetOpenverseTokenForTests, type SearchDeps } from '../imageProviders';

// AbortSignal.timeout() timers are unref'd: keep the process alive while the timeout test waits.
const keepAlive = setInterval(() => {}, 1000);
let pass = 0;
let fail = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass++;
    console.log('PASS -', name);
  } catch (e: any) {
    fail++;
    console.log('FAIL -', name, '\n      ', e?.message);
  }
}

interface Call { url: URL; init?: RequestInit }
type Handler = (u: URL, init?: RequestInit) => Response | Promise<Response> | undefined;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function makeDeps(handlers: Handler[], env: SearchDeps['env'] = {}) {
  const calls: Call[] = [];
  const fetchMock = (async (input: any, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push({ url, init });
    for (const h of handlers) {
      const r = await h(url, init);
      if (r) return r;
    }
    return json({}, 404);
  }) as unknown as typeof fetch;
  return { deps: { fetch: fetchMock, env } as SearchDeps, calls };
}

// ---- realistic mocked responses ----
const wikiPage = (lang: string, id: number, title: string, index: number, img?: string, en?: string) => ({
  pageid: id, ns: 0, title, index,
  ...(img ? { thumbnail: { source: img, width: 640, height: 480 } } : {}),
  ...(en ? { langlinks: [{ lang: 'en', title: en }] } : {}),
});
const wikiHandler: Handler = (u) => {
  if (u.host === 'ar.wikipedia.org') {
    return json({ query: { pages: [
      wikiPage('ar', 2, 'قطط', 2, 'https://upload.wikimedia.org/ar-cats.jpg', 'Cat'),
      wikiPage('ar', 1, 'قطة', 1, 'https://upload.wikimedia.org/ar-cat.jpg', 'Cat'),
      wikiPage('ar', 3, 'صفحة بلا صورة', 3, undefined, 'No image page'),
    ] } });
  }
  if (u.host === 'en.wikipedia.org') {
    return json({ query: { pages: [wikiPage('en', 10, 'Cat', 1, 'https://upload.wikimedia.org/en-cat.jpg')] } });
  }
};
const pexelsHandler: Handler = (u) => {
  if (u.host === 'api.pexels.com') {
    return json({ photos: [
      { id: 7, width: 4000, height: 3000, url: 'https://www.pexels.com/photo/7/', photographer: 'Ann', alt: 'A cat on a sofa', src: { medium: 'https://images.pexels.com/7-m.jpg', large: 'https://images.pexels.com/7-l.jpg' } },
      { id: 8, width: 100, height: 100, url: 'https://www.pexels.com/photo/8/', photographer: 'Bob', alt: '', src: { medium: 'https://images.pexels.com/8-m.jpg', large: 'https://images.pexels.com/8-l.jpg' } },
    ] });
  }
};
const openverseHandler: Handler = (u) => {
  if (u.host === 'api.openverse.org' && u.pathname === '/v1/images/') {
    return json({ results: [{ id: 'abc', title: 'Cat photo', thumbnail: 'https://api.openverse.org/v1/images/abc/thumb/', url: 'https://flickr.example/abc.jpg', creator: 'Cy', foreign_landing_url: 'https://flickr.example/abc', width: 800, height: 600 }] });
  }
};
const commonsHandler: Handler = (u) => {
  if (u.host === 'commons.wikimedia.org') {
    return json({ query: { pages: [
      { pageid: 55, index: 1, title: 'File:Cat-pic.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/c-thumb.jpg', url: 'https://upload.wikimedia.org/c.jpg', thumbwidth: 500, thumbheight: 400 }] },
      { pageid: 56, index: 2, title: 'File:Diagram.svg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/d-thumb.png', url: 'https://upload.wikimedia.org/d.svg' }] },
    ] } });
  }
};
const all = [wikiHandler, pexelsHandler, openverseHandler, commonsHandler];

await test('Arabic query: Arabic Wikipedia first, its English title feeds the English-only sources', async () => {
  const { deps, calls } = makeDeps(all, { PEXELS_API_KEY: 'k' });
  const out = await searchAllProviders(deps, 'قطة', 0, 60);
  const arCall = calls.find((c) => c.url.host === 'ar.wikipedia.org')!;
  assert.equal(arCall.url.searchParams.get('gsrsearch'), 'قطة');
  assert.equal(arCall.url.searchParams.get('lllang'), 'en');
  assert.equal(arCall.url.searchParams.get('formatversion'), '2');
  assert.equal(calls.find((c) => c.url.host === 'api.pexels.com')!.url.searchParams.get('query'), 'Cat');
  assert.equal(calls.find((c) => c.url.pathname === '/v1/images/')!.url.searchParams.get('q'), 'Cat');
  assert.ok(out.results.length >= 5);
  assert.equal(out.results[0].title, 'قطة', 'Wikipedia results are ordered by search rank');
  assert.ok(!out.results.some((r) => r.title === 'صفحة بلا صورة'), 'pages without a picture are dropped');
});

await test('every result has a source label and real image URLs; attribution is kept', async () => {
  const { deps } = makeDeps(all, { PEXELS_API_KEY: 'k' });
  const out = await searchAllProviders(deps, 'cat', 0, 60);
  for (const r of out.results) {
    assert.ok(r.source && /^https:\/\//.test(r.thumbUrl) && /^https:\/\//.test(r.fullUrl), JSON.stringify(r));
  }
  const px = out.results.find((r) => r.source === 'Pexels')!;
  assert.equal(px.credit, 'Ann');
  assert.equal(px.creditUrl, 'https://www.pexels.com/photo/7/');
  assert.equal(px.fullUrl, 'https://images.pexels.com/7-l.jpg');
  assert.equal(out.results.find((r) => r.source === 'Openverse')!.credit, 'Cy');
});

await test('English query goes to English Wikipedia (not Arabic) and Pexels gets the same words', async () => {
  const { deps, calls } = makeDeps(all, { PEXELS_API_KEY: 'k' });
  await searchAllProviders(deps, 'cat', 0, 60);
  assert.ok(calls.some((c) => c.url.host === 'en.wikipedia.org'));
  assert.ok(!calls.some((c) => c.url.host === 'ar.wikipedia.org'));
  assert.equal(calls.find((c) => c.url.host === 'api.pexels.com')!.url.searchParams.get('query'), 'cat');
});

await test('Pexels: key sent as Authorization header, never in the URL', async () => {
  const { deps, calls } = makeDeps(all, { PEXELS_API_KEY: 'SECRETKEY' });
  await searchAllProviders(deps, 'cat', 0, 60);
  const c = calls.find((x) => x.url.host === 'api.pexels.com')!;
  assert.equal((c.init!.headers as any).Authorization, 'SECRETKEY');
  assert.ok(!c.url.toString().includes('SECRETKEY'));
});

await test('no PEXELS_API_KEY: Pexels is skipped (no request) and the others still answer', async () => {
  const { deps, calls } = makeDeps(all, {});
  const out = await searchAllProviders(deps, 'cat', 0, 60);
  assert.ok(!calls.some((c) => c.url.host === 'api.pexels.com'));
  assert.ok(out.results.length > 0);
  assert.match(String(out.providers['pexels']), /skipped/);
});

await test('one provider failing (429 / network error) does not break the search', async () => {
  const failing: Handler = (u) => (u.host === 'api.pexels.com' ? json({}, 429) : u.host === 'api.openverse.org' ? Promise.reject(new Error('boom')) : undefined);
  const { deps } = makeDeps([failing, ...all], { PEXELS_API_KEY: 'k' });
  const out = await searchAllProviders(deps, 'cat', 0, 60);
  assert.ok(out.results.some((r) => r.source === 'Wikipedia'));
  assert.match(String(out.providers['pexels']), /error/);
  assert.match(String(out.providers['openverse']), /error/);
});

await test('a provider that HANGS is cut off by the timeout; the rest still answer', async () => {
  const hang: Handler = (u, init) =>
    u.host === 'api.pexels.com'
      ? new Promise<Response>((_, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('aborted by timeout'))))
      : undefined;
  const { deps } = makeDeps([hang, ...all], { PEXELS_API_KEY: 'k' });
  const t0 = Date.now();
  const out = await searchAllProviders(deps, 'cat', 0, 60);
  const ms = Date.now() - t0;
  assert.ok(ms >= 4500 && ms < 8000, `took ${ms}ms`);
  assert.ok(out.results.some((r) => r.source === 'Wikipedia'));
  assert.match(String(out.providers['pexels']), /error/);
});

await test('everything down: empty result, no exception', async () => {
  const { deps } = makeDeps([() => json({}, 500)], { PEXELS_API_KEY: 'k' });
  const out = await searchAllProviders(deps, 'قطة', 0, 60);
  assert.deepEqual(out.results, []);
});

await test('Openverse OAuth: token requested once (form-encoded), reused as Bearer', async () => {
  resetOpenverseTokenForTests();
  const tokenHandler: Handler = (u, init) =>
    u.pathname === '/v1/auth_tokens/token/' ? json({ access_token: 'TOK', expires_in: 36000, token_type: 'Bearer' }) : undefined;
  const { deps, calls } = makeDeps([tokenHandler, ...all], { OPENVERSE_CLIENT_ID: 'id', OPENVERSE_CLIENT_SECRET: 'sec' });
  await searchAllProviders(deps, 'cat', 0, 60);
  await searchAllProviders(deps, 'dog', 0, 60);
  const tokenCalls = calls.filter((c) => c.url.pathname === '/v1/auth_tokens/token/');
  assert.equal(tokenCalls.length, 1, 'token is cached');
  assert.equal((tokenCalls[0].init!.headers as any)['Content-Type'], 'application/x-www-form-urlencoded');
  const body = String(tokenCalls[0].init!.body);
  assert.ok(body.includes('grant_type=client_credentials') && body.includes('client_id=id'));
  const search = calls.filter((c) => c.url.pathname === '/v1/images/');
  assert.ok(search.every((c) => (c.init!.headers as any).Authorization === 'Bearer TOK'));
});

await test('Openverse OAuth failure falls back to anonymous instead of failing', async () => {
  resetOpenverseTokenForTests();
  const badToken: Handler = (u) => (u.pathname === '/v1/auth_tokens/token/' ? json({ detail: 'nope' }, 401) : undefined);
  const { deps } = makeDeps([badToken, ...all], { OPENVERSE_CLIENT_ID: 'id', OPENVERSE_CLIENT_SECRET: 'sec' });
  const out = await searchAllProviders(deps, 'cat', 0, 60);
  assert.ok(out.results.some((r) => r.source === 'Openverse'));
});

await test('pagination: offset becomes the right page / gsroffset for each provider', async () => {
  const { deps, calls } = makeDeps(all, { PEXELS_API_KEY: 'k' });
  await searchAllProviders(deps, 'cat', 60, 60);
  assert.equal(calls.find((c) => c.url.host === 'api.pexels.com')!.url.searchParams.get('page'), '3');
  assert.equal(calls.find((c) => c.url.pathname === '/v1/images/')!.url.searchParams.get('page'), '3');
  assert.equal(calls.find((c) => c.url.host === 'en.wikipedia.org')!.url.searchParams.get('gsroffset'), '60');
});

await test('dedupes identical images and respects the limit; SVG files from Commons are dropped', async () => {
  const dup: Handler = (u) =>
    u.host === 'en.wikipedia.org' ? json({ query: { pages: [wikiPage('en', 1, 'Cat', 1, 'https://x/same.jpg')] } }) :
    u.host === 'commons.wikimedia.org' ? json({ query: { pages: [{ pageid: 1, index: 1, title: 'File:a.jpg', imageinfo: [{ thumburl: 'https://x/same.jpg', url: 'https://x/same.jpg' }] },
                                                                   { pageid: 2, index: 2, title: 'File:b.svg', imageinfo: [{ thumburl: 'https://x/b.png', url: 'https://x/b.svg' }] }] } }) : undefined;
  const { deps } = makeDeps([dup, ...all], { PEXELS_API_KEY: 'k' });
  const out = await searchAllProviders(deps, 'cat', 0, 60);
  assert.equal(out.results.filter((r) => r.thumbUrl === 'https://x/same.jpg').length, 1);
  assert.ok(!out.results.some((r) => r.thumbUrl === 'https://x/b.png'));
  const small = await searchAllProviders(deps, 'cat', 0, 2);
  assert.equal(small.results.length, 2);
});

await test('the built-in Arabic dictionary is used when Wikipedia gives no English title', async () => {
  const noLinks: Handler = (u) => (u.host === 'ar.wikipedia.org' ? json({ query: { pages: [wikiPage('ar', 1, 'برجر', 1, 'https://x/b.jpg')] } }) : undefined);
  const { deps, calls } = makeDeps([noLinks, ...all], { PEXELS_API_KEY: 'k' });
  await searchAllProviders(deps, 'برجر', 0, 60, () => ['burger hamburger', 'برجر']);
  assert.equal(calls.find((c) => c.url.host === 'api.pexels.com')!.url.searchParams.get('query'), 'burger hamburger');
});

await test('Pixabay (hotlinking forbidden), Bing and Google CSE are never called', async () => {
  const { deps, calls } = makeDeps(all, { PEXELS_API_KEY: 'k' });
  await searchAllProviders(deps, 'قطة', 0, 60);
  await searchAllProviders(deps, 'cat', 0, 60);
  assert.ok(!calls.some((c) => /pixabay|bing|googleapis/.test(c.url.host)));
});

console.log(`\nSUMMARY: ${pass}/${pass + fail} passed`);
clearInterval(keepAlive);
process.exit(fail ? 1 : 0);
