// Content checks shared by verify:content and the per-file CLI (KAL-05..08, ICR-03, ICR-11, ICR-12, SEO-03).
// All matching is Turkish-aware: NFC + toLocaleLowerCase('tr-TR'); never a regex /i flag (ICR-11).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import * as cheerio from 'cheerio';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const json = (p) => JSON.parse(read(p));

export const lower = (s, lang = 'tr') => (s ?? '').normalize('NFC').toLocaleLowerCase(lang === 'en' ? 'en-GB' : 'tr-TR');
/** Normalise for n-gram comparison: NFC, tr lowercase, punctuation removed (KAL-05). */
export function tokens(s, lang = 'tr') {
  return lower(s, lang)
    .replace(/[‘’']/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
export const ngrams = (toks, n) => {
  const out = new Set();
  for (let i = 0; i + n <= toks.length; i++) out.add(toks.slice(i, i + n).join(' '));
  return out;
};

// ---------------------------------------------------------------------------------------------
// Front matter + body parsing (tiny YAML subset used by our content files).
export function parseContent(path) {
  const raw = read(path).replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${path}: no front matter`);
  return { fm: parseYaml(m[1]), body: m[2] };
}

function scalar(v) {
  v = v.trim();
  if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1).split(',').map((x) => scalar(x)).filter((x) => x !== '');
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

/** Minimal YAML: maps, lists of scalars, lists of maps, inline arrays. Enough for our front matter. */
export function parseYaml(src) {
  const lines = src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  let i = 0;
  const indentOf = (l) => l.match(/^ */)[0].length;
  function block(indent) {
    const first = lines[i];
    if (first && first.trim().startsWith('- ')) {
      const arr = [];
      while (i < lines.length && indentOf(lines[i]) === indent && lines[i].trim().startsWith('- ')) {
        const content = lines[i].trim().slice(2);
        const kv = content.match(/^([\w-]+):\s*(.*)$/);
        if (kv && !content.startsWith('"')) {
          // list of maps
          const obj = {};
          obj[kv[1]] = kv[2] === '' ? undefined : scalar(kv[2]);
          i++;
          while (i < lines.length && indentOf(lines[i]) === indent + 2 && !lines[i].trim().startsWith('- ')) {
            const m2 = lines[i].trim().match(/^([\w-]+):\s*(.*)$/);
            if (m2) obj[m2[1]] = scalar(m2[2]);
            i++;
          }
          arr.push(obj);
        } else {
          arr.push(scalar(content));
          i++;
        }
      }
      return arr;
    }
    const obj = {};
    while (i < lines.length && indentOf(lines[i]) === indent) {
      const m = lines[i].trim().match(/^([\w-]+):\s*(.*)$/);
      if (!m) {
        i++;
        continue;
      }
      i++;
      if (m[2] === '') {
        const childIndent = i < lines.length ? indentOf(lines[i]) : indent + 2;
        obj[m[1]] = childIndent > indent || (lines[i] ?? '').trim().startsWith('- ') ? block(childIndent) : '';
      } else obj[m[1]] = scalar(m[2]);
    }
    return obj;
  }
  return block(0);
}

/** Markdown body → plain prose (links keep their text, markers and headings kept as text). */
export function mdToText(md) {
  return md
    .replace(/^@kart\s+SD-\d{3}\s*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#|]/g, ' ')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const inline = (s) => mdToText(String(s ?? ''));

/** All prose of a content entry, split by field for reporting. FAQ is kept separate (ICR-03 counts it apart). */
export function proseOf(fm, body) {
  const parts = [];
  const push = (field, v) => v && parts.push({ field, text: inline(v) });
  for (const k of ['description', 'intro', 'lead', 'price', 'h1']) push(k, fm[k]);
  if (fm.hero?.subtitle) push('hero', fm.hero.subtitle);
  for (const h of fm.highlights ?? []) push('highlights', h);
  for (const s of fm.summary ?? []) push('summary', s);
  for (const s of fm.steps ?? []) {
    push('steps', s.title);
    push('steps', s.text);
  }
  for (const w of fm.why ?? []) {
    push('why', w.title);
    push('why', w.text);
  }
  for (const v of Object.values(fm.sections ?? {})) push('sections', v);
  push('body', body);
  const faq = (fm.faq ?? []).map((f) => ({ field: 'faq', text: `${inline(f.q)} ${inline(f.a)}` }));
  return { main: parts, faq };
}

export const wordCount = (s) => (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;

// ---------------------------------------------------------------------------------------------
// Source corpus (KAL-05): prose of every scraped HTML page.
let corpusCache = null;
export function corpus() {
  if (corpusCache) return corpusCache;
  const rawDir = new URL('data/raw/', ROOT);
  const grams = new Set();
  for (const f of readdirSync(rawDir).filter((x) => x.endsWith('.html'))) {
    const $ = cheerio.load(readFileSync(new URL(f, rawDir), 'utf8'));
    $('script,style,noscript,svg').remove();
    const text = $('body').text();
    for (const lang of ['tr', 'en']) for (const g of ngrams(tokens(text, lang), 8)) grams.add(g);
  }
  // The PDF catalogue is part of the source too.
  if (existsSync(new URL('data/source/katalog-pdf.json', ROOT))) {
    for (const p of json('data/source/katalog-pdf.json').pages) for (const g of ngrams(tokens(p), 8)) grams.add(g);
  }
  corpusCache = grams;
  return grams;
}

/** Tokens excluded from KAL-05: model names, catalog technical values, address/phone/email. */
let maskCache = null;
function maskTerms() {
  if (maskCache) return maskCache;
  const cat = json('data/catalog/products.json');
  const terms = new Set();
  for (const p of cat) {
    for (const v of [p.model, p.name.tr, p.name.en, p.sourceNameRaw]) if (v) terms.add(v);
    for (const s of p.specs) for (const v of [s.valueRaw, s.value.tr, s.value.en]) terms.add(v);
    for (const o of p.options) for (const v of [o.tr, o.en]) terms.add(v);
  }
  for (const v of ['Fındıklı, Yaseminler Sokağı No: 7 A, 34854 Maltepe/İstanbul, Türkiye', 'info@spaworld.com.tr', '+90 534 359 76 44', '+90 534 451 88 97', '+90 216 755 39 55']) terms.add(v);
  // Tokenise in both locales: en-GB lowercases "İ" to "i̇", which tokenises differently from tr-TR.
  maskCache = [...terms].flatMap((t) => [tokens(t, 'tr'), tokens(t, 'en')]).filter((t) => t.length).sort((a, b) => b.length - a.length);
  return maskCache;
}
function mask(toks) {
  const out = [...toks];
  for (const term of maskTerms()) {
    for (let i = 0; i + term.length <= out.length; i++) {
      let hit = true;
      for (let k = 0; k < term.length; k++) if (out[i + k] !== term[k]) { hit = false; break; }
      if (hit) for (let k = 0; k < term.length; k++) out[i + k] = `§${i + k}`; // unique placeholder breaks the n-gram
    }
  }
  return out;
}

export function sourceOverlaps(text, lang) {
  const grams = corpus();
  const toks = mask(tokens(text, lang));
  const hits = [];
  for (let i = 0; i + 8 <= toks.length; i++) {
    const g = toks.slice(i, i + 8).join(' ');
    if (!g.includes('§') && grams.has(g)) hits.push(g);
  }
  return [...new Set(hits)];
}

// ---------------------------------------------------------------------------------------------
// Banned phrases (Ek D, ICR-11). Extendable via data/overrides/allowed-phrases.json.
const BANNED = {
  tr: [
    'en iyi', 'en kaliteli', 'en ucuz', 'en uygun fiyat', 'en güvenilir', 'lider', 'sektör lideri', 'bir numara', '1 numara',
    "türkiye'nin en", 'türkiyenin en', 'dünyanın en', 'rakipsiz', 'eşsiz', 'benzersiz kalite', '%100', 'garantili sonuç',
    'tedavi eder', 'iyileştirir', 'şifa', 'detoks', 'toksin', 'selülit', 'zayıfla', 'kilo verdir', 'bağışıklık',
    'ağrıyı giderir', 'ağrıyı azaltır', 'hastalık', 'ücretsiz kargo', 'ücretsiz kurulum', 'stokta', 'hemen teslim',
    'indirim', 'kampanya', 'ucuz', '7/24', 'ce belgeli', 'iso', 'tse',
    // extensions (kept, never narrowed)
    'kan dolaşımı', 'dolaşımı hızlandır', 'kas ağrı', 'stresi azalt', 'mucize',
  ],
  en: [
    'the best', 'best-in-class', 'best quality', 'best price', 'cheapest', 'leading', 'market leader', 'number one', '#1',
    'world-class', 'unrivalled', 'unrivaled', '100%', 'guaranteed results', 'cure', 'cures', 'heals', 'treats', 'detox',
    'toxins', 'cellulite', 'weight loss', 'immune', 'pain relief', 'free shipping', 'free installation', 'in stock',
    'discount', 'on sale', '24/7', 'ce certified', 'iso certified',
    // extensions
    'circulation', 'relieves', 'miracle',
  ],
};
const allowed = existsSync(new URL('data/overrides/allowed-phrases.json', ROOT)) ? json('data/overrides/allowed-phrases.json').allowed ?? [] : [];

/** Word-boundary match on a tr-lowercased text (boundary = not a letter/digit). */
function findPhrase(text, phrase, lang = 'tr') {
  const hits = [];
  let from = 0;
  while (true) {
    const i = text.indexOf(phrase, from);
    if (i < 0) break;
    const before = text[i - 1] ?? ' ';
    const after = text[i + phrase.length] ?? ' ';
    const isWord = /[\p{L}\p{N}]/u;
    const startOk = !isWord.test(before) || !isWord.test(phrase[0]);
    // Turkish is agglutinative: "lider" must also catch "lideri", so TR matches are prefix matches.
    const endOk = lang === 'tr' || !isWord.test(after) || !isWord.test(phrase.at(-1));
    if (startOk && endOk) hits.push(text.slice(Math.max(0, i - 25), i + phrase.length + 25));
    from = i + phrase.length;
  }
  return hits;
}

export function bannedHits(text, lang) {
  const t = lower(text, lang);
  const out = [];
  for (const p of BANNED[lang]) {
    for (const ctx of findPhrase(t, p, lang)) {
      if (allowed.some((a) => a.lang === lang && ctx.includes(lower(a.phrase, lang)))) continue;
      out.push(`"${p}" … ${ctx.trim()}`);
    }
  }
  // "tedavi" only in "fizik tedavi" / "tedavi merkezi/merkezleri" (Ek D).
  if (lang === 'tr') {
    for (const ctx of findPhrase(t.replace(/fizik tedavi|tedavi merkez(?:i|leri)/g, '∅'), 'tedavi')) out.push(`"tedavi" … ${ctx.trim()}`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Number integrity (ICR-12).
// Duration units take Turkish suffixes ("haftada", "günde", "yılı"); "ay" lists its suffixes so "ayaklı" is not a month.
const UNIT_RE = String.raw`(cm|mm|m²|m2|m|kg|kw|v|w|°c|°|l|lt|yıl\p{L}*|ay(?:da|dan|dır|lık|a|ı|ın)?|gün\p{L}*|hafta\p{L}*|adet|years?|months?|days?|weeks?|pcs|%)`;
let factsCache = null;
function allFacts() {
  if (factsCache) return factsCache;
  const cat = json('data/catalog/products.json');
  const derived = existsSync(new URL('data/derived-facts.json', ROOT)) ? json('data/derived-facts.json').facts ?? [] : [];
  factsCache = { cat, derived };
  return factsCache;
}

/** "80 × 200 cm" → ["80 cm","200 cm"]; "68-85 cm" → ["68-85 cm"]; "%95" → ["95 %"]. */
export function numberUnits(text, lang) {
  const t = lower(text, lang).replace(/(\d)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)\b/g, '$1 $3 $2 $3');
  const out = [];
  const re = new RegExp(String.raw`(?<![\p{L}\d])(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*-?\s*${UNIT_RE}(?![\p{L}])`, 'gu');
  for (const m of t.matchAll(re)) out.push(`${m[1].replace(/\s*[-–]\s*/, '-')} ${m[2]}`);
  for (const m of t.matchAll(/%\s*(\d+(?:[.,]\d+)?)/g)) out.push(`${m[1]} %`);
  return out;
}
const normUnit = (u) => {
  if (/^yıl/.test(u)) return 'yıl';
  if (/^ay/.test(u)) return 'ay';
  if (/^gün/.test(u)) return 'gün';
  if (/^hafta/.test(u)) return 'hafta';
  return ({ m2: 'm²', lt: 'l', '°c': '°', years: 'yıl', year: 'yıl', months: 'ay', month: 'ay', days: 'gün', day: 'gün', weeks: 'hafta', week: 'hafta', pcs: 'adet' })[u] ?? u;
};
const norm = (nu) => {
  const [n, u] = nu.split(' ');
  return `${n.replace(',', '.')} ${normUnit(u)}`;
};

/** Allowed number+unit pairs for a page: catalog values of the given products + derived facts + §4. */
export function allowedNumbers(codes) {
  const { cat, derived } = allFacts();
  const set = new Set(['5 yıl']);
  for (const p of cat.filter((x) => codes.includes(x.code))) {
    for (const s of p.specs) for (const v of [s.valueRaw, s.value.tr, s.value.en]) for (const nu of numberUnits(v, 'tr')) set.add(norm(nu));
    for (const o of p.options) for (const v of [o.tr, o.en]) for (const nu of numberUnits(v, 'tr')) set.add(norm(nu));
    // Ranges also allow their endpoints: "68-85 cm" → 68 cm, 85 cm.
    for (const v of [...set]) {
      const m = v.match(/^([\d.]+)-([\d.]+) (.+)$/);
      if (m) {
        set.add(`${m[1]} ${m[3]}`);
        set.add(`${m[2]} ${m[3]}`);
      }
    }
  }
  for (const f of derived) for (const nu of numberUnits(f.value, 'tr')) set.add(norm(nu));
  return set;
}

export function numberViolations(text, lang, codes) {
  const allowedSet = allowedNumbers(codes);
  const out = [];
  for (const nu of numberUnits(text, lang)) {
    const n = norm(nu);
    const unit = n.split(' ')[1];
    if (['ay', 'gün', 'hafta'].includes(unit)) {
      out.push(`süre birimi yasak: "${nu}"`);
      continue;
    }
    if (unit === 'yıl' && n !== '5 yıl') {
      out.push(`yalnızca "5 yıl" geçerli: "${nu}"`);
      continue;
    }
    if (!allowedSet.has(n)) out.push(`katalogda/derived-facts'te yok: "${nu}"`);
  }
  return out;
}

/** Product codes a content file is allowed to cite numbers for. */
export function contextCodes(collection, id, fm, body) {
  const { cat } = allFacts();
  const linked = [...`${JSON.stringify(fm)} ${body}`.matchAll(/(?:urun:|@kart\s+)(SD-\d{3})/g)].map((m) => m[1]);
  const codes = new Set(linked);
  if (collection === 'products') codes.add(id);
  if (collection === 'categories') for (const p of cat.filter((x) => x.category === id)) codes.add(p.code);
  for (const c of fm.products ?? []) codes.add(c);
  for (const c of fm.relatedProducts ?? []) codes.add(c);
  for (const c of fm.featured ?? []) codes.add(c);
  return [...codes];
}

// ---------------------------------------------------------------------------------------------
// Lengths (ICR-03) and meta (SEO-03).
export const LIMITS = {
  products: { min: 300, max: 600, faq: [2, 4] },
  categories: { min: 250, max: 500, intro: 80 },
  services: { min: 600, max: 1000 },
  guides: { min: 1200, max: 2000 },
  'pages/anasayfa': { min: 500, max: 900, withFaq: true },
  'pages/hakkimizda': { min: 300, max: 600 },
  'pages/sss': { faqItems: [8, 12] },
};
export const TITLE_SUFFIX = ' | Spa Dünyası';
export function titleLength(collection, id, title) {
  return collection === 'pages' && id === 'anasayfa' ? title.length : title.length + TITLE_SUFFIX.length;
}
export const CTA_WORDS = {
  tr: ['whatsapp', 'sorun', 'isteyin', 'inceleyin', 'iletin', 'arayın', 'ulaşın', 'alın', 'öğrenin', 'okuyun', 'keşfedin', 'karşılaştırın', 'bakın', 'yazın', 'göz atın'],
  en: ['whatsapp', 'ask', 'call', 'browse', 'compare', 'read', 'contact', 'get', 'see', 'explore', 'find', 'send', 'message', 'check'],
};

export function listContent() {
  const out = [];
  for (const collection of ['products', 'categories', 'services', 'guides', 'pages']) {
    for (const lang of ['tr', 'en']) {
      const dir = new URL(`src/content/${collection}/${lang}/`, ROOT);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) out.push({ collection, lang, id: f.slice(0, -3), path: `src/content/${collection}/${lang}/${f}` });
    }
  }
  return out;
}
