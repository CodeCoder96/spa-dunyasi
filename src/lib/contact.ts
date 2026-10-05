// Contact link builders (DON-01..03, SAB-09). Company facts come only from site.config.ts.
import { site, type PhoneKey } from '../../site.config.ts';
import { t, type Lang } from '../i18n/ui.ts';

export const waNumber = site.whatsapp.replace('https://wa.me/', '');

export function waLink(text?: string): string {
  return text ? `${site.whatsapp}?text=${encodeURIComponent(text)}` : site.whatsapp;
}

export type WaContext =
  | { kind: 'general' }
  | { kind: 'product'; name: string; code: string; url: string }
  | { kind: 'category'; name: string; url: string }
  | { kind: 'service'; name: string; url: string };

export function waMessage(lang: Lang, ctx: WaContext): string {
  switch (ctx.kind) {
    case 'product':
      return t(lang, 'wa.product', { name: ctx.name, code: ctx.code, url: ctx.url });
    case 'category':
      return t(lang, 'wa.category', { name: lang === 'en' ? ctx.name.toLowerCase() : ctx.name, url: ctx.url });
    case 'service':
      return t(lang, 'wa.service', { name: lang === 'en' ? ctx.name.toLowerCase() : ctx.name, url: ctx.url });
    default:
      return t(lang, 'wa.general');
  }
}

export const telLink = (key: PhoneKey = site.primaryPhone) => `tel:${site.phones[key].e164}`;

/** mailto with a filled subject (DON-03); CRLF line breaks (DON-05). */
export function mailtoLink(subject: string, body?: string): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/%0A/g, '%0D%0A').replace(/%0D%0D%0A/g, '%0D%0A');
  return `mailto:${site.email}?subject=${enc(subject)}${body ? `&body=${enc(body)}` : ''}`;
}

const mapsQuery = encodeURIComponent(site.address.full);
export const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
export const mapsDirections = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;

/** Phone numbers are shown with non-breaking spaces so they never wrap mid-number. */
export const nbsp = (s: string) => s.replace(/ /g, ' ');
