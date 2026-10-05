// Tiny inline Markdown for frontmatter strings (FAQ answers, intros): **bold**, *em*, [text](id-or-url).
// Links use the same id scheme as content files (MIM-06); unknown ids throw.
import { resolveLink } from './routes.ts';
import type { Lang } from '../i18n/ui.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function marked(src: string, lang: Lang): string {
  let s = esc(src);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, target: string) => {
    const resolved = resolveLink(lang, target);
    if (resolved === null && !/^(https?:|mailto:|tel:)/.test(target)) throw new Error(`[inline-md] unresolved link ${target}`);
    return `<a href="${resolved ?? target}">${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s.replace(/(Spa Dünyası|Spa World)/g, '<span translate="no">$1</span>');
}
