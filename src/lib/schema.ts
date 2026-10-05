// JSON-LD builders (SEO-08). One @graph per page. No offers/aggregateRating/review (no prices, no reviews).
import { site } from '../../site.config.ts';
import type { Product } from './catalog-schema.ts';
import { CATEGORY_META } from './categories.ts';
import { absolute, SITE, type Route } from './routes.ts';
import type { Lang } from '../i18n/ui.ts';

const ORG_ID = `${SITE}/#org`;
const PARENT_ID = `${SITE}/#spaworld`;
const inLang = (lang: Lang) => (lang === 'tr' ? 'tr-TR' : 'en-GB');

export function orgSchema() {
  return [
    {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: site.brand,
      url: `${SITE}/`,
      logo: absolute('/icon-512.png'),
      email: site.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address.street,
        postalCode: site.address.postalCode,
        addressLocality: site.address.locality,
        addressRegion: site.address.region,
        addressCountry: site.address.country,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: site.phones.mobil_1.e164,
        contactType: 'sales',
        availableLanguage: ['tr', 'en'],
      },
      parentOrganization: { '@id': PARENT_ID },
    },
    {
      '@type': 'Organization',
      '@id': PARENT_ID,
      name: site.parent.name,
      url: `${site.parent.url}/`,
      sameAs: [site.social.instagram, site.social.facebook],
    },
  ];
}

export function websiteSchema(lang: Lang) {
  return { '@type': 'WebSite', '@id': `${SITE}/#website-${lang}`, name: site.brand, url: absolute(lang === 'tr' ? '/' : '/en/'), inLanguage: inLang(lang), publisher: { '@id': ORG_ID } };
}

export function breadcrumbSchema(items: Route[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.title, item: absolute(r.path) })),
  };
}

export function productSchema(p: Product, lang: Lang, description: string, url: string) {
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name[lang],
    description,
    sku: p.code,
    url,
    image: [absolute(`/og/urun-${p.code.toLowerCase()}.jpg`)],
    brand: { '@type': 'Brand', name: site.parent.name },
    manufacturer: { '@id': PARENT_ID },
    category: CATEGORY_META[p.category].name[lang],
    additionalProperty: p.specs.map((s) => ({ '@type': 'PropertyValue', name: s.label[lang], value: s.value[lang] })),
  };
}

export function itemListSchema(items: { name: string; url: string }[], name: string) {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: it.url, name: it.name })),
  };
}

export function faqSchema(items: { q: string; a: string }[], lang: Lang) {
  const strip = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1');
  return {
    '@type': 'FAQPage',
    inLanguage: inLang(lang),
    mainEntity: items.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: strip(it.a) } })),
  };
}

export function serviceSchema(name: string, description: string, url: string, lang: Lang) {
  return { '@type': 'Service', '@id': `${url}#service`, name, description, url, inLanguage: inLang(lang), provider: { '@id': ORG_ID }, areaServed: ['TR', 'Worldwide'] };
}

export function articleSchema(a: { headline: string; description: string; url: string; image: string; datePublished: string; dateModified: string; lang: Lang }) {
  return {
    '@type': 'Article',
    '@id': `${a.url}#article`,
    headline: a.headline,
    description: a.description,
    image: [a.image],
    datePublished: a.datePublished,
    dateModified: a.dateModified,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    inLanguage: inLang(a.lang),
    mainEntityOfPage: a.url,
  };
}

export function pageSchema(type: 'AboutPage' | 'ContactPage' | 'WebPage' | 'CollectionPage', name: string, url: string, lang: Lang) {
  return { '@type': type, '@id': `${url}#page`, name, url, inLanguage: inLang(lang), isPartOf: { '@id': `${SITE}/#website-${lang}` }, about: { '@id': ORG_ID } };
}
