/** Platforms Letterly runs on. Keys are used in frontmatter and in <Platform name="…">. */
export const PLATFORMS = ['iphone', 'android', 'mac', 'windows', 'web'] as const;
export type PlatformKey = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  iphone: 'iPhone',
  android: 'Android',
  mac: 'Mac',
  windows: 'Windows',
  web: 'Web',
};

export function isPlatform(v: unknown): v is PlatformKey {
  return typeof v === 'string' && (PLATFORMS as readonly string[]).includes(v);
}
