// KAL-16: consent + GA4 on the test build (G-TEST000000, analytics hostname "localhost", dist-ga-test/).
import { test, expect, type Page } from '@playwright/test';

const GOOGLE = /google-analytics\.com|googletagmanager\.com|analytics\.google\.com|doubleclick\.net/;

async function watchGoogle(page: Page) {
  const hits: string[] = [];
  page.on('request', (r) => {
    if (GOOGLE.test(r.url())) hits.push(r.url());
  });
  // Never hit the network: answer gtag.js with an inert stub that keeps dataLayer for inspection.
  await page.context().route(GOOGLE, (r) => r.fulfill({ contentType: 'text/javascript', body: '/* gtag stub */' }));
  await page.context().route('https://wa.me/**', (r) => r.fulfill({ body: 'ok' }));
  return hits;
}

test('no request to Google before consent; banner is compact with equal buttons', async ({ page }) => {
  const hits = await watchGoogle(page);
  await page.goto('/mercury-dinlenme-yatagi.html');
  const banner = page.locator('[data-cookie-banner]');
  await expect(banner).toBeVisible();
  const accept = banner.locator('[data-consent="granted"]');
  const reject = banner.locator('[data-consent="denied"]');
  expect(await accept.getAttribute('class')).toBe(await reject.getAttribute('class'));
  const box = await banner.boundingBox();
  expect(box!.height).toBeLessThan(260);
  await page.locator('[data-quote-form] [data-quote-add="SD-024"]').click();
  await page.reload();
  expect(hits).toEqual([]);
});

test('accept loads gtag with consent defaults and tracks a WhatsApp click', async ({ page }) => {
  const hits = await watchGoogle(page);
  await page.goto('/mercury-dinlenme-yatagi.html');
  await page.locator('[data-consent="granted"]').click();
  await expect.poll(() => hits.some((u) => u.includes('googletagmanager.com/gtag/js?id=G-TEST000000'))).toBe(true);
  const consent = await page.evaluate(() => (window.dataLayer as IArguments[]).map((a) => Array.from(a)).find((a) => a[0] === 'consent'));
  expect(consent).toEqual(['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' }]);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('a[data-cta="product_main"][href^="https://wa.me/"]').click()]);
  await popup.close();
  const ev = await page.evaluate(() => (window.dataLayer as IArguments[]).map((a) => Array.from(a)).find((a) => a[0] === 'event' && a[1] === 'whatsapp_click'));
  expect(ev?.[2]).toEqual({ language: 'tr', page_type: 'product', cta_location: 'product_main', product_code: 'sd_024' });
  // decision persists: no banner on the next page, gtag loads again
  await page.goto('/en/');
  await expect(page.locator('[data-cookie-banner]')).toBeHidden();
});

test('reject: no Google request at all, even after reloads', async ({ page }) => {
  const hits = await watchGoogle(page);
  await page.goto('/');
  await page.locator('[data-consent="denied"]').click();
  await expect(page.locator('[data-cookie-banner]')).toBeHidden();
  await page.reload();
  await page.goto('/urunler.html');
  expect(hits).toEqual([]);
});

test('withdrawing consent deletes _ga cookies and reloads', async ({ page, context }) => {
  await watchGoogle(page);
  await page.goto('/');
  await page.locator('[data-consent="granted"]').click();
  await context.addCookies([
    { name: '_ga', value: 'GA1.1.1', domain: 'localhost', path: '/' },
    { name: '_ga_TEST000000', value: 'GS1.1.1', domain: 'localhost', path: '/' },
  ]);
  await page.locator('[data-cookie-prefs]').click();
  await expect(page.locator('[data-cookie-banner]')).toBeVisible();
  await Promise.all([page.waitForEvent('load'), page.locator('[data-consent="denied"]').click()]);
  const names = (await context.cookies()).map((c) => c.name);
  expect(names.filter((n) => n.startsWith('_ga'))).toEqual([]);
});

test('analytics does not run on another hostname (ANL-06)', async ({ page, baseURL }) => {
  const hits = await watchGoogle(page);
  await page.goto(baseURL!.replace('localhost', '127.0.0.1') + '/');
  await page.locator('[data-consent="granted"]').click();
  await page.waitForTimeout(500);
  expect(hits).toEqual([]);
});

test('storage blocked: the decision lasts for this page only', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL: baseURL! });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-consent="denied"]').click();
  await expect(page.locator('[data-cookie-banner]')).toBeHidden();
  await page.reload();
  await expect(page.locator('[data-cookie-banner]')).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

test('cookie policy lists _ga cookies in the GA build', async ({ page }) => {
  await page.goto('/cerez-politikasi.html');
  await expect(page.locator('.cookie-table')).toContainText('_ga');
  await expect(page.locator('.cookie-table')).toContainText('_ga_TEST000000');
});

test('KAL-15 with consent granted: no JS errors, no CSP violations, no 404s', async ({ page }) => {
  await watchGoogle(page);
  const problems: string[] = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP ${e.violatedDirective} ${e.blockedURI}`)));
  await page.goto('/');
  await page.locator('[data-consent="granted"]').click();
  for (const p of ['/', '/en/', '/masaj-yataklari.html', '/lux-soft-masaj-yatagi.html', '/en/massage-bed-buying-guide.html', '/iletisim.html', '/urunler.html']) {
    await page.goto(p, { waitUntil: 'networkidle' });
  }
  expect(problems).toEqual([]);
});
