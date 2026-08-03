import { buildBody } from "./weekly-report-body";
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
  gtGap: number | null;
  noiseForSpeech: number;
  speechForNoise: number;
  shortPct: number | null;
  shortN: number;
  longPct: number | null;
  longN: number;
  wordsDropped: number;
  wordsAdded: number;
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

/** Plain-text body · the copy lives in weekly-report-body.ts.
 *  Plain text, not HTML: it renders the same everywhere, including the Gmail
 *  app on a phone, which is where the panel reads it. */
export function bodyFor(r: WeeklyRow, weekStart: string, weekEnd: string): string {
  return buildBody(r, weekLabel(weekStart, weekEnd));
}
