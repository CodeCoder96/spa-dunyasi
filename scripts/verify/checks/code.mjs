// verify:code — KAL-18 (Stylelint + strict TypeScript via astro check), TAS-02 (raw colours only in tokens.css),
// TAS-04 (no text-transform: uppercase). Astro <style> blocks are extracted to .scratch/css so Stylelint needs
// no extra syntax package.
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = path.join(ROOT, '.scratch', 'css');

async function walk(dir, ext, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, ext, out);
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

async function extract() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const files = [];
  for (const f of await walk(path.join(ROOT, 'src'), ['.astro', '.css'])) {
    const src = await readFile(f, 'utf8');
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const css = f.endsWith('.css') ? src : [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    if (!css.trim()) continue;
    // :global(x) is Astro syntax; unwrap it for linting.
    const out = path.join(OUT, rel.replace(/[/\\]/g, '__') + '.css');
    await writeFile(out, css.replace(/:global\(([^)]*)\)/g, '$1'));
    files.push({ out, rel, css });
  }
  // Custom properties provided at runtime by the Astro Fonts API.
  const runtime = path.join(OUT, '_runtime-props.css');
  await writeFile(runtime, ':root { --font-inter: sans-serif; --font-fraunces: serif; }\n');
  return { files, runtime };
}

export default [
  {
    id: 'kal-18-stylelint',
    title: 'Stylelint (tekrar eden seçici/özellik, tanımsız custom property), TAS-02, TAS-04',
    async run(res) {
      const { files, runtime } = await extract();
      const result = await stylelint.lint({
        files: files.map((f) => f.out),
        config: {
          extends: ['stylelint-config-standard'],
          plugins: ['stylelint-value-no-unknown-custom-properties'],
          rules: {
            'csstools/value-no-unknown-custom-properties': [true, { importFrom: [path.join(ROOT, 'src/styles/tokens.css'), path.join(ROOT, 'src/styles/global.css'), runtime] }],
            'no-duplicate-selectors': true,
            'declaration-block-no-duplicate-properties': true,
            // Project conventions (BEM-style class names, tokens, logical order) rather than errors:
            'selector-class-pattern': null,
            'custom-property-pattern': null,
            'no-descending-specificity': null,
            'declaration-empty-line-before': null,
            'property-no-vendor-prefix': null,
            'value-keyword-case': null,
            'import-notation': null,
            'media-feature-range-notation': 'context',
            'selector-not-notation': null,
            'comment-empty-line-before': null,
            'rule-empty-line-before': null,
            'at-rule-empty-line-before': null,
            'custom-property-empty-line-before': null,
            'shorthand-property-no-redundant-values': null,
            'length-zero-no-unit': null,
            'alpha-value-notation': null,
            'color-function-notation': null,
            'declaration-block-no-redundant-longhand-properties': null,
            'keyframes-name-pattern': null,
          },
        },
      });
      for (const r of result.results) {
        const rel = files.find((f) => f.out === r.source)?.rel ?? r.source;
        for (const w of r.warnings) res.errors.push(`${rel}:${w.line} ${w.text}`);
      }
      for (const f of files) {
        if (/text-transform\s*:\s*uppercase/i.test(f.css)) res.errors.push(`${f.rel}: text-transform: uppercase (TAS-04)`);
        if (f.rel !== 'src/styles/tokens.css') {
          const raw = f.css.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/gi);
          if (raw) res.errors.push(`${f.rel}: tokens.css dışında ham renk: ${[...new Set(raw)].join(', ')} (TAS-02)`);
        }
      }
      res.info.files = files.length;
    },
  },
  {
    id: 'kal-18-typescript',
    title: 'astro check (strict TypeScript) 0 hata',
    async run(res) {
      const r = spawnSync('npx astro check', { shell: true, encoding: 'utf8', cwd: ROOT });
      const out = `${r.stdout}\n${r.stderr}`;
      const m = out.match(/(\d+) errors?/);
      const w = out.match(/(\d+) warnings?/);
      if (r.status !== 0 || !m || Number(m[1]) > 0) res.errors.push(`astro check: ${m ? m[0] : 'çalışmadı'}\n${out.split('\n').filter((l) => /error/.test(l)).slice(0, 10).join('\n')}`);
      res.info = { errors: m ? Number(m[1]) : null, warnings: w ? Number(w[1]) : null };
    },
  },
];
