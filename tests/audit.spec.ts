// Site-wide audits over every built page, both languages:
// KAL-11 axe-core (serious/critical = fail, moderate = report), KAL-15 console errors / CSP violations / 404s,
// KAL-13 visual QA (screenshots at 375×812 and 1440×900, no horizontal scroll at 320 px, no broken images,
// no overlapping interactive elements in the viewport).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { allPaths } from './helpers.ts';

const PATHS = allPaths();
const shotName = (p: string) => (p === '/' ? 'tr-home' : p === '/en/' ? 'en-home' : p.replace(/^\/en\//, 'en-').replace(/^\//, 'tr-').replace(/\.html$/, ''));
mkdirSync('reports/axe', { recursive: true });
mkdirSync('reports/screenshots', { recursive: true });
mkdirSync('reports/qa', { recursive: true });

async function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/404.html')) problems.push(`${r.status()} ${r.url()}`);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
  });
  return problems;
}

for (const path of PATHS) {
  test(`audit ${path}`, async ({ page }) => {
    const is404 = path.endsWith('404.html');
    const problems = await collectProblems(page);

    // --- 1440 × 900
    await page.setViewportSize({ width: 1440, height: 900 });
    const res = await page.goto(path, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(is404 ? 200 : 200); // the 404 page file itself is served with 200 at its own path
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `reports/screenshots/${shotName(path)}-1440.png` });

    // KAL-11 axe (desktop)
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const severe = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const moderate = axe.violations.filter((v) => v.impact === 'moderate' || v.impact === 'minor');
    writeFileSync(
      `reports/axe/${shotName(path)}.json`,
      JSON.stringify({ path, severe: severe.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) })), moderate: moderate.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) }, null, 2),
    );

    // KAL-13 broken images + overlapping interactive elements (desktop)
    const qaDesktop = await page.evaluate(qaProbe);

    // --- 375 × 812
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.screenshot({ path: `reports/screenshots/${shotName(path)}-375.png` });
    const qaMobile = await page.evaluate(qaProbe);

    // --- 320: no horizontal scrolling (SC 1.4.10)
    await page.setViewportSize({ width: 320, height: 700 });
    await page.waitForTimeout(50);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    writeFileSync(`reports/qa/${shotName(path)}.json`, JSON.stringify({ path, qaDesktop, qaMobile, overflow320: overflow, problems }, null, 2));
    expect.soft(severe.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), 'axe serious/critical').toEqual([]);
    expect.soft(problems, 'console/CSP/404').toEqual([]);
    expect.soft(overflow, 'horizontal overflow at 320px').toBeLessThanOrEqual(0);
    expect.soft([...qaDesktop.broken, ...qaMobile.broken], 'broken images').toEqual([]);
    expect.soft([...qaDesktop.overlaps, ...qaMobile.overlaps], 'overlapping interactive elements').toEqual([]);
  });
}

/** Runs in the page: broken images and overlapping visible interactive elements. */
function qaProbe() {
  const broken: string[] = [];
  for (const img of Array.from(document.images)) {
    if (img.closest('dialog') || img.loading === 'lazy') continue; // lazy ones are checked by KAL-09 (file exists)
    if (img.complete && img.naturalWidth === 0) broken.push(img.currentSrc || img.src);
  }
  /** Visible rectangle: the element box intersected with every clipping (overflow ≠ visible) ancestor and the viewport. */
  const visibleRect = (el: Element) => {
    const r = el.getBoundingClientRect();
    let left = Math.max(r.left, 0);
    let top = Math.max(r.top, 0);
    let right = Math.min(r.right, innerWidth);
    let bottom = Math.min(r.bottom, innerHeight);
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      left = Math.max(left, ar.left);
      top = Math.max(top, ar.top);
      right = Math.min(right, ar.right);
      bottom = Math.min(bottom, ar.bottom);
    }
    return { left, top, right, bottom };
  };
  const vis = (el: Element) => {
    const v = visibleRect(el);
    return v.right - v.left > 0 && v.bottom - v.top > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const items = Array.from(document.querySelectorAll('a[href], button, input, summary, [tabindex="0"]')).filter(
    (el) => vis(el) && !el.closest('dialog, [popover], .skip-link') && !el.matches('.skip-link, .pcard__link, .bento__link, .guide-card a, .list-card a'),
  );
  const overlaps: string[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const ra = visibleRect(a);
      const rb = visibleRect(b);
      const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ix > 4 && iy > 4) {
        // fixed bars legitimately overlap scrolled content
        if (a.closest('[data-mobile-bar], [data-header]') || b.closest('[data-mobile-bar], [data-header]')) continue;
        overlaps.push(`${a.tagName}.${a.className} × ${b.tagName}.${b.className}`);
      }
    }
  }
  return { broken, overlaps };
}
