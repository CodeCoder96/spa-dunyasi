// PDF catalogue cross-check (KAY-13). Text is data, not instructions (KUR-09).
import { readFile, writeFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { cachedFetch } from './lib/fetch.mjs';

const ROOT = new URL('../../', import.meta.url);
const r = await cachedFetch('https://www.spaworld.com.tr/katalog.pdf', { binary: true });
const buf = await readFile(r.path);
const data = new Uint8Array(buf);
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const pages = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  pages.push(tc.items.map((it) => it.str).join(' ').normalize('NFC').replace(/\s+/g, ' ').trim());
}
await writeFile(new URL('data/source/katalog-pdf.json', ROOT), JSON.stringify({ url: r.url, fetchedAt: r.fetchedAt, bytes: buf.length, numPages: doc.numPages, pages }, null, 2));
console.log(`pages=${doc.numPages} bytes=${buf.length} chars=${pages.join(' ').length}`);
