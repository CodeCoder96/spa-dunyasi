// Emits /quote-index.<hash>.json (DON-05).
import type { APIRoute } from 'astro';
import { quoteIndexJson, quoteIndexName } from '../lib/quote-index.ts';

export function getStaticPaths() {
  return [{ params: { file: quoteIndexName } }];
}

export const GET: APIRoute = () => new Response(quoteIndexJson, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
