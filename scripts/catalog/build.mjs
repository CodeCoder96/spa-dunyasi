// Build data/catalog/products.json from source data + overrides (KAY-09..KAY-23).
// Also processes product images into src/assets/products/ and writes coverage/image reports and the sales CSV.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { slugify } from '../../src/lib/slug.ts';
import { catalogSchema, CATEGORY_IDS } from '../../src/lib/catalog-schema.ts';
import { CATEGORY_META } from '../../src/lib/categories.ts';

const ROOT = new URL('../../', import.meta.url);
const rd = async (p) => JSON.parse(await readFile(new URL(p, ROOT), 'utf8'));
const wr = async (p, data) => {
  await mkdir(new URL(p.replace(/[^/]+$/, ''), ROOT), { recursive: true });
  await writeFile(new URL(p, ROOT), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
};
const low = (s) => (s ?? '').normalize('NFC').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
const SRC_BASE = 'https://www.spaworld.com.tr/portfolios/';
const NO_IMAGES = process.argv.includes('--no-images');

const source = await rd('data/source/products.json');
const discovery = await rd('data/source/discovery.json');
const { pages: imgPages, files: imgFiles } = await rd('data/source/images.json');
const ov = await rd('data/overrides/products.json');
const tr = await rd('data/overrides/translations.json');
const imgOv = await rd('data/overrides/images.json');
const lockPath = 'data/codes.lock.json';
const lock = existsSync(new URL(lockPath, ROOT)) ? await rd(lockPath) : { _doc: 'Stable product codes (KAY-18). Retired codes are never reused.', next: 1, codes: {}, retired: {} };

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const srcBySlug = Object.fromEntries(source.map((p) => [p.url.split('/').at(-2), p]));

/** All text of a source page (or of one group section) used to verify quotes and feature evidence. */
function sourceText(slug, group) {
  const p = srcBySlug[slug];
  if (!p) return '';
  if (group) {
    const sec = p.sections.find((s) => s.type === 'tw-quote' && s.title?.startsWith(group));
    return sec ? `${sec.title} ${sec.description ?? ''}` : '';
  }
  return [p.heading, ...p.bullets, ...p.texts, ...p.specNotes, ...p.specs.map((s) => `${s.labelRaw}: ${s.valueRaw}`), ...p.lists.flatMap((l) => [l.heading, ...l.items]), ...p.sections.map((s) => s.title ?? s.text ?? '')].join(' \n ');
}

// ---------- Image repeat clusters (TZK-01, KAY-09) ----------
const productPageSlugs = new Set(ov.products.flatMap((p) => p.sources));
const flat = imgPages.filter((p) => productPageSlugs.has(p.slug)).flatMap((p) => p.items.map((it) => ({ slug: p.slug, it, f: imgFiles[it.resolved] })));
const parent = flat.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const ham = (a, b) => {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let c = 0;
  while (x) { c += Number(x & 1n); x >>= 1n; }
  return c;
};
for (let a = 0; a < flat.length; a++)
  for (let b = a + 1; b < flat.length; b++)
    if (flat[a].f.sha256 === flat[b].f.sha256 || ham(flat[a].f.dhash, flat[b].f.dhash) <= 6) parent[find(a)] = find(b);
const clusterPages = new Map();
flat.forEach((x, i) => {
  const r = find(i);
  if (!clusterPages.has(r)) clusterPages.set(r, new Set());
  clusterPages.get(r).add(x.slug);
});
const repeatedSha = new Set();
const repeatedReport = [];
flat.forEach((x, i) => {
  const pagesSet = clusterPages.get(find(i));
  if (pagesSet.size >= 3) {
    repeatedSha.add(x.f.sha256);
    repeatedReport.push({ slug: x.slug, file: x.it.url.split('/').pop(), pages: [...pagesSet].sort().join(', ') });
  }
});

// ---------- Background classification (KAY-16) ----------
async function classify(buf, w, h) {
  const patches = [];
  for (const [px, py] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const pw = Math.max(1, Math.round(w * 0.03));
    const ph = Math.max(1, Math.round(h * 0.03));
    const left = px ? w - pw : 0;
    const top = py ? h - ph : 0;
    const st = await sharp(buf).extract({ left, top, width: pw, height: ph }).removeAlpha().stats();
    patches.push(...st.channels.slice(0, 3).map((c) => c.mean));
  }
  const mean = patches.reduce((a, b) => a + b, 0) / patches.length;
  const spread = Math.max(...patches) - Math.min(...patches);
  return { background: mean > 235 && spread < 25 ? 'studio' : 'scene', mean: Math.round(mean), spread: Math.round(spread) };
}

// ---------- Build products ----------
const catalog = [];
const imageReport = [];
const usedKeys = new Set();
for (const def of ov.products) {
  if (usedKeys.has(def.key)) err(`duplicate override key ${def.key}`);
  usedKeys.add(def.key);
  const notes = [...(def.notes ?? [])];
  const primary = srcBySlug[def.sources[0]];
  if (!primary) { err(`${def.key}: source ${def.sources[0]} missing`); continue; }
  const sourceUrls = def.sources.map((s) => `${SRC_BASE}${s}/`);
  const groupLabel = def.group ?? null;
  const fullText = low(def.sources.map((s, i) => sourceText(s, i === 0 ? groupLabel : null)).join(' '));
  const sourceNameRaw = groupLabel
    ? primary.sections.find((s) => s.type === 'tw-quote' && s.title?.startsWith(groupLabel))?.title.slice(0, groupLabel.length) ?? groupLabel
    : primary.heading;

  // Specs from the table (KAY-03: raw values unchanged).
  const specs = [];
  if (!groupLabel) {
    for (const s of primary.specs) {
      if (def.excludeSpecs?.includes(s.labelRaw)) { notes.push(`Kaynak tablo satırı kullanılmadı: "${s.labelRaw}: ${s.valueRaw}".`); continue; }
      const lab = tr.specLabels[s.labelRaw];
      if (!lab) { err(`${def.key}: no translation for spec label "${s.labelRaw}"`); continue; }
      const vt = tr.specValues[s.valueRaw];
      const neutral = !/[a-zçğıöşüâîû]/i.test(s.valueRaw.replace(/\b(cm|mm|kg|v|w|hz|vac|volt|c|lt)\b/gi, '').replace(/[0-9]+(v|w|hz|vac)\b/gi, ''));
      if (!vt && !neutral) { err(`${def.key}: no translation for spec value "${s.valueRaw}"`); continue; }
      if (lab.correction) notes.push(`Düzeltme: ${lab.correction}.`);
      specs.push({ key: lab.key, label: { tr: lab.tr, en: lab.en }, valueRaw: s.valueRaw, value: vt ? { tr: vt.tr, en: vt.en } : { tr: s.valueRaw, en: s.valueRaw }, from: 'table' });
    }
  }
  for (const t of def.textSpecs ?? []) {
    if (!fullText.includes(low(t.quote))) err(`${def.key}: quote not found in source: "${t.quote}"`);
    if (!low(t.quote).includes(low(t.valueRaw))) err(`${def.key}: valueRaw "${t.valueRaw}" not inside quote`);
    specs.push({ key: t.key, label: t.label, valueRaw: t.valueRaw, value: t.value, from: t.from ?? 'text' });
  }

  // Options (KAY-20).
  const options = [];
  if (!groupLabel) {
    for (const l of primary.lists) {
      if (!/opsiyon/i.test(l.heading.normalize('NFC').toLocaleLowerCase('tr-TR'))) continue;
      for (const item of l.items) {
        if (def.optionsExclude?.includes(item)) continue;
        const o = tr.options[item];
        if (!o) { err(`${def.key}: no translation for option "${item}"`); continue; }
        if (o.correction) notes.push(`Düzeltme: ${o.correction}.`);
        options.push({ tr: o.tr, en: o.en });
      }
    }
  }
  if (def.textOptions) {
    if (!fullText.includes(low(def.textOptions.quote))) err(`${def.key}: option quote not found`);
    for (const item of def.textOptions.items) {
      const o = tr.options[item];
      if (!o) err(`${def.key}: no translation for option "${item}"`);
      else options.push({ tr: o.tr, en: o.en });
    }
  }

  // Features: must be evidenced by the source text.
  const features = [];
  for (const k of def.features ?? []) {
    const f = tr.features[k];
    if (!f) { err(`${def.key}: unknown feature ${k}`); continue; }
    if (!f.evidence.some((e) => fullText.includes(low(e)))) err(`${def.key}: feature ${k} has no evidence in source text`);
    features.push({ tr: f.tr, en: f.en });
  }
  const variants = (def.variants ?? []).map((v) => ({ tr: v.tr, en: v.en }));

  const slugTr = def.slug?.tr ?? (def.v1Path ? def.v1Path.slice(1, -5) : slugify(def.name.tr));
  const slugEn = def.slug?.en ?? slugify(def.name.en);

  // Images.
  const page = imgPages.find((p) => p.slug === def.sources[0]);
  let items = page ? page.items.filter((it) => !groupLabel || (it.group ?? '').startsWith(groupLabel)) : [];
  if (def.sources.length > 1) {
    for (const s of def.sources.slice(1)) {
      const extra = imgPages.find((p) => p.slug === s);
      if (!extra || s === 'yardimci-urunler') continue;
      items = items.concat(extra.items);
    }
  }
  const chosen = [];
  for (const it of items) {
    const f = imgFiles[it.resolved];
    const file = it.url.split('/').pop();
    const manual = imgOv.exclude?.[def.key]?.find((e) => e.file === file);
    if (manual) { imageReport.push({ code: null, key: def.key, file, status: 'hariç (elle)', reason: manual.reason }); continue; }
    if (repeatedSha.has(f.sha256)) { imageReport.push({ key: def.key, file, status: 'hariç (TZK-01)', reason: '≥3 ürün sayfasında tekrar ediyor' }); continue; }
    const dup = chosen.find((c) => c.f.sha256 === f.sha256 || ham(c.f.dhash, f.dhash) <= 4);
    if (dup) {
      const bigger = f.width * f.height > dup.f.width * dup.f.height;
      imageReport.push({ key: def.key, file: bigger ? dup.it.url.split('/').pop() : file, status: 'hariç (kopya)', reason: `aynı görselin ${bigger ? 'küçük' : 'daha küçük ya da eş'} sürümü (KAY-10)` });
      if (bigger) Object.assign(dup, { it, f });
      continue;
    }
    chosen.push({ it, f });
  }
  catalog.push({
    _def: def, _chosen: chosen,
    code: null, sourceUrls, sourceNameRaw, model: def.model ?? null, name: def.name,
    slug: { tr: slugTr, en: slugEn }, category: def.category, specs, options, features, variants,
    images: [], v1Path: def.v1Path ?? null, notes,
  });
}

// ---------- Codes (KAY-18) ----------
const collator = new Intl.Collator('tr');
const lockKey = (p) => p._def.sources[0] + (p._def.group ? `#${p._def.group}` : '');
const ordered = [...catalog].sort((a, b) => CATEGORY_IDS.indexOf(a.category) - CATEGORY_IDS.indexOf(b.category) || collator.compare(a.name.tr, b.name.tr));
const liveKeys = new Set(ordered.map(lockKey));
for (const [k, code] of Object.entries(lock.codes)) {
  if (!liveKeys.has(k)) { lock.retired[k] = code; delete lock.codes[k]; warnings.push(`code ${code} retired (${k})`); }
}
for (const p of ordered) {
  const k = lockKey(p);
  if (!lock.codes[k]) {
    lock.codes[k] = `SD-${String(lock.next).padStart(3, '0')}`;
    lock.next++;
  }
  p.code = lock.codes[k];
}
const usedCodes = Object.values(lock.codes);
if (new Set(usedCodes).size !== usedCodes.length) err('duplicate codes in lock');
if (Object.values(lock.retired).some((c) => usedCodes.includes(c))) err('retired code reused');

// ---------- Image processing (KAY-14..17) ----------
const assetsRoot = new URL('src/assets/products/', ROOT);
if (!NO_IMAGES) await rm(assetsRoot, { recursive: true, force: true });
for (const p of ordered) {
  const dir = `src/assets/products/${p.slug.tr}/`;
  if (!NO_IMAGES) await mkdir(new URL(dir, ROOT), { recursive: true });
  let n = 0;
  const variantDefs = p._def.variants ?? [];
  for (const { it, f } of p._chosen) {
    n++;
    const nn = String(n).padStart(2, '0');
    const ext = f.format === 'png' ? 'png' : f.format === 'webp' ? 'webp' : 'jpg';
    const file = `${dir}${p.slug.tr}-${nn}.${ext}`;
    const raw = await readFile(new URL(`data/raw/${f.file}`, ROOT));
    let pipe = sharp(raw).rotate().toColourspace('srgb').resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });
    pipe = ext === 'png' ? pipe.png({ compressionLevel: 9 }) : ext === 'webp' ? pipe.webp({ quality: 90 }) : pipe.jpeg({ quality: 90, mozjpeg: true });
    const out = await pipe.toBuffer({ resolveWithObject: true });
    if (!NO_IMAGES) await writeFile(new URL(file, ROOT), out.data);
    const { background, mean, spread } = await classify(out.data, out.info.width, out.info.height);
    const variantDef = variantDefs.find((v) => (it.group ?? '').startsWith(v.group));
    const lowRes = Math.max(out.info.width, out.info.height) < 800;
    const ovr = imgOv.overrides?.[p.code]?.[nn] ?? {};
    const variantLabel = variantDef ? { tr: variantDef.tr, en: variantDef.en } : null;
    const total = p._chosen.length;
    const altTr = `${p.name.tr}${variantLabel ? ` (${variantLabel.tr})` : ''}, ${background === 'studio' ? 'açık zeminde ürün fotoğrafı' : 'uygulama ortamında'}${total > 1 ? `, ${n}. fotoğraf` : ''}`;
    const altEn = `${p.name.en}${variantLabel ? ` (${variantLabel.en})` : ''}, ${background === 'studio' ? 'product shot on a light background' : 'shown in a treatment setting'}${total > 1 ? `, photo ${n}` : ''}`;
    p.images.push({
      file, sourceUrl: f.url, width: out.info.width, height: out.info.height,
      sha256: createHash('sha256').update(out.data).digest('hex'),
      fit: ovr.fit ?? (background === 'studio' ? 'contain' : 'cover'), position: ovr.position ?? 'center',
      lowRes, background, alt: ovr.alt ?? { tr: altTr, en: altEn }, variant: variantLabel,
    });
    imageReport.push({ code: p.code, key: p._def.key, file: f.url.split('/').pop(), out: file.split('/').pop(), size: `${f.width}×${f.height}${f.width !== out.info.width ? ` → ${out.info.width}×${out.info.height}` : ''}`, status: 'kullanıldı', background, mean, spread, lowRes, cmyk: f.space === 'cmyk' });
  }
  if (!p.images.length) p.notes.push('Görsel gerekli: kaynakta kullanılabilir görsel yok, yer tutucu gösterilir (KAY-17).');
}

