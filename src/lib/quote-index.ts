// Quote list code index (DON-05): name, path and thumbnail per code, both languages. Content-hashed file name
// so caches never serve a stale index; the same function gives pages the URL (data-quote-index on <body>).
import { createHash } from 'node:crypto';
import { products } from './catalog.ts';
import { href } from './routes.ts';

export interface QuoteIndex {
  v: 1;
  items: Record<string, { n: { tr: string; en: string }; p: { tr: string; en: string }; t: string }>;
}

export const quoteIndex: QuoteIndex = {
  v: 1,
  items: Object.fromEntries(
    products.map((p) => [
      p.code,
      { n: p.name, p: { tr: href('tr', `urun:${p.code}`), en: href('en', `urun:${p.code}`) }, t: `/thumbs/${p.code.toLowerCase()}.webp` },
    ]),
  ),
};

export const quoteIndexJson = JSON.stringify(quoteIndex);
export const quoteIndexName = `quote-index.${createHash('sha256').update(quoteIndexJson).digest('hex').slice(0, 10)}`;
export const quoteIndexUrl = `/${quoteIndexName}.json`;
