// Download candidate images politely into the raw cache and record hashes/dimensions (KAY-10).
// Output: data/source/images.json
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { cachedFetch } from '../scrape/lib/fetch.mjs';

const ROOT = new URL('../../', import.meta.url);
const pages = JSON.parse(await readFile(new URL('data/source/image-candidates.json', ROOT), 'utf8'));

/** 64-bit difference hash for near-duplicate detection across sizes. */
async function dHash(buf) {
  const px = await sharp(buf).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] < px[y * 9 + x + 1] ? '1' : '0';
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

const byUrl = {};
let n = 0;
const total = pages.reduce((a, p) => a + p.items.length, 0);
for (const page of pages) {
  for (const it of page.items) {
    n++;
    let got = null;
    for (const c of it.candidates) {
      if (byUrl[c]?.ok) { got = byUrl[c]; break; }
      try {
        const r = await cachedFetch(c, { binary: true });
        if (r.status === 200 && /^image\//.test(r.contentType)) {
          const buf = await readFile(r.path);
          const m = await sharp(buf).metadata();
          got = byUrl[c] = {
            ok: true, url: c, finalUrl: r.finalUrl, file: r.file, bytes: buf.length,
            sha256: createHash('sha256').update(buf).digest('hex'),
            dhash: await dHash(buf), width: m.width, height: m.height, format: m.format,
            orientation: m.orientation ?? null, space: m.space, icc: !!m.icc, hasExif: !!m.exif,
          };
          break;
        }
        byUrl[c] = { ok: false, url: c, status: r.status, contentType: r.contentType };
      } catch (e) {
        byUrl[c] = { ok: false, url: c, error: e.message };
      }
    }
    it.resolved = got ? got.url : null;
    if (n % 25 === 0) console.log(`${n}/${total}`);
  }
}
await writeFile(new URL('data/source/images.json', ROOT), JSON.stringify({ pages, files: byUrl }, null, 2));
const fails = pages.flatMap((p) => p.items.filter((i) => !i.resolved).map((i) => `${p.slug}: ${i.url}`));
console.log(`done ${n}, failed ${fails.length}`);
fails.forEach((f) => console.log('  FAIL', f));