// ---------- Validate & write ----------
const final = ordered.map(({ _def, _chosen, ...rest }) => rest);
const parsed = catalogSchema.safeParse(final);
if (!parsed.success) for (const i of parsed.error.issues) err(`schema: ${i.path.join('.')} ${i.message}`);
const reservedTr = ['urunler', 'hizmetler', 'rehber', 'hakkimizda', 'iletisim', 'sss', 'gizlilik', 'kvkk-aydinlatma-metni', 'cerez-politikasi', '404', 'index', ...CATEGORY_IDS.map((c) => CATEGORY_META[c].slug.tr)];
for (const p of final) if (reservedTr.includes(p.slug.tr)) err(`${p.code}: slug collides with a page slug: ${p.slug.tr}`);

await wr('data/catalog/products.json', final);
await wr(lockPath, lock);

// ---------- Reports ----------
const byKeySources = new Map();
for (const p of final) for (const u of p.sourceUrls) {
  if (!byKeySources.has(u)) byKeySources.set(u, []);
  byKeySources.get(u).push(p);
}
const excl = Object.fromEntries(ov.excluded.map((e) => [e.source, e]));
const rows = [];
const counts = { dahil: 0, birlesti: 0, bolundu: 0, haric: 0 };
for (const d of discovery.products) {
  const slug = d.slug;
  const ps = byKeySources.get(d.url) ?? [];
  const e = excl[slug];
  let decision;
  if (e?.decision === 'bölündü') { decision = `bölündü (→ ${ps.map((p) => p.code).join(', ')})`; counts.bolundu++; }
  else if (e?.decision === 'birleştirildi') { decision = `birleştirildi (→ ${e.into}; ${e.reason})`; counts.birlesti++; }
  else if (e?.decision === 'hariç') { decision = `hariç (${e.reason})`; counts.haric++; }
  else if (ps.length === 1 && ps[0].sourceUrls[0] === d.url) { decision = 'dahil'; counts.dahil++; }
  else if (ps.length) { decision = `birleştirildi (→ ${ps.map((p) => p.code).join(', ')})`; counts.birlesti++; }
  else { decision = '**KARARSIZ**'; err(`no decision for ${d.url}`); }
  const own = ps.filter((p) => !e || e.decision !== 'bölündü' ? true : true);
  rows.push(`| ${slug} | ${decision} | ${own.map((p) => p.code).join(', ') || '—'} | ${own.map((p) => `/${p.slug.tr}.html`).join('<br>') || '—'} | ${own.map((p) => `/en/${p.slug.en}.html`).join('<br>') || '—'} | ${d.sources.map((s) => s.replace('kategori:', 'kat:')).join(', ')} |`);
}
const total = discovery.products.length;
const sum = counts.dahil + counts.birlesti + counts.bolundu + counts.haric;
if (sum !== total) err(`coverage totals mismatch ${sum} != ${total}`);
const catCounts = CATEGORY_IDS.map((c) => `| ${CATEGORY_META[c].name.tr} | ${final.filter((p) => p.category === c).length} |`).join('\n');
const v1 = final.filter((p) => p.v1Path).map((p) => `| ${p.v1Path} | ${p.code} ${p.name.tr} | korundu (aynı yol, slug ürünü doğru tanımlıyor) |`).join('\n');
await wr('reports/kapsam-raporu.md', `# Kapsam raporu (KAY-22)

Üretim: ${new Date().toISOString().slice(0, 10)} · Kaynak: ${discovery.discoveredAt.slice(0, 10)} keşfi

## Toplamlar
- Kaynak ürün URL'si: **${total}** (arşiv sayfası \`/portfolios/\` hariç tutuldu)
- Dahil: **${counts.dahil}** · Birleştirildi: **${counts.birlesti}** · Bölündü: **${counts.bolundu}** · Hariç: **${counts.haric}** · Toplam: **${sum}** ${sum === total ? '✓' : '✗'}
- Katalogdaki ürün: **${final.length}** (bölünmeden gelen ${final.filter((p) => p.sourceUrls[0].endsWith('/yardimci-urunler/')).length} ürün dahil)
- Ek B karşılaştırması: eklenen ${discovery.appendixBDiff.added.length}, kaybolan ${discovery.appendixBDiff.missing.length}
- Liste sayfasında (\`/urunlerimiz/\`) olmayan URL: ${discovery.products.filter((p) => !p.sources.includes('liste')).length}

## Kategoriler
| Kategori | Ürün |
|---|---|
${catCounts}

## v1 URL kararları (MIM-05)
| v1 yolu | Ürün | Karar |
|---|---|---|
${v1}

301 gerektiren v1 yolu yok.

## URL bazında kararlar
| Kaynak slug | Karar | Kod | Yeni TR yol | Yeni EN yol | Göründüğü kaynaklar |
|---|---|---|---|---|---|
${rows.join('\n')}

## Ürün tablosu
| Kod | TR ad | EN ad | Kategori | Görsel | Düşük çöz. | Notlar |
|---|---|---|---|---|---|---|
${final.map((p) => `| ${p.code} | ${p.name.tr} | ${p.name.en} | ${p.category} | ${p.images.length} | ${p.images.filter((i) => i.lowRes).length || ''} | ${p.notes.join(' ')} |`).join('\n')}
`);

