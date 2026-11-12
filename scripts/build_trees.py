"""Build the tree-diagram PDF (every topic as Topic -> 6 branches -> notes lines) in the app's look.

Usage: python3 scripts/build_trees.py OUT.pdf   (needs Playwright + Chromium)
"""
import glob, html, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "paeds-path-trees.pdf")
topics = json.load(open(ROOT / "src/data/course.json"))["topics"]
summaries, hooks = {}, {}
for f in glob.glob(str(ROOT / "src/data/qbank/*.json")):
    for tid, e in json.load(open(f)).items():
        summaries[tid] = e.get("summary", "")
for f in glob.glob(str(ROOT / "src/data/chunks/*.json")):
    for tid, chunks in json.load(open(f)).items():
        for c in chunks:
            if c.get("hook"):
                hooks[(tid, c["block"])] = c["hook"]

BLOCKS = [("Def", "Definition"), ("Cause", "Causes"), ("Patho", "Patho&shy;physiology"), ("Signs", "Clinical picture"), ("Dx", "Diagnosis"), ("Rx", "Treatment")]
SECTION = {"I": "Symptoms, differentials & acute care", "II": "Prevention, infection, neonatology & oncology", "III": "Organ systems"}
JUNK = re.compile(r"(all 165 topics|in the words of your anki|thesis line)", re.I)

def clean(lines):
    out = []
    for l in lines:
        l = l.replace("O,₂", "O₂").strip()
        if len(l) <= 2 or JUNK.search(l):
            continue
        if out and re.search(r"(\b[A-Z]\.|e\.g\.)$", out[-1]) and re.match(r"^[a-z(]", l):
            out[-1] += " " + l
        else:
            out.append(l)
    return out

def esc(s):
    return html.escape(s).replace("→", "<b class=arr>→</b>")

cards = {"I": [], "II": [], "III": []}
for t in topics:
    branches = []
    for key, label in BLOCKS:
        lines = clean(t["blocks"].get(key, []))
        if not lines:
            continue
        leaves = "".join(f"<li>{esc(l)}</li>" for l in lines)
        hook = hooks.get((t["id"], key))
        hook_html = f'<p class="hook">{esc(hook)}</p>' if hook else ""
        branches.append(f'<div class="br b-{key}"><span class="lab">{label}</span><div class="leaves"><ul>{leaves}</ul>{hook_html}</div></div>')
    pearl = summaries.get(t["id"], "")
    cards[t["section"]].append(
        f'<article class="card" id="t-{t["id"]}"><header class="root">'
        f'<h3><span class="tid">{t["section"]}-{t["n"]} </span>{esc(t["title"])}</h3></header>'
        + (f'<p class="pearl">{esc(pearl)}</p>' if pearl else "")
        + f'<div class="trunk">{"".join(branches)}</div></article>'
    )

sections = '<div class="cols">' + "".join(
    f'<h2 class="sech"><span>Section {s}: </span>{SECTION[s]}<i> ({len(cards[s])} topics)</i></h2>{"".join(cards[s])}'
    for s in ("I", "II", "III")
) + "</div>"
legend = "".join(f'<span class="lg b-{k}"><i></i>{label.replace("&shy;", "")}</span>' for k, label in BLOCKS)
index = "".join(
    f'<div class="ix"><b>Section {s}</b> {SECTION[s]}<ol>' + "".join(f'<li><a href="#t-{t["id"]}">{t["n"]}. {html.escape(t["title"])}</a></li>' for t in topics if t["section"] == s) + "</ol></div>"
    for s in ("I", "II", "III")
)

