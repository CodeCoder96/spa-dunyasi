// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import idLinks, { inlineCards, noTranslate } from './src/lib/md-id-links.ts';
import { settings } from './site.config.ts';

const ga = Boolean(settings.ga4MeasurementId);

export default defineConfig({
  site: 'https://spadunyasi.com.tr',
  output: 'static',
  // Test builds (e.g. the GA consent build, KAL-16) go to a separate folder so dist/ stays the deliverable.
  outDir: process.env.SD_OUT_DIR ?? 'dist',
  trailingSlash: 'ignore',
  build: {
    // "file" would emit src/pages/en/index.astro as en.html and break /en/ (TEK-03).
    format: 'preserve',
    inlineStylesheets: 'always',
    assets: '_astro',
  },
  compressHTML: true,
  prefetch: false,
  devToolbar: { enabled: false },
  markdown: {
    // Sätteri is Astro 7's default processor; smart punctuation off keeps source quotes untouched.
    processor: satteri({ hastPlugins: [idLinks, inlineCards, noTranslate], features: { smartPunctuation: false } }),
    syntaxHighlight: false,
  },
  image: {
    // Responsive widths (PER-03); never upscaled.
    breakpoints: [320, 480, 640, 960, 1280, 1600],
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['system-ui', 'sans-serif'],
      optimizedFallbacks: true,
      options: {
        variants: [{ src: ['./src/assets/fonts/inter-tr-var.woff2'], weight: '400 600', style: 'normal', display: 'swap' }],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      fallbacks: ['georgia', 'serif'],
      optimizedFallbacks: true,
      options: {
        variants: [{ src: ['./src/assets/fonts/fraunces-tr-var.woff2'], weight: '400 600', style: 'normal', display: 'swap' }],
      },
    },
  ],
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        `img-src 'self' data:${ga ? ' https://*.google-analytics.com https://*.googletagmanager.com' : ''}`,
        `connect-src 'self'${ga ? ' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com' : ''}`,
        "font-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", ...(ga ? ['https://www.googletagmanager.com'] : [])],
      },
      styleDirective: {
        resources: ["'self'"],
      },
    },
  },
  vite: {
    build: { sourcemap: false },
  },
});
