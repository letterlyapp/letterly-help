// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';

/**
 * Sitemap data from the article files: hidden and draft articles stay out of the sitemap,
 * `updated` becomes <lastmod>.
 */
const articlesDir = new URL('./src/content/articles/', import.meta.url);
const articleMeta = new Map();
for (const file of fs.readdirSync(articlesDir)) {
  if (!file.endsWith('.mdx')) continue;
  const fm = fs.readFileSync(new URL(file, articlesDir), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  articleMeta.set(file.slice(0, -4), {
    skip: /^(hidden|draft):\s*true\s*$/m.test(fm),
    updated: fm.match(/^updated:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1],
  });
}
/** @param {string} url */
const slugOf = (url) => new URL(url).pathname.replace(/^\/|\/$/g, '');

export default defineConfig({
  site: 'https://help.letterly.app',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => {
        const slug = slugOf(page);
        return slug !== '404' && !articleMeta.get(slug)?.skip;
      },
      serialize: (item) => {
        const updated = articleMeta.get(slugOf(item.url))?.updated;
        if (updated) item.lastmod = new Date(`${updated}T00:00:00Z`).toISOString();
        return item;
      },
    }),
  ],
  markdown: {
    // keep the article text exactly as written (no automatic “smart quotes”)
    processor: satteri({ features: { smartPunctuation: false } }),
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        // MDX pages carry an Astro-internal "use astro:head-inject" line that the bundler reports as noise
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
          warn(warning);
        },
      },
    },
  },
});
