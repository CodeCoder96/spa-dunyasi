// Collect content image candidates per source page (KAY-09, TZK-01, TZK-06).
// Output: data/source/image-candidates.json (unmodified URLs + resolved preferred URL + cross-page counts).
import { readFile, writeFile } from 'node:fs/promises';
import { normalizeSourceUrl } from '../scrape/lib/fetch.mjs';

const ROOT = new URL('../../', import.meta.url);
const products = JSON.parse(await readFile(new URL('data/source/products.json', ROOT), 'utf8'));

/** Strip WordPress size suffixes and small-copy markers to get a file "stem" (KAY-10). */
export function stemOf(u) {
  const file = decodeURIComponent(new URL(u).pathname.split('/').pop()).toLowerCase();
  return file
    .replace(/\.(webp|jpe?g|png|gif|avif)$/, '')
    .replace(/-\d{2,5}x\d{2,5}$/, '')
    .replace(/-scaled$/, '')
    .replace(/-kucuk$/, '');
}

function preferred(img) {
  const raw = img.linked || img.srcsetWidest || img.src;
  if (!raw || raw.startsWith('data:')) return null;
  return normalizeSourceUrl(raw).replace(/\/$/, '');
}

const pages = [];
const stemPages = new Map();
for (const p of products) {
  const slug = p.url.split('/').at(-2);
  const items = [];
  for (const img of p.images) {
    const url = preferred(img);
    if (!url) continue;
    const candidates = [url];
    const m = url.match(/^(.*?)(-\d{2,5}x\d{2,5}|-kucuk)(\.\w+)$/i);
    if (m) candidates.unshift(`${m[1]}-scaled${m[3]}`, `${m[1]}${m[3]}`); // try originals first
    items.push({ group: img.group, widget: img.widget, alt: img.alt, url, candidates, stem: stemOf(url) });
  }
  for (const s of new Set(items.map((i) => i.stem))) {
    if (!stemPages.has(s)) stemPages.set(s, new Set());
    stemPages.get(s).add(slug);
  }
  pages.push({ slug, url: p.url, items, cssBackgroundImages: p.cssBackgroundImages });
}
for (const pg of pages) for (const it of pg.items) it.pagesWithStem = [...stemPages.get(it.stem)].sort();

await writeFile(new URL('data/source/image-candidates.json', ROOT), JSON.stringify(pages, null, 2));
const repeated = [...stemPages].filter(([, v]) => v.size >= 3);
const shared2 = [...stemPages].filter(([, v]) => v.size === 2);
console.log(`pages=${pages.length} images=${pages.reduce((a, p) => a + p.items.length, 0)} uniqueStems=${stemPages.size}`);
console.log('stems on >=3 pages (auto-excluded, TZK-01):', repeated.map(([k, v]) => `${k}[${[...v].join(',')}]`));
console.log('stems on 2 pages:', shared2.map(([k, v]) => `${k}[${[...v].join(',')}]`).join('\n  '));
console.log('size-suffixed urls:', pages.flatMap((p) => p.items).filter((i) => i.candidates.length > 1).length);
