/** Site-wide settings. */
export const site = {
  name: 'Letterly Help Center',
  description:
    'Help Center for Letterly, the voice-to-text and dictation app: setup guides, answers about plans and billing, and troubleshooting.',
  url: 'https://help.letterly.app',
  logo: 'https://help.letterly.app/images/logo/logo-dark.webp',
  ogImage: 'https://help.letterly.app/og.png',
  email: 'hi@letterly.app',
  appUrl: 'https://web.letterly.app',
};

/**
 * "Popular topics" chips under the search on the home page.
 * `article` is the article's file name without .mdx.
 * If an article here does not exist, the build stops with a message.
 */
export const popular: { label: string; article: string }[] = [
  { label: 'Getting started', article: 'what-is-letterly' },
  { label: 'Cancel subscription', article: 'manage-or-cancel-my-subscription' },
  { label: "Magic link didn't arrive", article: 'my-magic-link-didnt-arrive' },
  { label: 'Rewrite options', article: 'rewrite-options' },
  { label: 'Record a meeting', article: 'what-is-the-meeting-mode' },
];
