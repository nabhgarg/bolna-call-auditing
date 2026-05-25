# Call Audit Tool — Product Brainstorm
*Bolna × Human Evaluation-as-a-Service*
*Last updated: May 2026*

---

## 1. The Problem — What Manvi Does Today

Right now, reviewing one call requires a reviewer to:

1. Open the **Calls spreadsheet** → find a call → copy the UUID call ID + copy the S3 recording URL
2. Open the **recording URL** in a browser tab and play the audio
3. Open the **Process Setup Excel** file (separate app, separate file)
4. Go to **Call Log sheet** → paste the call ID manually, fill date, reviewer name, agent type, give Vibe Score
5. Go to **TTS Pronunciation sheet** → paste call ID again → pause audio → type the timestamp → fill word, severity, notes
6. Go to **TTS Tone sheet** → paste call ID again → do the same
7. Repeat for **Interruptions**, **Latency**, **Transcription** — 5 separate sheets, same call ID pasted every time
8. Manually hunt through the audio to re-find timestamps when going back to fill details

**The result:** A reviewer is context-switching between 3 windows (calls list, audio browser tab, Excel), pasting the same UUID 6 times, manually typing timestamps, and spending more time on logistics than on actual judgment. For 7-8 people doing 3-4 hours of passive time, this is a catastrophic waste.

---

## 2. What We're Building

A **purpose-built web tool** (mobile-first, works on desktop too) where a reviewer:

- Logs in → sees their assigned call queue → clicks a call
- Sees **audio player + transcript on one screen**
- **Taps a button** to capture the current timestamp when they hear an issue
- Fills in **dropdowns only** (no typing except "other" notes)
- Hits **Submit** → next call loads automatically

No copy-pasting. No switching tabs. No Excel. One screen, one flow.

This tool is also the **core product** of the EaaS (Evaluation as a Service) startup — what we build for Bolna becomes the template for every future client.

---

## 3. Design Principles

**P1 — One screen, everything you need.**
Audio player, transcript, and the form all live on the same screen. The reviewer never leaves the page.

**P2 — Timestamp is captured with one tap.**
While audio plays, reviewer taps a "Flag this moment" button → current playback time is auto-filled. No pausing, no manual typing.

**P3 — Dropdowns only.**
Every field is a dropdown or toggle. Free text only for "Other" notes. Decision fatigue is the enemy.

**P4 — The call ID is invisible to the reviewer.**
It's auto-assigned, auto-filled, never copy-pasted. Reviewer only sees: agent name, call duration, their queue.

**P5 — Mobile-first.**
Reviewers use passive time — commuting, waiting, etc. The tool must work one-handed with earphones in. Large tap targets, vertical scroll, no hover states.

**P6 — Team 1 and Team 2 see different interfaces.**
Same underlying call data, but Team 1's screen is optimised for transcript reading + vibe scoring. Team 2's screen is optimised for audio listening + event flagging. They don't see each other's scores during review.

**P7 — Speed is the KPI.**
Every design decision should reduce seconds per call. Target: 5 min/call for Team 1, 8 min/call for Team 2. The tool measures this automatically.

---

## 4. The Two Review Modes

### Team 1 — Transcript + Vibe Mode

**Who:** 3 people. Read transcript while listening. Give gestalt scores.

**What they evaluate:**
- Transcription errors (wrong, missing, entity tag, script type)
- Vibe Score (1–4)
- Call Completion / Flow (1–4)

**Interface priority:** Transcript is large, readable, scrollable. Audio is a persistent bottom bar. Flagging happens by tapping words inline in the transcript.

**Blind to:** Team 2's logs. They don't see pronunciation/tone/interruption scores until after they submit.

---

### Team 2 — Technical Audio Mode

**Who:** 5 people. Pure listen. Flag events as they happen.

**What they evaluate:**
- TTS Pronunciation (per word flagged)
- TTS Tone (Y/N + tag + time range)
- Interruptions (valid/invalid + consequences)
- Latency (event + user reaction)
- LLM Hallucination (per AI turn)

**Interface priority:** Audio controls are prominent. Transcript is a reference sidebar. Big "Flag" button always visible. Turn navigator for LLM eval.

---

## 5. Core Screens

### Screen 0 — Login + Queue

```
┌─────────────────────────────────────┐
│  👋 Hey Manvi                        │
│  You have 12 calls in your queue    │
│  Estimated: ~1h 40min               │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🎧 CALL 1 of 12              │  │
│  │ Agent: App Registration       │  │
│  │ Duration: 1m 28s              │  │
│  │ Client: Pronto                │  │
│  │ Mode: Transcript + Vibe       │  │
│  │                               │  │
│  │        [Start Review]         │  │
│  └───────────────────────────────┘  │
│                                     │
│  ▓▓▓▓▓▓▓░░░░░░░░  5/12 done today  │
└─────────────────────────────────────┘
```

