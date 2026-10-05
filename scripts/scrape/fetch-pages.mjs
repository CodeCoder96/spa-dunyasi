// Fetch every discovered product page plus company/service pages into the raw cache.
import { readFile } from 'node:fs/promises';
import { cachedFetch } from './lib/fetch.mjs';

const d = JSON.parse(await readFile(new URL('../../data/source/discovery.json', import.meta.url), 'utf8'));
const extra = [
  'https://www.spaworld.com.tr/hakkimizda/',
  'https://www.spaworld.com.tr/iletisim/',
  'https://www.spaworld.com.tr/about-us/',
  'https://www.spaworld.com.tr/contact-us/',
  ...d.otherSitemaps['service-sitemap.xml'],
];
let blocked = 0;
for (const u of [...d.products.map((p) => p.url), ...extra]) {
  const r = await cachedFetch(u, { expectMarkers: u.includes('/portfolios/') ? ['portfolio', 'spaworld'] : undefined });
  if (r.blocked) blocked++;
  console.log(`${r.cached ? 'cache' : 'net  '} ${r.status} ${r.blocked ?? ''} ${u}`);
}
console.log(`done, blocked=${blocked}`);
