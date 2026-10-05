// Sätteri hast plugin: rewrite id links in content Markdown ("urun:SD-014", "sayfa:iletisim", ...) to the
// registry path of the file's language (MIM-06). An unresolvable id throws, failing the build.
import { resolveLink } from './routes.ts';
import { t, type Lang } from '../i18n/ui.ts';

interface HastElement {
  properties?: Record<string, unknown>;
}
interface VisitCtx {
  setProperty(node: HastElement, key: string, value: unknown): void;
}

const ID_RE = /^(urun|sayfa|kategori|rehber|hizmet):/;

export default function idLinks({ fileURL }: { fileURL: URL | undefined }) {
  const p = decodeURIComponent(fileURL?.pathname ?? '');
  const lang = (p.match(/\/content\/[^/]+\/(tr|en)\//)?.[1] ?? null) as Lang | null;
  return {
    name: 'id-links',
    element: {
      filter: ['a'],
      visit(node: HastElement, ctx: VisitCtx) {
        const href = node.properties?.href;
        // DON-03: e-mail links always carry a filled subject line (GFM autolinks plain addresses).
        if (typeof href === 'string' && href.startsWith('mailto:') && !href.includes('?') && lang) {
          ctx.setProperty(node, 'href', `${href}?subject=${encodeURIComponent(t(lang, 'contact.email.subject'))}`);
          return;
        }
        if (typeof href !== 'string' || !ID_RE.test(href)) return;
        if (!lang) throw new Error(`[id-links] cannot infer language for ${p}`);
        const resolved = resolveLink(lang, href);
        if (!resolved) throw new Error(`[id-links] unresolved link "${href}" in ${p}`);
        ctx.setProperty(node, 'href', resolved);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Inline product cards in guides (SAB-08): a paragraph that is exactly "@kart SD-014" becomes a static card.
// Thumbnails (/thumbs/<code>.webp, 320×240) are generated in postbuild from the catalog.
import { byCode } from './catalog.ts';
import { CATEGORY_META } from './categories.ts';
import { href } from './routes.ts';

const CARD_RE = /^@kart\s+(SD-\d{3})$/;

export function inlineCards({ fileURL }: { fileURL: URL | undefined }) {
  const p = decodeURIComponent(fileURL?.pathname ?? '');
  const lang = (p.match(/\/content\/[^/]+\/(tr|en)\//)?.[1] ?? null) as Lang | null;
  return {
    name: 'inline-cards',
    element: {
      filter: ['p'],
      visit(node: HastElement, ctx: VisitCtx & { textContent(n: HastElement): string }) {
        const m = ctx.textContent(node).trim().match(CARD_RE);
        if (!m) return undefined;
        if (!lang) throw new Error(`[inline-cards] cannot infer language for ${p}`);
        const prod = byCode.get(m[1]!);
        if (!prod) throw new Error(`[inline-cards] unknown product ${m[1]} in ${p}`);
        const name = prod.name[lang];
        const tag = CATEGORY_META[prod.category].short[lang];
        const el = (tagName: string, properties: Record<string, unknown>, children: unknown[] = []) => ({ type: 'element', tagName, properties, children });
        const text = (value: string) => ({ type: 'text', value });
        return el('div', { className: ['inline-card'] }, [
          el('a', { className: ['inline-card__link'], href: href(lang, `urun:${prod.code}`) }, [
            el('img', { src: `/thumbs/${prod.code.toLowerCase()}.webp`, width: 320, height: 240, alt: '', loading: 'lazy', decoding: 'async' }),
            el('span', { className: ['inline-card__body'] }, [
              el('span', { className: ['tag'] }, [text(tag)]),
              el('strong', { translate: 'no' }, [text(name)]),
              el('span', { className: ['code'], translate: 'no' }, [text(prod.code)]),
            ]),
          ]),
        ]);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// TAS-11: keep brand names, product names and distinctive model names out of browser auto-translation.
// Generic English model words ("Light", "Soft", "Classic"…) are only protected inside full product names.
import { products } from './catalog.ts';

const DISTINCT_MODELS = ['Avant', 'Ayurveda', 'Base W', 'Base X', 'Base X Cube', 'Base X Square', 'Evony', 'Mercury', 'Odessa', 'Uranus', 'Venus', 'Lux Soft', 'Spa Life'];
const PROTECTED = [...new Set(['Spa Dünyası', 'Spa World', ...products.flatMap((p) => [p.name.tr, p.name.en]), ...DISTINCT_MODELS])].sort((a, b) => b.length - a.length);
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PROTECT_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${PROTECTED.map(escRe).join('|')})(?![\\p{L}\\p{N}])`, 'gu');

interface TextNode {
  value: string;
}
interface ReplaceCtx {
  replaceNode(node: TextNode, next: unknown[]): void;
}

export function noTranslate() {
  return {
    name: 'no-translate',
    text(node: TextNode, ctx: ReplaceCtx) {
        const v = node.value;
        PROTECT_RE.lastIndex = 0;
        if (!PROTECT_RE.test(v)) return;
        PROTECT_RE.lastIndex = 0; // test() advanced it; matchAll would otherwise skip the first match
        const parts: unknown[] = [];
        let last = 0;
        for (const m of v.matchAll(PROTECT_RE)) {
          if (m.index > last) parts.push({ type: 'text', value: v.slice(last, m.index) });
          parts.push({ type: 'element', tagName: 'span', properties: { translate: 'no' }, children: [{ type: 'text', value: m[0] }] });
          last = m.index + m[0].length;
        }
        if (last < v.length) parts.push({ type: 'text', value: v.slice(last) });
        ctx.replaceNode(node, parts);
    },
  };
}
