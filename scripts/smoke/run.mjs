// Post-deploy smoke test (SUN-06). Usage: npm run smoke -- https://spadunyasi.com.tr [--no-psi]
// Works against a local server too (npm run smoke -- http://localhost:4321): host/https checks are skipped there.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import https from 'node:https';

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:\/\//.test(a)) ?? 'https://spadunyasi.com.tr').replace(/\/$/, '');
const LIVE = /^https:\/\/spadunyasi\.com\.tr$/.test(BASE);
const PSI = LIVE && !args.includes('--no-psi');
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, opts = {}) {
  await sleep(150); // be gentle with shared hosting
  return fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'spadunyasi-smoke/1.0', 'Accept-Encoding': 'gzip, br', ...(opts.headers ?? {}) }, method: opts.method ?? 'GET' });
}

// 1) Redirects: exactly one 301 hop to the final canonical URL.
async function oneHop(from, to) {
  try {
    const r = await get(from);
    const raw = r.headers.get('location');
    const loc = raw ? new URL(raw, from).href : raw; // the live .htaccess sends absolute URLs; local servers may not
    if (r.status !== 301 || loc !== to) return ok(`yönlendirme ${from}`, false, `${r.status} → ${loc} (beklenen 301 → ${to})`);
    const r2 = await get(to);
    ok(`yönlendirme ${from}`, r2.status === 200, `301 → ${to} → ${r2.status}`);
  } catch (e) {
    ok(`yönlendirme ${from}`, false, e.message);
  }
}
if (LIVE) {
  await oneHop('http://spadunyasi.com.tr/', 'https://spadunyasi.com.tr/');
  await oneHop('http://www.spadunyasi.com.tr/', 'https://spadunyasi.com.tr/');
  await oneHop('https://www.spadunyasi.com.tr/', 'https://spadunyasi.com.tr/');
  await oneHop('https://www.spadunyasi.com.tr/iletisim.html', 'https://spadunyasi.com.tr/iletisim.html');
  await oneHop('http://spadunyasi.com.tr/en/', 'https://spadunyasi.com.tr/en/');
}
await oneHop(`${BASE}/index.html`, `${LIVE ? 'https://spadunyasi.com.tr' : BASE}/`);
await oneHop(`${BASE}/en`, `${LIVE ? 'https://spadunyasi.com.tr' : BASE}/en/`);
await oneHop(`${BASE}/en/index.html`, `${LIVE ? 'https://spadunyasi.com.tr' : BASE}/en/`);
if (LIVE) {
  await oneHop(`${BASE}/iletisim`, 'https://spadunyasi.com.tr/iletisim.html');
  await oneHop(`${BASE}/iletisim.html/`, 'https://spadunyasi.com.tr/iletisim.html');
}

// 2) TLS certificate of the www host (the redirect source must have a valid certificate too).
if (LIVE) {
  await new Promise((resolve) => {
    const req = https.request({ host: 'www.spadunyasi.com.tr', method: 'HEAD', path: '/', rejectUnauthorized: true, timeout: 15000 }, (res) => {
      const cert = res.socket.getPeerCertificate();
      ok('SSL www.spadunyasi.com.tr', true, `geçerli, bitiş ${cert.valid_to}`);
      res.resume();
      resolve();
    });
    req.on('error', (e) => {
      ok('SSL www.spadunyasi.com.tr', false, e.message);
      resolve();
    });
    req.end();
  });
}

// 3) Pages: the 18 v1 URLs and every sitemap URL return 200 text/html; charset=utf-8.
const V1 = ['/', '/brand-cilt-bakim-koltugu.html', '/cilt-bakim-koltugu-secim-rehberi.html', '/dinlenme-yatagi-secim-rehberi.html', '/evony-dinlenme-yatagi.html', '/gizlilik.html', '/light-dinlenme-yatagi.html', '/lux-soft-masaj-yatagi.html', '/mercury-dinlenme-yatagi.html', '/mermer-dinlenme-yatagi.html', '/moon-dinlenme-yatagi.html', '/mozaik-dinlenme-yatagi.html', '/nice-masaj-yatagi.html', '/odessa-dinlenme-yatagi.html', '/rattan-sezlong.html', '/trend-masaj-yatagi.html', '/uranus-dinlenme-yatagi.html', '/venus-dinlenme-yatagi.html'];
let v1Fail = [];
for (const p of V1) {
  const r = await get(BASE + p);
  if (r.status !== 200) v1Fail.push(`${p} ${r.status}`);
}
ok(`v1 URL'leri (${V1.length})`, v1Fail.length === 0, v1Fail.join(', '));

const sm = await get(`${BASE}/sitemap.xml`);
ok('sitemap.xml erişilebilir', sm.status === 200);
const locs = [...(await sm.text()).matchAll(/<loc>https:\/\/spadunyasi\.com\.tr([^<]*)<\/loc>/g)].map((m) => m[1]);
const bad = [];
for (const p of locs) {
  const r = await get(BASE + p);
  const ct = r.headers.get('content-type') ?? '';
  if (r.status !== 200 || !/^text\/html;\s*charset=utf-8$/i.test(ct)) bad.push(`${p} ${r.status} ${ct}`);
  await r.arrayBuffer();
}
ok(`sitemap URL'leri 200 + text/html; charset=utf-8 (${locs.length})`, bad.length === 0, bad.slice(0, 5).join(' | '));

