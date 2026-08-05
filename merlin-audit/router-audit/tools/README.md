# Tools — run the audit end to end

Pipeline: **runlog.csv → blind_pairs.py → review.html (reviewers) → score.py → results.md**

## 0. Files you fill in

- `runlog.csv` — start from `runlog-template.csv`. One row per response
  (60 prompts × 2 arms = 120 rows). `response_text` verbatim.
- `search_needed.csv` — already filled; edit only if you change F-series prompts.
- `objective.csv` (optional but recommended) — start from `objective-template.csv`;
  operator's pass/fail per prompt × arm against the `objective_check` column in
  prompts.csv + assets.md ground truth.
- `golden.json` (after runs) — hand-built golden items, format:
  `[{"prompt": "...", "good": "<text>", "bad": "<text>"}]`. The script places
  good/bad on random sides and tracks the expected answer.

## 1. Build the blinded review set

```bash
python3 blind_pairs.py --runlog runlog.csv --prompts ../prompts.csv --golden golden.json --seed 7
```

Outputs:
- `review_items.json` — what reviewers see (no model names, no arms, A/B random)
- `answer_key.csv` — the unblinding map. **Do not open until judgments are in.**

## 2. Reviewers grade

Send each reviewer `review.html` + `review_items.json`. They open the HTML in
any browser, load the JSON, enter their name, grade all items, click
**Export judgments** → sends you `judgments_<name>.csv`. Progress auto-saves in
the browser (localStorage), safe to close and resume.

## 3. Score

```bash
python3 score.py --key answer_key.csv --prompts ../prompts.csv --runlog runlog.csv \
  --search-needed search_needed.csv --objective objective.csv \
  --judgments judgments_r1.csv judgments_r2.csv
```

Outputs `results.md`: golden accuracy per reviewer, Cohen's κ, win/tie/loss
overall + per category × difficulty, certain-only losses, failure-tag profile,
credit totals per arm, the search-needed × search-invoked 2×2, objective pass
rates, and the list of adjudication-needed conflicts (send those to reviewer 3,
append their judgments file, rerun).
