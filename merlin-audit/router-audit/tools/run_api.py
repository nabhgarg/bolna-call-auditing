#!/usr/bin/env python3
"""Run the prompt set through raw model APIs — the MATCHED and FRONTIER arms.

- Inlines [ASSET:...] blocks from assets.md automatically (never the ground truth).
- Skips URL/YouTube/live-search prompts by default (raw APIs can't fetch; those
  items are graded Merlin-solo against run-day ground truth).
- Appends rows in runlog.csv format so blind_pairs.py / score.py work unchanged.

Usage:
  export ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
  # FRONTIER arm, one model for everything:
  python3 run_api.py --prompts ../prompts.csv --assets ../assets.md \
      --arm FRONTIER --model claude-sonnet-5 --out runlog_api.csv
  # MATCHED arm, per-prompt models from the Magic run:
  python3 run_api.py --prompts ../prompts.csv --assets ../assets.md \
      --arm MATCHED --model-map matched_models.csv --out runlog_api.csv

matched_models.csv: prompt_id,model  (model = API id you judge closest to the
badge Merlin showed; leave blank to skip that prompt)
"""
import argparse, csv, datetime, json, os, re, sys, time, urllib.request

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MAX_TOKENS = 4096


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def parse_assets(path):
    """Map asset name -> content. Sections start '## NAME ' and end at next '## '/'# '."""
    text = open(path, encoding="utf-8").read()
    text = text.split("# GROUND TRUTH")[0]  # never load ground truth
    assets = {}
    for m in re.finditer(r"^## (\w+)[^\n]*\n(.*?)(?=^## |^# |\Z)", text, re.M | re.S):
        assets[m.group(1)] = m.group(2).strip()
    return assets


def inline_assets(prompt, assets):
    def sub(m):
        name = m.group(1)
        if name not in assets:
            raise KeyError(f"asset {name} not found")
        return "\n\n" + assets[name] + "\n\n"
    return re.sub(r"\[ASSET:(\w+)[^\]]*\]", sub, prompt)


def call_anthropic(model, prompt):
    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=json.dumps({"model": model, "max_tokens": MAX_TOKENS,
                         "messages": [{"role": "user", "content": prompt}]}).encode(),
        headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"],
                 "anthropic-version": "2023-06-01", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.load(r)
    return "".join(b.get("text", "") for b in data["content"])


def call_openai(model, prompt):
    req = urllib.request.Request(
        OPENAI_URL,
        data=json.dumps({"model": model,
                         "messages": [{"role": "user", "content": prompt}],
                         "max_completion_tokens": MAX_TOKENS}).encode(),
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
                 "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.load(r)
    return data["choices"][0]["message"]["content"]


def call_gemini(model, prompt):
    req = urllib.request.Request(
        GEMINI_URL.format(model=model),
        data=json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                         "generationConfig": {"maxOutputTokens": MAX_TOKENS}}).encode(),
        headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"],
                 "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.load(r)
    return "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])


def call_model(model, prompt):
    fn = (call_anthropic if model.startswith("claude")
          else call_gemini if model.startswith("gemini") else call_openai)
    for attempt in range(3):
        try:
            return fn(model, prompt)
        except Exception as e:
            if attempt == 2:
                raise
            wait = 15 * (attempt + 1)
            print(f"  retry in {wait}s ({e})", file=sys.stderr)
            time.sleep(wait)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompts", required=True)
    ap.add_argument("--assets", required=True)
    ap.add_argument("--arm", required=True, choices=["FRONTIER", "MATCHED", "PINNED"])
    ap.add_argument("--model", help="single model for all prompts")
    ap.add_argument("--model-map", help="csv prompt_id,model for MATCHED arm")
    ap.add_argument("--out", default="runlog_api.csv")
    ap.add_argument("--allow-urls", action="store_true",
                    help="include prompts containing URLs (default: skip)")
    ap.add_argument("--only", nargs="*", help="run only these prompt_ids")
    args = ap.parse_args()

    if not args.model and not args.model_map:
        sys.exit("need --model or --model-map")
    model_map = ({r["prompt_id"]: r["model"] for r in read_csv(args.model_map) if r["model"].strip()}
                 if args.model_map else {})
    assets = parse_assets(args.assets)
    prompts = read_csv(args.prompts)

    fields = ["prompt_id", "arm", "run_ts", "surface", "model_badge", "credit_cost",
              "search_used", "latency_s", "anomaly", "ground_truth",
              "ground_truth_source", "response_text"]
    exists = os.path.exists(args.out)
    done = {(r["prompt_id"], r["arm"]) for r in read_csv(args.out)} if exists else set()

    with open(args.out, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        if not exists:
            w.writeheader()
        for p in prompts:
            pid = p["id"]
            if args.only and pid not in args.only:
                continue
            if (pid, args.arm) in done:
                continue
            model = model_map.get(pid, args.model)
            if not model:
                continue
            if "http" in p["prompt"] and not args.allow_urls:
                print(f"skip {pid} (URL prompt — grade Merlin solo)")
                continue
            try:
                text = inline_assets(p["prompt"], assets)
            except KeyError as e:
                print(f"skip {pid} ({e})")
                continue
            print(f"{pid} -> {model}")
            t0 = time.time()
            try:
                resp = call_model(model, text)
                anomaly = ""
            except Exception as e:
                resp, anomaly = "", f"api_error: {e}"
            w.writerow({"prompt_id": pid, "arm": args.arm,
                        "run_ts": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
                        "surface": "api", "model_badge": model, "credit_cost": "",
                        "search_used": "no", "latency_s": round(time.time() - t0, 1),
                        "anomaly": anomaly, "ground_truth": "", "ground_truth_source": "",
                        "response_text": resp})
            f.flush()
            time.sleep(2)
    print("done")


if __name__ == "__main__":
    main()
