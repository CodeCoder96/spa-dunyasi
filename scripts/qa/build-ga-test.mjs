// Builds the analytics test site (KAL-16): fake GA id G-TEST000000, analytics hostname "localhost",
// output in dist-ga-test/ so the real dist/ is untouched.
import { spawnSync } from 'node:child_process';

const env = { ...process.env, SD_GA4_ID: 'G-TEST000000', SD_ANALYTICS_HOST: 'localhost', SD_OUT_DIR: 'dist-ga-test' };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run('node', ['scripts/build.mjs']);
console.log('GA test build ready in dist-ga-test/');
