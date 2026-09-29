/**
 * Categories and groups of the Help Center.
 *
 * - The order here is the order on the site (home cards, menu, category pages).
 * - `slug` is used in addresses (/category/<slug>/) and in the article's
 *   frontmatter (`category:` and `group:`). Only lowercase letters, digits and dashes.
 * - `icon` is one of the names in src/components/Icon.astro.
 * - A category without groups (groups: []) lists its articles directly.
 */

export type Group = { slug: string; title: string };
export type Category = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  /** background and foreground colour of the round icon */
  color: { bg: string; fg: string };
  groups: Group[];
};

export const categories: Category[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    description: 'What Letterly is & how to set it up',
    icon: 'rocket',
    color: { bg: 'rgba(255,107,91,.14)', fg: '#C9402F' },
    groups: [
      { slug: 'quick-guides', title: 'Quick guides' },
      { slug: 'about-letterly', title: 'About Letterly' },
      { slug: 'set-up', title: 'Set up' },
    ],
  },
  {
    slug: 'using-letterly',
    title: 'Using Letterly',
    description: 'Dictation, notes, meetings & more',
    icon: 'mic',
    color: { bg: 'rgba(91,58,237,.12)', fg: '#5B3AED' },
    groups: [
      { slug: 'dictation', title: 'Mode 1 · Dictation' },
      { slug: 'record-myself', title: 'Mode 2 · Record myself' },
      { slug: 'meeting', title: 'Mode 3 · Meeting' },
      { slug: 'rewrite-and-translation', title: 'Rewrite & translation' },
      { slug: 'words-and-spelling', title: 'Words & spelling' },
      { slug: 'working-with-notes', title: 'Working with notes' },
      { slug: 'organizing-notes', title: 'Organizing notes' },
      { slug: 'audio', title: 'Audio' },
      { slug: 'ai-and-integrations', title: 'AI & integrations' },
      { slug: 'quick-access', title: 'Quick access' },
    ],
  },
  {
    slug: 'billing-and-subscription',
    title: 'Billing & subscription',
    description: 'Plans, payments and receipts',
    icon: 'card',
    color: { bg: 'rgba(232,160,46,.18)', fg: '#9A5F06' },
    groups: [
      { slug: 'plans-and-pricing', title: 'Plans & pricing' },
      { slug: 'managing-your-subscription', title: 'Managing your subscription' },
      { slug: 'payments-and-receipts', title: 'Payments & receipts' },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description: "When something isn't working",
    icon: 'wrench',
    color: { bg: 'rgba(62,139,216,.14)', fg: '#2767AD' },
    groups: [
      { slug: 'signing-in', title: 'Signing in' },
      { slug: 'recording-and-transcription', title: 'Recording & transcription' },
      { slug: 'dictation', title: 'Dictation' },
      { slug: 'words-and-spelling', title: 'Words & spelling' },
      { slug: 'sync', title: 'Sync' },
    ],
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy & security',
    description: "Your data and how it's handled",
    icon: 'shield',
    color: { bg: 'rgba(47,169,140,.15)', fg: '#1D7F63' },
    groups: [],
  },
  {
    slug: 'more',
    title: 'More',
    description: 'New features, affiliate & contact',
    icon: 'megaphone',
    color: { bg: 'rgba(122,130,144,.16)', fg: '#525A68' },
    groups: [],
  },
];

export const categorySlugs = categories.map((c) => c.slug) as [string, ...string[]];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
