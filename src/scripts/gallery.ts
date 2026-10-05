// Gallery enhancement (SAB-03): smooth thumbnail scrolling with aria-current, fullscreen <dialog> with
// prev/next buttons, arrow keys, Esc, swipe, focus return and next-image preloading.

function initGallery(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>('[data-gallery-track]');
  const slides = [...root.querySelectorAll<HTMLElement>('.gallery__slide')];
  const thumbs = [...root.querySelectorAll<HTMLAnchorElement>('[data-gallery-thumb]')];
  const opens = [...root.querySelectorAll<HTMLAnchorElement>('[data-gallery-open]')];
  const dialog = root.querySelector<HTMLDialogElement>('[data-lightbox]');
  if (!track || !slides.length) return;

  const setCurrent = (i: number) => thumbs.forEach((t, k) => (k === i ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current')));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  thumbs.forEach((t, i) =>
    t.addEventListener('click', (e) => {
      e.preventDefault();
      track.scrollTo({ left: slides[i]!.offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
      setCurrent(i);
    }),
  );
  let raf = 0;
  track.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCurrent(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
    },
    { passive: true },
  );

  if (!dialog) return;
  const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]')!;
  const counter = dialog.querySelector<HTMLElement>('[data-lightbox-counter]');
  let index = 0;
  let opener: HTMLElement | null = null;
  const preload = (i: number) => {
    const o = opens[(i + opens.length) % opens.length];
    if (o) new Image().src = o.dataset.full!;
  };
  const show = (i: number) => {
    index = (i + opens.length) % opens.length;
    const o = opens[index]!;
    img.src = o.dataset.full!;
    img.alt = o.querySelector('img')?.alt ?? '';
    if (counter) counter.textContent = `${index + 1} / ${opens.length}`;
    preload(index + 1);
  };
  opens.forEach((o, i) =>
    o.addEventListener('click', (e) => {
      e.preventDefault();
      opener = o;
      show(i);
      dialog.showModal();
    }),
  );
  dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-lightbox-next]')?.addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    opener?.focus();
    setCurrent(index);
  });
  let x0: number | null = null;
  dialog.addEventListener('touchstart', (e) => (x0 = e.touches[0]?.clientX ?? null), { passive: true });
  dialog.addEventListener(
    'touchend',
    (e) => {
      if (x0 === null) return;
      const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
      if (Math.abs(dx) > 40 && opens.length > 1) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
    },
    { passive: true },
  );
}

document.querySelectorAll<HTMLElement>('[data-gallery]').forEach(initGallery);