Key decisions:
- Reviewer never sees the UUID. Just agent name, duration, client.
- Queue is pre-assigned server-side. No coordination needed.
- Progress bar shows daily throughput — light gamification.
- Mode label ("Transcript + Vibe" vs "Technical Audio") so reviewer knows which hat to wear.

---

### Screen 1A — Team 1 Review (Transcript + Vibe)

```
┌─────────────────────────────────────────────────────────────┐
│  ◄  App Registration · Pronto · 1m 28s          [2 / 12]    │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  TRANSCRIPT                                          [Flag] │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🤖 Hello, मैं Neha बोल रही हूं Pronto Company की     │  │
│  │    तरफ़ से.                                           │  │
│  │                                                       │  │
│  │ 👤 hello yes ma'am हां जी बाकी दे दूं               │  │
│  │                                                       │  │
│  │ 🤖 नमस्ते कंचन तिर्की जी, मैं Pronto की तरफ़ से    │  │
│  │    call कर रही हूं. आपने Pronto में काम करने में   │  │
│  │    [interest]← tap word to flag transcription error  │  │
│  │    दिखाया था...                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ── AUDIO ──────────────────────────────────────────────── │
│  ▶  ──────●──────────────────  0:23 / 1:28    [−5s] [+5s]  │
│─────────────────────────────────────────────────────────────│
│  SCORES (fill after listening)                              │
│  Vibe:  [1] [2] [3] [4]          Flow: [1] [2] [3] [4]     │
│                                                             │
│  Notes: _______________                                     │
│                              [Submit & Next Call →]        │
└─────────────────────────────────────────────────────────────┘
```

Key interactions:
- **Tap any word in the transcript** → opens a quick panel to log a transcription error for that word. Timestamp auto-fills from that word's position in the transcript (if synced) or from audio current position.
- **Transcript scrolls** as audio plays (auto-scroll, can be toggled off).
- **Vibe score is locked** until audio has played at least 80% — prevents premature scoring.
- **−5s / +5s buttons** for quick audio navigation to re-check a moment.

---

### Screen 1A-sub — Transcription Flag Panel (slides up)

```
┌─────────────────────────────────┐
│  Log Transcription Error        │
│  Timestamp: 00:43 (auto-filled) │
│                                 │
│  Issue Type                     │
│  ○ Wrong (same language)        │
│  ○ Wrong (different language) ← │
│  ○ Missing                      │
│                                 │
│  What audio said: [__________]  │
│  What transcript shows: [_____] │
│                                 │
│  Content Tag                    │
│  [General ▼]                    │
│  (General / City / Proper Noun) │
│                                 │
│  Script issue?  [No ▼]          │
│                                 │
│  [Cancel]          [Add Issue]  │
└─────────────────────────────────┘
```

---

### Screen 1B — Team 2 Review (Technical Audio)

```
┌─────────────────────────────────────────────────────────────┐
│  ◄  App Registration · Pronto · 1m 28s          [3 / 12]    │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ── AUDIO ──────────────────────────────────────────────── │
│  ▶  ────────●────────────────  0:31 / 1:28    [−5s] [+5s]  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  🚩 FLAG THIS MOMENT          [currently: 0:31]      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │  │
│  │  │🗣️ Pronun │ │🎭 Tone   │ │✋ Interr  │ │⏱️ Lag  │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ── LLM EVALUATION (turn by turn) ─────────────────────── │
│  Turn 3 of 8                           ← prev   next →     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🤖 "जब आपने Pronto Partner app download किया था,   │  │
│  │    तब आपने app में Delhi - Dwaraka screening        │  │
│  │    center select किया था..."                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  How was this response?                                     │
│  [✓ As expected] [⚠ Not perfect] [✗ Deviated]             │
│                                                             │
│  If ✗: Error type [Loop / No-progress ▼]                   │
│                                                             │
│  ── TRANSCRIPT (reference) ────────────── [collapse ▲] ─  │
│  (collapsible, small text, for reference only)              │
│                                                             │
│                              [Submit & Next Call →]        │
└─────────────────────────────────────────────────────────────┘
```

Key interactions:
- **Flag This Moment** button is always visible while audio plays. Tap it → choose category (Pronunciation / Tone / Interruption / Latency) → mini-form slides up with timestamp pre-filled.
- **LLM Turn Navigator** is separate from audio — reviewer evaluates each AI turn sequentially. "As expected" is a single tap, ~3 seconds. Only deviations need extra input.
- Transcript is collapsed by default in Team 2 mode — it's audio-first. Reviewer can expand it as reference.
- **Issues logged so far** shown as a small counter badge next to each category button.

---

### Screen 1B-sub — Flag Panel Examples

