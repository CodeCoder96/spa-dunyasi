// Read cached raw responses by URL.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sha1 } from './fetch.mjs';
const RAW = fileURLToPath(new URL('../../../data/raw/', import.meta.url));
export function rawMeta(url) {
  const p = `${RAW}${sha1(url)}.meta.json`;
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}
export function rawText(url) {
  const m = rawMeta(url);
  return m ? readFileSync(`${RAW}${m.file}`, 'utf8') : null;
}
