// Server-side catalog for the New use case screen (wireframe 23a/23b).
// Prices and volume rules live HERE, never in the component, and the estimate
// is always recomputed on the server so a client-side total can't be trusted.

export type Routing = "human" | "judge_human_verified" | "judge";
export type Unit = "per_call" | "per_verified";

export type CheckDef = {
  id: string;
  name: string;
  routing: Routing;
  /** ₹ per reviewed call (human) or per judged call (judge lane) */
  priceInr: number;
  /** judge lane only: ₹ per call a human verifies */
  verifyInr?: number;
  /** share of calls reviewed · 1 = every call */
  samplePct: number;
  /** judge lane only: share of judged calls the judge flags for human verification */
  flagPct?: number;
  unit: Unit;
  /** why this lane · shown under the check, in plain language */
  laneReason: string;
  /** what the reviewer actually does, appended after the "because you said" clause */
  work: string;
  /** matches the client's own description */
  match: RegExp;
};

export const CHECKS: CheckDef[] = [
  {
    // One human pass covers both halves of the same job · a reviewer who writes
    // what was actually said has, by the same listen, checked what the bot
    // registered. Splitting them into two priced checks made the plan look
    // busier without doing more work.
    id: "transcription", name: "Input capture · ASR and transcription", routing: "human",
    priceInr: 34, samplePct: 0.4, unit: "per_call",
    work: "A reviewer listens and writes what was actually said · Devanagari against Roman, numbers as spoken, names and addresses · then checks it against what the bot registered.",
    laneReason: "A machine judge cannot grade this, it scores against the same audio it already misheard, and the transcript often looks fine while the value is missing.",
    match: /mishear|misheard|hear|transcri|accent|fast|mumbl|switch(es|ing)? language|hinglish|devanagari|garbl|unclear|speech|order number|address|amount|otp|digit|number|quantity|pin ?code|phone|booking|date|wrong(ly)? (captur|record|regist|tagg)|gets? .* wrong/i,
  },
  {
    id: "factual", name: "Factual accuracy", routing: "judge_human_verified",
    priceInr: 4, verifyInr: 31, samplePct: 1, flagPct: 0.1, unit: "per_verified",
    work: "Every claim checked against your policy doc · the judge reads all calls, humans verify the ones it flags so a false alarm never reaches you.",
    laneReason: "",
    match: /policy|refund|not what we (actually )?do|wrong info|incorrect|tells? customers|claim|price|offer|knowledge|document|compliance breach|says? something/i,
  },
  {
    id: "pronunciation", name: "Pronunciation of brand and city names", routing: "human",
    priceInr: 18, samplePct: 0.4, unit: "per_call",
    work: "A reviewer hears names, cities and brands the way your customers hear them.",
    laneReason: "Purely acoustic, so a judge reading text produces nothing here.",
    match: /pronounc|brand name|city name|says? my name|name wrong/i,
  },
  {
    id: "tone", name: "Tone and naturalness", routing: "human",
    priceInr: 16, samplePct: 0.4, unit: "per_call",
    work: "Whether it sounds like a person or a machine · pacing, warmth, awkward pauses.",
    laneReason: "Delivery is audible only.",
    match: /tone|rude|robot|natural|empath|polite|sounds?|pace|abrupt/i,
  },
  {
    id: "barge_in", name: "Talking over the customer", routing: "judge", priceInr: 3, samplePct: 1, unit: "per_call",
    work: "Every interruption, measured from the call timing.",
    laneReason: "Measured from telemetry, so no human time is spent on it.",
    match: /interrupt|talks? over|cuts? (them |people |the customer )?off|barge/i,
  },
  {
    id: "compliance", name: "Script and compliance lines", routing: "judge_human_verified",
    priceInr: 4, verifyInr: 8, samplePct: 1, flagPct: 0.1, unit: "per_verified",
    work: "Whether the required lines were actually said, in full.",
    laneReason: "",
    match: /complian|disclosure|mandatory|required line|script|regulat|consent|recorded line/i,
  },
];

