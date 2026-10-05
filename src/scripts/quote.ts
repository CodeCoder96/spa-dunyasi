// Quote list (DON-05). Storage: localStorage "sd_quote_v1" = {v:1, items:[{code, qty, addedAt}]}.
// Names, paths and thumbnails come from /quote-index.<hash>.json (language independent list).
// Limits: ≤ 30 distinct items, qty 1-99 integers. Falls back to in-memory storage when localStorage is blocked.
import { track } from './track.ts';

type Item = { code: string; qty: number; addedAt: number };
type Store = { v: 1; items: Item[] };
type IndexEntry = { n: { tr: string; en: string }; p: { tr: string; en: string }; t: string };

const KEY = 'sd_quote_v1';
const MAX_ITEMS = 30;
const MAX_QTY = 99;
const WA_LIMIT = 2000;
const WA_BASE = 'https://wa.me/905343597644';
const EMAIL = 'info@spaworld.com.tr';

const body = document.body;
const lang = (body.dataset.lang === 'en' ? 'en' : 'tr') as 'tr' | 'en';
const dialog = document.querySelector<HTMLDialogElement>('[data-quote-dialog]');
const T = (k: string) => dialog?.querySelector<HTMLElement>(`[data-t="${k}"]`)?.textContent ?? '';

// ---------------------------------------------------------------- storage
let memory: Store = { v: 1, items: [] };
let persistent = true;
try {
  const probe = '__sd_probe__';
  localStorage.setItem(probe, '1');
  localStorage.removeItem(probe);
} catch {
  persistent = false;
}

function sanitize(raw: unknown): Store {
  const out: Store = { v: 1, items: [] };
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Store).items)) return out;
  const seen = new Set<string>();
  for (const it of (raw as Store).items) {
    if (!it || typeof it.code !== 'string' || !/^SD-\d{3}$/.test(it.code) || seen.has(it.code)) continue;
    const qty = Math.min(MAX_QTY, Math.max(1, Math.trunc(Number(it.qty)) || 1));
    out.items.push({ code: it.code, qty, addedAt: Number(it.addedAt) || Date.now() });
    seen.add(it.code);
    if (out.items.length >= MAX_ITEMS) break;
  }
  return out;
}

function load(): Store {
  if (!persistent) return memory;
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return { v: 1, items: [] };
  }
}

function save(s: Store): void {
  memory = s;
  if (!persistent) return;
  try {
    if (s.items.length) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    persistent = false;
  }
}

// ---------------------------------------------------------------- index (names/paths/thumbs)
let index: Record<string, IndexEntry> | null = null;
let indexPromise: Promise<void> | null = null;
function loadIndex(): Promise<void> {
  if (indexPromise) return indexPromise;
  const url = body.dataset.quoteIndex;
  indexPromise = (url ? fetch(url, { credentials: 'same-origin' }) : Promise.reject(new Error('no index')))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { items: Record<string, IndexEntry> }) => {
      index = j.items;
      // Silently drop codes that are no longer in the catalogue.
      const s = load();
      const kept = s.items.filter((i) => index![i.code]);
      if (kept.length !== s.items.length) save({ v: 1, items: kept });
    })
    .catch(() => {
      index = null; // names unavailable: show codes only, sending still works
    });
  return indexPromise;
}

// ---------------------------------------------------------------- announcements + counter
const live = dialog?.querySelector<HTMLElement>('[data-quote-live]');
const pageLive = document.querySelector<HTMLElement>('[data-quote-page-live]');
function announce(msg: string): void {
  for (const el of [live, pageLive]) {
    if (!el) continue;
    el.textContent = '';
    window.setTimeout(() => (el.textContent = msg), 50);
  }
}
const nameOf = (code: string) => index?.[code]?.n[lang] ?? code;

function renderCount(): void {
  const n = load().items.length;
  document.querySelectorAll<HTMLElement>('[data-quote-count]').forEach((c) => {
    c.textContent = String(n);
    c.hidden = n === 0; // no "0" badge on an empty list
  });
  document.querySelectorAll<HTMLElement>('[data-quote-open]').forEach((b) => {
    b.hidden = false;
    b.setAttribute('aria-label', `${T('open')} (${n} ${T('count')})`);
  });
}

