/** Structured data (schema.org JSON-LD) for search engines. */
import { site } from '../data/site';

const abs = (href: string) => new URL(href, site.url).href;

/** The company behind the help center — publisher of every article. */
export const organization = {
  '@type': 'Organization',
  '@id': 'https://letterly.app/#organization',
  name: 'Letterly',
  url: 'https://letterly.app/',
  logo: { '@type': 'ImageObject', url: site.logo, width: 512, height: 159 },
  email: site.email,
};

/**
 * BreadcrumbList from the page's breadcrumbs plus the page itself.
 * Crumbs that point to a part of a page (#group) are left out — they are not separate pages.
 */
export function breadcrumbList(crumbs: { label: string; href?: string }[], current: { label: string; href: string }) {
  const items = [...crumbs.filter((c) => c.href && !c.href.includes('#')), current];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: abs(c.href!) })),
  };
}

export function articleLd(a: { title: string; description: string; updated: Date; url: string }) {
  return {
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    dateModified: a.updated.toISOString().slice(0, 10),
    url: abs(a.url),
    mainEntityOfPage: abs(a.url),
    image: site.ogImage,
    inLanguage: 'en',
    author: { '@id': organization['@id'] },
    publisher: organization,
  };
}

export const websiteLd = {
  '@type': 'WebSite',
  '@id': `${site.url}/#website`,
  name: site.name,
  url: `${site.url}/`,
  description: site.description,
  inLanguage: 'en',
  publisher: { '@id': organization['@id'] },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

/** FAQPage from the home page questions; answers are HTML with absolute links. */
export function faqLd(faq: { q: string; html: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, html }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: html.replace(/\s(href|src)="\/(?!\/)/g, ` $1="${site.url}/`).trim(),
      },
    })),
  };
}
