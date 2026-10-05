// All-products filter (SAB-06): chips become in-page filters with aria-pressed; state lives in the URL hash
// (#masaj-yataklari), never in a query string; the visible count is announced via aria-live.

const nav = document.querySelector<HTMLElement>('[data-filter]');
const grid = document.querySelector<HTMLElement>('[data-filter-grid]');
if (nav && grid) {
  const chips = [...nav.querySelectorAll<HTMLAnchorElement>('[data-filter-chip]')];
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-category]')];
  const count = nav.querySelector<HTMLElement>('[data-filter-count]');
  const template = count?.dataset.template ?? '{n}';
  const bySlug = new Map(chips.map((c) => [c.dataset.filterChip ?? '', c.dataset.filterCategory ?? '']));

  const apply = (slug: string, announce: boolean) => {
    const category = bySlug.get(slug) ?? '';
    let n = 0;
    for (const card of cards) {
      const show = !category || card.dataset.category === category;
      card.hidden = !show;
      if (show) n++;
    }
    for (const c of chips) {
      c.removeAttribute('aria-current');
      c.setAttribute('aria-pressed', String((c.dataset.filterChip ?? '') === (bySlug.has(slug) ? slug : '')));
    }
    if (count && announce) count.textContent = template.replace('{n}', String(n));
  };

  for (const c of chips) {
    c.setAttribute('role', 'button');
    c.addEventListener('click', (e) => {
      e.preventDefault();
      const slug = c.dataset.filterChip ?? '';
      history.replaceState(null, '', slug ? `#${slug}` : location.pathname);
      apply(slug, true);
    });
  }
  const fromHash = () => decodeURIComponent(location.hash.slice(1));
  window.addEventListener('hashchange', () => apply(fromHash(), true));
  apply(fromHash(), Boolean(location.hash));
}