// ---------------------------------------------------------------- mutations
function add(code: string, qty: number): boolean {
  const s = load();
  const found = s.items.find((i) => i.code === code);
  if (found) found.qty = Math.min(MAX_QTY, found.qty + qty);
  else {
    if (s.items.length >= MAX_ITEMS) {
      announce(T('limit'));
      showError(T('limit'));
      return false;
    }
    s.items.push({ code, qty: Math.min(MAX_QTY, qty), addedAt: Date.now() });
  }
  save(s);
  renderCount();
  const now = s.items.find((i) => i.code === code)!.qty;
  announce(`${nameOf(code)} ${T('added')} ${now}`);
  track('quote_add', { product_code: code, quantity: qty });
  return true;
}

function setQty(code: string, qty: number): void {
  const s = load();
  const it = s.items.find((i) => i.code === code);
  if (!it) return;
  it.qty = Math.min(MAX_QTY, Math.max(1, qty));
  save(s);
  announce(`${nameOf(code)} ${T('qtyChanged')} ${it.qty}`);
}

function remove(code: string): void {
  const s = load();
  save({ v: 1, items: s.items.filter((i) => i.code !== code) });
  renderCount();
  announce(`${nameOf(code)} ${T('removed')}`);
  track('quote_remove', { product_code: code });
}

/** Parse a quantity field: integers only; out-of-range values are clamped; anything else is invalid (null). */
export function parseQty(v: string): number | null {
  const t = v.trim();
  if (!/^\d+$/.test(t)) return null;
  return Math.min(MAX_QTY, Math.max(1, Number(t)));
}

// ---------------------------------------------------------------- messages
function lines(withNames: boolean): string[] {
  return load().items.map((i) => (withNames && index?.[i.code] ? `• ${nameOf(i.code)} (${i.code}) × ${i.qty}` : `• ${i.code} × ${i.qty}`));
}
function message(withNames: boolean, sep = '\n'): string {
  return [T('msgIntro'), '', ...lines(withNames), '', T('msgSource')].join(sep);
}
export function whatsappUrl(): string | null {
  for (const withNames of [true, false]) {
    const url = `${WA_BASE}?text=${encodeURIComponent(message(withNames))}`;
    if (url.length <= WA_LIMIT) return url;
  }
  return null;
}
export function mailtoUrl(): string {
  // CRLF line breaks: some mail clients ignore a bare \n (DON-05).
  const enc = (s: string) => encodeURIComponent(s).replace(/%0A/g, '%0D%0A');
  return `mailto:${EMAIL}?subject=${enc(T('subject'))}&body=${enc(message(true))}`;
}

// ---------------------------------------------------------------- panel
const list = dialog?.querySelector<HTMLUListElement>('[data-quote-list]');
const tpl = dialog?.querySelector<HTMLTemplateElement>('[data-quote-row]');
const empty = dialog?.querySelector<HTMLElement>('[data-quote-empty]');
const actions = dialog?.querySelector<HTMLElement>('[data-quote-actions]');
const errorEl = dialog?.querySelector<HTMLElement>('[data-quote-error]');
const clearBtn = dialog?.querySelector<HTMLButtonElement>('[data-quote-clear]');

function showError(msg: string): void {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
}

function renderPanel(): void {
  if (!dialog || !list || !tpl) return;
  const items = load().items;
  list.replaceChildren();
  for (const it of items) {
    const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
    row.dataset.code = it.code;
    const entry = index?.[it.code];
    const a = row.querySelector<HTMLAnchorElement>('[data-name]')!;
    a.textContent = entry ? entry.n[lang] : it.code;
    if (entry) a.href = entry.p[lang];
    else a.removeAttribute('href');
    a.setAttribute('translate', 'no');
    row.querySelector<HTMLElement>('[data-code]')!.textContent = it.code;
    const thumb = row.querySelector<HTMLElement>('[data-thumb]')!;
    if (entry) {
      const img = document.createElement('img');
      img.src = entry.t;
      img.alt = '';
      img.width = 56;
      img.height = 42;
      img.loading = 'lazy';
      thumb.append(img);
    }
    const input = row.querySelector<HTMLInputElement>('[data-qty]')!;
    input.value = String(it.qty);
    input.setAttribute('aria-label', `${T('qty')}: ${entry ? entry.n[lang] : it.code}`);
    list.append(row);
  }
  const has = items.length > 0;
  if (empty) empty.hidden = has;
  if (actions) actions.hidden = !has;
  dialog.querySelector<HTMLElement>('[data-quote-memory]')!.hidden = persistent;
}

function resetClear(): void {
  if (!clearBtn) return;
  clearBtn.dataset.armed = '';
  clearBtn.querySelector('[data-clear-label]')!.textContent = clearBtn.dataset.label ?? '';
}

