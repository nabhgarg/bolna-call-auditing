# RealLoop product demo · screen recording script

~2 minutes. One take per scene is fine; cut between scenes. Speak at a normal
pace · every VO block below is timed to its scene at ~2.3 words a second.
Record the screen at full width, cursor visible, notifications off, and log out
(or use a private window) until scene 6 so the anonymous views show.

One story runs through the whole video: the COD order-confirmation agent. You
type it as a client, screen for it as a reviewer, and see its findings and
reliability as the output.

---

## 1 · Website · ~12s

**On screen:** realloop.in. Scroll slowly from the hero to the use-case
screenshot, pause on it, keep scrolling to "The wall every team hits".

**Say:**
> This is RealLoop · a marketplace for credible human judgment. Every AI in
> production eventually needs a real human, to judge it, teach it, or do what
> it still can't. Getting those humans is the wall every team hits.

## 2 · Client input · ~15s

**On screen:** Click **Start a use case**. The composer opens. Click the first
example card so the COD text fills in, then click **Analyse**. Let the three
check cards appear. Hover the highlighted phrases in the bubble.

**Say:**
> A client describes the problem in plain language. Our order confirmation
> agent, parcels come back refused, customers say they never agreed. The
> engine reads it back as checks · transcription, number capture, factual
> accuracy · and shows which phrase, in the client's own words, made it pick
> each one. Volume in, price out. Nothing starts until they say so.

*(If you want, change the volume to 3,000 and let the prices reprice on
camera · one beat, no VO needed.)*

## 3 · Reviewer marketplace · ~13s

**On screen:** Open marketplace.realloop.in **on your phone**, or in a narrow
browser window. Show the landing, tap **Become a reviewer**, show the short
apply form · name, state, languages, phone.

**Say:**
> The other side of the marketplace. Reviewers join from anywhere in India,
> from a phone. No CV, no interview loop · you pick your languages and you're
> straight into a real screening task.

## 4 · Screening and training · ~20s

**On screen:** Continue on the phone. The 7-question assignment. Open the
first transcription question: play the clip, mark one **Correct**, then get one
**wrong on purpose** so the feedback card explains why. Show the "why" line.

**Say:**
> And here is the core idea · the use case you just saw becomes these tasks.
> That fuzzy question, is the transcript right, is now one clip and one
> decision. You hear the call, you judge it, and you get instant feedback with
> the why, on real production audio, graded against our experts. Screening and
> training are the same thing here · only reviewers who match the experts get
> the work.

## 5 · The task tool · ~18s

**On screen:** Still in the assignment: the full transcription workbench.
Play a segment, click **Wrong · fix it**, type a correction in Roman and let it
convert to Devanagari on screen. Tap through to the next clip to show the pace.

**Say:**
> The logging tool is built for speed. Type Hindi in Roman, it converts as you
> go. English stays English. One tap per judgment, the audio follows you, and
> a full call takes minutes. Fast reviewers who stay accurate · that is what
> makes human judgment affordable at production volume.

## 6 · Insight · ~12s

**On screen:** Laptop, logged in. Agent insights, Order Confirmation selected.
Point at "What to fix", then **play the first golden pair** · "हां जी" against
"नहीं नहीं अभी तोह नहीं चाहिए". Let a second of the audio play.

**Say:**
> Output. The agent's root cause, ranked, with the evidence behind every
> number. The transcript said yes · listen · the customer said no. A machine
> judge scoring that transcript would have passed it.

## 7 · Reliability · ~10s

**On screen:** Click the **86% reliability chip** on the same page. The
reliability tab opens focused on this agent: inter-panel, vs ground truth,
delta vs program.

**Say:**
> And how much to trust it. Reviewer agreement, and agreement with a hidden
> expert, per agent, published. Most vendors can't tell you their reliability.
> It's a tab in ours.

## 8 · MCP · ~12s

**On screen:** Open a terminal over the portal. Paste the `claude mcp add`
one-liner from /portal/connect, then in Claude Code type a one-line use case
and show `resolve_use_case` returning checks and the estimate.

**Say:**
> And for engineers, the whole thing is an MCP server. Describe the problem
> from your terminal, same engine, same panel, same prices · as easy as
> calling an LLM judge, except this one comes with humans you can trust.

---

**Total ~112s.**

Recording notes:
- Scene 2 and scene 6 must show the SAME use case and agent · that continuity
  is the story.
- Scene 6: today's live numbers are 89 scored calls / 175 reviewed, avg 2.7.
  Do not quote numbers in VO · they move as data lands; the script never says
  one aloud.
- Scene 8: use a fresh demo key, not the one from the old video.
- If a scene runs long, cut screen time, not words · the VO lines are already
  at the floor.
