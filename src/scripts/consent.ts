// Cookie consent + GA4 loader (ANL-02..06). Consent Mode "basic": gtag.js is requested only after "Accept".
// ad_storage, ad_user_data and ad_personalization always stay denied. Decision stored as sd_consent_v1.
const KEY = 'sd_consent_v1';
const body = document.body;
const GA_ID = body.dataset.gaId ?? '';
const HOST = body.dataset.gaHost ?? 'spadunyasi.com.tr';
const POLICY = Number(body.dataset.consentVersion ?? '1');
const banner = document.querySelector<HTMLElement>('[data-cookie-banner]');

type Decision = { status: 'granted' | 'denied'; ts: number; policyVersion: number };
let pageOnly: Decision | null = null;

function read(): Decision | null {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Decision | null;
    return d && d.policyVersion === POLICY && (d.status === 'granted' || d.status === 'denied') ? d : null;
  } catch {
    return pageOnly; // storage blocked: decision is valid for this page only (ANL-04)
  }
}

function write(status: Decision['status']): void {
  const d: Decision = { status, ts: Date.now(), policyVersion: POLICY };
  pageOnly = d;
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* page-only decision */
  }
}

function loadGa(): void {
  if (!GA_ID || location.hostname !== HOST || window.gtag) return; // ANL-06
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.append(s);
  body.dataset.gaActive = '1';
}

/** Delete _ga and _ga_* on both the bare and the dotted domain, path "/" (ANL-05). */
function deleteGaCookies(): void {
  const names = document.cookie.split(';').map((c) => c.split('=')[0]!.trim()).filter((n) => n === '_ga' || n.startsWith('_ga_'));
  const host = location.hostname;
  for (const n of names) {
    for (const domain of ['', `; domain=${host}`, `; domain=.${host}`]) document.cookie = `${n}=; Max-Age=0; path=/${domain}`;
  }
}

function show(): void {
  if (!banner) return;
  banner.hidden = false;
  banner.querySelector<HTMLElement>('[data-consent="granted"]')?.focus({ preventScroll: true });
}

if (GA_ID && banner) {
  const d = read();
  if (!d) show();
  else if (d.status === 'granted') loadGa();

  banner.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-consent]');
    if (!b) return;
    const status = b.dataset.consent as Decision['status'];
    const before = read()?.status;
    write(status);
    banner.hidden = true;
    if (status === 'granted') loadGa();
    else if (before === 'granted') {
      deleteGaCookies();
      location.reload();
    }
  });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-cookie-prefs]')) show();
  });
}
