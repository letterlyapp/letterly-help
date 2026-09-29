/** Components that can be used in any article without an import line. */
import Callout from './Callout.astro';
import Steps from './Steps.astro';
import PlatformTabs from './PlatformTabs.astro';
import Platform from './Platform.astro';
import Figure from './Figure.astro';
import Video from './Video.astro';
import Details from './Details.astro';
import MoreLink from './MoreLink.astro';
import Table from './Table.astro';

export const mdxComponents = {
  Callout, Steps, PlatformTabs, Platform, Figure, Video, Details, MoreLink,
  // Markdown elements with custom markup
  table: Table,
};
