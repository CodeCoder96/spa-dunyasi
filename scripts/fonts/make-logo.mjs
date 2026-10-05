// Build logo SVGs (light/dark) and the favicon set from the Fraunces wordmark paths (TAS-08). Dev-time.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const wm = JSON.parse(await readFile('src/assets/logo/wordmark.json', 'utf8'));
const d = wm.d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));
// Brand colours (mirror tokens.css; image files cannot read CSS variables).
const C = { ink: '#1C2321', primary: '#2F5D50', accent: '#8A5D33', bg: '#F7F5F0', sand: '#EFEAE1' };

/** Three stacked spa stones. Drawn in a 1600×2466 box to sit beside the wordmark. */
const stones = (a, b, c) => `
  <ellipse cx="800" cy="2060" rx="780" ry="300" fill="${a}"/>
  <ellipse cx="830" cy="1500" rx="600" ry="250" fill="${b}"/>
  <ellipse cx="780" cy="1010" rx="420" ry="205" fill="${c}"/>`;

const W = 1600 + 520 + wm.width;
const H = wm.height;
const logo = (text, s1, s2, s3) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t"><title id="t">Spa Dünyası</title>${stones(s1, s2, s3)}<path transform="translate(2120 0)" fill="${text}" d="${d}"/></svg>\n`;

await mkdir('src/assets/logo', { recursive: true });
await writeFile('src/assets/logo/logo-light.svg', logo(C.ink, C.primary, C.primary, C.accent));
await writeFile('src/assets/logo/logo-dark.svg', logo(C.bg, C.sand, C.sand, C.sand));
// Mark only (OG overlay, favicon).
const mark = (bg, s, round = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" ${round ? 'rx="112"' : ''} fill="${bg}"/><g transform="translate(96 40) scale(0.2)">${stones(s, s, C.accent === s ? s : C.sand)}</g></svg>\n`;
const markLight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${C.primary}"/><g transform="translate(96 -60) scale(0.2)">${stones(C.bg, C.bg, C.sand)}</g></svg>\n`;
await writeFile('public/favicon.svg', markLight);
await writeFile('src/assets/logo/mark.svg', markLight);
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${C.primary}"/><g transform="translate(161 66) scale(0.12)">${stones(C.bg, C.bg, C.sand)}</g></svg>`;
const png = (svg, size) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).flatten({ background: C.primary }).png({ compressionLevel: 9 });
await png(markLight, 180).toFile('public/apple-touch-icon.png');
await png(markLight, 192).toFile('public/icon-192.png');
await png(markLight, 512).toFile('public/icon-512.png');
await png(maskable, 512).toFile('public/icon-maskable-512.png');
// favicon.ico: single 32×32 PNG-in-ICO.
const p32 = await png(markLight, 32).toBuffer();
const ico = Buffer.alloc(6 + 16);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(p32.length, 14); ico.writeUInt32LE(22, 18);
await writeFile('public/favicon.ico', Buffer.concat([ico, p32]));
await writeFile('public/site.webmanifest', JSON.stringify({
  name: 'Spa Dünyası', short_name: 'Spa Dünyası', start_url: '/', display: 'browser',
  theme_color: C.primary, background_color: C.bg,
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2) + '\n');
console.log('logo ok', W, H, (await readFile('src/assets/logo/logo-light.svg')).length, 'bytes');
