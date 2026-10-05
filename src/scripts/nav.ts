// Header menus (SAB-11). Without JS the "Products"/"Services" items are plain links and the mobile menu
// relies on the Popover API. With JS: click-to-open dropdowns (aria-expanded, Esc, outside click) and a
// class-based fallback for browsers without popover support.

function initDropdowns(): void {
  const items = [...document.querySelectorAll<HTMLElement>('[data-dropdown]')];
  if (!items.length) return;
  const closeAll = (except?: HTMLElement) => {
    for (const it of items) {
      if (it === except) continue;
      it.querySelector('[data-dd-toggle]')?.setAttribute('aria-expanded', 'false');
      it.querySelector<HTMLElement>('[data-dd-panel]')?.setAttribute('hidden', '');
    }
  };
  for (const it of items) {
    const link = it.querySelector<HTMLElement>('[data-dd-link]');
    const toggle = it.querySelector<HTMLButtonElement>('[data-dd-toggle]');
    const panel = it.querySelector<HTMLElement>('[data-dd-panel]');
    if (!link || !toggle || !panel) continue;
    link.hidden = true;
    toggle.hidden = false;
    if (link.hasAttribute('aria-current')) toggle.setAttribute('aria-current', 'true');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      closeAll(it);
      toggle.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
      if (!open) panel.querySelector<HTMLElement>('a')?.focus();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = items.find((it) => it.querySelector('[data-dd-toggle]')?.getAttribute('aria-expanded') === 'true');
    if (!open) return;
    closeAll();
    open.querySelector<HTMLElement>('[data-dd-toggle]')?.focus();
  });
  document.addEventListener('click', (e) => {
    if (!items.some((it) => it.contains(e.target as Node))) closeAll();
  });
  document.addEventListener('focusin', (e) => {
    if (!items.some((it) => it.contains(e.target as Node))) closeAll();
  });
}

function initMobileMenu(): void {
  const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!menu || !openBtn) return;
  const supportsPopover = typeof HTMLElement.prototype.togglePopover === 'function';
  if (supportsPopover) {
    menu.addEventListener('toggle', (e) => {
      const open = (e as ToggleEvent).newState === 'open';
      openBtn.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector<HTMLElement>('a, button')?.focus();
    });
    return;
  }
  // Fallback: toggle a class and manage focus/Escape ourselves.
  const closeBtn = menu.querySelector<HTMLButtonElement>('[data-menu-close]');
  const setOpen = (open: boolean) => {
    menu.classList.toggle('is-open', open);
    openBtn.setAttribute('aria-expanded', String(open));
    if (open) closeBtn?.focus();
    else openBtn.focus();
  };
  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    setOpen(!menu.classList.contains('is-open'));
  });
  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
  });
}

initDropdowns();
initMobileMenu();
