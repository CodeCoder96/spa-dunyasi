// verify:data — catalog, coverage, codes, raw-value fidelity, images, CSV (KAL-01 data part, KAL-02, KAY-*).
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { catalogSchema } from '../../../src/lib/catalog-schema.ts';

const ROOT = new URL('../../../', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, ROOT), 'utf8'));
const low = (s) => (s ?? '').normalize('NFC').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
/** Number tokens of a value, used to prove numbers were not changed (KUR-03). */
const nums = (s) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).join('|');
const URANUS_STEMS = ['uranus.webp', 'uranus3.webp'];

export default [
  {
    id: 'kal-01-catalog-schema',
    title: 'Katalog Zod şeması',
    async run(r) {
      const cat = await json('data/catalog/products.json');
      const res = catalogSchema.safeParse(cat);
      if (!res.success) for (const i of res.error.issues) r.errors.push(`${i.path.join('.')}: ${i.message}`);
      r.info.products = cat.length;
    },
  },
  {
    id: 'kal-02-coverage',
    title: 'Kapsam: her kaynak URL için karar, kod kilidi',
    async run(r) {
      const cat = await json('data/catalog/products.json');
      const disc = await json('data/source/discovery.json');
      const ov = await json('data/overrides/products.json');
      const lock = await json('data/codes.lock.json');
      const decided = new Set([...cat.flatMap((p) => p.sourceUrls), ...ov.excluded.map((e) => `https://www.spaworld.com.tr/portfolios/${e.source}/`)]);
      const undecided = disc.products.filter((p) => !decided.has(p.url));
      for (const u of undecided) r.errors.push(`kararsız URL: ${u.url}`);
      for (const u of decided) if (!disc.products.some((p) => p.url === u)) r.errors.push(`katalogda keşifte olmayan kaynak URL: ${u}`);
      const report = await readFile(new URL('reports/kapsam-raporu.md', ROOT), 'utf8');
      const m = report.match(/Dahil: \*\*(\d+)\*\* · Birleştirildi: \*\*(\d+)\*\* · Bölündü: \*\*(\d+)\*\* · Hariç: \*\*(\d+)\*\* · Toplam: \*\*(\d+)\*\*/);
      if (!m) r.errors.push('kapsam raporunda toplam satırı yok');
      else {
        const [d, b, bo, h, t] = m.slice(1).map(Number);
        if (d + b + bo + h !== t || t !== disc.products.length) r.errors.push(`kapsam toplamları tutmuyor: ${d}+${b}+${bo}+${h}=${t}, kaynak=${disc.products.length}`);
        r.info.totals = { dahil: d, birlesti: b, bolundu: bo, haric: h, toplam: t };
      }
      const lockCodes = Object.values(lock.codes);
      for (const p of cat) if (!lockCodes.includes(p.code)) r.errors.push(`${p.code} kod kilidinde yok`);
      if (lockCodes.length !== cat.length) r.errors.push(`kilitte ${lockCodes.length} aktif kod, katalogda ${cat.length} ürün`);
      if (new Set(lockCodes).size !== lockCodes.length) r.errors.push('kilitte tekrar eden kod');
      for (const c of Object.values(lock.retired ?? {})) if (lockCodes.includes(c)) r.errors.push(`emekli kod yeniden kullanılmış: ${c}`);
      const max = Math.max(...[...lockCodes, ...Object.values(lock.retired ?? {})].map((c) => Number(c.slice(3))));
      if (lock.next <= max) r.errors.push(`lock.next (${lock.next}) en büyük koddan (${max}) büyük olmalı`);
      r.info.undecided = undecided.length;
    },
  },
  {
    id: 'kay-03-raw-fidelity',
    title: 'Teknik veriler kaynakla birebir (KUR-03)',
    async run(r) {
      const cat = await json('data/catalog/products.json');
      const src = await json('data/source/products.json');
      const bySlug = Object.fromEntries(src.map((p) => [p.url.split('/').at(-2), p]));
      let checked = 0;
      for (const p of cat) {
        const sources = p.sourceUrls.map((u) => bySlug[u.split("/").at(-2)]).filter(Boolean);
        if (!sources.length) { r.errors.push(`${p.code}: kaynak sayfa verisi yok`); continue; }
        const text = low(sources.map((s) => JSON.stringify([s.heading, s.bullets, s.texts, s.specs, s.specNotes, s.lists, s.sections])).join(' '));
        for (const s of p.specs) {
          checked++;
          if (s.from === 'table') {
            if (!sources[0].specs.some((x) => x.valueRaw === s.valueRaw)) r.errors.push(`${p.code} ${s.key}: tablo değeri kaynakta birebir yok: "${s.valueRaw}"`);
          } else if (!text.includes(low(s.valueRaw))) r.errors.push(`${p.code} ${s.key}: değer kaynak metninde yok: "${s.valueRaw}"`);
          for (const lang of ['tr', 'en']) if (nums(s.value[lang]) !== nums(s.valueRaw)) r.errors.push(`${p.code} ${s.key}.${lang}: sayılar değişmiş: "${s.valueRaw}" → "${s.value[lang]}"`);
        }
      }
      r.info.specsChecked = checked;
    },
  },
  {
    id: 'kay-14-images',
    title: 'Görseller: dosya, boyut, hash, tekrar ve Uranus kontrolü',
    async run(r) {
      const cat = await json('data/catalog/products.json');
      let n = 0;
      const seen = new Map();
      for (const p of cat) {
        if (!p.images.length) r.warnings.push(`${p.code} görselsiz (yer tutucu)`);
        for (const im of p.images) {
          n++;
          const url = new URL(im.file, ROOT);
          if (!existsSync(url)) { r.errors.push(`${p.code}: dosya yok ${im.file}`); continue; }
          const buf = await readFile(url);
          if (createHash('sha256').update(buf).digest('hex') !== im.sha256) r.errors.push(`${p.code}: sha256 uyuşmuyor ${im.file}`);
          const m = await sharp(buf).metadata();
          if (m.width !== im.width || m.height !== im.height) r.errors.push(`${p.code}: boyut uyuşmuyor ${im.file}`);
          if (Math.max(m.width, m.height) > 2560) r.errors.push(`${p.code}: 2560 px'ten büyük ${im.file}`);
          if (m.exif || m.icc && m.space !== 'srgb') r.errors.push(`${p.code}: meta veri/renk profili kalmış ${im.file}`);
          if (m.space !== 'srgb') r.errors.push(`${p.code}: sRGB değil (${m.space}) ${im.file}`);
          // The Uranus photo is the theme's CSS background on every page; only the Uranus product may show it (D-009).
          if (p.model !== 'Uranus' && URANUS_STEMS.some((u) => im.sourceUrl.toLowerCase().endsWith(u))) r.errors.push(`${p.code}: Uranus banner görseli galeride (TZK-01)`);
          if (/-\d{2,5}x\d{2,5}\.\w+$|-kucuk\.\w+$/i.test(im.sourceUrl)) r.errors.push(`${p.code}: küçük kopya kullanılmış ${im.sourceUrl}`);
          if (seen.has(im.sha256)) r.warnings.push(`${p.code}: aynı görsel ${seen.get(im.sha256)} ürününde de var`);
          seen.set(im.sha256, p.code);
        }
      }
      // Source sizes vs output: never upscaled.
      const { files } = await json('data/source/images.json');
      const bySrc = Object.fromEntries(Object.values(files).filter((f) => f.ok).map((f) => [f.url, f]));
      for (const p of cat) for (const im of p.images) {
        const f = bySrc[im.sourceUrl];
        if (f && (im.width > f.width || im.height > f.height)) r.errors.push(`${p.code}: görsel büyütülmüş ${im.file}`);
      }
      r.info.images = n;
    },
  },
  {
    id: 'kay-23-csv',
    title: "CSV: ';' ayraç, UTF-8 BOM",
    async run(r) {
      for (const f of ['docs/urun-eslestirme.csv', 'docs/keyword-map.csv']) {
        const url = new URL(f, ROOT);
        if (!existsSync(url)) {
          if (f.includes('keyword')) r.warnings.push(`${f} henüz yok (Faz 4)`);
          else r.errors.push(`${f} yok`);
          continue;
        }
        const buf = await readFile(url);
        if (!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)) r.errors.push(`${f}: UTF-8 BOM yok`);
        const head = buf.toString('utf8').split(/\r?\n/)[0];
        if (!head.includes(';') || head.includes(',')) r.errors.push(`${f}: başlık satırı ';' ayraçlı değil`);
      }
      const cat = await json('data/catalog/products.json');
      const rows = (await readFile(new URL('docs/urun-eslestirme.csv', ROOT), 'utf8')).trim().split(/\r?\n/).length - 1;
      if (rows !== cat.length) r.errors.push(`urun-eslestirme.csv ${rows} satır, katalog ${cat.length}`);
      r.info.size = (await stat(new URL('docs/urun-eslestirme.csv', ROOT))).size;
    },
  },
];
