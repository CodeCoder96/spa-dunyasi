// verify:output — dist tree, HTML validity, links, budgets (KAL-03, KAL-04, KAL-07 on HTML, KAL-09, PER-02).
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { HtmlValidate } from 'html-validate';
import { bannedHits } from '../../content-checks/lib.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = path.join(ROOT, 'dist');
const V1 = ['/', '/brand-cilt-bakim-koltugu.html', '/cilt-bakim-koltugu-secim-rehberi.html', '/dinlenme-yatagi-secim-rehberi.html', '/evony-dinlenme-yatagi.html', '/gizlilik.html', '/light-dinlenme-yatagi.html', '/lux-soft-masaj-yatagi.html', '/mercury-dinlenme-yatagi.html', '/mermer-dinlenme-yatagi.html', '/moon-dinlenme-yatagi.html', '/mozaik-dinlenme-yatagi.html', '/nice-masaj-yatagi.html', '/odessa-dinlenme-yatagi.html', '/rattan-sezlong.html', '/trend-masaj-yatagi.html', '/uranus-dinlenme-yatagi.html', '/venus-dinlenme-yatagi.html'];

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p) => '/' + path.relative(DIST, p).split(path.sep).join('/');
let filesCache = null;
const files = async () => (filesCache ??= await walk(DIST));
const htmlFiles = async () => (await files()).filter((f) => f.endsWith('.html'));
const toFile = (urlPath) => {
  let p = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  return path.join(DIST, p);
};

