// verify:lighthouse — KAL-12 / PER-01: local mobile Lighthouse (simulated throttling) on the PER-01 pages.
// Targets: Performance ≥ 95, Accessibility 100, Best Practices 100, SEO 100 (not for 404),
// LCP ≤ 2.0 s, CLS ≤ 0.05, TBT ≤ 100 ms. Uses installed Chrome, or Playwright's Chromium via CHROME_PATH.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

const PORT = 4340;
const PAGES = [
  ['tr-home', '/'],
  ['en-home', '/en/'],
  ['category', '/masaj-yataklari.html'],
  ['product-studio', '/brand-cilt-bakim-koltugu.html'],
  ['product-scene', '/mercury-dinlenme-yatagi.html'],
  ['guide', '/masaj-yatagi-secimi.html'],
  ['contact', '/iletisim.html'],
  ['404', '/lighthouse-olmayan-sayfa.html'],
];
const RUNS = 3; // median run is reported (Lighthouse's own recommendation against run-to-run variance)

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const win = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  return existsSync(win) ? win : undefined;
}

export default [
  {
    id: 'kal-12-lighthouse',
    title: 'Lighthouse mobil (PER-01 sayfaları)',
    async run(res) {
      await mkdir('reports/lighthouse', { recursive: true });
      const server = spawn(process.execPath, ['scripts/serve-dist.mjs', String(PORT)], { stdio: 'ignore' });
      await new Promise((r) => setTimeout(r, 800));
      const rows = [];
      try {
        for (const [name, path] of PAGES) {
          const runs = [];
          for (let i = 0; i < RUNS; i++) {
            const out = `reports/lighthouse/${name}.json`;
            const env = { ...process.env, ...(chromePath() ? { CHROME_PATH: chromePath() } : {}) };
            spawnSync(`npx lighthouse "http://localhost:${PORT}${path}" --quiet --output=json --output-path="${out}" --chrome-flags="--headless=new" --form-factor=mobile --throttling-method=simulate${name === '404' ? ' --ignore-status-code' : ''}`, { shell: true, env, stdio: 'ignore' });
            if (!existsSync(out)) continue;
            const j = JSON.parse(readFileSync(out, 'utf8'));
            if (j.runtimeError) continue;
            const c = j.categories;
            const a = j.audits;
            const r = {
              name,
              path,
              perf: Math.round(c.performance.score * 100),
              a11y: Math.round(c.accessibility.score * 100),
              bp: Math.round(c['best-practices'].score * 100),
              seo: Math.round(c.seo.score * 100),
              lcp: a['largest-contentful-paint'].numericValue,
              cls: a['cumulative-layout-shift'].numericValue,
              tbt: a['total-blocking-time'].numericValue,
              failedBp: Object.values(a)
                .filter((x) => c['best-practices'].auditRefs.some((ref) => ref.id === x.id && ref.weight > 0) && x.score !== null && x.score < 1)
                .map((x) => ({ id: x.id, items: (x.details?.items ?? []).map((i) => i.description ?? '') })),
              failedSeo: Object.values(a).filter((x) => c.seo.auditRefs.some((ref) => ref.id === x.id && ref.weight > 0) && x.score !== null && x.score < 1).map((x) => x.id),
            };
            runs.push(r);
          }
          runs.sort((x, y) => x.lcp - y.lcp);
          const best = runs.length ? runs[Math.floor((runs.length - 1) / 2)] : null;
          if (!best) {
            res.errors.push(`${name}: Lighthouse çalışmadı`);
            continue;
          }
          rows.push(best);
          const b = best;
          if (b.perf < 95) res.errors.push(`${name}: performans ${b.perf} < 95`);
          if (b.a11y < 100) res.errors.push(`${name}: erişilebilirlik ${b.a11y}`);
          // On the 404 page the browser itself logs the document's 404 status to the console; that is inherent to a
          // real 404 response (D-022). Any other best-practices failure is still an error.
          const only404Log = name === '404' && b.failedBp.every((f) => f.id === 'errors-in-console' && f.items.every((d) => /status of 404/.test(d)));
          if (b.bp < 100) (only404Log ? res.warnings : res.errors).push(`${name}: en iyi uygulamalar ${b.bp} (${b.failedBp.map((f) => f.id).join(', ')})`);
          if (name !== '404' && b.seo < 100) {
            // Origin mismatch (localhost vs spadunyasi.com.tr) can fail canonical/hreflang audits locally (KAL-12): report only.
            const onlyOrigin = b.failedSeo.every((id) => ['canonical', 'hreflang'].includes(id));
            (onlyOrigin ? res.warnings : res.errors).push(`${name}: SEO ${b.seo} (${b.failedSeo.join(', ')})`);
          }
          if (b.lcp > 2000) res.errors.push(`${name}: LCP ${(b.lcp / 1000).toFixed(2)} s > 2.0 s`);
          if (b.cls > 0.05) res.errors.push(`${name}: CLS ${b.cls.toFixed(3)} > 0.05`);
          if (b.tbt > 100) res.errors.push(`${name}: TBT ${Math.round(b.tbt)} ms > 100 ms`);
        }
      } finally {
        server.kill();
      }
      const md = [
        '# Lighthouse (yerel, mobil, simüle kısıtlama)',
        '',
        `Tarih: ${new Date().toISOString().slice(0, 10)} · Her sayfa ${RUNS} kez ölçüldü; LCP'ye göre medyan çalıştırma raporlandı. Sunucu: scripts/serve-dist.mjs (gzip açık).`,
        '',
        '| Sayfa | Yol | Perf | Erişil. | En iyi uyg. | SEO | LCP | CLS | TBT |',
        '|---|---|---|---|---|---|---|---|---|',
        ...rows.map((r) => `| ${r.name} | ${r.path} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.name === '404' ? `(${r.seo})` : r.seo} | ${(r.lcp / 1000).toFixed(2)} s | ${r.cls.toFixed(3)} | ${Math.round(r.tbt)} ms |`),
        '',
        '404 sayfasının SEO skoru hedef dışıdır (noindex + 404 durum kodu, PER-01). En iyi uygulamalar skorundaki tek eksik, tarayıcının belgenin kendi 404 durumunu konsola yazmasıdır (D-022).',
      ].join('\n');
      await writeFile('reports/lighthouse/summary.md', md + '\n');
      res.info = { rows };
    },
  },
];
