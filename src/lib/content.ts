// Content access (ICR-14). Missing TR or EN content is a build error unless SD_DRAFT=1 (Phase 2 only, D-013).
import { getCollection, getEntry, type CollectionEntry, type CollectionKey } from 'astro:content';
import type { Lang } from '../i18n/ui.ts';

export const DRAFT = import.meta.env.SD_DRAFT === '1' || process.env.SD_DRAFT === '1';

export async function content<C extends CollectionKey>(collection: C, lang: Lang, id: string): Promise<CollectionEntry<C> | null> {
  const entry = await getEntry(collection, `${lang}/${id}`);
  if (!entry && !DRAFT) throw new Error(`[content] missing ${collection}/${lang}/${id}.md (ICR-14)`);
  return (entry as CollectionEntry<C> | undefined) ?? null;
}

/** Fail the build if any entry exists in one language only. */
export async function assertPairs(): Promise<void> {
  if (DRAFT) return;
  for (const c of ['products', 'categories', 'services', 'guides', 'pages'] as const) {
    const all = await getCollection(c);
    const ids = new Set(all.map((e) => e.id));
    for (const e of all) {
      const [lang, id] = e.id.split('/');
      const other = `${lang === 'tr' ? 'en' : 'tr'}/${id}`;
      if (!ids.has(other)) throw new Error(`[content] ${c}/${e.id} has no ${other} counterpart (ICR-14)`);
    }
  }
}