// 4) 404s per language.
for (const [p, needle] of [
  ['/olmayan-sayfa-smoke.html', 'Aradığınız sayfa bulunamadı'],
  ['/en/missing-page-smoke.html', 'We could not find that page'],
]) {
  const r = await get(BASE + p);
  const body = await r.text();
  ok(`404 ${p}`, r.status === 404 && body.includes(needle), `${r.status}`);
}

// 5) Headers and MIME types.
const home = await get(`${BASE}/`);
const homeHtml = await home.text();
const h = (r, k) => r.headers.get(k) ?? '';
ok('X-Content-Type-Options: nosniff', h(home, 'x-content-type-options').toLowerCase() === 'nosniff');
if (LIVE) {
  ok('HSTS (includeSubDomains/preload yok)', /max-age=31536000/.test(h(home, 'strict-transport-security')) && !/includesubdomains|preload/i.test(h(home, 'strict-transport-security')));
  ok('Referrer-Policy / X-Frame-Options / Permissions-Policy', Boolean(h(home, 'referrer-policy') && h(home, 'x-frame-options') && h(home, 'permissions-policy')));
}
ok('HTML Cache-Control: no-cache', /no-cache/.test(h(home, 'cache-control')));
ok('HTML sıkıştırılmış (gzip/br)', /gzip|br/.test(h(home, 'content-encoding')), h(home, 'content-encoding'));
const asset = homeHtml.match(/\/_astro\/[^"' )]+\.(?:avif)/)?.[0];
const font = homeHtml.match(/\/_astro\/fonts\/[^"' )]+\.woff2/)?.[0];
const js = homeHtml.match(/\/_astro\/[^"' )]+\.js/)?.[0];
if (asset) {
  const r = await get(BASE + asset);
  ok('AVIF MIME image/avif', h(r, 'content-type').startsWith('image/avif'), h(r, 'content-type'));
  ok('_astro immutable önbellek', /immutable/.test(h(r, 'cache-control')), h(r, 'cache-control'));
}
if (font) {
  const r = await get(BASE + font);
  ok('woff2 MIME font/woff2', h(r, 'content-type').startsWith('font/woff2'), h(r, 'content-type'));
}
if (js) {
  const r = await get(BASE + js);
  ok('JS sıkıştırılmış', /gzip|br/.test(h(r, 'content-encoding')), h(r, 'content-encoding'));
}
const mf = await get(`${BASE}/site.webmanifest`);
ok('webmanifest MIME', /application\/manifest\+json/.test(h(mf, 'content-type')), h(mf, 'content-type'));

// 6) Access rules.
const astroDir = await get(`${BASE}/_astro/`);
const astroBody = await astroDir.text();
ok('/_astro/ dizin listesi kapalı', astroDir.status !== 200 || !/Index of/i.test(astroBody), `${astroDir.status}`);
const wk = await get(`${BASE}/.well-known/smoke-test`);
ok('/.well-known/ engellenmemiş (403 değil)', wk.status !== 403, `${wk.status}`);
const dot = await get(`${BASE}/.htaccess`);
ok('.htaccess dışarıya kapalı', dot.status === 403 || dot.status === 404, `${dot.status}`);
const robots = await get(`${BASE}/robots.txt`);
ok('robots.txt erişilebilir', robots.status === 200 && (await robots.text()).includes('Sitemap:'));

// 7) Live Lighthouse via PageSpeed Insights (no key; may be rate-limited).
if (PSI) {
  const pages = ['/', '/en/', '/masaj-yataklari.html', '/brand-cilt-bakim-koltugu.html', '/mercury-dinlenme-yatagi.html', '/masaj-yatagi-secimi.html', '/iletisim.html'];
  for (const p of pages) {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&url=${encodeURIComponent(BASE + p)}&category=performance&category=accessibility&category=best-practices&category=seo`;
    try {
      const r = await fetch(api);
      const j = await r.json();
      const c = j.lighthouseResult?.categories;
      if (!c) throw new Error(j.error?.message ?? 'no result');
      const s = ['performance', 'accessibility', 'best-practices', 'seo'].map((k) => Math.round(c[k].score * 100));
      ok(`PSI ${p}`, s[0] >= 95 && s[1] === 100 && s[2] === 100 && s[3] === 100, s.join(' / '));
    } catch (e) {
      ok(`PSI ${p}`, false, `ölçülemedi: ${e.message}`);
    }
    await sleep(3000);
  }
}

await mkdir('reports', { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
await writeFile(`reports/smoke-${stamp}.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} kontrol geçti. Rapor: reports/smoke-${stamp}.json`);
process.exit(failed ? 1 : 0);
void readFile;
