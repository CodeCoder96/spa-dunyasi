// docs/keyword-map.csv (SEO-01): one row per indexable page, ';'-separated, UTF-8 with BOM.
// Primary/secondary keywords come from each content file's front matter. No search-volume data exists,
// so every row is marked as an estimate to be revisited with Search Console data after launch.
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { routes } from '../../src/lib/routes.ts';
import { parseContent } from '../content-checks/lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPE = { home: 'ana sayfa', products: 'ürün listesi', category: 'kategori', product: 'ürün', services: 'hizmet listesi', service: 'hizmet', guides: 'rehber listesi', guide: 'rehber', about: 'hakkımızda', contact: 'iletişim', faq: 'sss' };

function contentPath(r) {
  const [type, key] = r.id.split(':');
  const col = { urun: 'products', kategori: 'categories', hizmet: 'services', rehber: 'guides', sayfa: 'pages' }[type];
  return `src/content/${col}/${r.lang}/${key}.md`;
}

export async function writeKeywordMap() {
  const cell = (s) => (/[;"\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const rows = [['yol', 'dil', 'sayfa tipi', 'ana kelime', 'yan kelimeler', 'arama niyeti', 'not']];
  const missing = [];
  for (const r of routes.filter((x) => x.indexable)) {
    const p = contentPath(r);
    if (!existsSync(new URL(p, `file:///${ROOT.replace(/\\/g, '/')}`))) {
      missing.push(p);
      continue;
    }
    const kw = parseContent(p).fm.keyword;
    if (!kw?.primary) {
      missing.push(`${p} (keyword)`);
      continue;
    }
    rows.push([r.path, r.lang, TYPE[r.type] ?? r.type, kw.primary, (kw.secondary ?? []).join(', '), kw.intent ?? '', 'tahmin: arama hacmi verisi yok; yayın sonrası Search Console ile güncellenecek']);
  }
  await writeFile(new URL('docs/keyword-map.csv', `file:///${ROOT.replace(/\\/g, '/')}`), '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n');
  return { rows: rows.length - 1, missing };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const r = await writeKeywordMap();
  console.log(`keyword-map rows=${r.rows} missing=${r.missing.length}`);
}
