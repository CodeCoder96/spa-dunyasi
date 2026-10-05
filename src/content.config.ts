// Content collections (ICR-14). Files: src/content/<collection>/<lang>/<id>.md; entry id = "<lang>/<id>".
// Technical data never lives here (KAY-21): templates print specs/options from the catalog.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const idFromPath = ({ entry }: { entry: string }) => entry.replace(/\.md$/, '');
const faq = z.array(z.object({ q: z.string().min(5), a: z.string().min(10) }));
const keyword = z.object({ primary: z.string().min(2), secondary: z.array(z.string()).min(2).max(5), intent: z.string().optional() });
const base = {
  /** <title> without the " | Spa Dünyası" suffix (added by the layout). */
  title: z.string().min(5),
  description: z.string().min(50),
  keyword,
};

const products = defineCollection({
  loader: glob({ pattern: '*/SD-[0-9][0-9][0-9].md', base: './src/content/products', generateId: idFromPath }),
  schema: z.object({
    ...base,
    code: z.string().regex(/^SD-\d{3}$/),
    intro: z.string().min(40),
    highlights: z.array(z.string()).min(3).max(5),
    price: z.string().min(40),
    faq: faq.min(2).max(4),
    relatedGuides: z.array(z.string()).min(1).max(2),
    related: z.array(z.string().regex(/^SD-\d{3}$/)).optional(),
  }),
});

const categories = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/categories', generateId: idFromPath }),
  schema: z.object({
    ...base,
    intro: z.string().min(20),
    faq: faq.min(2).max(5),
    relatedGuides: z.array(z.string()).min(1),
    relatedServices: z.array(z.string()).default([]),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/services', generateId: idFromPath }),
  schema: z.object({
    ...base,
    intro: z.string().min(40),
    steps: z.array(z.object({ title: z.string(), text: z.string() })).length(4),
    faq: faq.min(3).max(6),
    relatedProducts: z.array(z.string().regex(/^SD-\d{3}$/)).default([]),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/guides', generateId: idFromPath }),
  schema: z.object({
    ...base,
    summary: z.array(z.string()).min(3).max(6),
    datePublished: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateModified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    products: z.array(z.string().regex(/^SD-\d{3}$/)).min(1).max(8),
    image: z.string().regex(/^SD-\d{3}$/).optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/pages', generateId: idFromPath }),
  schema: z.object({
    title: z.string().min(5),
    description: z.string().min(50),
    keyword: keyword.optional(),
    h1: z.string().optional(),
    lead: z.string().optional(),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    faq: faq.optional(),
    /** Home page only. */
    hero: z.object({ subtitle: z.string() }).optional(),
    why: z.array(z.object({ title: z.string(), text: z.string() })).optional(),
    featured: z.array(z.string().regex(/^SD-\d{3}$/)).optional(),
    guides: z.array(z.string()).optional(),
    sections: z.record(z.string(), z.string()).optional(),
  }),
});

export const collections = { products, categories, services, guides, pages };
