#!/usr/bin/env python3
"""Build blinded items for the review.realloop.in/merlin panel.

Reads runlog.csv, pairs MAGIC with FRONTIER (preferred) or MATCHED per prompt,
randomizes sides, writes:
  ../../vercel-supabase-app/lib/merlin-items.json   (blinded — served to browsers)
  ../../vercel-supabase-app/lib/merlin-key.json     (unblinding key — server only)
Rerun whenever runlog.csv grows, then redeploy.
"""
import csv, json, random, re
from pathlib import Path

HERE = Path(__file__).parent
APP_LIB = HERE / "../../../vercel-supabase-app/lib"
rng = random.Random(11)


def parse_assets(path):
    """Asset name -> content. Splits off GROUND TRUTH first: those answers must
    never reach a reviewer's browser."""
    text = Path(path).read_text(encoding="utf-8").split("# GROUND TRUTH")[0]
    return {m.group(1): m.group(2).strip()
            for m in re.finditer(r"^## (\w+)[^\n]*\n(.*?)(?=^## |^# |\Z)", text, re.M | re.S)}

prompts = {r["id"]: r for r in csv.DictReader(open(HERE / "../prompts.csv", encoding="utf-8"))}
rows = list(csv.DictReader(open(HERE / "runlog.csv", encoding="utf-8")))
by = {}
for r in rows:
    by.setdefault(r["prompt_id"], {})[r["arm"]] = r

items, key = [], {}
for pid in sorted(by):
    arms = by[pid]
    base = "FRONTIER" if "FRONTIER" in arms else "MATCHED" if "MATCHED" in arms else None
    if "MAGIC" not in arms or not base:
        continue
    a, b = ("MAGIC", base) if rng.random() < 0.5 else (base, "MAGIC")
    iid = f"m_{pid}"
    items.append({
        "item_id": iid,
        "category": prompts[pid]["category"],
        "prompt": prompts[pid]["prompt"],
        "A": arms[a]["response_text"],
        "B": arms[b]["response_text"],
    })
    key[iid] = {"prompt_id": pid, "A_arm": a, "B_arm": b, "pair_type": base,
                "magic_model": arms["MAGIC"]["model_badge"]}

# Second block: the Haiku 4.5 vs Sonnet 5 model comparison on the 30 search
# prompts (haiku_compare.csv, arms MATCHED=haiku-4.5 / PINNED=sonnet-5).
# Same blind A/B treatment; pair_type distinguishes them at analysis time.
cmp_path = HERE / "haiku_compare.csv"
if cmp_path.exists():
    cby = {}
    for r in csv.DictReader(open(cmp_path, encoding="utf-8")):
        if r["response_text"].strip():
            cby.setdefault(r["prompt_id"], {})[r["arm"]] = r
    for pid in sorted(cby):
        arms = cby[pid]
        if "MATCHED" not in arms or "PINNED" not in arms:
            continue
        a, b = ("MATCHED", "PINNED") if rng.random() < 0.5 else ("PINNED", "MATCHED")
        iid = f"c_{pid}"
        items.append({
            "item_id": iid,
            "category": prompts[pid]["category"],
            "prompt": prompts[pid]["prompt"],
            "A": arms[a]["response_text"],
            "B": arms[b]["response_text"],
        })
        key[iid] = {"prompt_id": pid, "A_arm": arms[a]["model_badge"],
                    "B_arm": arms[b]["model_badge"], "pair_type": "H45_VS_S5",
                    "magic_model": ""}

# Third block: wrapper tests — Merlin's output vs the SAME model called
# directly (wrapper-runs/responses.json). Same blind treatment; pair_type
# WRAPPER separates them at analysis time.
wrap_path = HERE / "../wrapper-runs/responses.json"
if wrap_path.exists():
    for pid, arms in json.loads(wrap_path.read_text(encoding="utf-8")).items():
        if pid not in prompts or not arms.get("MERLIN") or not arms.get("DIRECT"):
            continue
        a, b = ("MERLIN", "DIRECT") if rng.random() < 0.5 else ("DIRECT", "MERLIN")
        iid = f"w_{pid}"
        items.append({
            "item_id": iid,
            "category": prompts[pid]["category"],
            "prompt": prompts[pid]["prompt"],
            "A": arms[a],
            "B": arms[b],
        })
        key[iid] = {"prompt_id": pid, "A_arm": a, "B_arm": b,
                    "pair_type": "WRAPPER", "magic_model": "Gemini 3.1 Pro"}

rng.shuffle(items)

# Source documents referenced by [ASSET:NAME] in prompts. Reviewers grading a
# summary must be able to read what it was summarising; the panel links each
# placeholder to /merlin/source/<NAME>. Ground truth is stripped above.
assets = parse_assets(HERE / "../assets.md")
used = {m for it in items for m in re.findall(r"\[ASSET:(\w+)", it["prompt"])}
(APP_LIB / "merlin-assets.json").write_text(
    json.dumps({k: v for k, v in assets.items() if k in used}, indent=1, ensure_ascii=False),
    encoding="utf-8")
print(f"source docs: {sorted(used)}")

APP_LIB.mkdir(exist_ok=True)
(APP_LIB / "merlin-items.json").write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf-8")
(APP_LIB / "merlin-key.json").write_text(json.dumps(key, indent=1), encoding="utf-8")
print(f"{len(items)} items -> merlin-items.json (+key). Pair types:",
      {t: sum(1 for k in key.values() if k['pair_type'] == t) for t in ('FRONTIER', 'MATCHED')})
