import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { categories, categorySlugs } from './data/categories';
import { PLATFORMS } from './lib/platforms';

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Articles: one file per article in src/content/articles/<slug>.mdx.
 * The file name is the address: set-up-dictation.mdx → help.letterly.app/set-up-dictation/
 * Any mistake in the block between the --- lines stops the build with a message.
 */
const articles = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/articles' }),
  schema: z
    .strictObject({
      title: z.string().trim().min(3, 'title is too short').max(120, 'title is too long (max 120 characters)'),
      description: z
        .string()
        .trim()
        .min(20, 'description is too short (min 20 characters)')
        .max(200, 'description is too long (max 200 characters) — keep it to one or two sentences'),
      category: z.enum(categorySlugs, {
        error: () => `category must be one of: ${categorySlugs.join(', ')} (see src/data/categories.ts)`,
      }),
      group: z.string().optional(),
      order: z.number({ error: 'order must be a number, e.g. 3' }).int().min(0),
      platforms: z
        .array(z.enum(PLATFORMS, { error: () => `platforms can only contain: ${PLATFORMS.join(', ')}` }))
        .min(1)
        .optional(),
      related: z
        .array(z.string().regex(slugRe, 'related must list article file names without .mdx, e.g. set-up-dictation'))
        .default([]),
      updated: z.coerce.date({ error: 'updated must be a date like 2026-09-29' }),
      draft: z.boolean().default(false),
      hidden: z.boolean().default(false),
      aliases: z.array(z.string().trim().min(2)).default([]),
    })
    .superRefine((data, ctx) => {
      const cat = categories.find((c) => c.slug === data.category);
      if (!cat) return;
      const groupSlugs = cat.groups.map((g) => g.slug);
      if (groupSlugs.length && !data.group) {
        ctx.addIssue({
          code: 'custom',
          path: ['group'],
          message: `group is required for category "${data.category}". Use one of: ${groupSlugs.join(', ')}`,
        });
      }
      if (!groupSlugs.length && data.group) {
        ctx.addIssue({
          code: 'custom',
          path: ['group'],
          message: `category "${data.category}" has no groups — remove the group line`,
        });
      }
      if (groupSlugs.length && data.group && !groupSlugs.includes(data.group)) {
        ctx.addIssue({
          code: 'custom',
          path: ['group'],
          message: `group "${data.group}" does not exist in category "${data.category}". Use one of: ${groupSlugs.join(', ')}`,
        });
      }
      if (data.platforms && new Set(data.platforms).size !== data.platforms.length) {
        ctx.addIssue({ code: 'custom', path: ['platforms'], message: 'platforms has the same platform twice' });
      }
    }),
});

/** Home page FAQ: one Markdown file per question in src/data/faq/. The text of the file is the answer. */
const faq = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/faq' }),
  schema: z.strictObject({
    question: z.string().trim().min(5),
    order: z.number().int().min(0),
  }),
});

export const collections = { articles, faq };
