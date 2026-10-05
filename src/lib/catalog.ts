// Typed access to the validated catalog (KAY-20, KAY-21). Specs/options are printed only from here.
import raw from '../../data/catalog/products.json' with { type: 'json' };
import { catalogSchema, CATEGORY_IDS, type CategoryId, type Product } from './catalog-schema.ts';

export const products: Product[] = catalogSchema.parse(raw);
export const byCode = new Map(products.map((p) => [p.code, p]));

export function getProduct(code: string): Product {
  const p = byCode.get(code);
  if (!p) throw new Error(`Unknown product code ${code}`);
  return p;
}

export function productsIn(category: CategoryId): Product[] {
  return products.filter((p) => p.category === category);
}

export const categoriesInUse: CategoryId[] = CATEGORY_IDS.filter((c) => products.some((p) => p.category === c));

/** Up to `max` dimension chips for cards and the info panel (SAB-02, SAB-04). */
export function dimensionChips(p: Product, lang: 'tr' | 'en', max = 2): string[] {
  const order = ['width', 'length', 'height', 'dimensions', 'dimensions_mm', 'load_capacity', 'capacity_lt', 'power'];
  const byKey = new Map(p.specs.map((s) => [s.key, s]));
  const w = byKey.get('width');
  const l = byKey.get('length');
  const out: string[] = [];
  // "80 × 200 cm" when both width and length are plain "<n> cm".
  const cm = (v?: string) => v?.match(/^(\d+(?:[.,]\d+)?) ?cm$/)?.[1];
  if (cm(w?.valueRaw) && cm(l?.valueRaw)) out.push(`${cm(w!.valueRaw)} × ${cm(l!.valueRaw)} cm`);
  for (const k of order) {
    if (out.length >= max) break;
    if (out.length && (k === 'width' || k === 'length')) continue;
    const s = byKey.get(k);
    if (s) out.push(lang === 'tr' ? `${s.label.tr}: ${s.value.tr}` : `${s.label.en}: ${s.value.en}`);
  }
  return out.slice(0, max);
}