export default [
  {
    id: 'kal-03-output-tree',
    title: 'Çıktı ağacı: zorunlu/yasak dosyalar, dosya adları, v1 yolları',
    async run(res) {
      const all = (await files()).map(rel);
      const required = ['/index.html', '/en/index.html', '/404.html', '/en/404.html', '/.htaccess', '/en/.htaccess', '/_astro/.htaccess', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png'];
      for (const r of required) if (!all.includes(r)) res.errors.push(`zorunlu dosya yok: ${r}`);
      for (const v of V1) if (!existsSync(toFile(v))) res.errors.push(`v1 yolu yok: ${v}`);
      for (const f of all) {
        if (/\.(map|php|md)$/i.test(f) || /(^|\/)(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(f)) res.errors.push(`yasak dosya: ${f}`);
        const name = f.replace(/^\/_astro\/.*$/, (m) => m.toLowerCase());
        if (!/^[a-z0-9/._-]+$/.test(name)) res.errors.push(`dosya adı küçük harf ASCII değil: ${f}`);
        if (/\s/.test(f)) res.errors.push(`dosya adında boşluk: ${f}`);
      }
      if (all.some((f) => f.startsWith('/assets/'))) res.errors.push('dist içinde /assets/ klasörü var (Ek A)');
      res.info.files = all.length;
    },
  },
  {
    id: 'kal-04-html',
    title: 'html-validate, tek H1, boş alt, yer tutucu metin, yasaklı ifade (HTML)',
    async run(res) {
      const hv = new HtmlValidate({
        extends: ['html-validate:recommended'],
        rules: {
          'no-inline-style': 'error',
          'void-style': 'off',
          'attribute-boolean-style': 'off',
          'no-trailing-whitespace': 'off',
          'long-title': 'off',
          'no-redundant-role': 'off',
          'prefer-native-element': 'off',
          'attribute-empty-style': 'off',
          'valid-id': ['error', { relaxed: true }],
          // Numbers are printed with non-breaking spaces (nbsp()); the rule also flags icon whitespace and labels
          // such as "Hemen Ara" inside tel: buttons (D-018).
          'tel-non-breaking': 'off',
        },
      });
      let checked = 0;
      for (const f of await htmlFiles()) {
        const html = await readFile(f, 'utf8');
        const report = await hv.validateString(html, rel(f));
        for (const r of report.results) for (const m of r.messages) res.errors.push(`${rel(f)}:${m.line} ${m.ruleId}: ${m.message}`);
        const $ = cheerio.load(html);
        $('img[alt=""]').each((_, img) => {
          // Decorative images are allowed only inside links/cards that carry the text elsewhere or thumbnails.
          const ok = $(img).closest('.gallery__thumb, .bento__item, .inline-card, .list-card, .quote-row').length > 0 || $(img).closest('[aria-hidden="true"]').length > 0;
          if (!ok) res.errors.push(`${rel(f)}: anlamlı görselde boş alt: ${$(img).attr('src')}`);
        });
        $('script, style, noscript, template').remove();
        const text = $('body').text().replace(/\s+/g, ' ');
        for (const p of ['TODO', 'TBD', 'lorem', 'undefined', 'null', 'NaN', '{{', '}}', '[object Object]']) {
          const re = new RegExp(`(^|[^\\p{L}])${p.replace(/[[\]{}]/g, '\\$&')}($|[^\\p{L}])`, 'u');
          if (re.test(text)) res.errors.push(`${rel(f)}: yer tutucu metin "${p}"`);
        }
        const lang = $('html').attr('lang') === 'en' ? 'en' : 'tr';
        for (const h of bannedHits(text, lang)) res.errors.push(`${rel(f)}: yasaklı ifade ${h}`);
        checked++;
      }
      res.info.pages = checked;
    },
  },
  {
    id: 'kal-04-rendered-content',
    title: 'Markdown gövdeleri HTML\'e gerçekten basıldı (sessiz render hatalarına karşı)',
    async run(res) {
      // Astro logs Markdown render errors without failing the build; prove every body made it into the page.
      const { routes } = await import('../../../src/lib/routes.ts');
      const { parseContent, mdToText, wordCount } = await import('../../content-checks/lib.mjs');
      const COL = { urun: 'products', kategori: 'categories', hizmet: 'services', rehber: 'guides', sayfa: 'pages' };
      let checked = 0;
      for (const r of routes) {
        const [type, key] = r.id.split(':');
        const md = `src/content/${COL[type]}/${r.lang}/${key}.md`;
        if (!existsSync(path.join(ROOT, md))) continue;
        const words = wordCount(mdToText(parseContent(md).body));
        if (words < 20) continue;
        const html = await readFile(toFile(r.path), 'utf8');
        const $ = cheerio.load(html);
        const rendered = wordCount($('main .prose').text());
        if (rendered < words * 0.8) res.errors.push(`${r.path}: gövde ${words} kelime, sayfada ${rendered} kelime`);
        checked++;
      }
      res.info.pages = checked;
    },
  },
  {
    id: 'kal-09-links',
    title: 'İç linkler ve varlıklar mevcut, spaworld görsel linki yok, dış link biçimleri',
    async run(res) {
      const seen = new Set();
      let n = 0;
      for (const f of await htmlFiles()) {
        const $ = cheerio.load(await readFile(f, 'utf8'));
        const refs = [];
        $('a[href]').each((_, a) => refs.push(['a', $(a).attr('href')]));
        $('link[href]').each((_, l) => refs.push(['link', $(l).attr('href')]));
        $('img[src], script[src]').each((_, e) => refs.push(['src', $(e).attr('src')]));
        $('img[srcset], source[srcset]').each((_, e) => $(e).attr('srcset').split(',').forEach((s) => refs.push(['srcset', s.trim().split(/\s+/)[0]])));
        $('link[imagesrcset]').each((_, e) => $(e).attr('imagesrcset').split(',').forEach((s) => refs.push(['srcset', s.trim().split(/\s+/)[0]])));
        $('[data-quote-index]').each((_, e) => refs.push(['data', $(e).attr('data-quote-index')]));
        for (const [kind, href] of refs) {
          n++;
          if (!href) continue;
          if (/wp-content|spaworld\.com\.tr\/wp-/.test(href)) res.errors.push(`${rel(f)}: kaynak siteye görsel/dosya linki ${href}`);
          if (href.startsWith('https://spadunyasi.com.tr/')) {
            const p = href.slice('https://spadunyasi.com.tr'.length);
            if (kind !== 'link' && !existsSync(toFile(p))) res.errors.push(`${rel(f)}: mutlak iç link kırık ${href}`);
            continue;
          }
          if (href.startsWith('/') && !href.startsWith('//')) {
            const p = href.split('#')[0];
            if (!p || seen.has(p)) continue;
            seen.add(p);
            if (!existsSync(toFile(p))) res.errors.push(`${rel(f)}: kırık iç link ${href}`);
            continue;
          }
          if (href.startsWith('#')) {
            const id = href.slice(1);
            if (id && !$(`[id="${id}"]`).length) res.errors.push(`${rel(f)}: çapa hedefi yok ${href}`);
            continue;
          }
          if (/^https:\/\/wa\.me\/905343597644(\?text=[^\s]+)?$/.test(href)) continue;
          if (/^tel:\+90\d{10}$/.test(href)) continue;
          if (/^mailto:info@spaworld\.com\.tr\?subject=[^\s]+$/.test(href)) continue;
          if (href.startsWith('https://www.spaworld.com.tr')) {
            if (href !== 'https://www.spaworld.com.tr' && href !== 'https://www.spaworld.com.tr/') res.errors.push(`${rel(f)}: spaworld linki ana sayfa değil ${href}`);
            continue;
          }
          if (/^https:\/\/(www\.instagram\.com|www\.facebook\.com|www\.google\.com\/maps)\//.test(href)) continue;
          res.errors.push(`${rel(f)}: beklenmeyen link biçimi ${href}`);
        }
        // SEO-10: spaworld link only in footer and on the About page.
        $('a[href^="https://www.spaworld.com.tr"]').each((_, a) => {
          if (!$(a).closest('footer').length && !/\/(hakkimizda|en\/about)\.html$/.test(rel(f))) res.errors.push(`${rel(f)}: spaworld linki footer/Hakkımızda dışında`);
        });
        // External new-tab links carry rel=noopener (DON-01, SEO-10).
        $('a[target="_blank"]').each((_, a) => {
          if (!($(a).attr('rel') ?? '').includes('noopener')) res.errors.push(`${rel(f)}: target=_blank rel=noopener yok`);
        });
      }
      res.info.references = n;
    },
  },
  {
    id: 'per-02-budgets',
    title: 'Bütçeler (gzip): HTML ≤ 40 KB, CSS ≤ 15 KB, JS ≤ 30/15 KB, font ≤ 120 KB',
    async run(res) {
      const gz = (b) => gzipSync(b).length;
      let maxHtml = { size: 0, f: '' };
      const jsCache = new Map();
      for (const f of await htmlFiles()) {
        const html = await readFile(f);
        const g = gz(html);
        if (g > maxHtml.size) maxHtml = { size: g, f: rel(f) };
        if (g > 40 * 1024) res.errors.push(`${rel(f)}: HTML ${Math.round(g / 1024)} KB gzip > 40 KB`);
        const $ = cheerio.load(html.toString());
        const css = $('style').map((_, s) => $(s).text()).get().join('');
        let cssG = gz(Buffer.from(css));
        for (const l of $('link[rel="stylesheet"]').map((_, l) => $(l).attr('href')).get()) cssG += gz(await readFile(toFile(l)));
        if (cssG > 15 * 1024) res.errors.push(`${rel(f)}: CSS ${Math.round(cssG / 1024)} KB gzip > 15 KB`);
        let jsG = 0;
        for (const s of $('script[src]').map((_, e) => $(e).attr('src')).get()) {
          if (!jsCache.has(s)) jsCache.set(s, gz(await readFile(toFile(s))));
          jsG += jsCache.get(s);
        }
        const isProduct = $('body').attr('data-page-type') === 'product';
        const limit = (isProduct ? 30 : 15) * 1024;
        if (jsG > limit) res.errors.push(`${rel(f)}: JS ${Math.round(jsG / 1024)} KB gzip > ${limit / 1024} KB`);
      }
      const fonts = (await files()).filter((f) => f.endsWith('.woff2'));
      let fontTotal = 0;
      for (const f of fonts) fontTotal += (await stat(f)).size;
      if (fontTotal > 120 * 1024) res.errors.push(`fontlar ${Math.round(fontTotal / 1024)} KB > 120 KB`);
      res.info = { maxHtmlGzip: maxHtml, fontsKB: Math.round(fontTotal / 1024), fontFiles: fonts.length };
    },
  },
];
