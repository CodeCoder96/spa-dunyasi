// Postbuild (TEK-07): .htaccess files, OG images, thumbnails, sitemap.xml, robots.txt, cleanup.
// Everything that lists pages reads the route registry (MIM-06).
import { readFile, writeFile, mkdir, copyFile, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { routes, absolute, SITE } from '../../src/lib/routes.ts';
import { CATEGORY_META } from '../../src/lib/categories.ts';
import { updateContentDates } from './content-dates.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = path.join(ROOT, process.env.SD_OUT_DIR ?? 'dist');
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'spadunyasi');
const C = { bg: '#F7F5F0', white: '#FFFFFF', sand: '#EFEAE1' };
const t0 = Date.now();
const log = (m) => console.log(`[postbuild] ${m}`);
const catalog = JSON.parse(await readFile(path.join(ROOT, 'data/catalog/products.json'), 'utf8'));
const byCode = new Map(catalog.map((p) => [p.code, p]));
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

// 1) .htaccess files (do not rely on public/ copying dotfiles).
for (const rel of ['.htaccess', 'en/.htaccess', '_astro/.htaccess']) {
  await mkdir(path.dirname(path.join(DIST, rel)), { recursive: true });
  await copyFile(path.join(ROOT, 'server', rel), path.join(DIST, rel));
}
log('htaccess copied');

// 2) OG images (SEO-07): 1200×630 progressive mozjpeg ≤ 200 KB, path-based SVG logo bottom-right, no text.
const logoSvg = await readFile(path.join(ROOT, 'src/assets/logo/logo-light.svg'), 'utf8');
const logoW = 300;
const logoH = Math.round((logoW * 2466) / 12882);
const plate = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${logoW + 48}" height="${logoH + 32}"><rect width="100%" height="100%" rx="18" fill="${C.bg}" fill-opacity="0.94"/></svg>`,
);
const logoPng = await sharp(Buffer.from(logoSvg), { density: 72 }).resize(logoW).png().toBuffer();
const site = JSON.parse(await readFile(path.join(ROOT, 'data/source/site-images.json'), 'utf8'));
const siteImg = (name) => path.join(ROOT, `src/assets/site/${name}.webp`);

async function og(source, fit, outName) {
  await mkdir(CACHE, { recursive: true });
  const srcBuf = await readFile(source);
  const key = sha(Buffer.concat([srcBuf, Buffer.from(fit + logoSvg + 'v2')]));
  const cached = path.join(CACHE, `og-${key}.jpg`);
  if (!existsSync(cached)) {
    const base =
      fit === 'contain'
        ? await sharp(srcBuf).resize(1200 - 120, 630 - 80, { fit: 'contain', background: C.white }).flatten({ background: C.white }).toBuffer()
        : await sharp(srcBuf).resize(1200, 630, { fit: 'cover', position: 'centre' }).toBuffer();
    let canvas = sharp({ create: { width: 1200, height: 630, channels: 3, background: C.white } }).composite([
      { input: base, gravity: 'centre' },
      { input: plate, left: 1200 - (logoW + 48) - 32, top: 630 - (logoH + 32) - 32 },
      { input: logoPng, left: 1200 - logoW - 24 - 32, top: 630 - logoH - 16 - 32 },
    ]);
    const flat = await canvas.png().toBuffer();
    let q = 80;
    let out;
    do {
      out = await sharp(flat).jpeg({ quality: q, progressive: true, mozjpeg: true }).toBuffer();
      q -= 6;
    } while (out.length > 200 * 1024 && q > 30);
    await writeFile(cached, out);
  }
  await mkdir(path.join(DIST, 'og'), { recursive: true });
  await copyFile(cached, path.join(DIST, 'og', outName));
}

const ids = [...new Set(routes.map((r) => r.id))];
let ogCount = 0;
for (const id of ids) {
  const [type, key] = id.split(':');
  const name = `${id.replace(':', '-').toLowerCase()}.jpg`;
  if (type === 'urun') {
    const p = byCode.get(key);
    const img = p.images[0];
    if (img) await og(path.join(ROOT, img.file), img.background === 'studio' ? 'contain' : 'cover', name);
    else await og(siteImg('home-hero'), 'cover', name);
  } else if (type === 'kategori') {
    const p = byCode.get(CATEGORY_META[key].cover);
    const img = p?.images[0];
    await og(img ? path.join(ROOT, img.file) : siteImg('home-hero'), img?.background === 'studio' ? 'contain' : 'cover', name);
  } else if (type === 'hizmet') {
    await og(siteImg(`hizmet-${key}`), 'cover', name);
  } else if (type === 'rehber' && key === 'hamam-sauna-buhar') {
    await og(siteImg('rehber-islak-alan'), 'cover', name);
  } else {
    await og(siteImg('home-hero'), 'cover', name);
  }
  ogCount++;
}
log(`og images: ${ogCount} (site images from ${Object.keys(site).length} sources)`);