**Pronunciation flag:**
```
┌─────────────────────────────────┐
│  🗣️ Pronunciation Issue          │
│  Timestamp: 00:31 (auto-filled) │
│                                 │
│  Correct form: [__________]     │
│  Word heard:   [__________]     │
│                       or [Not sure] │
│                                 │
│  Error Type  [Wrong syllable ▼] │
│  Severity    [3 - Minor      ▼] │
│  Content Tag [General        ▼] │
│                                 │
│  [Cancel]          [Add Issue]  │
└─────────────────────────────────┘
```

**Tone flag:**
```
┌─────────────────────────────────┐
│  🎭 Tone Issue                   │
│  Start time: 00:31 (auto-filled)│
│  End time:   [00:__] or [Across call] │
│                                 │
│  Tag  [Too robotic           ▼] │
│  (Robotic/Slow/Fast/Wrong emotion │
│   /Unnatural Pause/Other)       │
│                                 │
│  Notes (only if Other): [_____] │
│                                 │
│  [Cancel]          [Add Issue]  │
└─────────────────────────────────┘
```

**Latency flag:**
```
┌─────────────────────────────────┐
│  ⏱️ Latency Event                │
│  Timestamp: 00:31 (auto-filled) │
│                                 │
│  User Reaction                  │
│  ○ None – call continued        │
│  ○ Spoke again unprompted       │
│  ○ Said hello / are you there   │
│  ○ Expressed frustration        │
│  ○ Hung up                      │
│                                 │
│  [Cancel]          [Add Issue]  │
└─────────────────────────────────┘
```

---

### Screen 2 — Review Summary (before submit)

```
┌─────────────────────────────────────────┐
│  Review Summary                         │
│  App Registration · Pronto · 1m 28s     │
│─────────────────────────────────────────│
│                                         │
│  📝 Transcription    3 issues logged    │
│  🌡️ Vibe Score       2                  │
│  🔁 Flow             3                  │
│                                         │
│  ── or for Team 2 ──                   │
│                                         │
│  🗣️ Pronunciation    2 issues           │
│  🎭 Tone             1 issue            │
│  ✋ Interruptions    1 event            │
│  ⏱️ Latency          0 events           │
│  🤖 LLM (8 turns)   1 deviation        │
│                                         │
│  Time taken: 6m 42s                     │
│                                         │
│  [← Back to edit]     [Submit ✓]       │
└─────────────────────────────────────────┘
```

Reviewer can catch if they missed something before final submit.

---

### Screen 3 — Reviewer Dashboard

```
┌─────────────────────────────────────────┐
│  Manvi's Stats — Today                  │
│─────────────────────────────────────────│
│  Calls reviewed:    8 / 12 target       │
│  Avg time/call:     5m 48s              │
│  Issues flagged:    23                  │
│  Streak:            4 days 🔥           │
│─────────────────────────────────────────│
│  This week:  ▓▓▓▓▓▓▓░░░  38 calls      │
│─────────────────────────────────────────│
│  Top issue today: TTS Tone (Too robotic)│
└─────────────────────────────────────────┘
```

Light gamification — streak, daily target. No leaderboard to avoid competition over speed vs. quality.

---

## 6. Key Technical Features

### Auto Timestamp Capture
When reviewer taps "Flag This Moment", `audio.currentTime` is read from the HTML5 audio element and pre-populated in the form. No manual typing. This is the single highest-leverage feature — it removes the biggest friction point in the current Excel workflow.

### Blind Score Isolation
Team 1's Vibe Score is stored in a separate database partition from Team 2's technical scores. When a call's review is complete, both are merged into the output record. Neither team sees the other's scores in their review interface.

### Turn Segmentation
The transcript is pre-processed on ingest to split into turns (user vs. agent). The LLM evaluation navigator steps through agent turns only. For each turn, the reviewer's response (As expected / Not perfect / Deviated + error type) is stored with the turn index, not just a timestamp.

### Call Queue Assignment
Calls are assigned from a shared pool. Rules:
- Same call is sent to 2 different reviewers ~15% of the time (QC overlap)
- Reviewer is not told which calls are overlap calls
- Agent type and language match reviewer's proficiency tag (Hindi/Hinglish reviewer gets Hindi calls)
- Queue refills automatically from the Bolna call database

### Offline-first Audio
S3 audio URLs are proxied through the tool backend. Reviewer doesn't need to click external links. Audio buffers ahead. Works on slow mobile connections.

### Output Format
Each submitted review produces a structured JSON record:
```json
{
  "call_id": "34f0fb9f-...",
  "reviewer_id": "manvi_01",
  "team": "team1",
  "reviewed_at": "2026-05-25T14:32:00Z",
  "duration_taken_sec": 402,
  "vibe_score": 2,
  "flow_score": 3,
  "transcription_issues": [
    {
      "timestamp": "01:05",
      "issue_type": "wrong_different_language",
      "audio_said": "Narnaul",
      "transcript_shows": "now",
      "content_tag": "city",
      "script_issue": false
    }
  ]
}
```

