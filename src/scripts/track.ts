// Analytics wrapper (ANL-02, ANL-06, ANL-07). No-op unless a GA4 id is configured AND the visitor accepted
// AND the page runs on the live hostname. Parameter values are snake_case strings ≤ 100 chars.
type Params = Record<string, string | number>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const body = document.body;
const PAGE_TYPE = (body.dataset.pageType ?? 'other').replace(/[^a-z0-9]+/g, '_');
const LANG = body.dataset.lang ?? 'tr';

// snake_case values, ≤ 100 chars (ANL-07): "SD-024" → "sd_024"; commas kept for product_codes lists.
const clean = (v: string | number) => (typeof v === 'number' ? v : String(v).toLowerCase().replace(/[^a-z0-9,]+/g, '_').slice(0, 100));

export function analyticsActive(): boolean {
  return typeof window.gtag === 'function' && body.dataset.gaActive === '1';
}

export function track(event: string, params: Params = {}): void {
  if (!analyticsActive()) return;
  const p: Params = { language: LANG, page_type: PAGE_TYPE };
  for (const [k, v] of Object.entries(params)) p[k] = clean(v);
  window.gtag!('event', event, p);
}

// Click delegation for WhatsApp, phone and email links (ANL-07).
if (body.dataset.gaId) {
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      const cta = a.dataset.cta ?? (a.closest('footer') ? 'footer' : a.closest('header') ? 'header' : 'inline');
      const code = body.dataset.productCode;
      if (href.startsWith('https://wa.me/')) track('whatsapp_click', { cta_location: cta, ...(code ? { product_code: code } : {}) });
      else if (href.startsWith('tel:')) track('phone_click', { cta_location: cta, phone_line: a.dataset.phoneLine ?? 'mobil_1' });
      else if (href.startsWith('mailto:')) track('email_click', { cta_location: cta });
    },
    { capture: true },
  );
}
