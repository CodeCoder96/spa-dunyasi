// Category definitions (MIM-08, D-007). Order here is the display and code-assignment order.
import type { CategoryId } from './catalog-schema.ts';

export interface CategoryMeta {
  name: { tr: string; en: string };
  /** Short name for chips and card labels. */
  short: { tr: string; en: string };
  slug: { tr: string; en: string };
  /** Source categories on spaworld.com.tr this category was derived from. */
  derivedFrom: string[];
  /** Product whose first photo represents the category on the home page. */
  cover: string;
}

export const CATEGORY_META: Record<CategoryId, CategoryMeta> = {
  'masaj-yataklari': {
    name: { tr: 'Masaj Yatakları', en: 'Massage Beds' },
    short: { tr: 'Masaj yatağı', en: 'Massage bed' },
    slug: { tr: 'masaj-yataklari', en: 'massage-beds' },
    derivedFrom: ['masaj-terapi-yataklari', 'yardimci'],
    cover: 'SD-009',
  },
  'dinlenme-yataklari': {
    name: { tr: 'Dinlenme Yatakları', en: 'Relaxation Loungers' },
    short: { tr: 'Dinlenme yatağı', en: 'Relaxation lounger' },
    slug: { tr: 'dinlenme-yataklari', en: 'relaxation-loungers' },
    derivedFrom: ['dinlenme-yataklari'],
    cover: 'SD-024',
  },
  'bakim-ve-pedikur-koltuklari': {
    name: { tr: 'Bakım ve Pedikür Koltukları', en: 'Treatment & Pedicure Chairs' },
    short: { tr: 'Bakım koltuğu', en: 'Treatment chair' },
    slug: { tr: 'bakim-ve-pedikur-koltuklari', en: 'treatment-and-pedicure-chairs' },
    derivedFrom: ['cilt-bakim-analiz-cihazlari', 'pedikur'],
    cover: 'SD-032',
  },
  manikur: {
    name: { tr: 'Manikür Masaları ve Koltukları', en: 'Manicure Tables & Chairs' },
    short: { tr: 'Manikür', en: 'Manicure' },
    slug: { tr: 'manikur-masalari', en: 'manicure-tables' },
    derivedFrom: ['manikur'],
    cover: 'SD-038',
  },
  'havlu-ve-sterilizatorler': {
    name: { tr: 'Havlu Isıtıcı ve Sterilizatörler', en: 'Towel Warmers & Sterilisers' },
    short: { tr: 'Havlu ve steril', en: 'Towel & steriliser' },
    slug: { tr: 'havlu-isitici-ve-sterilizatorler', en: 'towel-warmers-and-sterilisers' },
    derivedFrom: ['havlu-ve-steril-cihazlari'],
    cover: 'SD-043',
  },
  'sicak-tas-ve-isiticilar': {
    name: { tr: 'Sıcak Taş ve Isıtıcılar', en: 'Hot Stone & Heaters' },
    short: { tr: 'Sıcak taş', en: 'Hot stone' },
    slug: { tr: 'sicak-tas-ve-isiticilar', en: 'hot-stone-and-heaters' },
    derivedFrom: ['sicak-tas-isitici-setler', 'yardimci'],
    cover: 'SD-051',
  },
  'islak-alan': {
    name: { tr: 'Islak Alan Ürünleri', en: 'Wet Area Equipment' },
    short: { tr: 'Islak alan', en: 'Wet area' },
    slug: { tr: 'islak-alan-urunleri', en: 'wet-area-equipment' },
    derivedFrom: ['islak-hacim-gorsel', 'cilt-bakim-analiz-cihazlari'],
    cover: 'SD-053',
  },
  aksesuar: {
    name: { tr: 'Aksesuar ve Yardımcı Ürünler', en: 'Accessories' },
    short: { tr: 'Aksesuar', en: 'Accessory' },
    slug: { tr: 'aksesuar-ve-yardimci-urunler', en: 'accessories' },
    derivedFrom: ['yardimci', 'tabureler'],
    cover: 'SD-062',
  },
};
