/* Client-side behaviour, ported from the v7 prototype:
   drawer menu, menu groups, search (Pagefind), platform tabs, table of contents, "Was this helpful?", FAQ. */

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function store(k: string, v?: string): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {}
  return null;
}
const ICON = (paths: string) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
const MAIL = ICON('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>');

const header = $('#top')!;
const side = $('#side')!;
const main = $('#main')!;
const toc = $('#toc')!;
const scrim = $('#scrim')!;
const menuBtn = $('#menuBtn')!;

/* ---------- Sidebar groups (opened groups are remembered for this visit) ---------- */
let opened: Record<string, boolean> = {};
try { opened = JSON.parse(sessionStorage.getItem('lh-groups') || '{}'); } catch {}
$$('.grp-b', side).forEach((b) => {
  const key = b.dataset.key!;
  const list = document.getElementById(b.getAttribute('aria-controls')!)!;
  if (opened[key] && b.getAttribute('aria-expanded') !== 'true') { b.setAttribute('aria-expanded', 'true'); list.hidden = false; }
  b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
    opened[key] = open;
    try { sessionStorage.setItem('lh-groups', JSON.stringify(opened)); } catch {}
  });
});
const cur = $('a[aria-current="page"]', side);
if (cur && window.innerWidth > 900) {
  if (cur.offsetTop > side.clientHeight - 60) side.scrollTop = Math.max(0, cur.offsetTop - side.clientHeight / 3);
}

