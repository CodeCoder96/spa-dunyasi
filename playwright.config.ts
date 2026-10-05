// Playwright runs against the Apache-like dist server (TEK-06), never against `astro dev`.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4322);

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['json', { outputFile: 'reports/verify/playwright.json' }]],
  outputDir: '.scratch/test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    { command: `node scripts/serve-dist.mjs ${PORT}`, url: `http://localhost:${PORT}/`, reuseExistingServer: false, timeout: 30_000 },
    // GA consent build (KAL-16): built by `node scripts/qa/build-ga-test.mjs` into dist-ga-test/.
    { command: `node scripts/serve-dist.mjs ${PORT + 1}`, url: `http://localhost:${PORT + 1}/`, reuseExistingServer: false, timeout: 30_000, env: { SD_SERVE_DIR: 'dist-ga-test' } },
  ],
  projects: [
    { name: 'site', testIgnore: /ga\.spec\.ts/ },
    { name: 'ga', testMatch: /ga\.spec\.ts/, use: { baseURL: `http://localhost:${PORT + 1}` } },
  ],
});
