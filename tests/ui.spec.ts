// Interactions and keyboard (SAB-03, SAB-06, SAB-11, DON-04, ERS-02, ERS-03, MIM-07).
import { test, expect } from '@playwright/test';

test.describe('header menus', () => {
  test('desktop dropdown: click/keyboard open, Escape closes and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const toggle = page.locator('[data-dd-toggle][aria-controls="dd-products"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#dd-products')).toBeVisible();
    await expect(page.locator('#dd-products a').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#dd-products')).toBeHidden();
    await expect(toggle).toBeFocused();
    // outside click closes
    await toggle.click();
    await page.locator('h1').click();
    await expect(page.locator('#dd-products')).toBeHidden();
  });

  test('mobile menu opens with the menu button (popover) and closes with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/en/');
    const btn = page.locator('[data-menu-open]');
    await btn.click();
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-mobile-bar]')).toBeHidden(); // DON-04
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.locator('[data-mobile-bar]')).toBeVisible();
  });

  test('language switcher points to the same page in the other language', async ({ page }) => {
    await page.goto('/mercury-dinlenme-yatagi.html');
    const sw = page.locator('a.lang-switch').first();
    await expect(sw).toHaveAttribute('href', '/en/mercury-relaxation-lounger.html');
    await expect(sw).toHaveAttribute('hreflang', 'en');
    await expect(sw).toHaveAttribute('lang', 'en');
  });

  test('skip link is first in tab order and moves focus to main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });
});

test.describe('gallery', () => {
  test('thumbnails mark the current slide; lightbox keyboard navigation and focus return', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lux-soft-masaj-yatagi.html');
    const thumbs = page.locator('[data-gallery-thumb]');
    await expect(thumbs.first()).toHaveAttribute('aria-current', 'true');
    await thumbs.nth(2).click();
    await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true');
    const opener = page.locator('[data-gallery-open]').first();
    await opener.click();
    const lb = page.locator('[data-lightbox]');
    await expect(lb).toBeVisible();
    await expect(lb.locator('[data-lightbox-counter]')).toHaveText(/^1 \/ \d+$/);
    await page.keyboard.press('ArrowRight');
    await expect(lb.locator('[data-lightbox-counter]')).toHaveText(/^2 \/ \d+$/);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(lb.locator('[data-lightbox-counter]')).toHaveText(/^(\d+) \/ \1$/);
    await page.keyboard.press('Escape');
    await expect(lb).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('single-image product shows no thumbnails or arrows', async ({ page }) => {
    await page.goto('/agda-isitici.html');
    await expect(page.locator('[data-gallery-thumb]')).toHaveCount(0);
    await expect(page.locator('[data-lightbox-next]')).toHaveCount(0);
  });

  test('without JS, thumbnails are #g-N anchors and images link to full-size files', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/lux-soft-masaj-yatagi.html');
    await expect(page.locator('[data-gallery-thumb]').nth(1)).toHaveAttribute('href', '#g-2');
    const full = await page.locator('[data-gallery-open]').first().getAttribute('href');
    const res = await page.request.get(full!);
    expect(res.status()).toBe(200);
    await ctx.close();
  });
});

test.describe('all-products filter', () => {
  test('chips filter in place, use the URL hash and announce the count', async ({ page }) => {
    await page.goto('/urunler.html');
    const total = await page.locator('[data-filter-grid] .pcard').count();
    const chip = page.locator('[data-filter-chip="dinlenme-yataklari"]');
    await expect(chip).toHaveAttribute('role', 'button');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/urunler\.html#dinlenme-yataklari$/);
    const visible = await page.locator('[data-filter-grid] .pcard:visible').count();
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(total);
    await expect(page.locator('[data-filter-count]')).toHaveText(`${visible} ürün gösteriliyor`);
    expect(page.url()).not.toContain('?');
    // deep link restores the filter
    await page.goto('/urunler.html#masaj-yataklari');
    await expect(page.locator('[data-filter-chip="masaj-yataklari"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-filter-chip=""]').click();
    await expect(page.locator('[data-filter-grid] .pcard:visible')).toHaveCount(total);
  });

  test('without JS chips are links to category pages', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/en/products.html');
    await expect(page.locator('[data-filter-chip="massage-beds"]')).toHaveAttribute('href', '/en/massage-beds.html');
    await ctx.close();
  });
});

test.describe('mobile bar and fixed elements', () => {
  test('mobile bar is 56-64 px + safe area, hidden on short (landscape) screens, never covers the footer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/mercury-dinlenme-yatagi.html');
    const bar = page.locator('[data-mobile-bar]');
    const box = await bar.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    expect(box!.height).toBeLessThanOrEqual(64);
    // product-specific WhatsApp message (DON-04)
    const wa = await bar.locator('a').first().getAttribute('href');
    expect(decodeURIComponent(wa!)).toContain('Mercury Dinlenme Yatağı (Kod: SD-024)');
    // bottom padding equals the bar height so the footer stays reachable
    const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    expect(pad).toBeGreaterThanOrEqual(box!.height - 1);
    await page.setViewportSize({ width: 812, height: 375 });
    await expect(bar).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(bar).toBeHidden();
  });

  test('focused elements are not hidden under the sticky header or mobile bar (SC 2.4.11)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    // Measure the settled position: smooth scrolling is disabled under reduced motion.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/masaj-yataklari.html');
    const header = await page.locator('[data-header]').boundingBox();
    const bar = await page.locator('[data-mobile-bar]').boundingBox();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el.closest('[data-header], [data-mobile-bar], .mobile-menu, dialog, .skip-link')) return null;
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, h: b.height };
      });
      if (!r || r.h === 0) continue;
      expect(r.top).toBeGreaterThanOrEqual(header!.y + header!.height - 2);
      expect(r.bottom).toBeLessThanOrEqual(bar!.y + 2);
    }
  });
});

test('GA id empty (production build): no banner, no gtag, no cookie preferences link, policy says no analytics', async ({ page }) => {
  const google: string[] = [];
  page.on('request', (r) => {
    if (/google/.test(new URL(r.url()).hostname)) google.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('[data-cookie-banner]')).toHaveCount(0);
  await expect(page.locator('[data-cookie-prefs]')).toHaveCount(0);
  expect(await page.evaluate(() => typeof (window as { gtag?: unknown }).gtag)).toBe('undefined');
  await page.goto('/cerez-politikasi.html');
  await expect(page.locator('main')).toContainText('analitik çerez kullanılmaz');
  await page.goto('/en/cookie-policy.html');
  await expect(page.locator('main')).toContainText('does not use analytics cookies');
  expect(google).toEqual([]);
});
