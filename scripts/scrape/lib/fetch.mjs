// Polite cached fetcher (KUR-12, KAY-03, KAY-04, KAY-05).
// One request at a time, 1000-1500 ms random delay, 30 s timeout,
// exponential backoff 2/4/8/16 s (honours Retry-After), max 4 attempts.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const RAW_DIR = path.join(ROOT, 'data', 'raw');

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const REFRESH = process.argv.includes('--refresh');
let lastRequestAt = 0;
let slowMode = false;
let queue = Promise.resolve();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha1 = (s) => createHash('sha1').update(s).digest('hex');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function extFor(contentType) {
  if (!contentType) return 'bin';
  if (contentType.includes('html')) return 'html';
  if (contentType.includes('xml')) return 'xml';
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('json')) return 'json';
  const m = contentType.match(/image\/([a-z0-9+]+)/);
  if (m) return m[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  return 'bin';
}

/** Block signals (KAY-04). "imunify" alone is NOT a signal (TZK-10). */
export function looksBlocked(status, body, expectMarkers) {
  if ([403, 409, 415, 429].includes(status)) return `status ${status}`;
  if (typeof body === 'string') {
    const low = body.toLocaleLowerCase('tr-TR');
    if (/captcha|verifying you are human|bot verification|access denied/.test(low) && body.length < 20000)
      return 'challenge page';
    if (expectMarkers?.length && !expectMarkers.some((m) => low.includes(m.toLocaleLowerCase('tr-TR'))))
      return 'expected markers missing';
  }
  return null;
}

async function throttle() {
  const min = slowMode ? 3000 : 1000;
  const span = slowMode ? 2000 : 500;
  const wait = lastRequestAt + min + Math.random() * span - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function networkFetch(url, binary) {
  let attempt = 0;
  let lastErr;
  while (attempt < 4) {
    attempt++;
    await throttle();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: binary ? '*/*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        },
      });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after'));
        const backoff = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * 2 ** (attempt - 1);
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(backoff);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { status: res.status, finalUrl: res.url, contentType: res.headers.get('content-type') ?? '', buf };
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`fetch failed after 4 attempts: ${url} (${lastErr?.message})`);
}

/**
 * Fetch with cache. Returns { url, finalUrl, status, contentType, fetchedAt, file, body? }.
 * Text responses include `body`; binary ones only `file`.
 */
export function cachedFetch(url, { binary = false, expectMarkers } = {}) {
  const run = async () => {
    await mkdir(RAW_DIR, { recursive: true });
    const key = sha1(url);
    const metaPath = path.join(RAW_DIR, `${key}.meta.json`);
    if (!REFRESH && (await exists(metaPath))) {
      const meta = JSON.parse(await readFile(metaPath, 'utf8'));
      const filePath = path.join(RAW_DIR, meta.file);
      if (await exists(filePath)) {
        if (binary) return { ...meta, path: filePath };
        return { ...meta, path: filePath, body: await readFile(filePath, 'utf8'), cached: true };
      }
    }
    let r = await networkFetch(url, binary);
    let body = binary ? null : r.buf.toString('utf8');
    let blocked = looksBlocked(r.status, body, expectMarkers);
    if (blocked && !binary) {
      // KAY-04 step 1: slow down and retry once.
      slowMode = true;
      console.warn(`[fetch] possible block (${blocked}) on ${url}; retrying slowly`);
      r = await networkFetch(url, binary);
      body = r.buf.toString('utf8');
      blocked = looksBlocked(r.status, body, expectMarkers);
    }
    const file = `${key}.${extFor(r.contentType)}`;
    await writeFile(path.join(RAW_DIR, file), r.buf);
    const meta = {
      url,
      finalUrl: r.finalUrl,
      status: r.status,
      contentType: r.contentType,
      fetchedAt: new Date().toISOString(),
      file,
      blocked: blocked ?? null,
    };
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
    return { ...meta, path: path.join(RAW_DIR, file), body: body ?? undefined };
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

/** Normalise source URLs: https, www host, trailing slash (KAY-01). */
export function normalizeSourceUrl(u) {
  const url = new URL(u.trim(), 'https://www.spaworld.com.tr/');
  url.protocol = 'https:';
  if (url.hostname === 'spaworld.com.tr') url.hostname = 'www.spaworld.com.tr';
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += '/';
  return url.toString();
}

/** NFC + entity-decoded (by cheerio) + whitespace-collapsed text (KAY-06). */
export function cleanText(s) {
  return (s ?? '').normalize('NFC').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}