doc = f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
<style>
@page {{ size: 1100px 1556px; margin: 26px 24px 22px; }}
:root {{ --ink:#202a3b; --muted:#5f6b70; --paper:#f6f4ed; --card:#fcfbf7; --line:#dedbd1; --forest:#326b58; --mint:#dcebe2; --coral:#b9604b;
  --Def:#326b58; --Cause:#b9604b; --Patho:#4c6373; --Signs:#9b7749; --Dx:#6b5b95; --Rx:#1f6f78; }}
* {{ box-sizing:border-box; }}
html, body {{ margin:0; background:var(--paper); color:var(--ink); font-family:'DM Sans',system-ui,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }}
.cover {{ display:grid; grid-template-columns: 1fr 1.25fr; gap:24px; align-items:end; padding:4px 2px 12px; margin-bottom:12px; border-bottom:2px solid var(--ink); }}
.brand {{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }}
.brand i {{ width:34px; height:34px; border-radius:11px; background:#94c5a6; display:grid; place-items:center; color:#233d36; font-style:normal; font:800 20px Manrope; }}
.brand b {{ font:800 19px Manrope; letter-spacing:-.05em; }}
.cover h1 {{ font:800 40px/1 Manrope; letter-spacing:-.05em; margin:0; }}
.cover h1 em {{ font-style:normal; color:var(--forest); }}
.cover p.lede {{ font-size:11.5px; line-height:1.5; color:var(--muted); margin:0 0 8px; }}
.legend {{ display:flex; flex-wrap:wrap; gap:6px 14px; margin:0; }}
.lg {{ display:inline-flex; align-items:center; gap:5px; font:700 11px 'DM Sans'; color:var(--c); }}
.lg i {{ width:10px; height:10px; border-radius:3px; background:var(--c); }}
.howto {{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:34px; }}
.howto div {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 16px; font-size:14.5px; line-height:1.5; color:#3a4850; }}
.howto b {{ display:block; font:700 15px Manrope; color:var(--ink); margin-bottom:4px; }}
.index {{ columns:3; column-gap:22px; font-size:11.5px; line-height:1.45; }}
.ix {{ break-inside:avoid-column; margin-bottom:14px; }}
.ix > b {{ color:var(--coral); font:700 12px 'DM Sans'; display:block; }}
.ix ol {{ margin:4px 0 0; padding-left:0; list-style:none; }}
.ix a {{ color:var(--ink); text-decoration:none; }}
.b-Def {{ --c:var(--Def); }} .b-Cause {{ --c:var(--Cause); }} .b-Patho {{ --c:var(--Patho); }} .b-Signs {{ --c:var(--Signs); }} .b-Dx {{ --c:var(--Dx); }} .b-Rx {{ --c:var(--Rx); }}
.cover + .cols {{ }} .sech:not(:first-child) {{ margin-top:6px; }}
.sech {{ break-after:avoid; break-inside:avoid; display:flex; flex-wrap:wrap; align-items:baseline; gap:12px; margin:0 0 12px; padding-bottom:8px; border-bottom:2px solid var(--ink); font:800 17px/1.15 Manrope; letter-spacing:-.02em; }}
.sech span {{ color:var(--coral); font:700 14px 'DM Sans'; letter-spacing:0; }}
.sech i {{ margin-left:auto; font:500 13px 'DM Sans'; color:var(--muted); font-style:normal; }}
.cols {{ columns:3; column-gap:10px; }}
.card {{ break-inside:avoid; background:var(--card); border:1px solid var(--line); border-radius:11px; padding:6px 8px 5px; margin:0 0 7px; }}
.root {{ display:flex; gap:7px; align-items:baseline; background:var(--ink); color:#f6f4ed; border-radius:8px; padding:5px 8px; }}
.root .tid {{ font:700 9.5px 'DM Sans'; color:#9bd1ad; margin-right:3px; }}
.root h3 {{ margin:0; font:800 11.5px/1.2 Manrope; letter-spacing:-.01em; }}
.pearl {{ margin:4px 0 2px 10px; padding:2px 7px; border-left:3px solid var(--forest); background:var(--mint); border-radius:0 6px 6px 0; font:600 7.9px/1.3 'DM Sans'; color:#25483b; }}
.trunk {{ margin:4px 0 0 10px; border-left:2px solid #b9b4a6; padding-left:0; }}
.br {{ position:relative; display:grid; grid-template-columns:62px 1fr; gap:0; padding:1.5px 0 1.5px 9px; }}
.br::before {{ content:""; position:absolute; left:0; top:9px; width:8px; border-top:2px solid #b9b4a6; }}
.br:last-child {{ background:linear-gradient(var(--card),var(--card)) 0 11px/2px 100% no-repeat; margin-left:-2px; padding-left:11px; }}
.br:last-child::before {{ left:0; width:10px; }}
.lab {{ align-self:start; display:block; hyphens:manual; margin-top:1px; padding:2px 5px; border-radius:5px; background:var(--c); color:#fff; font:700 7.4px/1.25 'DM Sans'; text-align:center; }}
.leaves {{ border-left:1.6px solid var(--c); margin-left:4px; padding-left:0; }}
.leaves ul {{ list-style:none; margin:0; padding:0; }}
.leaves li {{ position:relative; padding:0.5px 0 0.5px 8px; font:400 8px/1.26 'DM Sans'; color:#26323c; }}
.leaves li::before {{ content:""; position:absolute; left:0; top:6px; width:5px; border-top:1.6px solid var(--c); }}
.arr {{ color:var(--c); font-weight:700; }}
.hook {{ margin:1px 0 1px 8px; font:italic 500 7.5px/1.3 'DM Sans'; color:var(--c); }}
</style></head><body>
<header class="cover">
  <div class="cv-l"><div class="brand"><i>+</i><b>paeds path</b></div><h1>Every topic, <em>as a tree.</em></h1></div>
  <div class="cv-r"><p class="lede">165 topics. Each tree: topic (dark bar), key point (green), then the same six branches every time, ending in your own notes lines. Italic line = memory hook. Use your PDF reader's outline/bookmarks to jump to any topic; zoom in freely, it's all vector.</p>
  <div class="legend">{legend}</div></div>
</header>
{sections}
</body></html>"""

html_path = OUT.with_suffix(".html")
html_path.write_text(doc, encoding="utf-8")
js = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://{html_path}', {{ waitUntil: 'networkidle' }});
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({{ path: '{OUT}', width: '1100px', height: '1556px', printBackground: true, preferCSSPageSize: true, outline: true, tagged: true }});
  await b.close();
}})();"""
subprocess.run(["node", "-e", js], check=True, cwd=str(ROOT))
print("wrote", OUT)
