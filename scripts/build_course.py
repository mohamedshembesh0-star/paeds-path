"""Turn the 40-page paeds summaries into course.json."""

import json
import re
from pathlib import Path

import pdfplumber

PDF = Path(__file__).resolve().parents[1] / "sources" / "Paediatrics - All 165 summaries - Anki wording (40 pages).pdf"
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "course.json"

HEADER = re.compile(r"^(I{1,3})-(\d+)\b(.*)$")
LABELS = ("Def", "Cause", "Patho", "Signs", "Dx", "Rx")

# Topics taken out of Anki because the deck had no reviews.
DAYS = {
    "sun": ["I-8", "I-9", "I-10", "I-11", "I-12", "I-15", "I-16", "I-17", "I-18", "I-20", "I-21", "I-22", "I-23", "I-24", "I-25", "I-26", "I-30", "I-31", "I-32", "I-33"],
    "mon": ["I-34", "I-35", "I-36", "I-37", "I-38", "I-39", "I-40", "I-41", "I-42", "I-43", "I-44", "I-45", "I-46", "I-47", "I-48", "I-49", "I-50", "I-51", "I-52", "I-53", "I-54", "I-55"],
    "tue": ["II-17", "II-27", "II-31", "II-35", "II-36", "II-38", "II-41", "II-50", "III-15", "III-16", "III-17", "III-18", "III-19", "III-20", "III-21", "III-22", "III-23", "III-24", "III-25", "III-26", "III-27", "III-28", "III-29", "III-30"],
    "wed": ["III-31", "III-32", "III-33", "III-34", "III-35", "III-36", "III-37", "III-38", "III-39", "III-40", "III-41", "III-42", "III-43", "III-44", "III-46", "III-47", "III-49", "III-50", "III-51", "III-52", "III-53", "III-54", "III-55"],
}
DAY_OF = {topic: day for day, ids in DAYS.items() for topic in ids}


def norm(text: str) -> str:
    for src, dst in (("\u2010", "-"), ("\u2011", "-"), ("\u2013", "-"), ("\u2014", "-"), ("\u2212", "-"), ("‐", "-")):
        text = text.replace(src, dst)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([₀₁₂₃₄₅₆₇₈₉])", r"\1", text)
    return re.sub(r"\s+([.,;:!?])", r"\1", text)


def sentence_end(text: str) -> bool:
    return text.rstrip().endswith((".", "?", "!"))


def page_lines(page):
    words = [word for word in page.extract_words(extra_attrs=["size"]) if 18 < float(word["top"]) < 800]
    columns = {"L": [], "R": []}
    for word in words:
        columns["L" if float(word["x0"]) < 300 else "R"].append(word)
    lines = []
    for column in ("L", "R"):
        ordered = sorted(columns[column], key=lambda word: (float(word["top"]), float(word["x0"])))
        buckets = []
        for word in ordered:
            top = float(word["top"])
            if buckets and abs(top - buckets[-1]["top"]) <= 4.0:
                buckets[-1]["words"].append(word)
            else:
                buckets.append({"top": top, "words": [word]})
        for bucket in buckets:
            group = sorted(bucket["words"], key=lambda word: float(word["x0"]))
            text = norm(" ".join(word["text"] for word in group))
            size = max(float(word.get("size") or 0) for word in group)
            if re.fullmatch(r"\d{1,2}", text):
                continue
            if text.startswith("Paeds Final") or "one-page summaries" in text or text.startswith("tested answers") or text.startswith("Section "):
                continue
            lines.append({"text": text, "size": size})
    return lines


def parse():
    topics = []
    current = None
    label = None

    def flush():
        nonlocal current, label
        if current and any(current["blocks"].values()):
            topics.append(current)
        current = None
        label = None

    with pdfplumber.open(PDF) as pdf:
        for page in pdf.pages:
            for line in page_lines(page):
                text, size = line["text"], line["size"]
                match = HEADER.match(text)
                if match and size >= 9:
                    flush()
                    section, number = match.group(1), int(match.group(2))
                    topic_id = f"{section}-{number}"
                    current = {
                        "id": topic_id,
                        "section": section,
                        "n": number,
                        "title": match.group(3).strip(" ."),
                        "day": DAY_OF.get(topic_id),
                        "blocks": {name: [] for name in LABELS},
                    }
                    label = None
                    continue
                if current is None:
                    continue
                if size >= 9 and label is None and text not in LABELS:
                    current["title"] = f"{current['title']} {text}".strip()
                    continue
                if text in LABELS:
                    label = text
                    continue
                if label and len(text) > 1:
                    block = current["blocks"][label]
                    if block and not sentence_end(block[-1]):
                        previous = block[-1]
                        block[-1] = f"{previous}{text}" if previous.endswith("-") else f"{previous} {text}"
                    else:
                        block.append(text)
        flush()
    return topics


def main():
    topics = parse()
    if len(topics) != 165:
        raise SystemExit(f"expected 165 topics, got {len(topics)}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"topics": topics}, ensure_ascii=False, indent=2), encoding="utf-8")
    notes = sum(1 for topic in topics if topic["day"])
    print(f"wrote {OUT} ({len(topics)} topics, {notes} on the notes path)")


if __name__ == "__main__":
    main()
