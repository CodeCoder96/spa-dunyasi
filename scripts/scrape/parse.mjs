// Raw extraction of product pages (KAY-07, KAY-08). Output is unmodified source data:
// data/source/products.json. Selectors were chosen after inspecting 5+ pages (Elementor widgets
// inside section.portfolio_details_page_elemantor). Missing expected widgets are recorded as errors.
import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import { rawText, rawMeta } from './lib/raw.mjs';
import { cleanText, normalizeSourceUrl } from './lib/fetch.mjs';

const ROOT = new URL('../../', import.meta.url);

/** Pick the best image URL for an <img>: linked full size > widest srcset > data-src > src (KAY-09). */
function imageCandidate($, img) {
  const $img = $(img);
  const link = $img.closest('a[href]').attr('href');
  const srcset = $img.attr('srcset') || $img.attr('data-srcset') || '';
  let widest = null;
  let widestW = 0;
  for (const part of srcset.split(',')) {
    const [u, w] = part.trim().split(/\s+/);
    const n = parseInt(w, 10);
    if (u && n > widestW) {
      widest = u;
      widestW = n;
    }
  }
  const src = $img.attr('data-src') || $img.attr('src') || null;
  const isImg = (u) => u && /\.(webp|jpe?g|png|gif|avif)(\?|$)/i.test(u);
  return {
    linked: isImg(link) ? link : null,
    srcsetWidest: widest,
    src,
    alt: cleanText($img.attr('alt')),
    width: Number($img.attr('width')) || null,
    height: Number($img.attr('height')) || null,
  };
}

function widgetType(w) {
  return (w.attribs['data-widget_type'] || '').replace(/\.default$/, '') || 'unknown';
}

export function parseProduct(url) {
  const html = rawText(url);
  const meta = rawMeta(url);
  const errors = [];
  if (!html) return { url, errors: ['raw page missing'] };
  const $ = cheerio.load(html);
  const root = $('section.portfolio_details_page_elemantor');
  if (!root.length) errors.push('root section.portfolio_details_page_elemantor not found');

  const out = {
    url,
    finalUrl: meta?.finalUrl ?? null,
    titleTag: cleanText($('title').text()),
    heading: null,
    sections: [], // ordered widget content, groups keep their sub-headings
    bullets: [],
    texts: [],
    specs: [],
    specNotes: [],
    lists: [],
    images: [],
    folioLinks: [],
    shortcodeText: [],
    cssBackgroundImages: [],
    errors,
  };

  let currentGroup = null; // last tw-quote/tw-heading label before a carousel
  root.find('.elementor-widget').each((_, w) => {
    const type = widgetType(w);
    const $w = $(w);
    switch (type) {
      case 'tw-heading': {
        const t = cleanText($w.text());
        if (!out.heading) out.heading = t;
        else currentGroup = { label: t, description: null };
        out.sections.push({ type, text: t });
        break;
      }
      case 'tw-quote': {
        // Quote widgets hold group sub-headings (and sometimes a description) or the closing CTA.
        const title = cleanText($w.find('h1,h2,h3,h4,h5,h6,.quote-title,strong').first().text());
        const full = cleanText($w.text());
        const label = title || full;
        const description = title && full.length > title.length ? cleanText(full.slice(full.indexOf(title) + title.length)) : null;
        currentGroup = { label, description };
        out.sections.push({ type, title: label, description });
        break;
      }
      case 'image':
      case 'image-carousel': {
        const items = $w
          .find('img')
          .map((__, img) => ({ ...imageCandidate($, img), group: currentGroup?.label ?? null, widget: type }))
          .get();
        // Carousels list full-size files as links even when <img> is lazy.
        if (type === 'image-carousel') {
          const links = $w.find('a[href]').map((__, a) => $(a).attr('href')).get();
          links.forEach((l, i) => {
            if (items[i] && !items[i].linked && /\.(webp|jpe?g|png)$/i.test(l)) items[i].linked = l;
          });
        }
        out.images.push(...items);
        out.sections.push({ type, group: currentGroup?.label ?? null, count: items.length });
        break;
      }
      case 'icon-list':
        out.bullets.push(...$w.find('.elementor-icon-list-text').map((__, e) => cleanText($(e).text())).get().filter(Boolean));
        break;
      case 'tw-text':
      case 'text-editor':
        out.texts.push(cleanText($w.text()));
        break;
      case 'tw-folio-meta':
        $w.find('li').each((__, li) => {
          const $li = $(li);
          const label = cleanText($li.find('span').first().text());
          const all = cleanText($li.text());
          if (!label) {
            if (all) out.specNotes.push(all);
            return;
          }
          const value = cleanText(all.slice(all.indexOf(label) + label.length));
          if (!value && /tekn[iİı]k [öo]zell/i.test(label.normalize('NFC').toLocaleLowerCase('tr-TR'))) return; // section header row
          if (!value) {
            out.specNotes.push(label);
            return;
          }
          out.specs.push({ labelRaw: label.replace(/\s*:\s*$/, ''), valueRaw: value });
        });
        break;
      case 'html': {
        const heading = cleanText($w.find('h1,h2,h3,h4').first().text());
        const items = $w.find('li').map((__, li) => cleanText($(li).text())).get().filter(Boolean);
        if (items.length) out.lists.push({ heading, items });
        else if (cleanText($w.text())) out.texts.push(cleanText($w.text()));
        break;
      }
      case 'shortcode':
        out.shortcodeText.push(cleanText($w.text()));
        break;
      case 'tw-folio':
        out.folioLinks.push(
          ...$w
            .find('a[href*="/portfolios/"]')
            .map((__, a) => normalizeSourceUrl($(a).attr('href')))
            .get(),
        );
        out.folioLinks = [...new Set(out.folioLinks)];
        break;
      case 'tw-social-share':
      case 'tw-button':
        break;
      default:
        out.sections.push({ type, text: cleanText($w.text()).slice(0, 500) });
    }
  });

  // Record CSS background images (TZK-01) for auditing; they are never gallery images.
  out.cssBackgroundImages = [...new Set([...html.matchAll(/url\(['"]?([^'")]+\.(?:webp|jpe?g|png))/g)].map((m) => m[1]))];
  if (!out.heading) errors.push('heading (tw-heading) not found');
  if (!out.images.length) errors.push('no content images found');
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const d = JSON.parse(await readFile(new URL('data/source/discovery.json', ROOT), 'utf8'));
  const products = d.products.map((p) => ({ ...parseProduct(p.url), discoverySources: p.sources }));
  await writeFile(new URL('data/source/products.json', ROOT), JSON.stringify(products, null, 2));
  const errs = products.filter((p) => p.errors.length);
  console.log(`parsed=${products.length} withErrors=${errs.length}`);
  for (const p of errs) console.log(' ', p.url, p.errors.join('; '));
  console.log('noSpecs:', products.filter((p) => !p.specs.length).map((p) => p.url.split('/').at(-2)).join(' '));
}
