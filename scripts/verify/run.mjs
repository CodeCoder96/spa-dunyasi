// Verification runner (Section 18). Usage: node scripts/verify/run.mjs [data|content|seo|output|...]
// Each check writes reports/verify/<id>.json (machine-readable) and the runner prints a human summary.
import { mkdir, writeFile } from 'node:fs/promises';

const GROUPS = {
  data: ['./checks/data.mjs'],
  content: ['./checks/content.mjs'],
  seo: ['./checks/seo.mjs'],
  output: ['./checks/output.mjs'],
  code: ['./checks/code.mjs'],
  browser: ['./checks/browser.mjs'],
  lighthouse: ['./checks/lighthouse.mjs'],
};
const ORDER = ['data', 'content', 'seo', 'output', 'code', 'browser', 'lighthouse'];

const wanted = process.argv[2] ? [process.argv[2]] : ORDER;
const out = new URL('../../reports/verify/', import.meta.url);
await mkdir(out, { recursive: true });

let failed = 0;
for (const g of wanted) {
  if (!GROUPS[g]) {
    console.error(`unknown group ${g}`);
    process.exit(2);
  }
  for (const mod of GROUPS[g]) {
    let checks;
    try {
      checks = (await import(mod)).default;
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND' && process.argv[2] !== g) {
        console.log(`- ${g}: not implemented yet (skipped)`);
        continue;
      }
      throw e;
    }
    for (const check of checks) {
      const started = Date.now();
      const res = { id: check.id, title: check.title, errors: [], warnings: [], info: {} };
      try {
        await check.run(res);
      } catch (e) {
        res.errors.push(`check crashed: ${e.stack ?? e}`);
      }
      res.ms = Date.now() - started;
      res.ok = res.errors.length === 0;
      res.at = new Date().toISOString();
      await writeFile(new URL(`${check.id}.json`, out), JSON.stringify(res, null, 2) + '\n');
      if (!res.ok) failed++;
      console.log(`${res.ok ? 'PASS' : 'FAIL'} ${check.id} ${check.title} (${res.errors.length} hata, ${res.warnings.length} uyarı, ${res.ms} ms)`);
      for (const e of res.errors.slice(0, 15)) console.log(`   ✗ ${e}`);
      if (res.errors.length > 15) console.log(`   … ${res.errors.length - 15} more (see reports/verify/${check.id}.json)`);
      for (const w of res.warnings.slice(0, 5)) console.log(`   ! ${w}`);
    }
  }
}
console.log(failed ? `\n${failed} kontrol başarısız.` : '\nBütün kontroller geçti.');
process.exit(failed ? 1 : 0);
