"""Validate bite-size chunk files against course.json."""
import json, sys, collections, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
course = {t["id"]: t for t in json.load(open(ROOT / "src/data/course.json"))["topics"]}
JUNK = re.compile(r"(all 165 topics|thesis line)", re.I)
files = sys.argv[1:] or sorted(str(p) for p in (ROOT / "src/data/chunks").glob("*.json"))
errors = 0; pos = collections.Counter(); total = longest = 0; seen = set()
def err(m):
    global errors; errors += 1; print("ERROR", m)
for f in files:
    for tid, chunks in json.load(open(f, encoding="utf-8")).items():
        if tid not in course: err(f"unknown topic {tid}"); continue
        if tid in seen: err(f"{tid} duplicated")
        seen.add(tid)
        real = sum(1 for b in course[tid]["blocks"].values() for l in b if not JUNK.search(l))
        n = 0
        if not isinstance(chunks, list) or not chunks: err(f"{tid}: no chunks"); continue
        for c in chunks:
            w = f"{tid}/{c.get('block')}"
            if c.get("block") not in ("Def", "Cause", "Patho", "Signs", "Dx", "Rx"): err(f"{w}: bad block")
            if not c.get("explain") or len(c["explain"]) > 300: err(f"{w}: explain missing/too long")
            if len(c.get("hook", "")) > 200: err(f"{w}: hook too long")
            for i, q in enumerate(c.get("checks", [])):
                n += 1; total += 1
                if not q.get("q", "").strip().endswith("?"): err(f"{w} c{i}: q must end with ?")
                o = q.get("options", [])
                if len(o) != 3 or len(set(x.strip().lower() for x in o)) != 3: err(f"{w} c{i}: need 3 distinct options"); continue
                a = q.get("answer")
                if a not in (0, 1, 2): err(f"{w} c{i}: answer"); continue
                pos[a] += 1
                if len(o[a]) > max(len(x) for j, x in enumerate(o) if j != a): longest += 1
                if not q.get("why"): err(f"{w} c{i}: why missing")
        if n < max(3, real - 4): err(f"{tid}: only {n} checks for {real} notes lines")
print(f"topics={len(seen)} checks={total} positions={dict(sorted(pos.items()))} longest-correct={longest}/{total}")
if total >= 30 and longest / total > 0.45: err("correct option is the longest too often")
if total >= 30 and max(pos.values()) / total > 0.5: err("answer positions unbalanced")
print("OK" if not errors else f"{errors} error(s)"); sys.exit(1 if errors else 0)
