// The weekly reviewer email · one builder used by BOTH the on-screen preview
// and the send path, so what you approve is byte-for-byte what goes out.
//
// Tone matters here: this lands in a reviewer's inbox, not on a dashboard.
// It leads with the work they did, reports quality only where there is enough
// shared work to be fair, and never ranks them against each other.

export type WeeklyRow = {
  email: string;
  name: string;
  active: boolean;
  total: number;
  byDay: number[];
  vibe: number;
  issue: number;
  transcription: number;
  activeDays: number;
  assigned: number;
  openNow: number;
  medianSec: number;
  perHour: number | null;
  fasterThanAudio: number;
  resubmissions: number;
  agreementPct: number | null;
  agreementN: number;
  deviation: number | null;
  transcriptionPct: number | null;
  transcriptionN: number;
  // vs ground truth · all-time, because expert-rated calls are too sparse to
  // land inside any one week
  gtPct: number | null;
  gtN: number;
  gtHigh: number;
  gtLow: number;
  gtSegPct: number | null;
  gtSegN: number;
  gtVerdict: Array<{ shift: string; n: number }>;
  // issue logging vs co-reviewers, this week
  missTotal: number;
  missCalls: number;
  missTop: Array<{ key: string; label: string; n: number }>;
};

// What each miss actually means on a call · a count teaches nobody anything,
// the sentence after it does.
const ISSUE_COACH: Record<string, string> = {
  response_appropriateness:
    "the agent answering something the customer did not ask, repeating a question already answered, or ignoring an explicit instruction. If the customer had to say it twice, that is a finding.",
  latency:
    "dead air — the gaps where the customer is left waiting mid-conversation. Easy to stop noticing once you are used to the agent's rhythm.",
  pronunciation:
    "brand names, city names and product names said the way a local would not say them. It is a finding even when the sentence is otherwise correct.",
  flag_for_review:
    "calls you cannot code cleanly. Flagging one is not a failure — an unflagged confusing call is worse than a flagged one.",
  tone: "the agent sounding brusque, robotic or oddly cheerful for what the customer just said.",
  barge_in: "the agent cutting in while the customer is still speaking."
};