export const DEFAULT_SUGGESTION_IDS = ["pronunciation", "tone", "barge_in", "compliance"];

/** ₹ per week for one check at a given call volume. */
export function lineTotal(c: CheckDef, callsPerWeek: number): number {
  const reviewed = Math.round(callsPerWeek * c.samplePct);
  if (c.routing === "judge_human_verified") {
    const verified = Math.round(reviewed * (c.flagPct ?? 0.1));
    return reviewed * c.priceInr + verified * (c.verifyInr ?? 0);
  }
  return reviewed * c.priceInr;
}

export type Cadence = "recurring" | "one_time";

export function volumeLine(c: CheckDef, callsPerWeek: number, cadence: Cadence = "recurring"): string {
  const reviewed = Math.round(callsPerWeek * c.samplePct);
  const wk = cadence === "recurring" ? " / wk" : "";
  if (c.routing === "judge_human_verified") {
    const verified = Math.round(reviewed * (c.flagPct ?? 0.1));
    return `${verified.toLocaleString()} verified${wk}`;
  }
  if (c.samplePct >= 1) return `${reviewed.toLocaleString()} calls${wk}, all calls`;
  return `${reviewed.toLocaleString()} calls${wk} at a ${Math.round(c.samplePct * 100)}% sample`;
}

export function priceLabel(c: CheckDef): string {
  if (c.routing === "judge_human_verified") return `₹${c.priceInr} + ₹${c.verifyInr} verified`;
  return `₹${c.priceInr} per call`;
}

/** Mean production call length across 1,727 real calls with a duration (80.5s).
 *  Used only to express the estimate as a per-hour rate · it never changes what
 *  is billed, which is per call actually reviewed. */
export const AVG_CALL_SEC = 80.5;

/** Hours of audio a human actually listens to · a call sampled by two checks is
 *  listened to twice, so passes are summed rather than de-duplicated. */
export function reviewHours(ids: string[], callsPerWeek: number, avgCallSec = AVG_CALL_SEC): number {
  const passes = ids
    .map((id) => CHECKS.find((c) => c.id === id))
    .filter((c): c is CheckDef => !!c)
    .reduce((s, c) => {
      const reviewed = Math.round(callsPerWeek * c.samplePct);
      // the judge listens to nothing · only the verified slice reaches a human
      if (c.routing === "judge_human_verified") return s + Math.round(reviewed * (c.flagPct ?? 0.1));
      if (c.routing === "judge") return s;
      return s + reviewed;
    }, 0);
  return (passes * avgCallSec) / 3600;
}

export function estimate(ids: string[], callsPerWeek: number) {
  const lines = ids
    .map((id) => CHECKS.find((c) => c.id === id))
    .filter((c): c is CheckDef => !!c)
    .map((c) => ({ checkId: c.id, inr: lineTotal(c, callsPerWeek) }));
  const weeklyInr = lines.reduce((s, l) => s + l.inr, 0);
  const hours = reviewHours(ids, callsPerWeek);
  return {
    weeklyInr,
    lines,
    hours: Math.round(hours * 10) / 10,
    perHourInr: hours > 0 ? Math.round(weeklyInr / hours) : 0,
  };
}

/** Deterministic mapping · also the fallback when the model is unavailable. */
export function matchChecks(description: string): CheckDef[] {
  const core = CHECKS.filter((c) => DEFAULT_SUGGESTION_IDS.indexOf(c.id) === -1);
  const hits = core.filter((c) => c.match.test(description));
  return hits.length ? hits : core.slice(0, 1);
}

/** Facts we can read straight off the description. */
export function extractLanguages(description: string): string[] {
  const found = ["Hindi", "Hinglish", "English", "Tamil", "Telugu", "Marathi", "Bengali", "Kannada", "Gujarati"]
    .filter((l) => new RegExp(l, "i").test(description));
  if (/mix|switch|code.?switch/i.test(description) && found.includes("Hindi") && found.includes("English") && !found.includes("Hinglish")) {
    found.splice(1, 0, "Hinglish");
  }
  return found.length ? found : ["Hindi", "English"];
}
