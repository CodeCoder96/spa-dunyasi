// Internal linking (SEO-09): related products (same category first, then complementary) and guide mapping.
import type { CategoryId, Product } from './catalog-schema.ts';
import { products, byCode } from './catalog.ts';

const COMPLEMENT: Record<CategoryId, CategoryId[]> = {
  'masaj-yataklari': ['aksesuar', 'sicak-tas-ve-isiticilar'],
  'dinlenme-yataklari': ['islak-alan', 'aksesuar'],
  'bakim-ve-pedikur-koltuklari': ['manikur', 'havlu-ve-sterilizatorler'],
  manikur: ['bakim-ve-pedikur-koltuklari', 'aksesuar'],
  'havlu-ve-sterilizatorler': ['aksesuar', 'masaj-yataklari'],
  'sicak-tas-ve-isiticilar': ['masaj-yataklari', 'aksesuar'],
  'islak-alan': ['dinlenme-yataklari', 'havlu-ve-sterilizatorler'],
  aksesuar: ['masaj-yataklari', 'havlu-ve-sterilizatorler'],
};

/** Guides per category (fallback when a product's content does not name one). */
export const CATEGORY_GUIDES: Record<CategoryId, string[]> = {
  'masaj-yataklari': ['masaj-yatagi-secimi', 'spa-ekipman-listesi'],
  'dinlenme-yataklari': ['dinlenme-yatagi-secimi', 'hamam-sauna-buhar'],
  'bakim-ve-pedikur-koltuklari': ['cilt-bakim-koltugu-secimi', 'pedikur-koltugu-secimi'],
  manikur: ['pedikur-koltugu-secimi', 'spa-ekipman-listesi'],
  'havlu-ve-sterilizatorler': ['havlu-isitici-kullanimi', 'spa-ekipman-listesi'],
  'sicak-tas-ve-isiticilar': ['sicak-tas-ekipmanlari', 'masaj-yatagi-secimi'],
  'islak-alan': ['hamam-sauna-buhar', 'spa-ekipman-listesi'],
  aksesuar: ['spa-ekipman-listesi', 'masaj-yatagi-secimi'],
};

/** Neighbours in code order within a list, wrapping around, so links spread across all products. */
function neighbours(list: Product[], self: Product, n: number): Product[] {
  const i = list.findIndex((p) => p.code === self.code);
  const out: Product[] = [];
  for (let k = 1; out.length < n && k < list.length; k++) out.push(list[(i + k) % list.length]!);
  return out;
}

export function relatedProducts(p: Product, explicit?: string[], max = 4): Product[] {
  if (explicit?.length) return explicit.map((c) => byCode.get(c)).filter((x): x is Product => Boolean(x) && x!.code !== p.code).slice(0, 6);
  const same = products.filter((x) => x.category === p.category);
  const out = neighbours(same, p, Math.min(max, same.length - 1));
  for (const c of COMPLEMENT[p.category]) {
    if (out.length >= Math.max(3, max)) break;
    const pool = products.filter((x) => x.category === c);
    if (pool.length) out.push(pool[Number(p.code.slice(3)) % pool.length]!);
  }
  return out.slice(0, 6);
}
