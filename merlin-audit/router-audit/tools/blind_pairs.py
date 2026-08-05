#!/usr/bin/env python3
"""Build the blinded review set from the run log.

Pairs MAGIC/PINNED responses per prompt, randomizes A/B sides and item order,
mixes in golden items, strips all metadata. Outputs review_items.json (for
reviewers) and answer_key.csv (keep sealed until judgments are in).
"""
import argparse, csv, json, random, sys
from pathlib import Path


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runlog", required=True)
    ap.add_argument("--prompts", required=True)
    ap.add_argument("--golden", help="golden.json: [{prompt, good, bad}]")
    ap.add_argument("--baseline", default="PINNED",
                    help="arm to pair against MAGIC (e.g. FRONTIER)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--outdir", default=".")
    args = ap.parse_args()
    rng = random.Random(args.seed)

    prompts = {r["id"]: r for r in read_csv(args.prompts)}
    runlog = read_csv(args.runlog)

    by_prompt = {}
    for r in runlog:
        if r.get("anomaly", "").strip().lower() in ("suspect",):
            print(f"note: skipping suspect row {r['prompt_id']}/{r['arm']}", file=sys.stderr)
            continue
        by_prompt.setdefault(r["prompt_id"], {})[r["arm"].upper()] = r

    items, key_rows = [], []
    base = args.baseline.upper()
    for pid, arms in sorted(by_prompt.items()):
        if "MAGIC" not in arms or base not in arms:
            print(f"warning: {pid} missing an arm, skipped", file=sys.stderr)
            continue
        if pid not in prompts:
            print(f"warning: {pid} not in prompts.csv, skipped", file=sys.stderr)
            continue
        a_arm, b_arm = ("MAGIC", base) if rng.random() < 0.5 else (base, "MAGIC")
        items.append({
            "item_id": None,  # assigned after shuffle
            "prompt": prompts[pid]["prompt"],
            "A": arms[a_arm]["response_text"],
            "B": arms[b_arm]["response_text"],
            "_pid": pid, "_a": a_arm, "_b": b_arm, "_golden": "", "_expected": "",
        })

    if args.golden:
        for g in json.loads(Path(args.golden).read_text(encoding="utf-8")):
            good_side = "A" if rng.random() < 0.5 else "B"
            items.append({
                "item_id": None,
                "prompt": g["prompt"],
                "A": g["good"] if good_side == "A" else g["bad"],
                "B": g["bad"] if good_side == "A" else g["good"],
                "_pid": "GOLDEN", "_a": "", "_b": "", "_golden": "yes",
                "_expected": good_side,
            })

    rng.shuffle(items)
    out_items = []
    for i, it in enumerate(items, 1):
        iid = f"item_{i:03d}"
        out_items.append({"item_id": iid, "prompt": it["prompt"], "A": it["A"], "B": it["B"]})
        key_rows.append({
            "item_id": iid, "prompt_id": it["_pid"], "A_arm": it["_a"], "B_arm": it["_b"],
            "is_golden": it["_golden"], "expected_side": it["_expected"],
        })

    outdir = Path(args.outdir)
    (outdir / "review_items.json").write_text(
        json.dumps(out_items, indent=1, ensure_ascii=False), encoding="utf-8")
    with open(outdir / "answer_key.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["item_id", "prompt_id", "A_arm", "B_arm", "is_golden", "expected_side"])
        w.writeheader(); w.writerows(key_rows)
    n_gold = sum(1 for k in key_rows if k["is_golden"])
    print(f"wrote {len(out_items)} items ({n_gold} golden) -> review_items.json, answer_key.csv")


if __name__ == "__main__":
    main()
