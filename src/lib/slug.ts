// Slug rules (MIM-03). Shared by scripts (Node type stripping) and Astro.
// "İ" needs no entry: toLocaleLowerCase('tr-TR') already turns it into "i".
const MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
};

export const SLUG_MAX = 60;

export function slugify(input: string): string {
  const lower = input.normalize('NFC').toLocaleLowerCase('tr-TR');
  let s = '';
  for (const ch of lower) s += MAP[ch] ?? ch;
  s = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (s.length > SLUG_MAX) s = s.slice(0, SLUG_MAX).replace(/-[^-]*$/, '');
  return s;
}

export function isValidSlug(s: string): boolean {
  return s.length > 0 && s.length <= SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}
