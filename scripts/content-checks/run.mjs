// Runs every content check over src/content (or a subset) and returns issues grouped by check id.
import {
  listContent, parseContent, proseOf, wordCount, sourceOverlaps, bannedHits, numberViolations, contextCodes,
  tokens, ngrams, LIMITS, titleLength, CTA_WORDS, lower,
} from './lib.mjs';

export function runContentChecks({ only } = {}) {
  const entries = listContent().map((e) => ({ ...e, ...parseContent(e.path) }));
  const target = only ? entries.filter((e) => only.some((o) => e.path.replace(/\\/g, '/').endsWith(o.replace(/\\/g, '/')))) : entries;
  const issues = { 'kal-05': [], 'kal-06': [], 'kal-07': [], 'kal-08': [], 'ici-14': [] };
  const stats = [];

  // ICR-14: every entry has its counterpart.
  for (const e of entries) {
    const other = entries.find((x) => x.collection === e.collection && x.id === e.id && x.lang !== e.lang);
    if (!other) issues['ici-14'].push(`${e.path}: ${e.lang === 'tr' ? 'EN' : 'TR'} karşılığı yok`);
  }

  for (const e of target) {
    const { main, faq } = proseOf(e.fm, e.body);
    const mainText = main.map((p) => p.text).join(' \n ');
    const all = `${mainText} ${faq.map((f) => f.text).join(' ')}`;
    const words = wordCount(main.filter((p) => p.field !== 'description').map((p) => p.text).join(' '));
    stats.push({ path: e.path, words, faq: (e.fm.faq ?? []).length });

    // KAL-05 originality.
    for (const g of sourceOverlaps(`${all} ${e.fm.title ?? ''}`, e.lang)) issues['kal-05'].push(`${e.path}: kaynakla ortak 8-gram: "${g}"`);
    // KAL-07 banned phrases + numbers.
    for (const h of bannedHits(`${all} ${e.fm.title ?? ''}`, e.lang)) issues['kal-07'].push(`${e.path}: yasaklı ifade ${h}`);
    for (const v of numberViolations(all, e.lang, contextCodes(e.collection, e.id, e.fm, e.body))) issues['kal-07'].push(`${e.path}: ${v}`);
    // Placeholder text (KAL-04 also checks HTML).
    for (const p of ['todo', 'tbd', 'lorem', 'undefined', 'nan', '{{', '}}', '[object object]']) if (` ${lower(all)} `.includes(p.length > 3 ? p : ` ${p} `)) issues['kal-07'].push(`${e.path}: yer tutucu "${p}"`);

    // KAL-08 lengths and meta.
    const key = e.collection === 'pages' ? `pages/${e.id}` : e.collection;
    const lim = LIMITS[key];
    if (lim?.min) {
      const w = lim.withFaq ? words + wordCount(faq.map((f) => f.text).join(' ')) : words;
      if (w < lim.min || w > lim.max) issues['kal-08'].push(`${e.path}: ${w} kelime (hedef ${lim.min}-${lim.max})`);
    }
    if (lim?.faq) {
      const n = (e.fm.faq ?? []).length;
      if (n < lim.faq[0] || n > lim.faq[1]) issues['kal-08'].push(`${e.path}: ${n} SSS (hedef ${lim.faq[0]}-${lim.faq[1]})`);
    }
    if (lim?.faqItems) {
      const n = (e.fm.faq ?? []).length;
      if (n < lim.faqItems[0] || n > lim.faqItems[1]) issues['kal-08'].push(`${e.path}: ${n} soru (hedef ${lim.faqItems[0]}-${lim.faqItems[1]})`);
    }
    if (lim?.intro && wordCount(String(e.fm.intro ?? '')) > lim.intro) issues['kal-08'].push(`${e.path}: giriş ${wordCount(String(e.fm.intro))} kelime (en fazla ${lim.intro})`);
    if (e.fm.title) {
      const tl = titleLength(e.collection, e.id, e.fm.title);
      if (tl > 60) issues['kal-08'].push(`${e.path}: <title> ${tl} karakter (en fazla 60)`);
    }
    const d = String(e.fm.description ?? '');
    if (d && (d.length < 120 || d.length > 155)) issues['kal-08'].push(`${e.path}: description ${d.length} karakter (120-155)`);
    if (d && !CTA_WORDS[e.lang].some((w) => lower(d, e.lang).includes(w))) issues['kal-08'].push(`${e.path}: description eylem çağrısı içermiyor`);
  }

  // Uniqueness of titles / descriptions / primary keywords per language (SEO-01, SEO-03).
  for (const lang of ['tr', 'en']) {
    for (const field of ['title', 'description']) {
      const seen = new Map();
      for (const e of entries.filter((x) => x.lang === lang && x.fm[field])) {
        const k = lower(String(e.fm[field]), lang);
        if (seen.has(k)) issues['kal-08'].push(`${e.path}: ${field} tekrar ediyor (${seen.get(k)})`);
        seen.set(k, e.path);
      }
    }
    const kw = new Map();
    for (const e of entries.filter((x) => x.lang === lang && x.fm.keyword?.primary)) {
      const k = lower(e.fm.keyword.primary, lang);
      if (kw.has(k)) issues['kal-08'].push(`${e.path}: ana kelime "${k}" ${kw.get(k)} ile aynı (SEO-01)`);
      kw.set(k, e.path);
    }
  }

  // KAL-06 site-internal similarity: same language and collection, 5-gram Jaccard ≤ 0.20.
  const groups = new Map();
  for (const e of entries) {
    const k = `${e.lang}|${e.collection}`;
    if (!groups.has(k)) groups.set(k, []);
    const { main, faq } = proseOf(e.fm, e.body);
    groups.get(k).push({ e, grams: ngrams(tokens([...main, ...faq].map((p) => p.text).join(' '), e.lang), 5) });
  }
  let maxJ = { v: 0, pair: '' };
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (only && !target.includes(a.e) && !target.includes(b.e)) continue;
        let inter = 0;
        for (const g of a.grams) if (b.grams.has(g)) inter++;
        const jac = inter / (a.grams.size + b.grams.size - inter || 1);
        if (jac > maxJ.v) maxJ = { v: jac, pair: `${a.e.path} ~ ${b.e.path}` };
        if (jac > 0.2) issues['kal-06'].push(`${a.e.path} ~ ${b.e.path}: Jaccard ${jac.toFixed(3)}`);
      }
  }
  return { issues, stats, maxJaccard: maxJ, entries: entries.length };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const only = process.argv.slice(2);
  const r = runContentChecks({ only: only.length ? only : undefined });
  for (const [k, v] of Object.entries(r.issues)) {
    console.log(`${v.length ? 'FAIL' : 'ok  '} ${k} (${v.length})`);
    v.slice(0, 40).forEach((x) => console.log('   ', x));
  }
  for (const s of r.stats) console.log(`  ${s.path}: ${s.words} kelime, ${s.faq} SSS`);
  console.log(`max Jaccard ${r.maxJaccard.v.toFixed(3)} ${r.maxJaccard.pair}`);
}