---

## 7. MVP vs V2 Scope

### MVP (Build first — 2–3 weeks)

The minimum that makes the workflow meaningfully faster than Excel:

- [ ] Call queue — assigned calls appear, no coordination needed
- [ ] Single-screen review: audio player + transcript + form
- [ ] Auto timestamp capture on flag tap
- [ ] Team 1 form: transcription issues + vibe score + flow score
- [ ] Team 2 form: pronunciation, tone, interruption, latency flags
- [ ] LLM turn navigator (basic — prev/next through agent turns)
- [ ] Submit → auto-advance to next call
- [ ] JSON output exportable to CSV for Bolna
- [ ] Basic reviewer dashboard (calls done today, time/call)

**Not in MVP:** inter-rater comparison, gamification, admin panel, analytics dashboard, real-time output to Bolna API.

**Tech for MVP:**
- Frontend: React (simple, fast to build)
- Backend: Python FastAPI or Node.js
- Data: PostgreSQL (structured JSON per review)
- Audio: HTML5 audio element, S3 URLs proxied
- Auth: Simple email + password, no OAuth needed yet
- Deployment: Railway or Render (cheap, fast)

**Could even start with:** Retool or an internal tool builder to get something working in days before building custom.

---

### V2 (After validating MVP works)

- [ ] Inter-rater comparison dashboard — flag calls where Team A Vibe and Team B technical scores diverge significantly
- [ ] Admin panel for Bolna — they see aggregated scores, filter by agent type, date, client
- [ ] Calibration session mode — supervisor shows the same call to all reviewers, compares scores in real-time
- [ ] Pronunciation audio snippet replay — when flagging, auto-clip the 3 seconds around the flagged timestamp for easy re-reference
- [ ] Agent prompt display (for LLM hallucination accuracy)
- [ ] Reviewer proficiency score — track inter-rater reliability per reviewer over time
- [ ] Multi-client support — plug in different call sources beyond Bolna

---

## 8. The "Passive Time" Design Constraint

The startup thesis is that reviewers use passive time — commuting, waiting, breaks. This changes tool requirements in specific ways:

**Sessions can be interrupted.** Reviewer must be able to pause mid-call and resume. Work-in-progress state must be saved automatically every time a flag is submitted (not just on final submit).

**Audio must work with earphones, no speakers.** No autoplay on page load. Large, thumb-friendly audio controls.

**Screen size is 375–390px wide.** All UI must be designed for phone first. No horizontal scrolling. Dropdowns instead of radio buttons for small screens.

**Sessions are short.** Reviewer might do 3 calls then put phone away, return later for 4 more. Queue shows remaining count and estimated time so they can plan.

**No typing.** Someone standing on a train cannot type well. Every input must be a tap: dropdowns, toggles, star ratings. The only text field is the optional "Other" notes field.

---

## 9. Open Questions to Resolve Before Building

1. **Where does the call list come from?** Does Bolna push calls to our system via API, or do we pull from the spreadsheet manually? API is better but needs Bolna's cooperation.

2. **Do we build or use an existing tool for MVP?** Options: build custom React app, use Retool (fast internal tool), use Airtable with custom forms, use Google Form + Apps Script. Each has different trade-offs on speed vs. flexibility.

3. **How do reviewers log in?** Simple email/password is fine. Or WhatsApp-based OTP if reviewers are on mobile most of the time.

4. **How does Bolna consume the output?** CSV export via email? Google Sheets sync? API endpoint they hit? Need to define before building the output layer.

5. **Does Team 2 need the agent prompt in the interface?** If yes, Bolna needs to provide prompt text per agent type as part of the call metadata. This is a data dependency.

6. **What's the overlap/QC logic?** 15% of calls reviewed by 2 people is the proposal. Who decides which 15%? Random? Systematic (every Nth call)? Bolna-flagged calls?

7. **How do we handle Hindi/Devanagari input?** Reviewers may need to type Hindi words for "what audio said" fields. The tool must support Unicode/IME input, especially on Android.

---

## 10. Why This Tool Is the Product

Every decision above — the two-mode split, the blind vibe scoring, the turn navigator, the timestamp tap — is not just a workflow improvement for Bolna. It's the specification for the EaaS platform.

When the next client comes (a different voice AI company, a different language), we configure:
- The rubric (which metrics, which dropdowns, which scales)
- The team split (how many reviewers, which mode)
- The call source (their API or CSV)
- The output format (their preferred schema)

The tool is the infrastructure. The human reviewers + their passive time are the labour. The rubric expertise (knowing what makes a Hindi Hinglish voice AI call good or bad) is the moat.

Build the tool to be configurable from day one, not hard-coded for Bolna.
