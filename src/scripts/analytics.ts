/* Custom events for Vercel Web Analytics (see "Analytics" in AGENTS.md).
   Page views are counted by <Analytics /> in src/layouts/Base.astro; nothing is sent outside help.letterly.app
   (the filter is `webAnalyticsBeforeSend` in the same file). Pro plan: at most 2 properties per event. */
import { track } from '@vercel/analytics';

/** "Was this helpful?" answer. `article` is the article slug (its URL without slashes). */
export function trackHelpful(answer: 'yes' | 'no') {
  track('helpful', { article: location.pathname.replace(/^\/|\/$/g, ''), answer });
}

/** A search that found nothing. Sent once per distinct query per page view. */
const sentQueries = new Set<string>();
export function trackNoResults(query: string) {
  const q = query.trim().toLowerCase().slice(0, 60);
  if (q.length < 2 || sentQueries.has(q)) return;
  sentQueries.add(q);
  track('search_no_results', { query: q });
}