// The verdict shifts worth explaining · gt→theirs
const VERDICT_COACH: Record<string, string> = {
  "wrong→correct": "you accepted an ASR line the expert marked wrong — the closest reading to \"we missed a real error\"",
  "correct→wrong": "you marked an ASR line wrong that the expert accepted",
  // the raw verdict is absent on segments the expert left unresolved · JSON
  // renders that as null, so the key is "null", not "None"
  "null→noise": "you wrote off as {noise} a segment the expert left as plain speech",
  "noise→null": "you transcribed something the expert judged to be noise",
  "null→missing": "you marked a turn missing where the expert had a transcript",
  "null→correct": "you confirmed the ASR on a segment the expert left unresolved",
  "null→wrong": "you corrected a segment the expert left unresolved",
  "wrong→noise": "you marked as {noise} a turn the expert transcribed and corrected"
};

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function pretty(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function weekLabel(weekStart: string, weekEnd: string): string {
  return `${pretty(weekStart)} – ${pretty(weekEnd)}`;
}

export function subjectFor(r: WeeklyRow, weekStart: string, weekEnd: string): string {
  return `Your week at RealLoop · ${weekLabel(weekStart, weekEnd)} · ${r.total} calls`;
}

/** Plain-text body. Deliberately not HTML: it renders identically everywhere,
 *  including the Gmail app most reviewers read on a phone. */
export function bodyFor(r: WeeklyRow, weekStart: string, weekEnd: string): string {
  const L: string[] = [];
  L.push(`Hi ${r.name.split(" ")[0]},`);
  L.push("");
  L.push(`Here is your week, ${weekLabel(weekStart, weekEnd)}.`);
  L.push("");
  L.push(`WHAT YOU DID`);
  L.push(`  ${r.total} calls reviewed across ${r.activeDays} day${r.activeDays === 1 ? "" : "s"}`);
  const parts: string[] = [];
  if (r.vibe) parts.push(`${r.vibe} vibe scored`);
  if (r.issue) parts.push(`${r.issue} issue logged`);
  if (r.transcription) parts.push(`${r.transcription} transcribed`);
  if (parts.length) L.push(`  ${parts.join(" · ")}`);
  L.push(`  ${DAY_LABEL.map((d, i) => `${d} ${r.byDay[i]}`).join("   ")}`);
  if (r.perHour) L.push(`  Typical pace: about ${r.perHour} calls an hour (median ${r.medianSec}s a call)`);
  L.push("");

  // ---- ② score accuracy against the expert ----
  if (r.gtPct !== null) {
    L.push(`SCORE ACCURACY  ·  against expert-rated calls`);
    L.push(`  ${r.gtPct}% of your scores were within 1 point of the expert (${r.gtN} shared calls)`);
    const off = r.gtHigh + r.gtLow;
    if (off > 0) {
      const lean = r.gtHigh > r.gtLow * 1.5 ? "high" : r.gtLow > r.gtHigh * 1.5 ? "low" : null;
      if (lean === "high") {
        L.push(`  When you differ you tend to score HIGH — ${r.gtHigh} above, ${r.gtLow} below.`);
        L.push(`  A call can sound polite and still fail the customer. Score what they`);
        L.push(`  walked away with, not how the agent sounded.`);
      } else if (lean === "low") {
        L.push(`  When you differ you tend to score LOW — ${r.gtLow} below, ${r.gtHigh} above.`);
        L.push(`  Erring strict is the safer direction, but a call that did the job with`);
        L.push(`  a rough edge is still a 3, not a 2.`);
      } else {
        L.push(`  Your misses are even (${r.gtHigh} high, ${r.gtLow} low) — no consistent bias.`);
      }
    }
    L.push("");
  }
  if (r.agreementPct !== null || r.deviation !== null) {
    L.push(`AGAINST THE REST OF THE PANEL  ·  this week`);
    if (r.agreementPct !== null) L.push(`  ${r.agreementPct}% within 1 point of your co-reviewers (${r.agreementN} shared ratings)`);
    if (r.deviation !== null) {
      const d = r.deviation;
      L.push(`  Your scores sit ${Math.abs(d) < 0.25 ? "right in line with the panel"
        : d > 0 ? `about ${d.toFixed(2)} above the panel on average`
        : `about ${Math.abs(d).toFixed(2)} below the panel on average`}`);
    }
    L.push("");
  }

  // ---- ③ issue logging · what a co-reviewer caught that they did not ----
  if (r.missTop.length && r.missCalls >= 10) {
    L.push(`ISSUE LOGGING  ·  what a second reviewer caught on the same call`);
    L.push(`  Across ${r.missCalls} calls someone else also reviewed, they logged`);
    L.push(`  ${r.missTotal} issue${r.missTotal === 1 ? "" : "s"} you did not. Most often:`);
    for (const m of r.missTop) L.push(`     ${m.label.padEnd(26)} ${m.n}`);
    const coach = ISSUE_COACH[r.missTop[0].key];
    if (coach) {
      L.push(`  ${r.missTop[0].label} is the big one — ${coach}`);
    }
    L.push("");
  }

  // ---- ④ transcription ----
  if (r.transcriptionPct !== null || r.gtSegPct !== null) {
    L.push(`TRANSCRIPTION`);
    if (r.transcriptionPct !== null) {
      L.push(`  ${r.transcriptionPct}% word agreement with other reviewers (${r.transcriptionN.toLocaleString()} shared segments)`);
    }
    if (r.gtSegPct !== null) {
      L.push(`  ${r.gtSegPct}% of your segments matched the expert's text (${r.gtSegN.toLocaleString()} shared segments)`);
      if (r.gtVerdict.length) {
        L.push(`  Where you and the expert judged a segment differently:`);
        for (const v of r.gtVerdict) {
          const why = VERDICT_COACH[v.shift];
          L.push(`     ${String(v.n).padStart(3)} × ${why || v.shift}`);
        }
        if (r.gtVerdict.some((v) => v.shift.endsWith("noise") || v.shift.endsWith("missing"))) {
          L.push(`  The pattern to watch: faint or very short user turns written off as`);
          L.push(`  noise. Press U on those to mute the agent channel — a quiet "haan ji"`);
          L.push(`  is usually audible once the agent's voice is out of the way.`);
        }
      }
    } else if (r.transcription > 0) {
      L.push(`  No expert-transcribed calls overlapped yours, so there is no`);
      L.push(`  ground-truth figure this week. That is a gap in our sampling, not`);
      L.push(`  in your work.`);
    }
    L.push("");
  }

  const notes: string[] = [];
  if (r.openNow > 0) notes.push(`  ${r.openNow} call${r.openNow === 1 ? "" : "s"} still open in your queue.`);
  if (r.resubmissions > 0) {
    notes.push(`  ${r.resubmissions} call${r.resubmissions === 1 ? " you" : "s you"} reviewed more than once — each pass is counted above, so redoing a call is not lost work.`);
  }
  if (r.fasterThanAudio > 0) {
    notes.push(`  ${r.fasterThanAudio} review${r.fasterThanAudio === 1 ? "" : "s"} took less than half the length of the call — worth a second listen if the audio was hard.`);
  }
  if (notes.length) { L.push(`WORTH A LOOK`); L.push(...notes); L.push(""); }

  L.push(`Thanks for the work this week.`);
  L.push(`— Nabh & Manavi, RealLoop`);
  L.push("");
  L.push(`Your queue: https://review.realloop.in`);
  return L.join("\n");
}
