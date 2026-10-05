// Route registry (MIM-06): the only source of paths. Menus, breadcrumbs, hreflang, the language switcher,
// the sitemap, internal links and 404 suggestions all read from here. Works in Astro and in Node scripts.
import type { Lang } from '../i18n/ui.ts';
import { CATEGORY_IDS } from './catalog-schema.ts';
import { CATEGORY_META } from './categories.ts';
import { products } from './catalog.ts';
import { GUIDES, SERVICES, STATIC_PAGES } from './structure.ts';
import { isValidSlug } from './slug.ts';

export const SITE = 'https://spadunyasi.com.tr';

export type RouteType =
  | 'home' | 'products' | 'category' | 'product' | 'services' | 'service' | 'guides' | 'guide'
  | 'about' | 'contact' | 'faq' | 'privacy' | 'kvkk' | 'cookies' | '404';

export interface Route {
  /** Language-independent id, e.g. "urun:SD-014", "kategori:masaj-yataklari", "sayfa:iletisim". */
  id: string;
  type: RouteType;
  lang: Lang;
  /** '' for the language home pages. */
  slug: string;
  /** Root-relative path: "/", "/en/", "/x.html", "/en/x.html". */
  path: string;
  /** Path of the same page in the other language. */
  altPath: string;
  indexable: boolean;
  /** id of the parent page for breadcrumbs (null for home). */
  parent: string | null;
  /** Visible name (menus, breadcrumbs, H1 fallback). */
  title: string;
  /** Key into the data source: product code, category id, service/guide key, static key. */
  key: string;
}

const pathFor = (lang: Lang, slug: string) => (lang === 'tr' ? (slug ? `/${slug}.html` : '/') : slug ? `/en/${slug}.html` : '/en/');

interface Def {
  id: string;
  type: RouteType;
  key: string;
  slug: { tr: string; en: string };
  name: { tr: string; en: string };
  indexable: boolean;
  parent: string | null;
}

const defs: Def[] = [];
for (const s of STATIC_PAGES) {
  defs.push({ id: `sayfa:${s.key}`, type: s.type, key: s.key, slug: s.slug, name: s.name, indexable: s.indexable, parent: s.type === 'home' ? null : 'sayfa:anasayfa' });
}
for (const c of CATEGORY_IDS) {
  if (!products.some((p) => p.category === c)) continue;
  const m = CATEGORY_META[c];
  defs.push({ id: `kategori:${c}`, type: 'category', key: c, slug: m.slug, name: m.name, indexable: true, parent: 'sayfa:urunler' });
}
for (const p of products) {
  defs.push({ id: `urun:${p.code}`, type: 'product', key: p.code, slug: p.slug, name: p.name, indexable: true, parent: `kategori:${p.category}` });
}
for (const s of SERVICES) defs.push({ id: `hizmet:${s.key}`, type: 'service', key: s.key, slug: s.slug, name: s.name, indexable: true, parent: 'sayfa:hizmetler' });
for (const g of GUIDES) defs.push({ id: `rehber:${g.key}`, type: 'guide', key: g.key, slug: g.slug, name: g.name, indexable: true, parent: 'sayfa:rehber' });

// Validate: slug rules and one namespace per language (MIM-03). Collisions are build errors.
for (const lang of ['tr', 'en'] as const) {
  const seen = new Map<string, string>();
  for (const d of defs) {
    const s = d.slug[lang];
    if (d.type !== 'home' && !isValidSlug(s)) throw new Error(`[routes] invalid ${lang} slug "${s}" for ${d.id}`);
    if (seen.has(s)) throw new Error(`[routes] ${lang} slug collision "${s}": ${seen.get(s)} vs ${d.id}`);
    seen.set(s, d.id);
  }
}

export const routes: Route[] = defs.flatMap((d) =>
  (['tr', 'en'] as const).map((lang) => ({
    id: d.id,
    type: d.type,
    lang,
    slug: d.slug[lang],
    path: pathFor(lang, d.slug[lang]),
    altPath: pathFor(lang === 'tr' ? 'en' : 'tr', d.slug[lang === 'tr' ? 'en' : 'tr']),
    indexable: d.indexable,
    parent: d.parent,
    title: d.name[lang],
    key: d.key,
  })),
);

const index = new Map(routes.map((r) => [`${r.lang}|${r.id}`, r]));

export function route(lang: Lang, id: string): Route {
  const r = index.get(`${lang}|${id}`);
  if (!r) throw new Error(`[routes] unknown route id "${id}" (${lang})`);
  return r;
}

export const hasRoute = (lang: Lang, id: string) => index.has(`${lang}|${id}`);
export const href = (lang: Lang, id: string) => route(lang, id).path;
export const absolute = (path: string) => `${SITE}${path}`;

export function breadcrumb(r: Route): Route[] {
  const chain: Route[] = [r];
  let cur = r;
  while (cur.parent) {
    cur = route(r.lang, cur.parent);
    chain.unshift(cur);
  }
  return chain;
}

export const routesOf = (lang: Lang, type?: RouteType) => routes.filter((r) => r.lang === lang && (!type || r.type === type));

/**
 * Resolve content links written with ids (MIM-06): "urun:SD-014", "sayfa:iletisim", "kategori:x", "rehber:x", "hizmet:x".
 * An optional "#fragment" is kept. Unknown ids throw (build error).
 */
const LINK_RE = /^(urun|sayfa|kategori|rehber|hizmet):([^#]+)(#.*)?$/;
export function resolveLink(lang: Lang, target: string): string | null {
  const m = target.match(LINK_RE);
  if (!m) return null;
  return href(lang, `${m[1]}:${m[2]}`) + (m[3] ?? '');
}
