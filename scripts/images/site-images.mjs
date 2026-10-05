// Non-product site photos (home hero, service heroes) from the source wet-area page (KUR-08, KAY-14).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const ROOT = new URL('../../', import.meta.url);
const { files } = JSON.parse(await readFile(new URL('data/source/images.json', ROOT), 'utf8'));
const PICK = {
  'home-hero': 'hamam2-scaled.webp',
  'hizmet-hamam': 'Hamam1.webp',
  'hizmet-sauna': 'Sauna-2.webp',
  'hizmet-buhar-odasi': 'Buhar-Odasi-2-1.webp',
  'hizmet-havuz': 'Ana-Resim.webp',
  'rehber-islak-alan': 'Buhar-odasi-3-1-scaled.webp',
};
await mkdir(new URL('src/assets/site/', ROOT), { recursive: true });
const manifest = {};
for (const [name, file] of Object.entries(PICK)) {
  const f = Object.values(files).find((x) => x.ok && x.url.endsWith(`/${file}`));
  if (!f) throw new Error(`missing ${file}`);
  const out = await sharp(await readFile(new URL(`data/raw/${f.file}`, ROOT)))
    .rotate().toColourspace('srgb').resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  await writeFile(new URL(`src/assets/site/${name}.webp`, ROOT), out.data);
  manifest[name] = { sourceUrl: f.url, width: out.info.width, height: out.info.height };
}
await writeFile(new URL('data/source/site-images.json', ROOT), JSON.stringify(manifest, null, 2));
console.log('site images', Object.keys(manifest).length);
