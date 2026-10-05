// Image helpers (PER-03): resolve catalog image files to Astro image metadata and build srcsets.
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/**/*.{jpg,jpeg,png,webp}', { eager: true });

export function asset(file: string): ImageMetadata {
  const key = file.startsWith('/') ? file : `/${file}`;
  const m = files[key];
  if (!m) throw new Error(`[images] missing asset ${file}`);
  return m.default;
}

export const WIDTHS = [320, 480, 640, 960, 1280, 1600] as const;
const QUALITY = { avif: 55, webp: 75 } as const;

export interface BuiltImage {
  avif: string;
  webp: string;
  /** Largest generated WebP, used as <img src> and as the full-size link. */
  src: string;
  width: number;
  height: number;
}

/** Build AVIF + WebP srcsets for the widths up to `maxWidth`, never above the intrinsic width. */
export async function buildImage(meta: ImageMetadata, maxWidth = 1600): Promise<BuiltImage> {
  const limit = Math.min(meta.width, maxWidth);
  const widths: number[] = WIDTHS.filter((w) => w < limit);
  widths.push(limit);
  const make = async (format: 'avif' | 'webp') => {
    const parts = await Promise.all(
      widths.map(async (w) => {
        const img = await getImage({ src: meta, width: w, format, quality: QUALITY[format] });
        return { w, src: img.src };
      }),
    );
    return parts;
  };
  const [avif, webp] = await Promise.all([make('avif'), make('webp')]);
  const largest = webp[webp.length - 1]!;
  return {
    avif: avif.map((p) => `${p.src} ${p.w}w`).join(', '),
    webp: webp.map((p) => `${p.src} ${p.w}w`).join(', '),
    src: largest.src,
    width: limit,
    height: Math.round((meta.height / meta.width) * limit),
  };
}
