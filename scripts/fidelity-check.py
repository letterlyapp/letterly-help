"""Fidelity check: visible article text of the built site vs the same article rendered by v7.

For every article and every platform tab:
  - h1 title, "Works on" line
  - body text (all whitespace ignored), after removing the expected differences:
      * v7 "Related articles" block (on our site it sits below the body) -> compared separately as a list
      * v7 placeholder boxes (figure.shot) -> not shown on our site
      * captions of pictures/videos from help-center-images/ (files not in the repo yet)
      * our carousel counter ("Picture 1 / 6")
Needs Python Playwright with Chromium (not an npm dependency of the site). Usage:
  npm run build
  node scripts/convert.mjs --list --json > /tmp/arts.json
  python3 scripts/fidelity-check.py dist ../design/help_center_v7.html /tmp/arts.json [report.json]
Exit code 1 when an unexpected difference is found.
"""
import json, re, sys, difflib, http.server, threading, functools, os
from playwright.sync_api import sync_playwright

DIST, V7, ARTS = sys.argv[1], os.path.abspath(sys.argv[2]), sys.argv[3]
OUT = sys.argv[4] if len(sys.argv) > 4 else None
PLAT_KEY = {"iPhone": "iphone", "Android": "android", "Mac": "mac", "Windows": "windows", "Web": "web"}

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass
handler = functools.partial(Quiet, directory=DIST)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}"

V7_JS = """() => {
  const b = document.querySelector('#body');
  const t = (el) => el ? el.innerText : '';
  const rel = [...b.querySelectorAll('.rel a')].map(a => a.innerText.trim());
  const remove = [];
  b.querySelectorAll('.rel').forEach(r => remove.push(r.innerText));
  const shots = [...b.querySelectorAll('.shot')].map(s => s.innerText.trim());
  shots.forEach(s => remove.push(s));
  const missing = [];
  b.querySelectorAll('figure').forEach(f => {
    const m = f.querySelector('img,video');
    const src = m ? (m.getAttribute('src') || '') : '';
    if (src.includes('help-center-images')) { const c = f.querySelector('figcaption'); if (c) { missing.push(c.innerText.trim()); remove.push(c.innerText); } }
  });
  // hide the expected differences, read the text, then show them again
  const hide = [...b.querySelectorAll('.rel, .shot')];
  b.querySelectorAll('figure').forEach(f => { const m = f.querySelector('img,video'); if (m && (m.getAttribute('src') || '').includes('help-center-images')) hide.push(f); });
  hide.forEach(el => { el.dataset.fidDisp = el.style.display; el.style.display = 'none'; });
  const body = b.innerText;
  hide.forEach(el => { el.style.display = el.dataset.fidDisp; });
  return { h1: t(document.querySelector('main h1')), works: t(document.querySelector('main .works')),
           body, rel, remove: [], shots, missing };
}"""

OURS_JS = """() => {
  const b = document.querySelector('#body');
  const panel = b.querySelector('[role=tabpanel]:not([hidden])');
  const t = (el) => el ? el.innerText : '';
  return { h1: t(document.querySelector('main h1')), works: t(document.querySelector('main .works')),
           body: t(panel || b), rel: [...document.querySelectorAll('nav.rel a')].map(a => a.innerText.trim()),
           tabs: [...document.querySelectorAll('#body .ptab')].map(x => x.innerText.trim()) };
}"""

nows = lambda s: re.sub(r"\s+", "", s or "")


def word_diff(a, b):
    aw, bw = a.split(), b.split()
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, aw, bw, autojunk=False).get_opcodes():
        if op != "equal":
            out.append(f"{op}: v7[{' '.join(aw[max(0,i1-3):i2+3])}]  ours[{' '.join(bw[max(0,j1-3):j2+3])}]")
    return out


arts = json.load(open(ARTS))
report = {"checked": 0, "ok": 0, "problems": [], "expected": {"shots": [], "missing_media_captions": [], "related_moved": 0}}
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1440, "height": 1000})
    v7 = ctx.new_page()
    v7.goto("file://" + V7)
    ours = ctx.new_page()
    for a in arts:
        slug, plats = a["slug"], a["plats"] or [None]
        v7.evaluate("s => { location.hash = '#/' + s; }", slug)
        v7.wait_for_function("t => { const h = document.querySelector('main h1'); return h && h.textContent === t; }", arg=a["title"], timeout=5000)
        ours.goto(f"{BASE}/{slug}/")
        otabs = ours.evaluate("() => [...document.querySelectorAll('#body .ptab')].map(x => x.innerText.trim())")
        v7tabs = v7.evaluate("() => [...document.querySelectorAll('main .ptab')].map(x => x.innerText.trim())")
        if (a["plats"] or []) != otabs or (a["plats"] or []) != v7tabs:
            report["problems"].append({"slug": slug, "what": "tab order", "v7": v7tabs, "ours": otabs})
        for pl in plats:
            if pl:
                v7.click(f"main .ptab:text-is('{pl}')")
                ours.click(f"#body .ptab[data-platform='{PLAT_KEY[pl]}']")
            A = v7.evaluate(V7_JS)
            B = ours.evaluate(OURS_JS)
            report["checked"] += 1
            where = f"{slug}" + (f" [{pl}]" if pl else "")
            probs = []
            if nows(A["h1"]) != nows(B["h1"]):
                probs.append(f"title: v7={A['h1']!r} ours={B['h1']!r}")
            if nows(A["works"]) != nows(B["works"]):
                probs.append(f"works-on: v7={A['works']!r} ours={B['works']!r}")
            va = nows(A["body"])
            for r in A["remove"]:
                va = va.replace(nows(r), "", 1)
            vb = re.sub(r"Picture\d+/\d+", "", nows(B["body"]))
            if va != vb:
                # readable diff on words (same removals)
                ta = A["body"]
                for r in A["remove"]:
                    ta = ta.replace(r, " ", 1)
                tb = re.sub(r"Picture \d+ / \d+", " ", B["body"])
                probs.append({"body_diff": word_diff(ta, tb)[:12]})
            missing_rel = [r for r in A["rel"] if r not in B["rel"]]
            if missing_rel:
                probs.append(f"related missing on our page: {missing_rel}")
            if A["rel"]:
                report["expected"]["related_moved"] += 1
            report["expected"]["shots"] += [f"{where}: {s}" for s in A["shots"]]
            report["expected"]["missing_media_captions"] += [f"{where}: {s}" for s in A["missing"]]
            if probs:
                report["problems"].append({"where": where, "problems": probs})
            else:
                report["ok"] += 1
    br.close()
srv.shutdown()
print(json.dumps(report["problems"], ensure_ascii=False, indent=1))
if OUT:
    json.dump(report, open(OUT, "w"), ensure_ascii=False, indent=1)
print(f"\nChecked {report['checked']} article/tab views: {report['ok']} identical, {len(report['problems'])} with differences.")
sys.exit(1 if report["problems"] else 0)
