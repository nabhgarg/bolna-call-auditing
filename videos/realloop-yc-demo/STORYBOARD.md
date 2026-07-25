# RealLoop — YC demo video · storyboard + narration

Target: ~2:00, 16:9, screen-recording of REAL product views + voiceover.
Every frame in `assets/views/` is a real capture of the live product (no mockups).

Numbers on screen (real / current live values):
- Reliability: **88% inter-panel**, **85% vs ground truth**
- LLM-judge-vs-human: transcription 94 v 0, pronunciation 92 v 0, language 86 v 85
- Golden dataset: 247 calls, 2,729 ASR corrections
- Evaluation funnel: 2,448 calls in · 849 vibe-scored · 1,263 judge-read

| # | Beat | Real view (asset) | Narration (VO) | ~sec |
|---|------|-------------------|----------------|------|
| 1 | Cold open · the miss | `agent-insights.png` (Field Support · "what to fix" with the playable ASR miss @00:09) | "A real production AI call. The machine judge passed it. Here's what it missed — the customer said 'spare part'; the AI heard 'self part'. Catching that needs a human." | 0:00–0:18 |
| 2 | Where humans come from | `join-landing.png` | "So we built the place to find them — India's workforce, screened for judgment work. Apply from any phone, in Hindi or English, no resume." | 0:18–0:35 |
| 3 | The screening = the tool | `assign-transcription-1.png` → `assign-transcription-edit.png` (hero) | "The screening IS the job. They transcribe the whole user side of a real code-switched call, segment by segment — and catch the one the AI got wrong." | 0:35–0:58 |
| 4 | More judgment tools | `assign-pronunciation.png` → `assign-issue.png` | "Same tool handles pronunciation and issue-logging — a name mispronounced, a user answer the AI never captured. Tap targets, not typing, so a first-time worker is productive on day two." | 0:58–1:14 |
| 5 | Trust made visible | `reliability.png` | "Clients don't take our word on quality. Every reviewer is scored against hidden expert truth — 88% inter-panel, 85% against ground truth — and the client sees it. On audio the machine judge scores zero; humans are the only signal." | 1:14–1:36 |
| 6 | Deployment intelligence | `evaluation.png` → `agent-insights.png` | "For every use case the system decides where humans add value and where the judge can stand in, and it shows the client exactly which agent is breaking and why." | 1:36–1:54 |
| 7 | Proof + vision | slide (real numbers) | "Three pilots run on this today. Evals are the wedge — we're building the human layer every production AI plugs into." | 1:54–2:06 |

## The single most important cut
Beat 1 (machine judge passed / "self part") → Beat 3 (a screened human catching exactly that, "and self part" → "and spare part"). Same call, machine wrong, human right — the whole thesis in one cut.

## Captions
Every VO line also renders as a lower-third caption (so the video reads muted). If no voice engine is available, captions carry the narration.
