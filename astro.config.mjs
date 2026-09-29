// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://help.letterly.app',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [mdx()],
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
