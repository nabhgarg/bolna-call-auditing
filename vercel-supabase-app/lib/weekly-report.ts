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

  const q: string[] = [];
  if (r.agreementPct !== null) {
    q.push(`  Agreement with other reviewers: ${r.agreementPct}% within 1 point, across ${r.agreementN} shared ratings`);
  }
  if (r.deviation !== null) {
    const d = r.deviation;
    const how = Math.abs(d) < 0.25 ? "right in line with the panel"
      : d > 0 ? `about ${d.toFixed(2)} above the panel on average`
      : `about ${Math.abs(d).toFixed(2)} below the panel on average`;
    q.push(`  Your scores sit ${how}`);
  }
  if (r.transcriptionPct !== null) {
    q.push(`  Transcription match with other reviewers: ${r.transcriptionPct}% of words, across ${r.transcriptionN} shared segments`);
  }
  if (q.length) {
    L.push(`HOW IT LINED UP`);
    L.push(...q);
    L.push(`  (These compare only the calls more than one person reviewed.)`);
    L.push("");
  }

  const notes: string[] = [];
  if (r.openNow > 0) notes.push(`  ${r.openNow} call${r.openNow === 1 ? "" : "s"} still open in your queue.`);
  if (r.resubmissions > 0) notes.push(`  ${r.resubmissions} review${r.resubmissions === 1 ? "" : "s"} you submitted more than once.`);
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
