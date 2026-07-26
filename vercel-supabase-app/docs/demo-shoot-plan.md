# Shoot plan · record first, VO after

Nabh records silent screen capture. Manavi records voice separately. They are
cut together at the end.

Two rules that change how you shoot when the VO comes later:

1. **Every clip must be longer than its VO.** You can trim frames, you cannot
   add them. Target length below = VO length + ~40% headroom. When in doubt,
   hold the shot two seconds longer before you stop recording.
2. **Move slowly and deliberately.** Natural speed looks frantic under a calm
   voice. Pause a full beat on anything the VO will name.

Record silent. Do not narrate while capturing · you will be tempted to rush to
keep up with a script that is not playing.

**Realistic total: ~2 min 30 s of VO.** Not 2:00. Do not try to hit 2:00 by
shooting fast; if it must come down, we cut a scene in the edit.

---

## Pre-flight · do all of this once, before any recording

- [ ] Chrome: new window, **no other tabs**, bookmarks bar hidden, no extensions
      visible. Zoom 100%.
- [ ] macOS: Do Not Disturb ON. Hide the dock. Menu bar clock is fine.
- [ ] Screen recording at **1920x1080 or higher**, 30 or 60 fps, cursor visible.
- [ ] A **private/incognito window** for Blocks A and B · the logged-out views
      are the point (no "Bolna" program name, no client data leaking on camera).
- [ ] A **normal window logged in as expert** for Block C, opened in advance so
      you are not typing an OTP on camera.
- [ ] Phone: notifications off, brightness up, screen-record enabled.
- [ ] Terminal: font size up to ~18pt, clean prompt, window sized ~1400px wide.

**Shoot in the order below, not in scene order.** It is grouped by setup so you
change device and login state as few times as possible. Scene numbers refer to
the script in `demo-video-script.md`.

---

## BLOCK A · Laptop, logged OUT (private window)

### A1 → Scene 1 · Website · hold 22 s
`realloop.in`
- Rest 2 s on the hero, still.
- Scroll slowly to the product screenshot, pause 3 s.
- Keep scrolling until **"The wall every team hits"** is centred. Hold 3 s.
- Keep going one more beat into the three cards. Stop.

### A2 → Scene 2 · Client input · hold 30 s
- Click **Start a use case** · new tab opens.
- Pause 2 s on the empty composer so the question is readable.
- Click the **first example card**. Pause 3 s (people need to read it).
- Click **Analyse**. **Do not cut the loading pulse** · let it run.
- When the plan lands, pause 2 s.
- Move the cursor **slowly** across the underlined phrases: the green one, then
  the purple one. About 2 s each, no clicking.
- Drift down over the two check cards, 2 s each.
- Right rail: click the volume box, select all, type **3000**, click **a day**.
  Pause 3 s on the updated line.
- Rest the cursor near **Start the program**. Stop. **Do not click yet.**

### A3 → Scene 2b · Start + back to website · hold 24 s
Start a fresh clip (do not continue A2 · the edit needs a cut here).
- Click **Start the program**.
- Hold 5 s on the green panel · the 48-hour line and the rough range.
- Switch to the **realloop.in tab** (still open from A1).
- Scroll to **"What happens with your request"**.
- Cursor drifts across the two stage cards, 3 s each. Hold 2 s. Stop.

---

## BLOCK B · Phone (screen recording on the device)

Record these as three separate clips.

### B1 → Scene 3 · Marketplace · hold 20 s
`marketplace.realloop.in`
- 2 s on the landing.
- Tap **Become a reviewer**.
- Scroll the form slowly: name, state, languages, phone.
- **Tap a language chip** so it visibly selects. Hold 2 s. Stop.

### B2 → Scene 4 · Screening and training · hold 30 s
- Fill the form (name, state, one language, phone) and submit.
- 3 s on the **7-question assignment** list · this shows the use case became
  tasks, which is what the VO says.
- Open the first transcription question.
- **Play the clip.** Let real audio run 3 s.
- Answer **Correct** on one clip.
- On the next clip answer **wrong on purpose**.
- **Hold 6 s on the feedback card** while it explains why. This is the most
  important 6 seconds in Block B. Stop.

