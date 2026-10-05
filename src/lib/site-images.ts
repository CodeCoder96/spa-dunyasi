// Non-product photos (service heroes) with alt texts describing what is shown (ICR-13).
import type { ImageMetadata } from 'astro';
import hamam from '../assets/site/hizmet-hamam.webp';
import sauna from '../assets/site/hizmet-sauna.webp';
import buhar from '../assets/site/hizmet-buhar-odasi.webp';
import havuz from '../assets/site/hizmet-havuz.webp';
import islak from '../assets/site/rehber-islak-alan.webp';

type Hero = { src: ImageMetadata; alt: { tr: string; en: string } };

const HEROES: Record<string, Hero> = {
  hamam: { src: hamam, alt: { tr: 'Kemerli kapıları ve desenli göbek taşıyla beyaz mermer hamam', en: 'White marble hammam with arched doors and a patterned heated centre stone' } },
  sauna: { src: sauna, alt: { tr: 'Ahşap kademeli oturma alanı ve taş sobasıyla loş ışıklı sauna', en: 'Softly lit sauna with tiered wooden benches and a stone heater' } },
  'buhar-odasi': { src: buhar, alt: { tr: 'Koyu taş kaplı, tavanı yıldız ışıklı buhar odası', en: 'Dark stone-clad steam room with a starry ceiling' } },
  havuz: { src: havuz, alt: { tr: 'Geniş camlı cepheli kapalı yüzme havuzu ve şezlonglar', en: 'Indoor swimming pool with full-height glazing and loungers' } },
  'rehber-islak-alan': { src: islak, alt: { tr: 'Taş oturma bankları olan sıcak tonlu buhar odası', en: 'Warm-toned steam room with stone benches' } },
};

export function serviceHero(key: string): Hero {
  const h = HEROES[key];
  if (!h) throw new Error(`[site-images] no hero for ${key}`);
  return h;
}

export const homeHeroAlt = {
  tr: 'Mermer göbek taşı ve kurnaları olan, sıcak ışıklı hamam',
  en: 'Warmly lit hammam with a marble heated stone and basins',
};
