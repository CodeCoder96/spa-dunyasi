// KAL-17: quote list behaviour.
import { test, expect } from '@playwright/test';
import { catalog, quoteState, seedQuote } from './helpers.ts';

const PRODUCT = '/lux-soft-masaj-yatagi.html';
const PRODUCT_EN = '/en/lux-soft-massage-bed.html';

test.describe('quote list', () => {
  test('add from product page, counter, panel rows, remove', async ({ page }) => {
    await page.goto(PRODUCT);
    const qty = page.locator('[data-quote-qty]');
    await expect(qty).toBeVisible();
    await qty.fill('3');
    await page.locator('[data-quote-form] [data-quote-add="SD-013"]').click();
    await expect(page.locator('[data-quote-count]').first()).toHaveText('1');
    expect((await quoteState(page))?.items).toEqual([expect.objectContaining({ code: 'SD-013', qty: 3 })]);
    // adding again increments
    await qty.fill('2');
    await page.locator('[data-quote-form] [data-quote-add="SD-013"]').click();
    await expect.poll(async () => (await quoteState(page))?.items[0]?.qty).toBe(5);
    // panel
    await page.locator('[data-quote-open]').first().click();
    const dialog = page.locator('[data-quote-dialog]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.quote-row')).toHaveCount(1);
    await expect(dialog.locator('.quote-row__name')).toHaveText('Lux Soft Masaj Yatağı');
    await expect(dialog.locator('[data-quote-live]')).toContainText(/Lux Soft|güncellendi|eklendi|listeye/);
    await dialog.locator('[data-remove]').click();
    await expect(dialog.locator('.quote-row')).toHaveCount(0);
    await expect(dialog.locator('[data-quote-empty]')).toBeVisible();
    expect(await quoteState(page)).toBeNull();
  });

  test('quantity limits: 0→1, 100→99, decimals and letters revert', async ({ page }) => {
    await page.goto(PRODUCT);
    await seedQuote(page, [{ code: 'SD-013', qty: 5 }]);
    await page.reload();
    await page.locator('[data-quote-open]').first().click();
    const input = page.locator('.quote-row [data-qty]');
    await input.fill('0');
    await input.press('Tab');
    await expect(input).toHaveValue('1');
    await input.fill('100');
    await input.press('Tab');
    await expect(input).toHaveValue('99');
    await input.fill('2.5');
    await input.press('Tab');
    await expect(input).toHaveValue('99');
    await input.fill('ab');
    await input.press('Tab');
    await expect(input).toHaveValue('99');
    expect((await quoteState(page))?.items[0]?.qty).toBe(99);
    // + at the ceiling stays 99, − goes down
    await page.locator('.quote-row [data-step="1"]').click();
    await expect(page.locator('.quote-row [data-qty]')).toHaveValue('99');
    await page.locator('.quote-row [data-step="-1"]').click();
    await expect(page.locator('.quote-row [data-qty]')).toHaveValue('98');
    // product page quantity field: letters revert to 1
    await page.keyboard.press('Escape');
    await page.locator('[data-quote-qty]').fill('x7');
    await page.locator('[data-quote-qty]').press('Tab');
    await expect(page.locator('[data-quote-qty]')).toHaveValue('1');
  });

  test('30 distinct items maximum', async ({ page }) => {
    await page.goto('/urunler.html');
    await seedQuote(page, catalog.slice(0, 30).map((p) => ({ code: p.code, qty: 1 })));
    await page.reload();
    await expect(page.locator('[data-quote-count]').first()).toHaveText('30');
    const extra = catalog[30]!.code;
    await page.locator(`[data-quote-add="${extra}"]`).first().click();
    await page.waitForTimeout(300);
    const st = await quoteState(page);
    expect(st?.items.length).toBe(30);
    expect(st?.items.some((i) => i.code === extra)).toBe(false);
    // an existing item can still be incremented
    await page.locator(`[data-quote-add="${catalog[0]!.code}"]`).first().click();
    await expect.poll(async () => (await quoteState(page))?.items[0]?.qty).toBe(2);
  });

  test('persists across pages and syncs across tabs', async ({ page, context }) => {
    await page.goto(PRODUCT);
    await page.locator('[data-quote-form] [data-quote-add="SD-013"]').click();
    const other = await context.newPage();
    await other.goto('/');
    await expect(other.locator('[data-quote-count]').first()).toHaveText('1');
    await page.goto('/mercury-dinlenme-yatagi.html');
    await expect(page.locator('[data-quote-count]').first()).toHaveText('1');
    await page.locator('[data-quote-form] [data-quote-add="SD-024"]').click();
    await expect(other.locator('[data-quote-count]').first()).toHaveText('2'); // storage event
  });

  test('codes removed from the catalogue are dropped silently', async ({ page }) => {
    await page.goto('/');
    await seedQuote(page, [
      { code: 'SD-013', qty: 1 },
      { code: 'SD-999', qty: 4 },
    ]);
    await page.reload();
    await page.locator('[data-quote-open]').first().click();
    await expect(page.locator('.quote-row')).toHaveCount(1);
    await expect.poll(async () => (await quoteState(page))?.items.map((i) => i.code)).toEqual(['SD-013']);
  });

  test('TR and EN WhatsApp messages', async ({ page }) => {
    await page.context().route('https://wa.me/**', (r) => r.fulfill({ body: 'ok' }));
    for (const [path, intro, source, name] of [
      [PRODUCT, 'Merhaba, aşağıdaki ürünler için fiyat teklifi almak istiyorum:', 'Kaynak: spadunyasi.com.tr teklif listesi', 'Lux Soft Masaj Yatağı'],
      [PRODUCT_EN, 'Hello, I would like a price quote for the following products:', 'Source: spadunyasi.com.tr quote list', 'Lux Soft Massage Bed'],
    ] as const) {
      await page.goto(path);
      await seedQuote(page, [{ code: 'SD-013', qty: 2 }]);
      await page.reload();
      await page.locator('[data-quote-open]').first().click();
      await expect(page.locator('.quote-row__name')).toHaveText(name);
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-quote-send="whatsapp"]').click()]);
      const url = new URL(popup.url());
      await popup.close();
      expect(url.origin + url.pathname).toBe('https://wa.me/905343597644');
      expect(url.searchParams.get('text')).toBe(`${intro}

• ${name} (SD-013) × 2

${source}`);
    }
  });

  test('wa.me 2000-character limit drops names first', async ({ page }) => {
    await page.goto('/urunler.html');
    // 30 items × 99: with Turkish names the URL exceeds 2000 characters, codes-only fits.
    await seedQuote(page, catalog.slice(0, 30).map((p) => ({ code: p.code, qty: 99 })));
    await page.reload();
    await page.locator('[data-quote-open]').first().click();
    await expect(page.locator('.quote-row')).toHaveCount(30);
    await page.context().route('https://wa.me/**', (r) => r.fulfill({ body: 'ok' }));
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-quote-send="whatsapp"]').click()]);
    const href = popup.url();
    await popup.close();
    expect(href.length).toBeLessThanOrEqual(2000);
    const text = decodeURIComponent(href.split('text=')[1]!);
    expect(text).toContain('• SD-001 × 99');
    expect(text).not.toContain('Avant');
  });

  test('e-mail link encodes line breaks as %0D%0A', async ({ page }) => {
    await page.goto(PRODUCT);
    await seedQuote(page, [{ code: 'SD-013', qty: 1 }]);
    await page.reload();
    await page.locator('[data-quote-open]').first().click();
    await expect(page.locator('.quote-row')).toHaveCount(1);
    await page.evaluate(() => {
      (window as unknown as { __sent: string[] }).__sent = [];
      document.addEventListener('sd:quote-send', (e) => (window as unknown as { __sent: string[] }).__sent.push((e as CustomEvent<{ url: string }>).detail.url));
    });
    await page.locator('[data-quote-send="email"]').click();
    const sent = await page.evaluate(() => (window as unknown as { __sent: string[] }).__sent[0] ?? '');
    expect(sent).toMatch(/^mailto:info@spaworld\.com\.tr\?subject=/);
    expect(sent).toContain('%0D%0A');
    expect(sent).not.toMatch(/[^D]%0A/);
  });

  test('works in memory when localStorage is blocked', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(PRODUCT);
    await page.locator('[data-quote-form] [data-quote-add="SD-013"]').click();
    await expect(page.locator('[data-quote-count]').first()).toHaveText('1');
    await page.locator('[data-quote-open]').first().click();
    await expect(page.locator('[data-quote-memory]')).toBeVisible();
    await expect(page.locator('.quote-row')).toHaveCount(1);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('clear needs two clicks (no confirm())', async ({ page }) => {
    await page.goto(PRODUCT);
    await seedQuote(page, [{ code: 'SD-013', qty: 1 }]);
    await page.reload();
    page.on('dialog', () => {
      throw new Error('native dialog used');
    });
    await page.locator('[data-quote-open]').first().click();
    const clear = page.locator('[data-quote-clear]');
    await clear.click();
    await expect(page.locator('.quote-row')).toHaveCount(1);
    await expect(clear).toContainText('Evet');
    await clear.click();
    await expect(page.locator('.quote-row')).toHaveCount(0);
    expect(await quoteState(page)).toBeNull();
  });
});

test.describe('without JavaScript (KAL-14)', () => {
  test.use({ javaScriptEnabled: false });
  test('quote buttons are hidden, content and contact links work', async ({ page }) => {
    for (const p of ['/', PRODUCT, '/masaj-yataklari.html', PRODUCT_EN, '/urunler.html']) {
      await page.goto(p);
      await expect(page.locator('h1')).toBeVisible();
      for (const b of await page.locator('[data-quote-add], [data-quote-open], [data-quote-form]').all()) await expect(b).toBeHidden();
      expect(await page.locator('a[href^="https://wa.me/905343597644"]').count()).toBeGreaterThan(0);
      expect(await page.locator('a[href^="tel:+90"]').count()).toBeGreaterThan(0);
      // navigation: "Products" is a plain link without JS
      expect(await page.locator('footer nav a').count()).toBeGreaterThan(10);
    }
  });
});
