"""Validate question-bank batch files against course.json."""
import json, sys, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
course = {t["id"]: t for t in json.load(open(ROOT / "src/data/course.json"))["topics"]}
BLOCKS = {"Def", "Cause", "Patho", "Signs", "Dx", "Rx"}
files = sys.argv[1:] or sorted(str(p) for p in (ROOT / "src/data/qbank").glob("*.json"))
errors = 0
positions = collections.Counter()
longest_correct = total_q = 0
seen = {}

def err(msg):
    global errors
    errors += 1
    print("ERROR", msg)

for f in files:
    data = json.load(open(f, encoding="utf-8"))
    for tid, entry in data.items():
        if tid not in course: err(f"{f}: unknown topic {tid}"); continue
        if tid in seen: err(f"{tid} duplicated in {f} and {seen[tid]}")
        seen[tid] = f
        if not isinstance(entry.get("summary"), str) or len(entry["summary"]) < 20: err(f"{tid}: summary missing/short")
        qs = entry.get("questions", [])
        if len(qs) < 8: err(f"{tid}: only {len(qs)} questions")
        for i, q in enumerate(qs):
            w = f"{tid} q{i}"
            if q.get("type") != "mcq": err(f"{w}: type")
            if q.get("block") not in BLOCKS: err(f"{w}: block {q.get('block')}")
            if q.get("level") not in (1, 2, 3): err(f"{w}: level")
            stem = q.get("stem", "")
            if not stem.strip().endswith("?"): err(f"{w}: stem must end with '?'")
            opts = q.get("options", [])
            if not (4 <= len(opts) <= 5): err(f"{w}: {len(opts)} options")
            if len(set(o.strip().lower() for o in opts)) != len(opts): err(f"{w}: duplicate options")
            if any(not isinstance(o, str) or not o.strip() for o in opts): err(f"{w}: empty option")
            a = q.get("answer")
            if not isinstance(a, int) or not (0 <= a < len(opts)): err(f"{w}: bad answer index"); continue
            positions[a] += 1
            total_q += 1
            if len(opts[a]) == max(len(o) for o in opts) and sorted(len(o) for o in opts)[-2] < len(opts[a]): longest_correct += 1
            if len(q.get("explain", "")) < 30: err(f"{w}: explain too short")
            if not q.get("note"): err(f"{w}: missing note")
        cards = entry.get("cards", [])
        if len(cards) < 3: err(f"{tid}: only {len(cards)} cards")
        for i, c in enumerate(cards):
            if c.get("type") != "card" or not c.get("front") or not c.get("back"): err(f"{tid} card{i}: malformed")

print(f"topics={len(seen)} questions={total_q} answer positions={dict(sorted(positions.items()))} longest-option-is-correct={longest_correct}/{total_q} ({(100*longest_correct/max(total_q,1)):.0f}%)")
if total_q and longest_correct / total_q > 0.4: err("correct answer is the strictly longest option too often (>40%) - rebalance distractor lengths")
if total_q >= 40:
    for p, c in positions.items():
        if p < 4 and c / total_q > 0.4: err(f"answer position {p} used {c}/{total_q} times - vary positions")
print("OK" if not errors else f"{errors} error(s)")
sys.exit(1 if errors else 0)
