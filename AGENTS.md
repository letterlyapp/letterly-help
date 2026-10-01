# Letterly Help Center — guide for AI assistants

This repo is the source of https://help.letterly.app: Astro 7 + Tailwind 4 + MDX, search by Pagefind,
hosted on Vercel. Every merge to `main` is live in about a minute; every pull request gets a Vercel preview.

Most changes come from the content editor (Dasha) through her Claude, using the `letterly-help` Cowork plugin.
This file is the exact technical guide for writing and editing content. It lives in the repo, so it changes
together with the code — read it again whenever it changes.

## Commands

```bash
npm ci          # install (first time and after package-lock.json changes)
npm run check   # type check + build + search index + strict link check (~15 s). Must pass before publishing.
npm run dev     # local site on http://localhost:4321 (search does not work in dev; drafts and <Shot> are visible)
```

`npm run check` fails with a readable message on: a bad frontmatter field, an unknown category or group,
a `related` entry that is not an existing article, an unknown component or callout type,
a picture or video that does not exist (except pending files in `public/images/help-center/`, see below),
and a broken internal link.
It also prints a **warning** (does not fail) listing article descriptions that break the description rule below.

SEO is automatic: every page gets a canonical URL, Open Graph/Twitter tags with `/og.png`, and structured data
(JSON-LD); `sitemap-index.xml` lists the home page, categories and every article except `draft` and `hidden` ones
(their `updated` date is the sitemap `lastmod`); `draft` and `hidden` articles get `noindex, follow`.

## Who may change what

Checks on every pull request (both are required to merge into `main`):

- `check` — `npm run check`.
- `guard` — authors who are not in `.github/maintainers.txt` and not repo admins may change only:
  `src/content/**` (articles), `src/data/faq/**` (home page FAQ), `public/images/**`, `public/video/**`.

Content editors must never change anything else: `.github/`, `src/components/`, `src/pages/`, `src/layouts/`,
`src/lib/`, `src/styles/`, `src/data/categories.ts`, `src/data/site.ts`, `scripts/`, `astro.config.mjs`,
`package*.json`, `tsconfig.json`, this file, `CLAUDE.md`, `README.md`. New sections, components or design
changes are requests for a maintainer (Roman).

Git rules: work on a branch (`dasha/<short-topic>-<yyyymmdd>` for the editor), never push to `main`,
never force-push, merge with a merge commit (`gh pr merge --merge --delete-branch`) only when both checks are green.

## Where things live

| What | Where |
|---|---|
| Articles | `src/content/articles/<slug>.mdx` — one file per article; the file name is the URL: `tags.mdx` → `/tags/` |
| Home page FAQ | `src/data/faq/NN-<slug>.md` — one question per file |
| Sections (categories and groups) | `src/data/categories.ts` — read-only for editors |
| Components usable in articles | `src/components/mdx/` (list below) — read-only for editors |
| New pictures | `public/images/help-center/` → `src="/images/help-center/<name>.webp"` |
| Pictures imported from letterly.app blog | `public/images/blog/` (do not add new files here) |
| Videos | `public/video/` → `src="/video/<name>.mp4"` |

## Article file

```mdx
---
title: "Merge notes"
description: "Merging combines several existing notes into one."
category: using-letterly
group: working-with-notes
order: 5
platforms: [iphone, android, mac, windows, web]
related: [record-more, what-is-a-note, delete-a-note]
updated: 2026-09-30
aliases: [combine notes, join notes]
---

Merging combines several existing notes into one.

## To merge notes

<Steps>

1. On the notes screen, press and hold a note to select it, then select the others.
2. Choose **Merge**.

</Steps>
```

### Frontmatter fields (schema: `src/content.config.ts`; unknown fields are an error)

| Field | Required | Rules |
|---|---|---|
| `title` | yes | 3–120 characters. Sentence case ("Set up Dictation"). Questions are fine ("Can I get a refund?"). |
| `description` | yes | Aim for **70–160 characters**: a complete sentence that says what the article helps with (Google shows it under the title in search results; it is also used in link previews and our search). Never end with a colon. The build accepts 20–200 characters but prints a warning for descriptions shorter than 70, longer than 160 or ending with ":" (see `node scripts/check-descriptions.mjs`). |
| `category` | yes | A `slug` from `src/data/categories.ts`: `getting-started`, `using-letterly`, `billing-and-subscription`, `troubleshooting`, `privacy-and-security`, `more` (the file is the source of truth). |
| `group` | depends | Required when the category has groups, forbidden when it has none (`privacy-and-security`, `more`). Must be a group `slug` of that category. |
| `order` | yes | Integer ≥ 0, position inside the group (or category without groups). New article: largest `order` in that group + 1. |
| `platforms` | no | Subset of `iphone, android, mac, windows, web`. Set it only when the feature is not on every platform; the page then shows "Works on: …". Omit when it works everywhere. |
| `related` | no | 2–5 slugs (file names without `.mdx`) of existing articles. Not itself, no duplicates. |
| `updated` | yes | `YYYY-MM-DD`. Set to today when the meaning of the article changes (not for typo fixes). |
| `draft` | no | `true` = not on the live site (visible only in `npm run dev`). |
| `hidden` | no | `true` = live and searchable by URL and search, but not in the menu or category pages. |
| `aliases` | no | Extra search words people might type ("unsubscribe", "refund"). Lowercase, 0–5 items. |

