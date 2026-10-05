// Catalog schema (KAY-20). Validated at catalog build time and again when Astro loads the catalog.
import { z } from 'astro/zod';
import { isValidSlug } from './slug.ts';

const i18n = z.object({ tr: z.string().min(1), en: z.string().min(1) });
const slug = z.string().refine(isValidSlug, 'invalid slug (MIM-03)');

export const CATEGORY_IDS = [
  'masaj-yataklari',
  'dinlenme-yataklari',
  'bakim-ve-pedikur-koltuklari',
  'manikur',
  'havlu-ve-sterilizatorler',
  'sicak-tas-ve-isiticilar',
  'islak-alan',
  'aksesuar',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const specSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: i18n,
  valueRaw: z.string().min(1),
  value: i18n,
  /** Where the raw value was taken from: the spec table or a quoted source sentence. */
  from: z.enum(['table', 'list', 'text']),
});

export const imageSchema = z.object({
  file: z.string().regex(/^src\/assets\/products\/[a-z0-9-]+\/[a-z0-9-]+-\d{2}\.(webp|jpg|png)$/),
  sourceUrl: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  fit: z.enum(['contain', 'cover']),
  position: z.string(),
  lowRes: z.boolean(),
  /** studio | scene (KAY-16), kept for reporting and OG rendering. */
  background: z.enum(['studio', 'scene']),
  alt: i18n,
  /** Variant label for group products (e.g. bolster types); null otherwise. */
  variant: i18n.nullable(),
});

export const productSchema = z.object({
  code: z.string().regex(/^SD-\d{3}$/),
  sourceUrls: z.array(z.url()).min(1),
  sourceNameRaw: z.string().min(1),
  model: z.string().nullable(),
  name: i18n,
  slug: z.object({ tr: slug, en: slug }),
  category: z.enum(CATEGORY_IDS),
  specs: z.array(specSchema),
  options: z.array(i18n),
  /** Standard features/equipment listed by the source (not options). Deviation D-008. */
  features: z.array(i18n),
  /** Named variants of a group product (e.g. bolster shapes, trolley models). */
  variants: z.array(i18n),
  images: z.array(imageSchema),
  v1Path: z.string().regex(/^\/[a-z0-9-]+\.html$/).nullable(),
  notes: z.array(z.string()),
});

export const catalogSchema = z
  .array(productSchema)
  .superRefine((items, ctx) => {
    const seen = new Map<string, string>();
    for (const p of items) {
      for (const key of [`code:${p.code}`, `tr:${p.slug.tr}`, `en:${p.slug.en}`]) {
        if (seen.has(key)) ctx.addIssue({ code: 'custom', message: `duplicate ${key} (${p.code} vs ${seen.get(key)})` });
        seen.set(key, p.code);
      }
    }
  });

export type Product = z.infer<typeof productSchema>;
export type Spec = z.infer<typeof specSchema>;
export type ProductImage = z.infer<typeof imageSchema>;
