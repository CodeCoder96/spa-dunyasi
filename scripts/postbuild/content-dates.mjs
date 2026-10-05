// data/content-dates.json (SEO-12): per page and language, the hash of everything that renders its content
// and the day that hash last changed. The sitemap's lastmod comes from here, never from the build time.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { routes } from '../../src/lib/routes.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FILE = path.join(ROOT, 'data/content-dates.json');

/** Today in Türkiye (UTC+3), as YYYY-MM-DD. */
function today() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

const readIf = async (p) => (existsSync(p) ? readFile(p, 'utf8') : '');

export async function updateContentDates() {
  const catalog = JSON.parse(await readFile(path.join(ROOT, 'data/catalog/products.json'), 'utf8'));
  const prev = existsSync(FILE) ? JSON.parse(await readFile(FILE, 'utf8')).pages ?? {} : {};
  const next = {};
  const dates = {};
  for (const r of routes) {
    const [type, key] = r.id.split(':');
    const parts = [];
    const content = (col, id) => readIf(path.join(ROOT, `src/content/${col}/${r.lang}/${id}.md`));
    if (type === 'urun') {
      parts.push(await content('products', key), JSON.stringify(catalog.find((p) => p.code === key)));
    } else if (type === 'kategori') {
      parts.push(await content('categories', key), JSON.stringify(catalog.filter((p) => p.category === key).map((p) => [p.code, p.name, p.images[0]?.sha256])));
    } else if (type === 'hizmet') parts.push(await content('services', key));
    else if (type === 'rehber') parts.push(await content('guides', key));
    else parts.push(await content('pages', key));
    if (r.id === 'sayfa:urunler') parts.push(JSON.stringify(catalog.map((p) => [p.code, p.name])));
    const hash = createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
    const k = `${r.lang}|${r.id}`;
    const old = prev[k];
    next[k] = old && old.hash === hash ? old : { hash, date: today() };
    dates[k] = next[k].date;
  }
  await writeFile(FILE, JSON.stringify({ _doc: 'SEO-12: lastmod = day the content hash changed. Commit this file.', pages: next }, null, 2) + '\n');
  return dates;
}
