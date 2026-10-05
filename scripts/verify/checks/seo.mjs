// verify:seo — runs on dist/ (KAL-10, KAL-08 meta part, SEO-03..SEO-12, MIM-07, ERS-06).
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import { routes, SITE, breadcrumb } from '../../../src/lib/routes.ts';

const ROOT = new URL('../../../', import.meta.url);
const DIST = new URL('dist/', ROOT);
const fileFor = (p) => new URL(p === '/' ? 'index.html' : p === '/en/' ? 'en/index.html' : p.slice(1), DIST);

let pagesCache = null;
async function pages() {
  if (pagesCache) return pagesCache;
  pagesCache = [];
  for (const r of routes) {
    const f = fileFor(r.path);
    if (!existsSync(f)) {
      pagesCache.push({ r, missing: true });
      continue;
    }
    pagesCache.push({ r, $: cheerio.load(await readFile(f, 'utf8')) });
  }
  return pagesCache;
}

function graphOf($) {
  const blocks = $('script[type="application/ld+json"]');
  if (!blocks.length) return null;
  return blocks.map((_, s) => JSON.parse($(s).text())).get();
}

export default [
  {
    id: 'kal-10-canonical-hreflang',
    title: 'Canonical, hreflang, robots ve dil değiştirici',
    async run(res) {
      for (const { r, $, missing } of await pages()) {
        if (missing) { res.errors.push(`${r.path}: dosya yok`); continue; }
        const can = $('link[rel="canonical"]');
        const hl = $('link[rel="alternate"][hreflang]');
        const robots = $('meta[name="robots"]').attr('content');
        if ($('html').attr('lang') !== r.lang) res.errors.push(`${r.path}: html lang ${$('html').attr('lang')}`);
        if (r.type === '404') {
          if (robots !== 'noindex,follow') res.errors.push(`${r.path}: 404 noindex değil`);
          if (hl.length) res.errors.push(`${r.path}: 404'te hreflang var`);
          continue;
        }
        if (can.length !== 1 || can.attr('href') !== SITE + r.path) res.errors.push(`${r.path}: canonical "${can.attr('href')}" (beklenen ${SITE + r.path})`);
        if (r.indexable) {
          if (robots) res.errors.push(`${r.path}: indekslenebilir sayfada robots meta var`);
          const m = Object.fromEntries(hl.map((_, l) => [$(l).attr('hreflang'), $(l).attr('href')]).get().map((x, i, a) => (i % 2 ? null : [a[i], a[i + 1]])).filter(Boolean));
          const map = {};
          hl.each((_, l) => (map[$(l).attr('hreflang')] = $(l).attr('href')));
          const trUrl = SITE + (r.lang === 'tr' ? r.path : r.altPath);
          const enUrl = SITE + (r.lang === 'en' ? r.path : r.altPath);
          if (map.tr !== trUrl || map.en !== enUrl || map['x-default'] !== enUrl || hl.length !== 3) res.errors.push(`${r.path}: hreflang ${JSON.stringify(map)}`);
          void m;
          // Reciprocity: the other language page must point back.
          if (!existsSync(fileFor(r.altPath))) res.errors.push(`${r.path}: hreflang hedefi yok ${r.altPath}`);
        } else {
          if (robots !== 'noindex,follow') res.errors.push(`${r.path}: noindex olması gereken sayfa: robots="${robots}"`);
          if (hl.length) res.errors.push(`${r.path}: noindex sayfada hreflang var`);
        }
        // Language switcher (MIM-07): same page in the other language, hreflang + lang, label.
        const sw = $('a.lang-switch').first();
        const other = r.lang === 'tr' ? 'en' : 'tr';
        if (sw.attr('href') !== r.altPath || sw.attr('hreflang') !== other || sw.attr('lang') !== other) res.errors.push(`${r.path}: dil değiştirici ${sw.attr('href')}`);
        if (!sw.text().includes(r.lang === 'tr' ? 'English' : 'Türkçe')) res.errors.push(`${r.path}: dil etiketi "${sw.text().trim()}"`);
      }
    },
  },
  {
    id: 'kal-10-sitemap',
    title: 'Sitemap = indekslenebilir sayfalar, robots.txt',
    async run(res) {
      const xml = await readFile(new URL('sitemap.xml', DIST), 'utf8');
      const $ = cheerio.load(xml, { xml: true });
      const locs = $('url > loc').map((_, l) => $(l).text()).get();
      const expected = routes.filter((r) => r.indexable).map((r) => SITE + r.path);
      for (const e of expected) if (!locs.includes(e)) res.errors.push(`sitemap'te eksik: ${e}`);
      for (const l of locs) if (!expected.includes(l)) res.errors.push(`sitemap'te fazla: ${l}`);
      if (new Set(locs).size !== locs.length) res.errors.push('sitemap tekrar eden URL');
      $('url').each((_, u) => {
        const alts = $(u).find('xhtml\\:link, link').length;
        if (alts !== 3) res.errors.push(`sitemap ${$(u).find('loc').text()}: ${alts} alternate`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test($(u).find('lastmod').text())) res.errors.push(`sitemap ${$(u).find('loc').text()}: lastmod yok`);
      });
      const robots = await readFile(new URL('robots.txt', DIST), 'utf8');
      if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`) || /Disallow:\s*\//.test(robots)) res.errors.push('robots.txt beklenen içerikte değil');
      res.info.urls = locs.length;
    },
  },
  {
    id: 'kal-10-jsonld',
    title: 'JSON-LD (@graph, zorunlu alanlar, breadcrumb eşleşmesi, FAQ tekilliği)',
    async run(res) {
      const faqSeen = new Map();
      for (const { r, $, missing } of await pages()) {
        if (missing || r.type === '404') continue;
        let blocks;
        try {
          blocks = graphOf($);
        } catch (e) {
          res.errors.push(`${r.path}: JSON-LD geçersiz JSON (${e.message})`);
          continue;
        }
        if (!blocks || blocks.length !== 1 || !Array.isArray(blocks[0]['@graph'])) {
          res.errors.push(`${r.path}: tek @graph yok`);
          continue;
        }
        const g = blocks[0]['@graph'];
        const of = (t) => g.filter((n) => n['@type'] === t);
        const org = g.find((n) => n['@id'] === `${SITE}/#org`);
        if (!org?.name || !org?.url || !org?.contactPoint?.telephone) res.errors.push(`${r.path}: Organization eksik`);
        if (r.type === 'home' && of('WebSite').length !== 1) res.errors.push(`${r.path}: WebSite yok`);
        if (r.type !== 'home') {
          const bl = of('BreadcrumbList')[0];
          const vis = $('nav.breadcrumb li').map((_, li) => $(li).text().trim()).get();
          const exp = breadcrumb(r);
          if (!bl) res.errors.push(`${r.path}: BreadcrumbList yok`);
          else {
            const names = bl.itemListElement.map((i) => i.name);
            const urls = bl.itemListElement.map((i) => i.item);
            if (JSON.stringify(names) !== JSON.stringify(vis)) res.errors.push(`${r.path}: breadcrumb görünen ${JSON.stringify(vis)} ≠ JSON-LD ${JSON.stringify(names)}`);
            if (JSON.stringify(urls) !== JSON.stringify(exp.map((x) => SITE + x.path))) res.errors.push(`${r.path}: BreadcrumbList URL'leri hatalı`);
          }
        }
        if (r.type === 'product') {
          const p = of('Product')[0];
          if (!p?.name || !p?.sku || !p?.brand?.name || !p?.image?.length || !p?.description) res.errors.push(`${r.path}: Product zorunlu alan eksik`);
          if (p && ('offers' in p || 'aggregateRating' in p || 'review' in p)) res.errors.push(`${r.path}: Product'ta offers/aggregateRating/review var`);
        }
        if ((r.type === 'category' || r.type === 'products') && !of('ItemList')[0]?.itemListElement?.length) res.errors.push(`${r.path}: ItemList yok`);
        if (r.type === 'service' && !of('Service')[0]?.provider) res.errors.push(`${r.path}: Service/provider yok`);
        if (r.type === 'guide') {
          const a = of('Article')[0];
          if (!a?.headline || !a?.datePublished || !a?.dateModified || !a?.author || !a?.publisher || !a?.image) res.errors.push(`${r.path}: Article zorunlu alan eksik`);
        }
        if (r.type === 'about' && !of('AboutPage').length) res.errors.push(`${r.path}: AboutPage yok`);
        if (r.type === 'contact' && !of('ContactPage').length) res.errors.push(`${r.path}: ContactPage yok`);
        for (const f of of('FAQPage')) {
          const visible = $('details summary').map((_, s) => $(s).text().trim()).get();
          for (const q of f.mainEntity) {
            if (!visible.includes(q.name)) res.errors.push(`${r.path}: FAQPage sorusu sayfada görünmüyor: ${q.name}`);
            const k = `${q.name}|${q.acceptedAnswer.text}`;
            if (faqSeen.has(k)) res.errors.push(`${r.path}: aynı SSS çifti ${faqSeen.get(k)} sayfasında da işaretli`);
            faqSeen.set(k, r.path);
          }
        }
      }
    },
  },
  {
    id: 'kal-10-og-meta',
    title: 'Open Graph, Twitter ve OG görselleri',
    async run(res) {
      const checked = new Set();
      for (const { r, $, missing } of await pages()) {
        if (missing) continue;
        const m = (p) => $(`meta[property="${p}"]`).attr('content');
        for (const p of ['og:title', 'og:description', 'og:url', 'og:site_name', 'og:type', 'og:locale', 'og:locale:alternate', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt'])
          if (!m(p)) res.errors.push(`${r.path}: ${p} yok`);
        if ($('meta[name="twitter:card"]').attr('content') !== 'summary_large_image') res.errors.push(`${r.path}: twitter:card`);
        if (r.type !== '404' && m('og:url') !== SITE + r.path) res.errors.push(`${r.path}: og:url ≠ canonical`);
        if (m('og:locale') !== (r.lang === 'tr' ? 'tr_TR' : 'en_GB')) res.errors.push(`${r.path}: og:locale ${m('og:locale')}`);
        if (m('og:type') !== (r.type === 'guide' ? 'article' : 'website')) res.errors.push(`${r.path}: og:type ${m('og:type')}`);
        const img = m('og:image') ?? '';
        if (!img.startsWith(`${SITE}/og/`)) {
          res.errors.push(`${r.path}: og:image yolu ${img}`);
          continue;
        }
        const rel = img.slice(SITE.length + 1);
        if (checked.has(rel)) continue;
        checked.add(rel);
        const f = new URL(rel, DIST);
        if (!existsSync(f)) {
          res.errors.push(`${r.path}: og görseli yok ${rel}`);
          continue;
        }
        const meta = await sharp(await readFile(f)).metadata();
        if (meta.format !== 'jpeg' || meta.width !== 1200 || meta.height !== 630) res.errors.push(`${rel}: ${meta.format} ${meta.width}×${meta.height}`);
        if (statSync(f).size > 200 * 1024) res.errors.push(`${rel}: ${Math.round(statSync(f).size / 1024)} KB > 200 KB`);
      }
      res.info.ogImages = checked.size;
    },
  },
  {
    id: 'kal-08-meta-headings',
    title: 'Title/description uzunluk ve tekillik, tek H1, başlık sırası',
    async run(res) {
      const seenT = new Map();
      const seenD = new Map();
      for (const { r, $, missing } of await pages()) {
        if (missing) continue;
        const title = $('title').text();
        const desc = $('meta[name="description"]').attr('content') ?? '';
        if ($('h1').length !== 1) res.errors.push(`${r.path}: ${$('h1').length} adet H1`);
        let prev = 1;
        $('main h1, main h2, main h3, main h4, main h5, main h6').each((_, h) => {
          const lvl = Number(h.tagName[1]);
          if (lvl > prev + 1) res.errors.push(`${r.path}: başlık seviyesi atlıyor (h${prev} → h${lvl}: "${$(h).text().trim().slice(0, 40)}")`);
          prev = lvl;
        });
        if (!r.indexable) continue;
        if (title.length > 60) res.errors.push(`${r.path}: title ${title.length} karakter`);
        if (r.type !== 'home' && !title.endsWith(' | Spa Dünyası')) res.errors.push(`${r.path}: title soneki yok`);
        if (desc.length < 120 || desc.length > 155) res.errors.push(`${r.path}: description ${desc.length} karakter`);
        const kt = `${r.lang}|${title}`;
        const kd = `${r.lang}|${desc}`;
        if (seenT.has(kt)) res.errors.push(`${r.path}: title ${seenT.get(kt)} ile aynı`);
        if (seenD.has(kd)) res.errors.push(`${r.path}: description ${seenD.get(kd)} ile aynı`);
        seenT.set(kt, r.path);
        seenD.set(kd, r.path);
      }
    },
  },
];
