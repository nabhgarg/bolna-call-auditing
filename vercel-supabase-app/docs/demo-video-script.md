# RealLoop product demo · screen recording script

~2 minutes. One take per scene; cut between scenes. Every VO block is timed to
its scene at ~2.4 words a second. Record at full width, cursor visible,
notifications off, and stay logged out until scene 6 so the anonymous views
show.

One story runs through the whole video: the **cart recovery agent**. You type it
as a client, screen for it as a reviewer, and see its findings and reliability
as the output. In the analytics it is **Cart Recovery · Marketplace**.

Two rules that hold everywhere:
- **Never speak a number.** The screen shows them; they move as data lands.
- **Scene 2 and scene 6 must be the same agent.** That continuity is the thesis.

---

## 1 · Website · ~12s

**Show:** realloop.in, logged out. Scroll slowly: hero → pause on the product
screenshot → keep scrolling so "The wall every team hits" fills the frame as you
land the last words.

**Say:**
> This is RealLoop · a marketplace for credible human judgment. Every AI in
> production eventually needs a real human · to judge it, teach it, or do what
> it still can't. Getting those humans is the wall every team hits.

## 2 · Client input · ~15s

**Show:** Click **Start a use case** → composer opens in a new tab. Click the
**first example card** (cart recovery fills in). Beat. Click **Analyse** · let
the skeleton pulse play, don't cut it. When the plan lands, **hover slowly
across the two highlighted phrases** in the bubble (green, then purple), drift
down the two check cards. In the right rail type **3000**, click **"a day"** ·
the volume line updates. End with the cursor near **Start the program**.

**Say:**
> A client describes the job in plain language. Our agent completes cart orders
> on the call · it confirms the name, the address, the quantity, the payment
> method, the discount. The engine reads that back as two checks, and shows the
> exact phrase in your own words that made it pick each one.

## 2b · Back to the website · ~10s

**Show:** Click **Start the program** · the panel answers with "We will get back
to you within 48 hours" and a rough cost range. Rest on it for a beat, then
switch back to the realloop.in tab (still open) and scroll to **"What happens
with your request"**, cursor drifting across the two stage cards.

**Say:**
> Nothing is priced until we scope it · we come back within 48 hours with the
> plan and the cost. The reviewers already exist in our marketplace, so your
> request goes through two stages · screening and training, then judgment
> logging.

## 3 · Reviewer marketplace · ~14s

**Show:** Phone (or narrow window): `marketplace.realloop.in`. Landing → tap
**Become a reviewer** → the apply form: name, state, language chips, phone. Tap
a language chip on camera.

**Say:**
> The other side is the marketplace. Reviewers join from anywhere in India,
> from a phone. No resume, no interview loop · you pick your languages and
> you're straight into a real screening task.

## 4 · Screening and training · ~20s

**Show:** Still on the phone. Submit → the 7-question assignment → open the
**first transcription question**. Play the clip. Answer one **Correct**. On the
next clip answer **wrong on purpose** · hold on the feedback card while it
explains why.

**Say:**
> The training tool is built for India's phone-first workforce. The use case
> the company entered becomes the tasks reviewers are screened and trained on ·
> for our query, transcription logging. Every answer gets instant feedback with
> the why, on real production calls, graded against our experts. Screening and
> training are the same thing here.

## 5 · The task tool · ~20s

**Show:** Same assignment, full transcription workbench. Play a segment → tap
**Wrong · fix it** → **type Hindi in Roman and let it convert to Devanagari on
camera** · give this 3 full seconds. Tap through two clips to show pace.

**Say:**
> The logging tool is built for speed and efficiency. Type Hindi in Roman, it
> converts as you go. English stays English. One tap per judgment, the audio
> follows you, and a full call takes minutes. Fast reviewers who stay accurate ·
> that is what makes human judgment affordable at production volume.

## 6 · Insight · ~10s

**Show:** Laptop, logged in. **Agent insights → Cart Recovery · Marketplace**
(same agent as scene 2). Cursor to "What to fix", then to the first golden pair ·
click **▶** and let ~2 seconds of real audio play over your pause at "listen".

**Say:**
> The agent's root cause, with the evidence behind every number. The transcript
> said yes · listen · the customer said no. A machine judge would have passed it.

## 7 · Reliability · ~10s

**Show:** Same page, click the **reliability chip** on the metric row · the
reliability tab opens focused on this agent: inter-panel, vs ground truth, delta
vs program. No scrolling, rest on the strip.

**Say:**
> And how much to trust it. A slice of calls goes through multiple reviewers,
> and against a hidden expert. Staffing agencies can't measure their own
> reliability. We publish ours.

## 8 · MCP · ~12s

**Show:** Terminal over the portal. Paste the `claude mcp add` one-liner from
/portal/connect (**fresh key**, not the old demo key). In Claude Code type one
line · *"our cart recovery agent mishears addresses, put humans on it"* · and
show `resolve_use_case` returning the checks.

**Say:**
> And once you're onboarded, it's an MCP server. Describe the problem from your
> terminal · human judgment as easy as calling an LLM judge, except this one you
> can trust.

---

**Total ~123s.**

Before recording:
- The landing page's hero screenshot is regenerated from the current product ·
  if the plan screen changes again, recapture it (scratchpad/capture_landing.js)
  or the website will show a stale version of the screen you demo live.
- Scene 8 needs a rotated MCP key.
- If a scene runs long, cut screen time, not words · the VO is already at the
  floor.
