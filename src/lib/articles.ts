import { getCollection, type CollectionEntry } from 'astro:content';
import { categories, type Category, type Group } from '../data/categories';
import { PLATFORMS, PLATFORM_LABELS, type PlatformKey } from './platforms';

export type Article = CollectionEntry<'articles'>;

export type NavGroup = Group & { articles: Article[] };
export type NavCategory = Category & { flat: Article[]; navGroups: NavGroup[]; count: number };

let cache: Promise<Article[]> | null = null;

/**
 * All articles that go on the site (drafts only in `npm run dev`).
 * Also checks links between articles and stops the build with a clear message.
 */
export function getArticles(): Promise<Article[]> {
  if (!cache) cache = load();
  return cache;
}

async function load(): Promise<Article[]> {
  const all = await getCollection('articles');
  const ids = new Set(all.map((a) => a.id));
  const errors: string[] = [];
  for (const a of all) {
    const file = `src/content/articles/${a.id}.mdx`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.id)) {
      errors.push(`${file}: file name must be lowercase words joined by dashes, e.g. set-up-dictation.mdx`);
    }
    for (const r of a.data.related) {
      if (r === a.id) errors.push(`${file}: related lists the article itself ("${r}")`);
      else if (!ids.has(r)) errors.push(`${file}: related "${r}" — there is no file src/content/articles/${r}.mdx`);
    }
    if (new Set(a.data.related).size !== a.data.related.length) {
      errors.push(`${file}: related has the same article twice`);
    }
  }
  if (errors.length) {
    throw new Error(`\n\nArticle check failed:\n  - ${errors.join('\n  - ')}\n`);
  }
  const visible = all.filter((a) => import.meta.env.DEV || !a.data.draft);
  return visible.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

/** Categories with their (non-hidden) articles, in menu order. Empty groups are left out. */
export async function getNav(): Promise<NavCategory[]> {
  const arts = (await getArticles()).filter((a) => !a.data.hidden);
  return categories.map((c) => {
    const inCat = arts.filter((a) => a.data.category === c.slug);
    const navGroups = c.groups
      .map((g) => ({ ...g, articles: inCat.filter((a) => a.data.group === g.slug) }))
      .filter((g) => g.articles.length > 0);
    const flat = c.groups.length ? [] : inCat;
    return { ...c, flat, navGroups, count: inCat.length };
  });
}

export function articleUrl(id: string): string {
  return `/${id}/`;
}

export function categoryUrl(slug: string, group?: string): string {
  return `/category/${slug}/` + (group ? `#grp-${group}` : '');
}

/** "Works on" labels, only when the article is limited to some platforms. */
export function worksOn(platforms: PlatformKey[] | undefined): string[] | null {
  if (!platforms) return null;
  if (PLATFORMS.every((p) => platforms.includes(p))) return null;
  return PLATFORMS.filter((p) => platforms.includes(p)).map((p) => PLATFORM_LABELS[p]);
}
