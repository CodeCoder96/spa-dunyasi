// Apache-like static server for dist/ (TEK-06). Tests run against this, never against `astro dev`.
// - directory request → index.html (only with trailing slash; "/en" → 301 "/en/" like the .htaccess)
// - no extension guessing ("/about" is a 404, not about.html)
// - unknown path → 404 status with /404.html, or /en/404.html under /en/
// - correct MIME types; dotfiles are forbidden except .well-known
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL(`../${process.env.SD_SERVE_DIR ?? 'dist'}/`, import.meta.url));
const PORT = Number(process.env.PORT ?? process.argv[2] ?? 4321);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

async function file(p) {
  try {
    const s = await stat(p);
    return s.isFile() ? p : s.isDirectory() ? 'DIR' : null;
  } catch {
    return null;
  }
}

// Same types as the .htaccess DEFLATE/BROTLI lists (SUN-01).
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.svg', '.webmanifest']);

async function send(res, status, p, headers = {}, req) {
  let body = await readFile(p);
  const ext = path.extname(p);
  const h = { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', ...headers };
  if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req?.headers['accept-encoding'] ?? '')) {
    body = gzipSync(body);
    h['Content-Encoding'] = 'gzip';
    h['Vary'] = 'Accept-Encoding';
  }
  res.writeHead(status, h);
  res.end(req?.method === 'HEAD' ? undefined : body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (/(^|\/)\.(?!well-known\/)/.test(pathname)) return res.writeHead(403).end('Forbidden');
  if (pathname === '/en') return res.writeHead(301, { Location: '/en/' }).end();
  if (/\/index\.html$/.test(pathname)) return res.writeHead(301, { Location: pathname.replace(/index\.html$/, '') }).end();
  const target = path.join(ROOT, pathname);
  if (!target.startsWith(ROOT.replace(/[\/]$/, ''))) return res.writeHead(403).end();
  let found = await file(target);
  if (found === 'DIR') {
    if (!pathname.endsWith('/')) return res.writeHead(301, { Location: `${pathname}/` }).end();
    found = await file(path.join(target, 'index.html'));
    if (!found) return res.writeHead(403).end('Directory listing is disabled');
  }
  if (found) return send(res, 200, found, { 'Cache-Control': pathname.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'no-cache' }, req);
  const notFound = path.join(ROOT, pathname.startsWith('/en/') ? 'en/404.html' : '404.html');
  if (await file(notFound)) return send(res, 404, notFound, {}, req);
  res.writeHead(404).end('Not found');
});

server.listen(PORT, () => console.log(`serving dist/ on http://localhost:${PORT}`));