### B3 → Scene 5 · Task tool · hold 28 s
- Same assignment, transcription workbench.
- Play a segment, 2 s.
- Tap **Wrong · fix it**.
- **Type Hindi in Roman and let it convert to Devanagari.** Type slowly. Hold
  3 s on the converted text. This is the shot everyone remembers.
- Tap through two more clips at working pace to show rhythm. Stop.

---

## BLOCK C · Laptop, logged IN as expert

### C1 → Scene 6 · Insight · hold 20 s
`portal.realloop.in/portal/agents?agent=Cart%20Recovery%20%C2%B7%20Marketplace`
- 2 s on the agent list, cursor on **Cart Recovery · Marketplace** (highlighted).
- Cursor to **"What to fix"**, hold 3 s.
- Cursor down to the first golden pair · **हां जी → नहीं नहीं अभी तोह नहीं चाहिए**.
- **Click ▶ and let the real audio play 3 s.** Do not cut this.
- Hold 2 s on the row. Stop.

### C2 → Scene 7 · Reliability · hold 18 s
- Same page. Cursor to the **reliability chip** in the metric row, hold 2 s.
- Click it. Reliability tab opens focused on this agent.
- Hold 6 s on the top strip · inter-panel, vs ground truth, delta vs program.
- Slow cursor across the by-agent table, showing this agent's row highlighted.
  Stop.

---

## BLOCK D · Terminal

### D1 → Scene 8 · MCP · hold 22 s
Terminal over the portal, or full screen.
- Paste the `claude mcp add` line from `/portal/connect`. **Use a rotated key.**
- Show the `✓ Added · 5 tools` confirmation, 2 s.
- Type the one-liner: *our cart recovery agent mishears addresses, put humans
  on it*
- Let `resolve_use_case` run and print the checks. Hold 5 s on the output. Stop.

---

## For Manavi · the voice

Record after the screen capture, reading from `demo-video-script.md`. Nine
blocks, in scene order. Notes:

- **Record each scene as its own take**, with 2 s of silence before and after.
  Retake freely · we pick the best of each.
- Room tone matters more than mic quality. Soft furnishings, no fan, no AC,
  phone on airplane mode.
- Pace: unhurried. The screen is already doing the work · the voice is
  explaining, not selling.
- **Scene 6 has a deliberate pause.** "The transcript said yes · *(pause 2 s
  while the call audio plays)* · the customer said no." Leave that gap in the
  take; the editor fills it with the real audio.
- Never read a number off the screen. If a number is in your take, it is wrong ·
  the script deliberately has none.
- One short pickup to record at the end, in case the edit needs a tail:
  *"RealLoop · the human layer for production AI."*

Approximate VO lengths, for reference while cutting:

| scene | VO | shoot |
|---|---|---|
| 1 · Website | 16 s | 22 s |
| 2 · Client input | 22 s | 30 s |
| 2b · Back to website | 17 s | 24 s |
| 3 · Marketplace | 14 s | 20 s |
| 4 · Screening | 23 s | 30 s |
| 5 · Task tool | 21 s | 28 s |
| 6 · Insight | 14 s | 20 s |
| 7 · Reliability | 12 s | 18 s |
| 8 · MCP | 13 s | 22 s |
| **total** | **~2:32** | **~3:34** |

---

## Assembly order

Cut in scene order: 1, 2, 2b, 3, 4, 5, 6, 7, 8.

- Keep the **real call audio** under scenes 4, 5 and 6 · duck it to ~20% under
  the VO, bring it up in scene 6's pause. It is the only thing in the video that
  cannot be faked, so let it be heard.
- Hard cuts between scenes. No transitions, no music sting on every cut. If you
  want music, one quiet bed at low volume throughout, out by scene 6.
- If it must come in under 2:30, cut **scene 2b** first (the website recap) and
  fold its one idea into scene 2's tail · it is the only scene that repeats
  something the viewer has already seen.
