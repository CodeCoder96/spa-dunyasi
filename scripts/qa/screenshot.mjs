// Screenshot pages from the local Apache-like server (KAL-13, PRO-10).
// Usage: node scripts/qa/screenshot.mjs [--full] [--out dir] /path.html /en/path.html ...
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const full = args.includes('--full');
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : 'reports/screenshots';
const paths = args.filter((a, i) => a.startsWith('/') && args[i - 1] !== '--out');
const base = process.env.BASE ?? 'http://localhost:4321';
const sizes = [
  { w: 375, h: 812 },
  { w: 1440, h: 900 },
];
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const name = (p === '/' ? 'tr-home' : p === '/en/' ? 'en-home' : p.replace(/^\/en\//, 'en-').replace(/^\//, 'tr-').replace(/\.html$/, '')) + `-${s.w}.png`;
    await page.screenshot({ path: `${out}/${name}`, fullPage: full });
    console.log(`${out}/${name}`);
  }
  await ctx.close();
}
await browser.close();
