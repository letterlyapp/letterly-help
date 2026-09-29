/** Site-wide settings. */
export const site = {
  name: 'Letterly Help Center',
  description: 'Answers, guides and troubleshooting for Letterly.',
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
