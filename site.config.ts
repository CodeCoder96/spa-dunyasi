/**
 * Single source of truth for company facts (SPEC §4) and build settings ("Bölüm 0").
 * No other company fact may appear on the site (KUR-02).
 */

/** "Bölüm 0" settings — confirmed with the user on 2026-10-03 (see docs/DECISIONS.md D-001). */
export const settings = {
  /** "iki-onay-noktasi" | "onaysiz" */
  approvalMode: 'onaysiz',
  /** Empty → no gtag, no cookie banner, no "cookie preferences" link (ANL-01). Overridable via env for tests (KAL-16). */
  ga4MeasurementId: process.env.SD_GA4_ID ?? '',
  /** Empty → data controller shown as "Spa World" (ICR-10). */
  tradeName: '',
  mersisOrVkn: '',
  googleSiteVerification: '',
  /** Analytics only runs on this hostname (ANL-06). Overridable for tests. */
  analyticsHostname: process.env.SD_ANALYTICS_HOST ?? 'spadunyasi.com.tr',
  /** Bump to re-ask for cookie consent (ANL-04). */
  consentPolicyVersion: 1,
} as const;

export const site = {
  brand: 'Spa Dünyası',
  domain: 'https://spadunyasi.com.tr',
  position: {
    tr: 'Spa World yetkili satış noktası',
    en: 'Authorized sales point of Spa World',
  },
  parent: { name: 'Spa World', url: 'https://www.spaworld.com.tr' },
  address: {
    full: 'Fındıklı, Yaseminler Sokağı No: 7 A, 34854 Maltepe/İstanbul, Türkiye',
    street: 'Fındıklı, Yaseminler Sokağı No: 7 A',
    postalCode: '34854',
    locality: 'Maltepe',
    region: 'İstanbul',
    country: 'TR',
  },
  phones: {
    mobil_1: { display: '+90 534 359 76 44', e164: '+905343597644' },
    mobil_2: { display: '+90 534 451 88 97', e164: '+905344518897' },
    ofis: { display: '+90 216 755 39 55', e164: '+902167553955' },
  },
  /** Main CTA line: WhatsApp and phone (DON-01, DON-03). */
  primaryPhone: 'mobil_1',
  whatsapp: 'https://wa.me/905343597644',
  email: 'info@spaworld.com.tr',
  /** Spa World's accounts. */
  social: {
    instagram: 'https://www.instagram.com/spaworldtr',
    facebook: 'https://www.facebook.com/profile.php?id=100076244326883',
  },
  facts: {
    warranty: { tr: '5 yıl garanti', en: '5-year warranty' },
    delivery: { tr: 'Türkiye geneli ve yurt dışı', en: 'Across Türkiye and abroad' },
    experience: { tr: '5 yılı aşkın deneyim', en: 'over 5 years of experience' },
    production: { tr: 'Ürünler Spa World tarafından üretilir', en: 'Products are manufactured by Spa World' },
    serviceScope: {
      tr: 'Sauna, hamam ve havuz projeleri; işletmeler ve evler için',
      en: 'Sauna, hammam and pool projects for businesses and homes',
    },
    /** Only on service pages. */
    projectService: {
      tr: 'Tasarımdan imalata, uygulamadan teslime kadar proje yürütme',
      en: 'Project delivery from design and manufacturing to installation and handover',
    },
  },
  /** Known unknowns — never rendered as facts. */
  unknown: ['deliveryTime', 'productInstallation', 'openingHours', 'price'],
  forbiddenClaims: ['7/24 hizmet'],
} as const;

export type PhoneKey = keyof typeof site.phones;
