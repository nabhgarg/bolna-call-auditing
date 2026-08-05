#!/usr/bin/env python3
"""Score the router audit: unblind judgments, compute QC + results, write results.md."""
import argparse, csv, sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

PREF_TO_SIDE = {"A much better": "A", "A slightly better": "A", "Tie": "tie",
                "B slightly better": "B", "B much better": "B"}


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def kappa(pairs):
    """Cohen's kappa over (label1, label2) pairs, 3 classes."""
    if not pairs:
        return None
    n = len(pairs)
    po = sum(1 for a, b in pairs if a == b) / n
    cats = {"A", "tie", "B"}
    p1 = Counter(a for a, _ in pairs)
    p2 = Counter(b for _, b in pairs)
    pe = sum((p1[c] / n) * (p2[c] / n) for c in cats)
    return (po - pe) / (1 - pe) if pe < 1 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", required=True)
    ap.add_argument("--prompts", required=True)
    ap.add_argument("--runlog", required=True)
    ap.add_argument("--judgments", nargs="+", required=True)
    ap.add_argument("--search-needed", dest="search_needed")
    ap.add_argument("--objective")
    ap.add_argument("--out", default="results.md")
    args = ap.parse_args()

    key = {r["item_id"]: r for r in read_csv(args.key)}
    prompts = {r["id"]: r for r in read_csv(args.prompts)}
    runlog = read_csv(args.runlog)
    judgments = [r for p in args.judgments for r in read_csv(p)]

    # per item: reviewer -> judgment
    by_item = defaultdict(dict)
    for j in judgments:
        by_item[j["item_id"]][j["reviewer"]] = j
    reviewers = sorted({j["reviewer"] for j in judgments})

    L = ["# Router Audit — Results", ""]

    # ---- 1. Golden accuracy ----------------------------------------------
    L += ["## 1. Reviewer QC", ""]
    for rev in reviewers:
        hits = tot = 0
        for iid, k in key.items():
            if k["is_golden"] != "yes" or rev not in by_item.get(iid, {}):
                continue
            tot += 1
            side = PREF_TO_SIDE.get(by_item[iid][rev]["preference"], "")
            hits += side == k["expected_side"]
        L.append(f"- Golden accuracy — **{rev}**: {hits}/{tot}" if tot else
                 f"- Golden accuracy — **{rev}**: no golden items seen")

    # ---- 2. Kappa (pairwise over shared non-golden items) ----------------
    for r1, r2 in combinations(reviewers, 2):
        pairs = []
        for iid, revs in by_item.items():
            if key.get(iid, {}).get("is_golden") == "yes":
                continue
            if r1 in revs and r2 in revs:
                pairs.append((PREF_TO_SIDE.get(revs[r1]["preference"], "tie"),
                              PREF_TO_SIDE.get(revs[r2]["preference"], "tie")))
        k = kappa(pairs)
        if k is not None:
            L.append(f"- Cohen's κ ({r1} vs {r2}, n={len(pairs)}): **{k:.2f}**")
    L.append("")

    # ---- 3. Aggregate to a per-item verdict ------------------------------
    # majority of sides; opposite sides w/o majority -> conflict (adjudicate)
    verdicts, conflicts = {}, []
    for iid, revs in by_item.items():
        k = key.get(iid)
        if not k or k["is_golden"] == "yes":
            continue
        sides = [PREF_TO_SIDE.get(j["preference"], "tie") for j in revs.values()]
        c = Counter(sides)
        top, n_top = c.most_common(1)[0]
        if n_top * 2 > len(sides):
            verdicts[iid] = top
        elif "A" in c and "B" in c:
            conflicts.append(iid)
        else:  # tie + one side -> lean
            verdicts[iid] = next(s for s in sides if s != "tie")

    def magic_outcome(iid, side):
        a_arm = key[iid]["A_arm"]
        if side == "tie":
            return "tie"
        won = key[iid]["A_arm"] if side == "A" else key[iid]["B_arm"]
        return "magic_win" if won == "MAGIC" else "magic_loss"

    # ---- 4. Win/tie/loss overall + slices --------------------------------
    overall = Counter()
    slice_cat = defaultdict(Counter)
    slice_diff = defaultdict(Counter)
    certain_loss = Counter()
    for iid, side in verdicts.items():
        pid = key[iid]["prompt_id"]
        p = prompts.get(pid)
        if not p:
            continue
        out = magic_outcome(iid, side)
        overall[out] += 1
        slice_cat[p["category"]][out] += 1
        slice_diff[(p["category"], p["difficulty"])][out] += 1
        if out == "magic_loss" and all(
                j["confidence"] == "Certain" for j in by_item[iid].values()):
            certain_loss[p["category"]] += 1

    tot = sum(overall.values()) or 1
    L += ["## 2. Core result — Magic vs pinned premium model", "",
          f"- Items with verdicts: {tot} (+{len(conflicts)} conflicts pending adjudication)",
          f"- **Magic win {overall['magic_win']} ({overall['magic_win']/tot:.0%}) · "
          f"tie {overall['tie']} ({overall['tie']/tot:.0%}) · "
          f"loss {overall['magic_loss']} ({overall['magic_loss']/tot:.0%})**",
          f"- Match-or-beat rate (win+tie): **{(overall['magic_win']+overall['tie'])/tot:.0%}**", "",
          "| category | n | magic win | tie | magic loss | certain-only losses |",
          "|---|---|---|---|---|---|"]
    for cat, c in sorted(slice_cat.items()):
        n = sum(c.values())
        L.append(f"| {cat} | {n} | {c['magic_win']} | {c['tie']} | {c['magic_loss']} | {certain_loss[cat]} |")
    L += ["", "| category | difficulty | n | win | tie | loss |", "|---|---|---|---|---|---|"]
    for (cat, d) in sorted(slice_diff):
        c = slice_diff[(cat, d)]
        L.append(f"| {cat} | {d} | {sum(c.values())} | {c['magic_win']} | {c['tie']} | {c['magic_loss']} |")
    L.append("")

    # ---- 5. Failure tags on Magic's losses -------------------------------
    tagc = Counter()
    for iid, side in verdicts.items():
        if magic_outcome(iid, side) != "magic_loss":
            continue
        magic_side = "A" if key[iid]["A_arm"] == "MAGIC" else "B"
        for j in by_item[iid].values():
            for t in (j.get(f"tags_{magic_side}") or "").split("|"):
                if t:
                    tagc[t] += 1
    L += ["## 3. Failure tags on Magic's losing responses", ""]
    L += [f"- {t}: {n}" for t, n in tagc.most_common()] or ["- (none)"]
    L.append("")

    # ---- 6. Routing + credits + search 2x2 -------------------------------
    route = defaultdict(Counter)
    credits = Counter()
    search_used = {}
    for r in runlog:
        pid, arm = r["prompt_id"], r["arm"].upper()
        p = prompts.get(pid)
        try:
            credits[arm] += float(r.get("credit_cost") or 0)
        except ValueError:
            pass
        if arm == "MAGIC" and p:
            route[p["category"]][r.get("model_badge", "?")] += 1
            search_used[pid] = (r.get("search_used", "").strip().lower() == "yes")
    L += ["## 4. Routing behavior (MAGIC arm)", ""]
    for cat, c in sorted(route.items()):
        L.append(f"- {cat}: " + ", ".join(f"{m}×{n}" for m, n in c.most_common()))
    base_arm = next((a for a in credits if a != "MAGIC" and credits[a]), None)
    if base_arm:
        saved = 1 - credits["MAGIC"] / credits[base_arm]
        L += ["", f"- Credits — MAGIC {credits['MAGIC']:.0f} vs {base_arm} {credits[base_arm]:.0f} "
                  f"→ **Magic saved {saved:.0%}** (only meaningful if both arms ran in Merlin)"]
    L.append("")

    if args.search_needed:
        need = {r["prompt_id"]: r["search_needed"] for r in read_csv(args.search_needed)}
        grid = Counter()
        misses, waste = [], []
        for pid, needed in need.items():
            if pid not in search_used:
                continue
            used = search_used[pid]
            grid[(needed, used)] += 1
            if needed == "yes" and not used:
                misses.append(pid)
            if needed == "no" and used:
                waste.append(pid)
        L += ["## 5. Search 2×2 (MAGIC arm, F-series)", "",
              "| search needed | invoked | not invoked |", "|---|---|---|",
              f"| yes | {grid[('yes',True)]} | **{grid[('yes',False)]} ← stale-risk misses** |",
              f"| no | {grid[('no',True)]} ← wasted invocations | {grid[('no',False)]} |",
              f"| either | {grid[('either',True)]} | {grid[('either',False)]} |", ""]
        if misses:
            L.append(f"- Needed-but-not-invoked: {', '.join(misses)}")
        if waste:
            L.append(f"- Invoked-but-not-needed: {', '.join(waste)}")
        L.append("")

    # ---- 7. Objective checks ---------------------------------------------
    if args.objective:
        obj = read_csv(args.objective)
        rates = defaultdict(Counter)
        route_fail = []
        by_pid = defaultdict(dict)
        for r in obj:
            rates[r["arm"].upper()][r["pass"].strip().lower()] += 1
            by_pid[r["prompt_id"]][r["arm"].upper()] = r["pass"].strip().lower()
        for pid, arms in by_pid.items():
            if arms.get("PINNED") == "pass" and arms.get("MAGIC") == "fail":
                route_fail.append(pid)
        L += ["## 6. Objective checks", ""]
        for arm in ("MAGIC", "PINNED"):
            n = sum(rates[arm].values())
            if n:
                L.append(f"- {arm}: {rates[arm]['pass']}/{n} pass ({rates[arm]['pass']/n:.0%})")
        if route_fail:
            L.append(f"- **Failures caused by routing** (PINNED pass, MAGIC fail): {', '.join(sorted(route_fail))}")
        L.append("")

    if conflicts:
        L += ["## Adjudication needed (reviewers chose opposite sides)", ""]
        L += [f"- {iid} ({key[iid]['prompt_id']})" for iid in sorted(conflicts)]
        L.append("")

    Path(args.out).write_text("\n".join(L), encoding="utf-8")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