// 3) Thumbnails for the quote panel and inline guide cards: /thumbs/<code>.webp, 320×240.
await mkdir(path.join(DIST, 'thumbs'), { recursive: true });
const placeholder = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="${C.sand}"/><g fill="#E2DCD0"><ellipse cx="160" cy="176" rx="64" ry="20"/><ellipse cx="162" cy="142" rx="49" ry="16"/><ellipse cx="158" cy="113" rx="34" ry="13"/></g></svg>`,
);
for (const p of catalog) {
  const img = p.images[0];
  const out = path.join(DIST, 'thumbs', `${p.code.toLowerCase()}.webp`);
  const pipe = img
    ? sharp(path.join(ROOT, img.file)).resize(320, 240, { fit: img.background === 'studio' ? 'contain' : 'cover', background: C.white }).flatten({ background: C.white })
    : sharp(placeholder).resize(320, 240);
  await pipe.webp({ quality: 72 }).toFile(out);
}
log(`thumbs: ${catalog.length}`);

// 4) Sitemap (SEO-12): indexable pages only, both languages, hreflang alternates identical to <head>,
// lastmod = day the page's content hash last changed (data/content-dates.json), never the build time.
const dates = await updateContentDates();
const indexable = routes.filter((r) => r.indexable);
const urls = indexable
  .map((r) => {
    const tr = absolute(r.lang === 'tr' ? r.path : r.altPath);
    const en = absolute(r.lang === 'en' ? r.path : r.altPath);
    const lastmod = dates[`${r.lang}|${r.id}`];
    return [
      '  <url>',
      `    <loc>${absolute(r.path)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      `    <xhtml:link rel="alternate" hreflang="tr" href="${tr}"/>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n');
  })
  .join('\n');
await writeFile(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
);
log(`sitemap: ${indexable.length} urls`);

// 4b) Keyword map (SEO-01) from content front matter.
{
  const { writeKeywordMap } = await import('../seo/keyword-map.mjs');
  const km = await writeKeywordMap();
  log(`keyword map: ${km.rows} rows${km.missing.length ? `, ${km.missing.length} pages without keywords` : ''}`);
}

// 5) robots.txt (SEO-12): allow everything, point to the sitemap.
await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// 6a) Unreferenced images in _astro: Astro copies the original files of globbed assets even though pages
// only use the resized AVIF/WebP variants. Anything no HTML/CSS/JS/JSON file mentions is removed.
{
  const texts = [];
  async function collect(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await collect(p);
      else if (/\.(html|css|js|json|xml|webmanifest)$/.test(e.name)) texts.push(await readFile(p, 'utf8'));
    }
  }
  await collect(DIST);
  const all = texts.join('\n');
  let removed = 0;
  let freed = 0;
  for (const f of await readdir(path.join(DIST, '_astro'))) {
    if (!/\.(jpe?g|png|webp|avif)$/i.test(f) || all.includes(`/_astro/${f}`)) continue;
    freed += (await stat(path.join(DIST, '_astro', f))).size;
    await rm(path.join(DIST, '_astro', f));
    removed++;
  }
  log(`unreferenced _astro images removed: ${removed} (${(freed / 1024 / 1024).toFixed(1)} MB)`);
}

// 6) Cleanup (TEK-08, KAL-03).
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (/^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(e.name) || /\.(map|md|php)$/i.test(e.name)) {
      await rm(p);
      log(`removed ${path.relative(DIST, p)}`);
    }
  }
}
await walk(DIST);
const size = async (dir) => {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) n += e.isDirectory() ? await size(path.join(dir, e.name)) : (await stat(path.join(dir, e.name))).size;
  return n;
};
log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s, dist ${(await size(DIST) / 1024 / 1024).toFixed(1)} MB`);
