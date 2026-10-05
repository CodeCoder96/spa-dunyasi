// Shared helpers for the Playwright suite.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const catalog = JSON.parse(readFileSync('data/catalog/products.json', 'utf8')) as {
  code: string;
  name: { tr: string; en: string };
  slug: { tr: string; en: string };
}[];

/** Every built page path, TR and EN, from the sitemap plus the noindex pages. */
export function allPaths(): string[] {
  const xml = readFileSync('dist/sitemap.xml', 'utf8');
  const locs = [...xml.matchAll(/<loc>https:\/\/spadunyasi\.com\.tr([^<]*)<\/loc>/g)].map((m) => m[1]!);
  return [...locs, '/gizlilik.html', '/kvkk-aydinlatma-metni.html', '/cerez-politikasi.html', '/en/privacy.html', '/en/personal-data-notice.html', '/en/cookie-policy.html', '/404.html', '/en/404.html'];
}

export const QUOTE_KEY = 'sd_quote_v1';

export async function quoteState(page: Page): Promise<{ items: { code: string; qty: number }[] } | null> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), QUOTE_KEY);
}

export async function seedQuote(page: Page, items: { code: string; qty: number }[]): Promise<void> {
  await page.evaluate(
    ([k, it]) => localStorage.setItem(k as string, JSON.stringify({ v: 1, items: (it as { code: string; qty: number }[]).map((i) => ({ ...i, addedAt: 1 })) })),
    [QUOTE_KEY, items] as const,
  );
}