await wr('reports/gorsel-raporu.md', `# Görsel raporu (KAY-09..17)

- Kullanılan: ${imageReport.filter((r) => r.status === 'kullanıldı').length} · Hariç (TZK-01 tekrar): ${imageReport.filter((r) => r.status.includes('TZK-01')).length} · Hariç (kopya): ${imageReport.filter((r) => r.status.includes('kopya')).length} · Hariç (elle): ${imageReport.filter((r) => r.status.includes('elle')).length}
- Düşük çözünürlük (<800 px): ${imageReport.filter((r) => r.lowRes).length}
- studio: ${imageReport.filter((r) => r.background === 'studio').length} · scene: ${imageReport.filter((r) => r.background === 'scene').length}
- CMYK → sRGB dönüştürülen: ${imageReport.filter((r) => r.cmyk).map((r) => r.file).join(', ') || 'yok'}
- Uranus banner (TZK-01): \`Uranus.webp\` ve \`Uranus3.webp\` yalnızca temanın CSS arka planında; içerik alanından toplama yapıldığı için hiçbir galeriye girmedi.
- Görselsiz ürün: ${final.filter((p) => !p.images.length).map((p) => `${p.code} ${p.name.tr}`).join(', ') || 'yok'}

## ≥3 ürün sayfasında tekrar eden görseller (otomatik hariç)
| Sayfa | Dosya | Küme sayfaları |
|---|---|---|
${repeatedReport.map((r) => `| ${r.slug} | ${r.file} | ${r.pages} |`).join('\n')}

## Yeni fotoğraf gereken düşük çözünürlüklü görseller
| Kod | Kaynak dosya | Boyut |
|---|---|---|
${imageReport.filter((r) => r.lowRes).map((r) => `| ${r.code} | ${r.file} | ${r.size} |`).join('\n')}

## Bütün görseller
| Kod | Kaynak | Çıktı | Boyut | Durum | Fon (ort./fark) |
|---|---|---|---|---|---|
${imageReport.map((r) => `| ${r.code ?? r.key} | ${r.file} | ${r.out ?? '—'} | ${r.size ?? ''} | ${r.status}${r.reason ? ` — ${r.reason}` : ''} | ${r.background ? `${r.background} (${r.mean}/${r.spread})` : ''} |`).join('\n')}
`);

const csvCell = (s) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv = ['kod;TR ad;EN ad;spaworld adı;spaworld URL;yeni TR URL;yeni EN URL']
  .concat(final.map((p) => [p.code, p.name.tr, p.name.en, p.sourceNameRaw, p.sourceUrls[0], `https://spadunyasi.com.tr/${p.slug.tr}.html`, `https://spadunyasi.com.tr/en/${p.slug.en}.html`].map(csvCell).join(';')))
  .join('\r\n');
await wr('docs/urun-eslestirme.csv', '﻿' + csv + '\r\n');

console.log(`products=${final.length} images=${final.reduce((a, p) => a + p.images.length, 0)} lowres=${final.reduce((a, p) => a + p.images.filter((i) => i.lowRes).length, 0)}`);
console.log(`coverage: ${JSON.stringify(counts)} total=${sum}/${total}`);
warnings.forEach((w) => console.log('WARN', w));
if (errors.length) {
  errors.forEach((e) => console.log('ERROR', e));
  process.exit(1);
}
console.log('catalog OK');