Slug (file name): lowercase English words joined by dashes, from the title: "Set up Dictation" → `set-up-dictation`.
Never rename an existing article file — its URL is shared by support; add an alias instead.

To list sections for choosing a place:

```bash
sed -n '/export const categories/,/^];/p' src/data/categories.ts | grep -E "slug|title"
```

To find the next `order` in a group:

```bash
grep -l "^group: <group>$" src/content/articles/*.mdx | xargs grep -l "^category: <category>$" | xargs grep -h '^order:' | sort -k2 -n | tail -1
```

### Body

- The page shows `title` as the H1. Do not repeat it; start the body with the answer in plain text.
- Headings: `##` for sections, `###` for sub-steps. No `#`.
- MDX: leave an empty line after an opening component tag and before its closing tag when the inside is Markdown
  (lists, paragraphs). Components need no import.
- Do not use raw HTML, `<br>`, `{`, `}` or a bare `<` in text — MDX treats them as code. Write "less than" or use `&lt;`.
- Internal links: `[Record more](/record-more/)` — leading and trailing slash. External links: full `https://` URL.
- Tables are plain Markdown tables (they scroll on phones automatically).

## Components (use only these)

**Callout** — coloured box. `type`: `tip` (default, a helpful hint), `note` (neutral info, requirements, plan limits),
`warn` (only for data loss, irreversible actions, money), `safe` (privacy reassurance). Optional `title`.

```mdx
<Callout type="note">

On the **Free** plan you can keep up to **10 notes** in total.

<MoreLink href="/what-plans-are-there/">Learn more about plans →</MoreLink>

</Callout>
```

**MoreLink** — "Learn more →" line, usually the last line inside a Callout: `<MoreLink href="/history/">Learn more about Dictation History →</MoreLink>`

**Steps** — numbered steps with round numbers; put a normal numbered list inside (see the article example above).

**PlatformTabs / Platform** — only when the text is really different per platform; at least two `Platform` blocks;
`name`: `iphone`, `android`, `mac`, `windows`, `web`. If only the screenshot differs, do not use tabs.

```mdx
<PlatformTabs>
<Platform name="iphone">

Tap **Settings → Dictation**.

</Platform>
<Platform name="mac">

Click **Settings → Dictation**.

</Platform>
</PlatformTabs>
```

**Figure** — picture. `alt` is required (a short, concrete description for screen readers); `caption` optional.

```mdx
<Figure src="/images/help-center/merge-notes-select.webp" alt="Two notes selected on the notes screen, with the Merge button at the bottom" caption="Select the notes, then tap Merge" />
```

**Video** — never autoplays. `<Video src="/video/merge-notes.mp4" caption="Merging notes" />`

**Carousel** — several pictures to swipe through; put `Figure`s inside, separated by empty lines, optional `label`.

**Details** — block that opens on click: `<Details summary="See all languages">…</Details>` (empty lines inside).

**Eyebrow** — small label above a heading, on the line before it: `<Eyebrow>Part 1</Eyebrow>`.

**Shot** — placeholder for a screenshot that is not ready: `<Shot label="Screenshot: History on Mac" />`.
Visible only in `npm run dev`, never on the live site. Replace it with `Figure`/`Video` when the file arrives.
Find open placeholders: `grep -rn '<Shot' src/content/articles`.

## Media

- Pictures: `.webp`, max width 1600 px, file names in lowercase kebab-case that say what is on them
  (`history-iphone.webp`, `mac-floating-bar-settings.webp`). Convert with `sharp` (installed with Astro, no new dependency).
  Keep each file under ~300 KB when possible.
- Videos: `.mp4` (H.264), no sound unless needed, short, ideally under 10 MB (never over 50 MB).
- **Pending files.** Some articles already reference files in `/images/help-center/` that are not in the repo yet.
  A missing file there does not fail the build — it is left out of the page with a `[media] waiting for file` warning.
  Any other missing file fails the build. List pending files:

  ```bash
  grep -rhoE 'src="/images/help-center/[^"]+"' src/content | sed 's/src="//;s/"$//' | sort -u | while read f; do [ -e "public$f" ] || echo "$f"; done
  ```

  When such a file arrives: a picture may be converted to `.webp` (then update the `src` in the article);
  a video is copied to the exact referenced path.

## Home page FAQ

`src/data/faq/NN-<slug>.md`:

```md
---
question: "How do I print a note or save it in Word?"
order: 1
---

Short answer in one paragraph. Links like [Share](/share/) are fine.
```

## Style

- Readers: people in the US, often not technical, many 60+. Plain words, short sentences, one idea per paragraph.
- The answer comes first. Then the steps. Then exceptions.
- Steps: 2–7 per list, one action per step, starting with a verb ("Open", "Tap", "Choose").
- UI labels in **bold**, exactly as in the app. Paths with arrows: **Settings → Dictation**.
- Say "tap or click" when the article covers both phones and computers.
- At most 1–2 callouts per article. `warn` is rare.
- US spelling (favorite, organize, color). No emoji. No exclamation marks in instructions.
- Plans: "Free" and "Pro" in bold when they are the point. Never invent limits, prices or features —
  ask the editor when not sure.
- Keep articles short. If it needs more than ~5 sections, split it and link the parts with `related`.
