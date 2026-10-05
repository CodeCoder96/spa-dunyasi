// Static site structure: pages, services and guides (MIM-04, MIM-09). Slugs are defined only here,
// in categories.ts and in the catalog. Everything else asks the route registry.
import type { Lang } from '../i18n/ui.ts';

type I18n = { tr: string; en: string };

export interface StaticPageDef {
  key: string;
  type: 'home' | 'products' | 'services' | 'guides' | 'about' | 'contact' | 'faq' | 'privacy' | 'kvkk' | 'cookies' | '404';
  slug: I18n;
  name: I18n;
  indexable: boolean;
}

export const STATIC_PAGES: StaticPageDef[] = [
  { key: 'anasayfa', type: 'home', slug: { tr: '', en: '' }, name: { tr: 'Ana sayfa', en: 'Home' }, indexable: true },
  { key: 'urunler', type: 'products', slug: { tr: 'urunler', en: 'products' }, name: { tr: 'Ürünler', en: 'Products' }, indexable: true },
  { key: 'hizmetler', type: 'services', slug: { tr: 'hizmetler', en: 'services' }, name: { tr: 'Hizmetler', en: 'Services' }, indexable: true },
  { key: 'rehber', type: 'guides', slug: { tr: 'rehber', en: 'guides' }, name: { tr: 'Rehber', en: 'Guides' }, indexable: true },
  { key: 'hakkimizda', type: 'about', slug: { tr: 'hakkimizda', en: 'about' }, name: { tr: 'Hakkımızda', en: 'About' }, indexable: true },
  { key: 'iletisim', type: 'contact', slug: { tr: 'iletisim', en: 'contact' }, name: { tr: 'İletişim', en: 'Contact' }, indexable: true },
  { key: 'sss', type: 'faq', slug: { tr: 'sss', en: 'faq' }, name: { tr: 'Sık Sorulan Sorular', en: 'Frequently Asked Questions' }, indexable: true },
  { key: 'gizlilik', type: 'privacy', slug: { tr: 'gizlilik', en: 'privacy' }, name: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' }, indexable: false },
  { key: 'kvkk', type: 'kvkk', slug: { tr: 'kvkk-aydinlatma-metni', en: 'personal-data-notice' }, name: { tr: 'KVKK Aydınlatma Metni', en: 'Personal Data Notice' }, indexable: false },
  { key: 'cerez', type: 'cookies', slug: { tr: 'cerez-politikasi', en: 'cookie-policy' }, name: { tr: 'Çerez Politikası', en: 'Cookie Policy' }, indexable: false },
  { key: '404', type: '404', slug: { tr: '404', en: '404' }, name: { tr: 'Sayfa bulunamadı', en: 'Page not found' }, indexable: false },
];

export interface ServiceDef {
  key: string;
  slug: I18n;
  name: I18n;
}

export const SERVICES: ServiceDef[] = [
  { key: 'sauna', slug: { tr: 'sauna-imalati', en: 'sauna-construction' }, name: { tr: 'Sauna İmalatı', en: 'Sauna Construction' } },
  { key: 'hamam', slug: { tr: 'hamam-imalati', en: 'hammam-construction' }, name: { tr: 'Hamam İmalatı', en: 'Hammam Construction' } },
  { key: 'buhar-odasi', slug: { tr: 'buhar-odasi-yapimi', en: 'steam-room-construction' }, name: { tr: 'Buhar Odası Yapımı', en: 'Steam Room Construction' } },
  { key: 'havuz', slug: { tr: 'havuz-yapimi', en: 'pool-construction' }, name: { tr: 'Havuz Yapımı', en: 'Pool Construction' } },
];

export interface GuideDef {
  key: string;
  slug: I18n;
  name: I18n;
}

export const GUIDES: GuideDef[] = [
  { key: 'dinlenme-yatagi-secimi', slug: { tr: 'dinlenme-yatagi-secim-rehberi', en: 'relaxation-lounger-buying-guide' }, name: { tr: 'Dinlenme Yatağı Seçim Rehberi', en: 'Relaxation Lounger Buying Guide' } },
  { key: 'cilt-bakim-koltugu-secimi', slug: { tr: 'cilt-bakim-koltugu-secim-rehberi', en: 'beauty-treatment-chair-buying-guide' }, name: { tr: 'Cilt Bakım Koltuğu Seçim Rehberi', en: 'Beauty Treatment Chair Buying Guide' } },
  { key: 'masaj-yatagi-secimi', slug: { tr: 'masaj-yatagi-secimi', en: 'massage-bed-buying-guide' }, name: { tr: 'Masaj Yatağı Seçimi: Sabit mi, Motorlu mu, Hangi Ölçü?', en: 'Choosing a Massage Bed: Fixed or Electric, and Which Size?' } },
  { key: 'pedikur-koltugu-secimi', slug: { tr: 'pedikur-koltugu-secimi', en: 'pedicure-chair-buying-guide' }, name: { tr: 'Pedikür Koltuğu ve Pedikür Spa Ünitesi Seçimi', en: 'Choosing a Pedicure Chair or Pedicure Spa Unit' } },
  { key: 'spa-ekipman-listesi', slug: { tr: 'spa-acarken-ekipman-listesi', en: 'spa-equipment-checklist' }, name: { tr: 'Yeni Spa Açarken Ekipman Kontrol Listesi', en: 'Equipment Checklist for Opening a New Spa' } },
  { key: 'havlu-isitici-kullanimi', slug: { tr: 'havlu-isitici-ve-sterilizator-kullanimi', en: 'towel-warmer-and-steriliser-guide' }, name: { tr: 'Spa ve Salonlarda Havlu Isıtıcı ve Sterilizatör Kullanımı', en: 'Towel Warmers and Sterilisers in Spas and Salons' } },
  { key: 'hamam-sauna-buhar', slug: { tr: 'hamam-sauna-buhar-odasi-farklari', en: 'hammam-sauna-steam-room-compared' }, name: { tr: 'Hamam, Sauna ve Buhar Odası: Farklar ve İşletmeye Göre Seçim', en: 'Hammam, Sauna and Steam Room: Differences and Choosing for Your Business' } },
  { key: 'sicak-tas-ekipmanlari', slug: { tr: 'sicak-tas-masaji-ekipmanlari', en: 'hot-stone-massage-equipment' }, name: { tr: 'Sıcak Taş Masajı Ekipmanları: Taş Setleri ve Isıtıcılar', en: 'Hot Stone Massage Equipment: Stone Sets and Heaters' } },
];

export const pick = <T extends I18n>(o: T, lang: Lang) => o[lang];
