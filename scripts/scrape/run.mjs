// npm run scrape [-- --refresh]: discovery → page fetch → raw parse → images → PDF → catalog.
// Every network request goes through the polite cached fetcher (KUR-12). --refresh bypasses the cache.
import { spawnSync } from 'node:child_process';

const flags = process.argv.slice(2);
const steps = [
  'scripts/scrape/discover.mjs',
  'scripts/scrape/fetch-pages.mjs',
  'scripts/scrape/parse.mjs',
  'scripts/images/collect.mjs',
  'scripts/images/download.mjs',
  'scripts/scrape/pdf.mjs',
  'scripts/catalog/build.mjs',
  'scripts/images/site-images.mjs',
  'scripts/catalog/derived-facts.mjs',
];
for (const s of steps) {
  console.log(`\n▶ ${s}`);
  const r = spawnSync(process.execPath, [s, ...flags], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`✗ ${s} failed (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}
console.log('\nscrape OK');
