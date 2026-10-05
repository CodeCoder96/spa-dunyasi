// reports/v1-temizlik-listesi.txt (TES-05): files referenced by the live v1 pages that the new build does not
// contain, so they can be deleted from public_html after upload. Read-only, one request at a time.
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as cheerio from 'cheerio';

const BASE = 'https://spadunyasi.com.tr';
const V1 = ['/', '/brand-cilt-bakim-koltugu.html', '/cilt-bakim-koltugu-secim-rehberi.html', '/dinlenme-yatagi-secim-rehberi.html', '/evony-dinlenme-yatagi.html', '/gizlilik.html', '/light-dinlenme-yatagi.html', '/lux-soft-masaj-yatagi.html', '/mercury-dinlenme-yatagi.html', '/mermer-dinlenme-yatagi.html', '/moon-dinlenme-yatagi.html', '/mozaik-dinlenme-yatagi.html', '/nice-masaj-yatagi.html', '/odessa-dinlenme-yatagi.html', '/rattan-sezlong.html', '/trend-masaj-yatagi.html', '/uranus-dinlenme-yatagi.html', '/venus-dinlenme-yatagi.html'];
const refs = new Set();
const fetched = [];
for (const p of V1) {
  await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
  try {
    const res = await fetch(BASE + p, { headers: { 'User-Agent': 'spadunyasi-v1-cleanup/1.0' } });
    fetched.push(`${p} ${res.status}`);
    if (!res.ok) continue;
    const $ = cheerio.load(await res.text());
    $('[src], [href], [srcset], [data-src]').each((_, el) => {
      for (const a of ['src', 'href', 'data-src']) {
        const v = $(el).attr(a);
        if (v) refs.add(v);
      }
      for (const part of ($(el).attr('srcset') ?? '').split(',')) if (part.trim()) refs.add(part.trim().split(/\s+/)[0]);
    });
  } catch (e) {
    fetched.push(`${p} HATA ${e.message}`);
  }
}
const local = [...refs]
  .map((u) => {
    try {
      const url = new URL(u, BASE);
      return url.hostname.replace(/^www\./, '') === 'spadunyasi.com.tr' ? decodeURIComponent(url.pathname) : null;
    } catch {
      return null;
    }
  })
  .filter((p) => p && p !== '/' && !p.endsWith('.html'));
const missing = [...new Set(local)].filter((p) => !existsSync(`dist${p}`)).sort();
const dirs = [...new Set(missing.map((p) => p.split('/')[1]).filter((d) => d && missing.some((m) => m.startsWith(`/${d}/`))))];
const lines = [
  '# v1 temizlik listesi (TES-05)',
  `# Üretim: ${new Date().toISOString().slice(0, 10)}. Canlı v1 sayfalarından okundu: ${fetched.length} sayfa.`,
  '# Bu dosyalar yeni sitede kullanılmıyor; yükleme bittikten SONRA public_html içinden silinebilir.',
  '# DOKUNMAYIN: .well-known/, cgi-bin/, google*.html doğrulama dosyaları.',
  '',
  ...(dirs.length ? ['# Tamamen silinebilecek klasörler:', ...dirs.map((d) => `/${d}/`), ''] : []),
  '# Tek tek dosyalar:',
  ...missing,
  '',
  '# Okunan sayfalar:',
  ...fetched.map((f) => `#   ${f}`),
];
await writeFile('reports/v1-temizlik-listesi.txt', lines.join('\n') + '\n');
console.log(`v1 refs=${refs.size} local=${local.length} missing=${missing.length} dirs=${dirs.join(',')}`);