/* ---------- Mobile drawer ---------- */
function openDrawer() {
  side.classList.add('open'); scrim.classList.add('on'); document.body.classList.add('lock');
  menuBtn.setAttribute('aria-expanded', 'true');
  side.setAttribute('role', 'dialog'); side.setAttribute('aria-modal', 'true'); side.setAttribute('aria-label', 'Menu');
  main.inert = true; header.inert = true; toc.inert = true;
  if (cur) side.scrollTop = Math.max(0, cur.offsetTop - side.clientHeight / 3);
  setTimeout(() => $('#drawerClose')?.focus(), 30);
}
function closeDrawer(silent?: boolean) {
  if (!side.classList.contains('open')) return;
  side.classList.remove('open'); scrim.classList.remove('on'); document.body.classList.remove('lock');
  menuBtn.setAttribute('aria-expanded', 'false');
  side.removeAttribute('role'); side.removeAttribute('aria-modal'); side.setAttribute('aria-label', 'Help topics');
  main.inert = false; header.inert = false; toc.inert = false;
  if (!silent) menuBtn.focus();
}
menuBtn.addEventListener('click', openDrawer);
scrim.addEventListener('click', () => closeDrawer());
$('#drawerClose')?.addEventListener('click', () => closeDrawer());
window.addEventListener('resize', () => { if (window.innerWidth > 900) closeDrawer(true); });
document.addEventListener('keydown', (e) => {
  if (!side.classList.contains('open')) return;
  if (e.key === 'Escape') closeDrawer();
  if (e.key === 'Tab') { // keep focus inside the drawer
    const f = $$('a[href],button:not([disabled])', side).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

/* ---------- Skip link: focus the page title ---------- */
$('.skip')?.addEventListener('click', (e) => {
  const h = $('h1', main);
  if (h) { e.preventDefault(); h.focus(); }
});

/* ---------- Search (Pagefind; works after `npm run build`) ---------- */
type PagefindResult = { url: string; excerpt: string; meta: { title?: string; crumb?: string } };
type Pagefind = {
  init?: () => Promise<void>;
  options?: (o: object) => Promise<void>;
  search: (q: string) => Promise<{ results: { data: () => Promise<PagefindResult> }[] }>;
};
let pfPromise: Promise<Pagefind | null> | null = null;
function loadPagefind(): Promise<Pagefind | null> {
  if (!pfPromise) {
    const url = '/pagefind/pagefind.js';
    pfPromise = import(/* @vite-ignore */ url)
      .then(async (pf: Pagefind) => { await pf.options?.({ excerptLength: 24 }); await pf.init?.(); return pf; })
      .catch(() => null);
  }
  return pfPromise;
}
const STOP = new Set('i a an the to do how my is can what in on of it and for with does why me or'.split(' '));
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'");
function terms(q: string) {
  const all = norm(q).split(/[^a-z0-9']+/).filter((x) => x.length > 1);
  const t = all.filter((x) => !STOP.has(x));
  return t.length ? t : all;
}
function hl(s: string, ts: string[]) {
  let out = esc(s);
  ts.forEach((t) => { out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '\u0001$1\u0002'); });
  return out.replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
}

let SEQ = 0;
function initSearch(box: HTMLElement, onDone?: () => void) {
  const input = $<HTMLInputElement>('input', box)!;
  const panel = $('.sres', box)!;
  const clear = $('.sclear', box)!;
  const id = 'sr' + ++SEQ;
  let items: HTMLAnchorElement[] = [];
  let curIdx = -1;
  let run = 0;
  function close() { panel.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); curIdx = -1; }
  function mark(n: number) {
    items.forEach((a, i) => { a.classList.toggle('hl', i === n); a.setAttribute('aria-selected', String(i === n)); });
    curIdx = n;
    if (n > -1) { input.setAttribute('aria-activedescendant', items[n].id); items[n].scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }
  function show(html: string) {
    panel.innerHTML = html;
    items = $$<HTMLAnchorElement>('a[role=option]', panel);
    panel.classList.add('on'); input.setAttribute('aria-expanded', 'true'); curIdx = -1; panel.scrollTop = 0;
  }
  async function render() {
    const q = input.value.trim();
    clear.classList.toggle('on', !!input.value);
    const my = ++run;
    if (q.length < 2) { close(); return; }
    const pf = await loadPagefind();
    if (my !== run) return;
    if (!pf) {
      show('<div class="note" role="status">Search works after the site is built: run <code>npm run build</code>, then <code>npm run preview</code>.</div>');
      return;
    }
    const res = await pf.search(q);
    if (my !== run) return;
    const data = await Promise.all(res.results.slice(0, 8).map((r) => r.data()));
    if (my !== run) return;
    if (!data.length) {
      show(`<div class="empty" role="status"><p>No results for “${esc(q)}”.</p><a href="mailto:${esc(document.querySelector<HTMLElement>('[data-email]')?.dataset.email || 'hi@letterly.app')}">${MAIL}Contact us</a></div>`);
      return;
    }
    const ts = terms(q);
    show('<ul>' + data.map((d, i) => {
      const title = d.meta.title || d.url;
      const nt = norm(title);
      const allInTitle = ts.length > 0 && ts.every((t) => nt.includes(t));
      return `<li><a role="option" id="${id}-${i}" href="${esc(d.url)}"><span class="rt">${hl(title, ts)}</span>` +
        (d.meta.crumb ? `<span class="rm">${esc(d.meta.crumb)}</span>` : '') +
        (!allInTitle && d.excerpt ? `<span class="rs">${d.excerpt}</span>` : '') + '</a></li>';
    }).join('') + '</ul>');
  }
  input.addEventListener('input', render);
  input.addEventListener('focus', () => { loadPagefind(); if (input.value.trim().length > 1) render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); mark(Math.min(items.length - 1, curIdx + 1)); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); mark(Math.max(-1, curIdx - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const a = items[curIdx > -1 ? curIdx : 0]; if (a) location.href = a.href; }
    else if (e.key === 'Escape') { if (panel.classList.contains('on')) close(); else onDone?.(); }
  });
  panel.addEventListener('mousedown', (e) => { if ((e.target as Element).closest('a')) e.preventDefault(); });
  clear.addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  document.addEventListener('click', (e) => { if (!box.contains(e.target as Node)) close(); });
  return { input, close };
}
const topBox = $('.top-search');
const topSearch = topBox ? initSearch(topBox, () => header.classList.remove('searching')) : null;
$$('.hero-search').forEach((b) => initSearch(b));
$('#searchBtn')?.addEventListener('click', () => { header.classList.add('searching'); topSearch?.input.focus(); });
$('#searchClose')?.addEventListener('click', () => {
  header.classList.remove('searching');
  if (topSearch) { topSearch.input.value = ''; topSearch.close(); }
  $('#searchBtn')?.focus();
});

/* ---------- Table of contents (h2 of the visible text) ---------- */
function tocActive() {
  if (!toc.classList.contains('on')) return;
  const ls = $$<HTMLAnchorElement>('a', toc);
  let active: HTMLAnchorElement | null = null;
  ls.forEach((a) => { const el = document.getElementById(a.dataset.id!); if (el && el.getBoundingClientRect().top - 110 <= 0) active = a; });
  if (ls.length && window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 2) active = ls[ls.length - 1];
  ls.forEach((a) => a.classList.remove('active'));
  (active || ls[0])?.classList.add('active');
}
function buildToc() {
  const body = $('#body');
  toc.innerHTML = ''; toc.classList.remove('on');
  if (!body) return;
  const hs = $$('h2', body).filter((h) => !h.closest('[hidden]') && h.id);
  if (hs.length < 2) return;
  toc.innerHTML = '<nav aria-labelledby="toc-t"><p class="toc-t" id="toc-t">On this page</p><ul>' +
    hs.map((h) => `<li><a href="#${esc(h.id)}" data-id="${esc(h.id)}">${esc(h.textContent || '')}</a></li>`).join('') + '</ul></nav>';
  toc.classList.add('on');
  tocActive();
}
let tick = false;
window.addEventListener('scroll', () => {
  if (tick) return; tick = true;
  requestAnimationFrame(() => { tocActive(); tick = false; });
}, { passive: true });

/* ---------- Platform tabs ---------- */
$$('[data-ptabs]').forEach((wrap) => {
  const tabs = $$<HTMLButtonElement>(':scope > .ptabs > [role=tab]', wrap);
  const panels = $$(':scope > [role=tabpanel]', wrap);
  function choose(b: HTMLButtonElement, focus?: boolean) {
    const k = b.dataset.platform!;
    tabs.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
    panels.forEach((p) => { p.hidden = p.dataset.platform !== k; });
    store('lh-platform', k);
    if (focus) b.focus();
    buildToc();
  }
  tabs.forEach((b) => b.addEventListener('click', () => choose(b)));
  wrap.querySelector('.ptabs')!.addEventListener('keydown', (ev) => {
    const e = ev as KeyboardEvent;
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const n = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 } as Record<string, number>)[e.key];
    if (n === undefined) return;
    e.preventDefault();
    choose(tabs[(n + tabs.length) % tabs.length], true);
  });
});
buildToc();

/* ---------- Was this helpful? ---------- */
$$('.helpful').forEach((box) => {
  box.addEventListener('click', (ev) => {
    const b = (ev.target as Element).closest<HTMLButtonElement>('.hbtn');
    if (!b) return;
    const tpl = $<HTMLTemplateElement>(b.dataset.v === 'yes' ? '#hf-yes' : '#hf-no', box);
    const btns = $('.btns', box);
    if (!tpl || !btns) return;
    btns.replaceWith(tpl.content.cloneNode(true));
    $('.thanks', box)?.focus({ preventScroll: true });
  });
});

/* ---------- Home FAQ ---------- */
$$('.faq-q').forEach((b) => b.addEventListener('click', () => {
  const open = b.getAttribute('aria-expanded') !== 'true';
  b.setAttribute('aria-expanded', String(open));
  document.getElementById(b.getAttribute('aria-controls')!)!.hidden = !open;
}));

export {};
