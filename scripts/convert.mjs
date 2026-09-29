#!/usr/bin/env node
/**
 * Converts articles from the prototype (design/help_center_v7.html) into MDX files.
 *
 *   node scripts/convert.mjs --only set-up-dictation,tags     convert some articles
 *   node scripts/convert.mjs --all                            convert every article
 *   node scripts/convert.mjs --faq                            (re)write the home FAQ (src/data/faq/*.md)
 *   node scripts/convert.mjs --list                           list all articles with their slugs
 *
 * Options: --src <path to v7 html> (default ../design/help_center_v7.html)
 *          --update  for files that already exist: rewrite the text from the prototype and refresh
 *                    `related`, but KEEP everything else in the block between the --- lines
 *                    (description, aliases, hidden, draft, order… — anything edited by hand).
 *                    `updated:` changes only when the text really changed.
 *          --force   overwrite files that already exist completely (hand edits are lost)
 *          --date 2026-09-29   value for `updated:` (default: today)
 *
 * The English text is copied exactly. Only presentation changes:
 *   - "Update Letterly to the latest version…" warnings become type="note";
 *   - placeholder screenshots (figure.shot) become <Shot label="…" /> — shown only in `npm run dev`,
 *     never on the live site; Russian captions are dropped (<Shot />);
 *   - the carousel becomes <Carousel> with <Figure> inside; "Part 1" labels above headings → <Eyebrow>;
 *   - platform tabs keep the order of the prototype;
 *   - related articles that don't exist yet are left out (listed in the report);
 *   - images: ../assets/letterly-images/… → /images/…, help-center-images/… → /images/help-center/…
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(name);

const SRC = path.resolve(ROOT, opt('--src') || '../design/help_center_v7.html');
const OUT = path.join(ROOT, 'src/content/articles');
const FAQ_OUT = path.join(ROOT, 'src/data/faq');
const DATE = opt('--date') || new Date().toISOString().slice(0, 10);
const FORCE = flag('--force');
const UPDATE = flag('--update');

const PLAT_KEYS = { iPhone: 'iphone', Android: 'android', Mac: 'mac', Windows: 'windows', Web: 'web' };
const PLAT_ORDER = ['iphone', 'android', 'mac', 'windows', 'web'];

// ---------- load the prototype data (NAV, C, FAQ_HTML) ----------
function loadData(file) {
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('(function(){', html.indexOf('var NAV') - 2000);
  if (start < 0) throw new Error('Could not find the data script in ' + file);
  let end = html.indexOf('v7 presentation layer', start);
  if (end > -1) end = html.lastIndexOf('/*', end);
  else end = html.indexOf('var ICONS', start);
  if (end < 0) throw new Error('Could not find the end of the data block in ' + file);
  const code = html.slice(start + '(function(){'.length, end);
  const ctx = {};
  vm.createContext(ctx);
  return vm.runInContext(`${code}\n;({NAV:NAV,C:C,PLATS:PLATS,FAQ_HTML:typeof FAQ_HTML!=='undefined'?FAQ_HTML:''})`, ctx);
}

// ---------- helpers ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', larr: '←', middot: '·', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', copy: '©' };
function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });
}
/** Same rule as the prototype: "Download & install" → "download-and-install" */
function slugify(t) {
  return decode(t).toLowerCase().replace(/[“”"'’‘]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const groupSlug = (name) => slugify(name.replace(/^Mode \d+\s*·\s*/, ''));
const yamlStr = (s) => JSON.stringify(s);
function attr(v) {
  return /["{}]/.test(v) ? `{${JSON.stringify(v)}}` : `"${v}"`;
}
function mapSrc(src) {
  return src
    .replace(/^(\.\.\/)?assets\/letterly-images\//, '/images/')
    .replace(/^(\.\.\/)?assets\/letterly-video\//, '/video/')
    .replace(/^https:\/\/letterly\.app\/images\//, '/images/')
    .replace(/^help-center-images\//, '/images/help-center/');
}

// ---------- HTML → MDX ----------
const BLOCK = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'div', 'figure', 'table', 'details', 'img', 'video', 'section', 'blockquote', 'hr']);
const isEl = (n) => n.nodeType === 1;
const tag = (n) => (n.rawTagName || '').toLowerCase();
const cls = (n) => (isEl(n) ? (n.getAttribute('class') || '').split(/\s+/) : []);
const isBlock = (n) => isEl(n) && (BLOCK.has(tag(n)) || (tag(n) === 'b' && cls(n).includes('t')));

function escText(s) {
  return s.replace(/\\/g, '\\\\').replace(/([*_`[\]{}<>])/g, '\\$1');
}
function escLineStart(s) {
  return s.replace(/^(\s*)([#>+-]|\d+[.)])(\s)/, (_m, sp, mark, after) => `${sp}${mark.replace(/([#>+.)-])/, '\\$1')}${after}`);
}

class Ctx {
  constructor(title) { this.title = title; this.related = []; this.warnings = []; this.links = new Set(); this.media = new Set(); }
  warn(m) { this.warnings.push(m); }
}

function inline(nodes, ctx) {
  let out = '';
  for (const n of nodes) {
    if (n.nodeType === 3) { out += escText(decode(n.rawText).replace(/\s+/g, ' ')); continue; }
    if (!isEl(n)) continue;
    const t = tag(n);
    const inner = () => inline(n.childNodes, ctx);
    if (t === 'b' || t === 'strong') out += wrapMark('**', inner());
    else if (t === 'i' || t === 'em') out += wrapMark('*', inner());
    else if (t === 'code') out += '`' + decode(n.text) + '`';
    else if (t === 'br') out += '<br />';
    else if (t === 'a') out += link(n, ctx);
    else if (t === 'span' && cls(n).includes('draft')) continue;
    else if (t === 'span' || t === 'small' || t === 'u') out += inner();
    else if (t === 'sup' || t === 'sub') out += `<${t}>${inner()}</${t}>`;
    else if (t === 'img') { ctx.warn('inline image moved to its own block'); out += inner(); }
    else { ctx.warn(`unknown inline tag <${t}> kept as text`); out += inner(); }
  }
  return out;
}
function wrapMark(m, s) {
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
  return core ? `${lead}${m}${core}${m}${trail}` : s;
}
function linkHref(n, ctx) {
  const art = n.getAttribute('data-art');
  if (art) { const slug = slugify(art); ctx.links.add(slug); return `/${slug}/`; }
  return decode(n.getAttribute('href') || '#');
}
function link(n, ctx) {
  const href = linkHref(n, ctx);
  const text = inline(n.childNodes, ctx).trim();
  if (cls(n).includes('more')) return `<MoreLink href="${href}">${text}</MoreLink>`;
  return `[${text}](${href})`;
}

function blocks(nodes, ctx) {
  const out = [];
  let buf = [];
  const flush = () => {
    const s = inline(buf, ctx).replace(/\s+/g, ' ').trim();
    if (s) out.push(escLineStart(s));
    buf = [];
  };
  for (const n of nodes) {
    if (!isEl(n) || !isBlock(n)) {
      if (isEl(n) && tag(n) === 'a' && cls(n).includes('more')) { flush(); out.push(link(n, ctx)); continue; }
      buf.push(n); continue;
    }
    flush();
    const b = block(n, ctx);
    if (b) out.push(b);
  }
  flush();
  return out.join('\n\n');
}

function list(n, ctx, ordered) {
  const items = n.childNodes.filter((c) => isEl(c) && tag(c) === 'li');
  return items.map((li, i) => {
    const mark = ordered ? `${i + 1}.` : '-';
    const pad = ' '.repeat(mark.length + 1);
    const body = li.childNodes.some(isBlock) ? blocks(li.childNodes, ctx) : escLineStart(inline(li.childNodes, ctx).replace(/\s+/g, ' ').trim()).replace(/^\\/, '\\');
    return mark + ' ' + body.split('\n').map((l, j) => (j === 0 || !l ? l : pad + l)).join('\n');
  }).join('\n');
}

function cellText(c, ctx) { return inline(c.childNodes, ctx).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'); }
function table(n, ctx) {
  const rows = n.querySelectorAll('tr');
  if (!rows.length) return '';
  const head = n.querySelector('thead tr') || rows[0];
  const bodyRows = rows.filter((r) => r !== head);
  const cells = (r) => r.childNodes.filter((c) => isEl(c) && (tag(c) === 'td' || tag(c) === 'th'));
  const h = cells(head).map((c) => cellText(c, ctx) || ' ');
  if (!n.querySelector('thead')) ctx.warn('table without a header row — first row used as header');
  const lines = [`| ${h.join(' | ')} |`, `| ${h.map(() => '---').join(' | ')} |`];
  for (const r of bodyRows) {
    const cs = cells(r).map((c) => cellText(c, ctx));
    while (cs.length < h.length) cs.push('');
    lines.push(`| ${cs.join(' | ')} |`);
  }
  return lines.join('\n');
}

const hasCyrillic = (s) => /[А-Яа-яЁё]/.test(s);
function shot(n, ctx) {
  const label = decode(n.text).replace(/\s+/g, ' ').trim();
  if (!label || hasCyrillic(label)) {
    ctx.warn(`placeholder screenshot: Russian caption dropped ("${label}") → <Shot />`);
    return '<Shot />';
  }
  ctx.warn(`placeholder screenshot kept as <Shot> (not shown on the live site): "${label}"`);
  return `<Shot label=${attr(label)} />`;
}
function figure(n, ctx) {
  if (cls(n).includes('shot')) return shot(n, ctx);
  const img = n.querySelector('img');
  const video = n.querySelector('video');
  const capEl = n.querySelector('figcaption');
  const caption = capEl ? decode(capEl.text).replace(/\s+/g, ' ').trim() : '';
  if (capEl && capEl.childNodes.some(isEl)) ctx.warn('figcaption had formatting — kept as plain text');
  if (video) {
    const src = mapSrc(decode(video.getAttribute('src') || ''));
    ctx.media.add(src);
    return `<Video src="${src}"${caption ? ` caption=${attr(caption)}` : ''} />`;
  }
  if (img) return imgTag(img, ctx, caption);
  ctx.warn('empty figure dropped');
  return '';
}
function imgTag(img, ctx, caption = '') {
  const src = mapSrc(decode(img.getAttribute('src') || ''));
  const alt = decode(img.getAttribute('alt') || '').trim();
  ctx.media.add(src);
  if (!alt) ctx.warn(`image without alt: ${src}`);
  return `<Figure src="${src}" alt=${attr(alt)}${caption ? ` caption=${attr(caption)}` : ''} />`;
}

function callout(n, ctx) {
  const c = cls(n);
  let type = c.includes('note') ? 'note' : c.includes('warn') ? 'warn' : c.includes('safe') ? 'safe' : 'tip';
  if (type === 'warn' && /^\s*update letterly to the latest version/i.test(decode(n.text))) type = 'note';
  let kids = n.childNodes.filter((k) => !(k.nodeType === 3 && !k.rawText.trim()));
  let title = '';
  const first = kids[0];
  if (first && isEl(first) && tag(first) === 'b' && (cls(first).includes('t') || (kids[1] && isBlock(kids[1])))) {
    title = decode(first.text).replace(/\s+/g, ' ').trim();
    kids = kids.slice(1);
  }
  const inner = blocks(kids, ctx);
  return `<Callout type="${type}"${title ? ` title=${attr(title)}` : ''}>\n\n${inner}\n\n</Callout>`;
}

function block(n, ctx) {
  const t = tag(n), c = cls(n);
  switch (t) {
    case 'p': { const s = inline(n.childNodes, ctx).replace(/\s+/g, ' ').trim(); return s ? escLineStart(s) : ''; }
    case 'h1': case 'h2': case 'h3': case 'h4': {
      const eb = n.childNodes.find((k) => isEl(k) && cls(k).includes('eyebrow'));
      const kids = n.childNodes.filter((k) => k !== eb);
      const h = '#'.repeat(Math.max(2, Number(t[1]))) + ' ' + inline(kids, ctx).replace(/\s+/g, ' ').trim();
      if (!eb) return h;
      return `<Eyebrow>${inline(eb.childNodes, ctx).replace(/\s+/g, ' ').trim()}</Eyebrow>\n\n${h}`;
    }
    case 'ul': return list(n, ctx, false);
    case 'ol': return c.includes('steps') ? `<Steps>\n\n${list(n, ctx, true)}\n\n</Steps>` : list(n, ctx, true);
    case 'table': return table(n, ctx);
    case 'figure': return figure(n, ctx);
    case 'img': return imgTag(n, ctx);
    case 'video': { const src = mapSrc(decode(n.getAttribute('src') || '')); ctx.media.add(src); return `<Video src="${src}" />`; }
    case 'details': {
      const sum = n.querySelector('summary');
      const summary = sum ? decode(sum.text).replace(/\s+/g, ' ').trim() : 'More';
      const kids = n.childNodes.filter((k) => !(isEl(k) && tag(k) === 'summary'));
      return `<Details summary=${attr(summary)}>\n\n${blocks(kids, ctx)}\n\n</Details>`;
    }
    case 'hr': return '---';
    case 'b': return ''; // stray title (handled in callout)
    case 'div': case 'section': case 'blockquote': {
      if (c.includes('callout')) return callout(n, ctx);
      if (c.includes('rel')) {
        n.querySelectorAll('a[data-art]').forEach((a) => ctx.related.push(slugify(a.getAttribute('data-art'))));
        return '';
      }
      if (c.includes('shots')) return n.querySelectorAll('figure').map((f) => shot(f, ctx)).join('\n\n');
      if (c.includes('car')) {
        const figs = n.querySelectorAll('figure').map((f) => figure(f, ctx)).filter(Boolean);
        return `<Carousel>\n\n${figs.join('\n\n')}\n\n</Carousel>`;
      }
      return blocks(n.childNodes, ctx);
    }
    default:
      ctx.warn(`unknown block <${t}> converted as text`);
      return inline(n.childNodes, ctx);
  }
}

function htmlToMdx(html, ctx) {
  const root = parse(html, { comment: false });
  return blocks(root.childNodes, ctx);
}

/** Text for the description: the first paragraph (of any tab), else the first list item. */
function firstParagraphText(...htmls) {
  for (const sel of ['p', 'li']) {
    for (const html of htmls) {
      const root = parse(html || '');
      const p = root.querySelectorAll(sel).find((x) => !x.closest('.callout') && !x.closest('.rel') && decode(x.text).trim().length >= 20);
      if (p) return decode(p.text).replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}
function makeDescription(text, title) {
  if (!text) return title;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
  let d = '';
  for (const s of sentences) {
    const next = (d ? d + ' ' : '') + s.trim();
    if (next.length > 160 && d.length >= 40) break;
    d = next;
    if (d.length >= 60) break;
  }
  if (d.length > 180) d = d.slice(0, 170).replace(/\s+\S*$/, '') + '…';
  if (d.length < 20) d = `${title}: ${d}`;
  return d;
}

// ---------- build the article list from NAV ----------
function index(data) {
  const catMap = {}; // title → slug
  const arts = [];
  data.NAV.forEach((sec) => {
    const catSlug = slugify(sec.title);
    catMap[sec.title] = catSlug;
    sec.blocks.forEach((b) => {
      const name = b.group || b.sub || null;
      let list = [];
      if (b.group) b.subs.forEach((s) => { list = list.concat(s.arts); });
      else if (b.arts) list = b.arts;
      else if (b.leaf || b.solo) list = [b.leaf || b.solo];
      list.forEach((t, i) => arts.push({ title: t, category: catSlug, group: name ? groupSlug(name) : undefined, order: i + 1, hidden: false }));
    });
  });
  const known = new Set(arts.map((a) => a.title));
  for (const t of Object.keys(data.C)) {
    if (known.has(t)) continue;
    const parts = decode(data.C[t].crumb || '').split('·').map((s) => s.trim());
    const category = catMap[parts[0]];
    let group = parts[1] ? groupSlug(parts[1]) : undefined;
    if (group) { // match "AI & integrations & automation" to the group "ai-and-integrations", like the prototype
      const groups = [...new Set(arts.filter((x) => x.category === category && x.group).map((x) => x.group))];
      group = groups.find((g) => g === group) || groups.find((g) => group.startsWith(g) || g.startsWith(group)) || group;
    }
    arts.push({ title: t, category, group, order: 99, hidden: true });
  }
  for (const a of arts) a.slug = slugify(a.title);
  return arts;
}

function checkAgainstConfig(arts) {
  const cfg = fs.readFileSync(path.join(ROOT, 'src/data/categories.ts'), 'utf8');
  const slugs = new Set([...cfg.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]));
  for (const a of arts) {
    if (!slugs.has(a.category)) console.warn(`! ${a.slug}: category "${a.category}" not in src/data/categories.ts`);
    if (a.group && !slugs.has(a.group)) console.warn(`! ${a.slug}: group "${a.group}" not in src/data/categories.ts`);
  }
}

function convertArticle(a, entry, existing) {
  const ctx = new Ctx(a.title);
  let body = '', descSource = '', platforms;
  const allTexts = entry.plat ? Object.values(entry.plat) : [entry.body || ''];
  if (entry.plat) {
    const keys = Object.keys(entry.plat);
    const same = new Set(keys.map((k) => entry.plat[k])).size === 1;
    if (same) {
      body = htmlToMdx(entry.plat[keys[0]], ctx);
      descSource = entry.plat[keys[0]];
    } else {
      // tabs keep the order of the prototype (e.g. Upload audio: iPhone, Mac, Android, Windows)
      const ordered = keys.map((k) => ({ k, key: PLAT_KEYS[k] }));
      body = '<PlatformTabs>\n' + ordered.map(({ k, key }) => `<Platform name="${key}">\n\n${htmlToMdx(entry.plat[k], ctx)}\n\n</Platform>`).join('\n') + '\n</PlatformTabs>';
      descSource = entry.plat[ordered[0].k];
    }
    const pk = keys.map((k) => PLAT_KEYS[k]);
    if (pk.length < PLAT_ORDER.length) platforms = PLAT_ORDER.filter((p) => pk.includes(p));
  } else {
    body = htmlToMdx(entry.body || '', ctx);
    descSource = entry.body || '';
  }
  if (entry.only) platforms = PLAT_ORDER.filter((p) => entry.only.map((o) => PLAT_KEYS[o]).includes(p));

  const related = [...new Set(ctx.related)].filter((s) => s !== a.slug);
  const keptRelated = related.filter((s) => existing.has(s));
  const droppedRelated = related.filter((s) => !existing.has(s));

  const fm = [['title', yamlStr(a.title)], ['description', yamlStr(makeDescription(firstParagraphText(descSource, ...allTexts), a.title))], ['category', a.category]];
  if (a.group) fm.push(['group', a.group]);
  fm.push(['order', String(a.order)]);
  if (platforms) fm.push(['platforms', `[${platforms.join(', ')}]`]);
  fm.push(['related', `[${keptRelated.join(', ')}]`]);
  fm.push(['updated', DATE]);
  if (a.hidden) fm.push(['hidden', 'true']);
  fm.push(['aliases', '[]']);
  body = body.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return { fm, body, ctx, droppedRelated };
}

const fmText = (fm) => ['---', ...fm.map(([k, v]) => `${k}: ${v}`), '---'].join('\n');

/** Split an existing .mdx file into its frontmatter lines ([key, raw value]) and body. */
function readExisting(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = [];
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (kv) fm.push([kv[1], kv[2]]);
    else if (fm.length) fm[fm.length - 1][1] += '\n' + line; // multi-line value: keep as is
  }
  return { fm, body: m[2].replace(/^\s+/, '').replace(/\s*$/, '\n') };
}

/**
 * --update: new text + fresh `related` from the prototype; every other field that is already
 * in the file stays exactly as it is (hand edits such as aliases or a rewritten description survive).
 */
const REFRESH = new Set(['related']);
function mergeFrontmatter(fresh, old, bodyChanged) {
  const oldMap = new Map(old.fm);
  const out = fresh.map(([k, v]) => {
    if (k === 'updated') return [k, bodyChanged || !oldMap.has(k) ? v : oldMap.get(k)];
    if (REFRESH.has(k) || !oldMap.has(k)) return [k, v];
    return [k, oldMap.get(k)];
  });
  const freshKeys = new Set(fresh.map(([k]) => k));
  for (const [k, v] of old.fm) if (!freshKeys.has(k)) out.push([k, v]); // e.g. draft: true added by hand
  return out;
}

// ---------- FAQ ----------
function convertFaq(data) {
  const root = parse(data.FAQ_HTML);
  const items = root.querySelectorAll('.faq-item');
  fs.mkdirSync(FAQ_OUT, { recursive: true });
  items.forEach((it, i) => {
    const q = decode(it.querySelector('.faq-q').text).replace(/\s+/g, ' ').trim();
    const ctx = new Ctx(q);
    const parts = it.querySelector('.faq-a').innerHTML.split(/<br\s*\/?>\s*<br\s*\/?>/i);
    const body = parts.map((p) => escLineStart(inline(parse(p).childNodes, ctx).replace(/\s+/g, ' ').trim())).filter(Boolean).join('\n\n');
    let base = slugify(q);
    if (base.length > 60) base = base.slice(0, 60).replace(/-[^-]*$/, '');
    const file = path.join(FAQ_OUT, `${String(i + 1).padStart(2, '0')}-${base}.md`);
    if (fs.existsSync(file) && !FORCE) { console.log(`= ${path.relative(ROOT, file)} exists (use --force)`); return; }
    fs.writeFileSync(file, `---\nquestion: ${yamlStr(q)}\norder: ${i + 1}\n---\n\n${body}\n`);
    console.log(`+ ${path.relative(ROOT, file)}`);
    ctx.warnings.forEach((w) => console.log(`    ! ${w}`));
  });
}

// ---------- main ----------
const data = loadData(SRC);
const arts = index(data);
checkAgainstConfig(arts);

if (flag('--list')) {
  for (const a of arts) console.log(`${a.slug.padEnd(48)} ${a.category}/${a.group || '-'}${a.hidden ? '  (hidden)' : ''}  ${data.C[a.title] ? '' : '[no text in prototype]'}`);
  process.exit(0);
}
if (flag('--faq')) convertFaq(data);

let chosen = [];
if (flag('--all')) chosen = arts;
else if (opt('--only')) {
  const want = opt('--only').split(',').map((s) => s.trim()).filter(Boolean);
  for (const w of want) {
    const a = arts.find((x) => x.slug === w);
    if (!a) { console.error(`Unknown article "${w}". Run with --list to see all slugs.`); process.exit(1); }
    chosen.push(a);
  }
}
if (!chosen.length && !flag('--faq')) {
  console.log('Nothing to do. Use --only a,b,c or --all or --faq (see the top of this file).');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const existing = new Set(fs.readdirSync(OUT).filter((f) => f.endsWith('.mdx')).map((f) => f.slice(0, -4)));
chosen.forEach((a) => existing.add(a.slug));

const report = { written: 0, skipped: 0, pendingLinks: new Set(), media: new Set() };
for (const a of chosen) {
  const entry = data.C[a.title];
  if (!entry) { console.log(`- ${a.slug}: no text in the prototype, skipped`); report.skipped++; continue; }
  const file = path.join(OUT, `${a.slug}.mdx`);
  const exists = fs.existsSync(file);
  if (exists && !FORCE && !UPDATE) { console.log(`= ${a.slug}.mdx exists (use --update to refresh it and keep hand edits, --force to overwrite)`); report.skipped++; continue; }
  const { fm, body, ctx, droppedRelated } = convertArticle(a, entry, existing);
  let text = fmText(fm) + '\n\n' + body;
  let mark = '+';
  if (exists && UPDATE && !FORCE) {
    const old = readExisting(file);
    if (!old) { console.log(`! ${a.slug}.mdx: could not read the block between the --- lines, skipped`); report.skipped++; continue; }
    const bodyChanged = old.body !== body;
    text = fmText(mergeFrontmatter(fm, old, bodyChanged)) + '\n\n' + body;
    const before = fs.readFileSync(file, 'utf8');
    if (before === text) { console.log(`= ${a.slug}.mdx unchanged`); report.skipped++; continue; }
    mark = '~';
    if (bodyChanged) ctx.warn('text re-generated from the prototype (check the diff if it was edited by hand)');
  }
  fs.writeFileSync(file, text);
  report.written++;
  console.log(`${mark} src/content/articles/${a.slug}.mdx`);
  ctx.warnings.forEach((w) => console.log(`    ! ${w}`));
  if (droppedRelated.length) console.log(`    ~ related not migrated yet (left out): ${droppedRelated.join(', ')}`);
  ctx.links.forEach((l) => { if (!existing.has(l)) report.pendingLinks.add(l); });
  ctx.media.forEach((m) => report.media.add(m));
}
const missingMedia = [...report.media].filter((m) => m.startsWith('/') && !fs.existsSync(path.join(ROOT, 'public', m)));
console.log(`\nDone: ${report.written} written, ${report.skipped} skipped.`);
if (report.pendingLinks.size) console.log(`Links to articles not migrated yet (${report.pendingLinks.size}): ${[...report.pendingLinks].join(', ')}`);
if (missingMedia.length) console.log(`Media files missing in public/ (${missingMedia.length}):\n  ${missingMedia.join('\n  ')}`);
