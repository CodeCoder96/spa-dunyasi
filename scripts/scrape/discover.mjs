// Product URL discovery (KAY-01, KAY-02).
// Union of folio-sitemap, /urunlerimiz/ list, 10 category pages and home page links.
import * as cheerio from 'cheerio';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cachedFetch, normalizeSourceUrl } from './lib/fetch.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'https://www.spaworld.com.tr';

export const CATEGORY_SLUGS = [
  'cilt-bakim-analiz-cihazlari',
  'dinlenme-yataklari',
  'havlu-ve-steril-cihazlari',
  'islak-hacim-gorsel',
  'manikur',
  'masaj-terapi-yataklari',
  'pedikur',
  'sicak-tas-isitici-setler',
  'tabureler',
  'yardimci',
];

// Appendix B (2026-10-03). `true` = only in sitemap.
const APPENDIX_B = {
  'afuzyondus-mozaik-ve-mermer': false, 'afuzyondus-wood': false, 'agda-isitici': false,
  'avant-masaj-yatagi': false, 'ayurveda-masaj-yatagi': false, 'base-w-masaj-yatagi': false,
  'base-x-cube-masaj-yatagi': false, 'base-x-masaj-yatagi': false, 'base-x-square-masaj-yatagi': false,
  bolster: false, 'brand-bakim-koltugu': false, 'classic-masaj-yatagi': false,
  'comfort-masaj-yatagi': false, 'dynamic-masaj-yatagi': false, etejer: false,
  'evony-dinlenme-yatagi': false, 'havlu-isitici': true, 'havlu-sogutucu': false,
  'high-masaj-yatagi': false, 'islak-hacim-urunleri': false, 'kafa-masaj-yatagi': true,
  'light-dinlenme-yatagi': false, 'line-masaj-yatagi': false, 'lux-soft-masaj-yatagi': false,
  'manikur-koltugu': true, 'manikur-masasi-glass': true, 'manikur-masasi-light': true,
  'manikur-masasi-wood': true, 'mayo-kurutucu': true, mercury: false,
  'mermer-dinlenme-yatagi': false, 'mini-manikur-masasi': true, moon: true,
  'mozaik-dinlenme-yatagi': false, 'nice-masaj-yatagi': false, odessa: false,
  'ozon-kapsul': true, 'pedikur-light': true, 'pedikur-spa': true, 'pedikur-spa-life': true,
  'pedikur-wood': true, 'podology-care-chair': false, 'rattan-sezlong': false,
  'soft-masaj-yatagi': false, 'space-masaj-yatagi': false, 'steril-cihazi': true,
  tabure: false, 'tas-isitici-cihazi-pan': true, 'tas-seti-volkanik': true,
  'thai-yatagi': false, 'towel-warmer': true, 'towel-warmer-wood': true,
  'trend-masaj-yatagi': true, 'trend-tuz-kum-yatagi': false, 'uranus-dinlenme-yatagi': false,
  'venus-dinlenme-yatagi': false, 'wet-areas': true, 'yag-ve-tas-isitici-cihazi': true,
  'yardimci-urunler': false,
};

const isProductUrl = (u) => /^https:\/\/www\.spaworld\.com\.tr\/portfolios\/[^/]+\/$/.test(u);
const slugOf = (u) => u.split('/').filter(Boolean).pop();

function locs(xml) {
  const $ = cheerio.load(xml, { xml: true });
  return $('loc').map((_, el) => $(el).text().trim()).get();
}

function productLinks(html, { skipNav = true } = {}) {
  const $ = cheerio.load(html);
  const out = new Set();
  $('a[href]').each((_, a) => {
    // Header/main-menu links are not list membership (e.g. islak-hacim-urunleri sits in the menu).
    if (skipNav && $(a).closest('nav, header, footer, .header-inner').length) return;
    const href = $(a).attr('href');
    if (!href || !href.includes('/portfolios/')) return;
    try {
      const n = normalizeSourceUrl(href);
      if (isProductUrl(n)) out.add(n);
    } catch {}
  });
  return [...out];
}

export async function discover() {
  const sources = new Map(); // url -> Set(source)
  const add = (u, src) => {
    if (!sources.has(u)) sources.set(u, new Set());
    sources.get(u).add(src);
  };

  const index = await cachedFetch(`${BASE}/sitemap_index.xml`);
  const subs = locs(index.body).map(normalizeSourceUrl);
  const sitemaps = {};
  for (const s of subs) {
    const r = await cachedFetch(s);
    sitemaps[s.split('/').pop()] = locs(r.body).map(normalizeSourceUrl);
  }
  const folio = sitemaps['folio-sitemap.xml'] ?? [];
  const archive = folio.filter((u) => !isProductUrl(u));
  for (const u of folio.filter(isProductUrl)) add(u, 'sitemap');

  const list = await cachedFetch(`${BASE}/urunlerimiz/`);
  for (const u of productLinks(list.body)) add(u, 'liste');

  const categories = {};
  for (const c of CATEGORY_SLUGS) {
    // Category archives are paginated (/page/N/); follow until there is no next page.
    const found = new Set();
    for (let page = 1; page < 20; page++) {
      const url = page === 1 ? `${BASE}/folio_cat/${c}/` : `${BASE}/folio_cat/${c}/page/${page}/`;
      const r = await cachedFetch(url);
      if (r.status !== 200) break;
      for (const u of productLinks(r.body)) found.add(u);
      if (!r.body.includes(`/folio_cat/${c}/page/${page + 1}/`)) break;
    }
    categories[c] = [...found].sort();
    for (const u of categories[c]) add(u, `kategori:${c}`);
  }

  const home = await cachedFetch(`${BASE}/`);
  for (const u of productLinks(home.body, { skipNav: false })) add(u, 'anasayfa');

  const urls = [...sources.keys()].sort();
  const live = new Set(urls.map(slugOf));
  const expected = new Set(Object.keys(APPENDIX_B));
  const diff = {
    added: [...live].filter((s) => !expected.has(s)),
    missing: [...expected].filter((s) => !live.has(s)),
    onlySitemapLive: urls.filter((u) => [...sources.get(u)].every((s) => s === 'sitemap')).map(slugOf),
  };

  const result = {
    discoveredAt: new Date().toISOString(),
    total: urls.length,
    archiveExcluded: archive,
    otherSitemaps: Object.fromEntries(Object.entries(sitemaps).filter(([k]) => k !== 'folio-sitemap.xml')),
    categories,
    products: urls.map((u) => ({ url: u, slug: slugOf(u), sources: [...sources.get(u)].sort() })),
    appendixBDiff: diff,
  };
  await mkdir(`${ROOT}data/source`, { recursive: true });
  await writeFile(`${ROOT}data/source/discovery.json`, JSON.stringify(result, null, 2));
  return result;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const r = await discover();
  console.log(`total=${r.total} archive=${r.archiveExcluded.length}`);
  console.log('appendix B diff:', JSON.stringify(r.appendixBDiff));
  console.log('category counts:', Object.fromEntries(Object.entries(r.categories).map(([k, v]) => [k, v.length])));
}
