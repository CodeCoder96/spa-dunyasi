// npm run build: astro build + postbuild. Astro logs some errors (e.g. Markdown render failures in the content
// layer) without a non-zero exit; any "[ERROR]" line fails the build here so broken pages never ship.
import { spawn, spawnSync } from 'node:child_process';

const astro = spawn('npx astro build', { shell: true, env: process.env });
let errors = 0;
const scan = (chunk, out) => {
  out.write(chunk);
  errors += (chunk.toString().match(/\[ERROR\]/g) ?? []).length;
};
astro.stdout.on('data', (c) => scan(c, process.stdout));
astro.stderr.on('data', (c) => scan(c, process.stderr));
astro.on('close', (code) => {
  if (code !== 0 || errors > 0) {
    console.error(`\n✗ astro build: exit ${code}, ${errors} [ERROR] line(s). Postbuild skipped.`);
    process.exit(code || 1);
  }
  const pb = spawnSync(process.execPath, ['scripts/postbuild/run.mjs'], { stdio: 'inherit', env: process.env });
  process.exit(pb.status ?? 1);
});