function initPanel(): void {
  if (!dialog || !list) return;
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const opener = t.closest<HTMLElement>('[data-quote-open]');
    if (opener) {
      showError('');
      resetClear();
      renderPanel();
      dialog.showModal();
      loadIndex().then(renderPanel);
    }
    const addBtn = t.closest<HTMLButtonElement>('[data-quote-add]');
    if (addBtn) {
      const form = addBtn.closest('[data-quote-form]');
      const qtyInput = form?.querySelector<HTMLInputElement>('[data-quote-qty]');
      const qty = qtyInput ? parseQty(qtyInput.value) : 1;
      if (qty === null) {
        qtyInput!.value = '1';
        qtyInput!.focus();
        return;
      }
      if (qtyInput) qtyInput.value = String(qty);
      loadIndex().then(() => {
        if (add(addBtn.dataset.quoteAdd!, qty)) {
          addBtn.classList.add('is-added');
          window.setTimeout(() => addBtn.classList.remove('is-added'), 1200);
        }
      });
    }
  });

  dialog.querySelector('[data-quote-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  list.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const row = t.closest<HTMLElement>('[data-code]');
    if (!row) return;
    const code = row.dataset.code!;
    const step = t.closest<HTMLElement>('[data-step]');
    if (step) {
      const it = load().items.find((i) => i.code === code);
      if (!it) return;
      setQty(code, it.qty + Number(step.dataset.step));
      renderPanel();
      list.querySelector<HTMLElement>(`[data-code="${code}"] [data-step="${step.dataset.step}"]`)?.focus();
    }
    if (t.closest('[data-remove]')) {
      const next = row.nextElementSibling ?? row.previousElementSibling;
      const nextCode = (next as HTMLElement | null)?.dataset.code;
      remove(code);
      renderPanel();
      (nextCode ? list.querySelector<HTMLElement>(`[data-code="${nextCode}"] [data-remove]`) : dialog.querySelector<HTMLElement>('[data-quote-close]'))?.focus();
    }
  });
  list.addEventListener('change', (e) => {
    const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-qty]');
    if (!input) return;
    const code = input.closest<HTMLElement>('[data-code]')!.dataset.code!;
    const q = parseQty(input.value);
    const it = load().items.find((i) => i.code === code);
    if (q === null) input.value = String(it?.qty ?? 1); // invalid: revert
    else {
      setQty(code, q);
      input.value = String(q);
    }
  });

  dialog.querySelectorAll<HTMLButtonElement>('[data-quote-send]').forEach((b) =>
    b.addEventListener('click', () => {
      const channel = b.dataset.quoteSend as 'whatsapp' | 'email';
      const items = load().items;
      if (!items.length) return;
      const url = channel === 'whatsapp' ? whatsappUrl() : mailtoUrl();
      if (!url) {
        showError(T('tooLong'));
        announce(T('tooLong'));
        return;
      }
      showError('');
      track('quote_send', {
        channel,
        item_count: items.length,
        total_quantity: items.reduce((a, i) => a + i.qty, 0),
        product_codes: items.map((i) => i.code).join(',').slice(0, 100),
        cta_location: 'quote_panel',
      });
      // Observable hook for tests and integrations; carries the exact URL being opened.
      document.dispatchEvent(new CustomEvent('sd:quote-send', { detail: { channel, url } }));
      if (channel === 'whatsapp') window.open(url, '_blank', 'noopener');
      else window.location.href = url;
    }),
  );

  clearBtn?.addEventListener('click', () => {
    if (clearBtn.dataset.armed !== '1') {
      clearBtn.dataset.armed = '1';
      clearBtn.querySelector('[data-clear-label]')!.textContent = clearBtn.dataset.confirm ?? '';
      window.setTimeout(resetClear, 5000);
      return;
    }
    save({ v: 1, items: [] });
    resetClear();
    renderCount();
    renderPanel();
    announce(T('cleared'));
    dialog.querySelector<HTMLElement>('[data-quote-close]')?.focus();
  });
  clearBtn?.addEventListener('blur', () => window.setTimeout(resetClear, 200));
}

// ---------------------------------------------------------------- boot
if (dialog) {
  document.querySelectorAll<HTMLElement>('[data-quote-add], [data-quote-form]').forEach((el) => (el.hidden = false));
  document.querySelectorAll<HTMLInputElement>('[data-quote-qty]').forEach((inp) =>
    inp.addEventListener('change', () => {
      const q = parseQty(inp.value);
      inp.value = String(q ?? 1);
    }),
  );
  initPanel();
  renderCount();
  if (load().items.length) loadIndex().then(renderCount);
  // Cross-tab sync (storage event fires in other tabs only).
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return;
    renderCount();
    if (dialog.open) renderPanel();
  });
}
