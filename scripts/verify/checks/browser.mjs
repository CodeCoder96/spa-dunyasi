// verify:browser — Playwright suite (KAL-11 axe, KAL-13 visual QA, KAL-14 no-JS, KAL-15 console/CSP,
// KAL-16 analytics on the G-TEST000000 build, KAL-17 quote list, ERS-02 keyboard). Runs against dist/.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sh = (cmd) => spawnSync(cmd, { stdio: 'inherit', shell: true });

export default [
  {
    id: 'kal-11-17-browser',
    title: 'Playwright: axe, görsel QA, JS kapalı, konsol/CSP, analytics, teklif listesi, klavye',
    async run(res) {
      if (sh('node scripts/qa/build-ga-test.mjs').status !== 0) {
        res.errors.push('GA test build başarısız');
        return;
      }
      sh('npx playwright test');
      const report = JSON.parse(readFileSync('reports/verify/playwright.json', 'utf8'));
      const walk = (suite, out = []) => {
        for (const s of suite.suites ?? []) walk(s, out);
        for (const spec of suite.specs ?? []) out.push(spec);
        return out;
      };
      const specs = report.suites.flatMap((s) => walk(s));
      let passed = 0;
      for (const sp of specs) {
        if (sp.ok) passed++;
        else res.errors.push(`${sp.file}: ${sp.title}`);
      }
      res.info = { tests: specs.length, passed };
    },
  },
];
