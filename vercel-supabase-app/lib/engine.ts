// RealLoop Engine · task -> sub-tasks -> screening -> process.
//
// "Give us a task, and within days you have a running human pipeline."
// The engine does three things, in this order:
//   1. DECOMPOSE  a client's plain-language task into sub-tasks a screened
//      human can do *accurately* (small, decidable, one judgment each).
//   2. SCREEN     say what each sub-task's screening assignment must test, so
//      only reviewers who prove they can do it get routed the work.
//   3. DESIGN     the process that turns their work into fast, accurate output:
//      routing (human vs machine judge), redundancy, hidden ground truth,
//      throughput and panel size.
//
// Rates are the single ₹34-table shared with lib/use-case-catalog.ts (the New
// use case screen). Every capability below is one we actually run today, with its REAL measured
// numbers (human/judge agreement from lib/portal-reliability.json, rates from
// the live marketplace). The LLM maps a task onto these; anything it proposes
// outside the library is returned as `novel: true` so we never imply we already
// deliver something we don't.

export type Lane = "human_only" | "judge_assist" | "judge_owned";

export type Capability = {
  key: string;
  label: string;
  /** what the reviewer is actually shown, and the one judgment they make */
  unitOfWork: string;
  decision: string;
  unit: string;              // what we bill per
  rateInr: number;
  lane: Lane;
  /** why the lane is what it is · this is the routing argument, not a claim */
  laneReason: string;
  /** measured: panel reliability, and the judge's agreement with the panel */
  humanScore: number;
  judgeScore: number | null; // null = never measured (no overlap yet)
  /** units a trained reviewer completes per hour (from delivered work) */
  perHour: number;
  /** what the screening assignment must prove before this work is routed */
  screening: string;
  /** how many independent reviewers a unit needs before we trust it */
  redundancy: number;
  match: RegExp;
};

export const CAPABILITIES: Capability[] = [
  {
    key: "transcription",
    label: "Transcription accuracy",
    unitOfWork: "One call, every user turn, played segment by segment",
    decision: "Is this segment what the customer actually said? If not, write what they said.",
    unit: "call", rateInr: 34, lane: "human_only",
    laneReason: "The judge reads the transcript, so it cannot hear the transcript being wrong. It scores 0 here.",
    humanScore: 94, judgeScore: 0, perHour: 4,
    screening: "Transcribe a real code-mixed call end to end: Devanagari for Hindi, Roman for English, numbers as spoken. Must catch the planted error without false-flagging clean turns.",
    redundancy: 2,
    match: /transcri|devanagari|hinglish|code.?mix|hindi|regional|tamil|telugu|marathi|bengali|accent|speech.to.text|asr|subtitle/i,
  },
  {
    key: "input_capture",
    label: "Number & input capture",
    unitOfWork: "The moment the customer gives a value, plus what the bot recorded",
    decision: "Did the agent capture what the customer actually said?",
    unit: "review", rateInr: 21, lane: "human_only",
    laneReason: "The failure is audible, not textual: the transcript often looks fine while the value is missing. Judge agreement measured at 37%.",
    humanScore: 84, judgeScore: 37, perHour: 12,
    screening: "Spot a call where the customer answers but the agent never registers it, and log it as input capture rather than a wrong response.",
    redundancy: 2,
    match: /number|amount|otp|digit|input|capture|phone|order id|pin ?code|address|quantity|date|booking|slot|price the (customer|user) (said|gave)/i,
  },
  {
    key: "pronunciation",
    label: "Pronunciation",
    unitOfWork: "The moment a name, place or brand is spoken by the agent",
    decision: "Did the agent say it the way a native speaker would?",
    unit: "review", rateInr: 18, lane: "human_only",
    laneReason: "Purely acoustic. The judge has no audio and produces no findings at all.",
    humanScore: 92, judgeScore: 0, perHour: 14,
    screening: "Hear a mispronounced customer name or city in a real call and tag it correctly (proper noun vs city vs general).",
    redundancy: 2,
    match: /pronounc|name|city|brand|proper noun|accent|says? it wrong|mispronounc/i,
  },
  {
    key: "factual",
    label: "Factual accuracy vs knowledge base",
    unitOfWork: "Each claim the agent makes, next to the source of truth",
    decision: "Is this claim supported by the knowledge base?",
    unit: "review", rateInr: 35, lane: "judge_assist",
    laneReason: "The judge can check a claim against a document at scale, but it agrees with the panel only 46% of the time, so humans verify what it flags.",
    humanScore: 85, judgeScore: 46, perHour: 10,
    screening: "Given a knowledge base excerpt, separate a claim that is merely unsupported from one that is actually wrong.",
    redundancy: 2,
    match: /fact|knowledge base|\bkb\b|policy|price|catalog|hallucinat|made up|invent|accurate|claim|product detail|offer|discount|refund/i,
  },
  {
    key: "language",
    label: "Language switching",
    unitOfWork: "Turns where the agent changes language",
    decision: "Did the agent switch language against what the customer asked for?",
    unit: "review", rateInr: 28, lane: "judge_owned",
    laneReason: "Fully visible in the transcript. Judge and panel agree 85%, so the judge owns it and humans spot-check.",
    humanScore: 86, judgeScore: 85, perHour: 16,
    screening: "Tell an unprompted language switch apart from the customer leading the switch.",
    redundancy: 1,
    match: /language|switch|hindi.*english|english.*hindi|bilingual|speaks? in|code.?switch/i,
  },
  {
    key: "response",
    label: "Response appropriateness",
    unitOfWork: "A turn where the agent's answer does not fit what was asked",
    decision: "What kind of wrong is it: irrelevant, repeated, or instruction not followed?",
    unit: "review", rateInr: 28, lane: "judge_assist",
    laneReason: "The judge finds candidates across every call; it agrees with the panel 46% of the time, so a human decides the type.",
    humanScore: 85, judgeScore: 46, perHour: 12,
    screening: "Classify a real failing turn into the right error type instead of a generic 'bad response'.",
    redundancy: 3,
    match: /wrong (response|answer)|irrelevant|off.topic|repeat|loop|stuck|instruction|follow|script|guardrail|refus|escalat|context/i,
  },
  {
    key: "vibe",
    label: "Overall call quality",
    unitOfWork: "The whole call, start to finish",
    decision: "Score it 1 to 4: did this call do its job for the customer?",
    unit: "review", rateInr: 28, lane: "human_only",
    laneReason: "A holistic judgment. We measure it against hidden expert-rated calls rather than trusting a machine score.",
    humanScore: 88, judgeScore: null, perHour: 15,
    screening: "Score real calls within 1 point of our experts, consistently, across a calibration set.",
    redundancy: 3,
    match: /overall|quality|good|bad|customer experience|satisfact|works? well|score the call|rate the call|vibe/i,
  },
  {
    key: "tone",
    label: "Tone & naturalness",
    unitOfWork: "The agent's delivery across the call",
    decision: "Does it sound human, or robotic and off-pace?",
    unit: "review", rateInr: 16, lane: "human_only",
    laneReason: "Pacing, warmth and awkward pauses are audible only. The judge sees text and misses all of it.",
    humanScore: 85, judgeScore: null, perHour: 15,
    screening: "Separate a genuinely robotic delivery from a merely short one.",
    redundancy: 3,
    match: /tone|natural|robot|human.?like|rude|polite|empath|pace|pause|awkward|sound/i,
  },
  {
    key: "text_annotation",
    label: "Text output review",
    unitOfWork: "One model output next to its prompt",
    decision: "Is it correct, complete and appropriately toned?",
    unit: "item", rateInr: 18, lane: "judge_assist",
    laneReason: "Text is fully machine-readable, so the judge pre-screens; humans arbitrate the disagreements that matter.",
    humanScore: 87, judgeScore: 46, perHour: 40,
    screening: "Grade model outputs against a rubric and match our experts on the borderline cases.",
    redundancy: 2,
    match: /chat|text|message|email|summar|classif|label|annotat|writing|content|prompt|completion|rag|document/i,
  },
];

export const LANE_LABEL: Record<Lane, string> = {
  human_only: "100% human",
  judge_assist: "judge + human",
  judge_owned: "judge owns it",
};

export type SubTask = Capability & { novel?: boolean; why?: string };

export type EngineDesign = {
  subtasks: SubTask[];
  screening: { capability: string; proves: string }[];
  process: {
    callsPerWeek: number;
    sampledPerWeek: number;
    reviewerHoursPerWeek: number;
    panelSize: number;
    hiddenGtPerWeek: number;
    redundancy: number;
    weeklyCostInr: number;
    daysToLive: number;
    reliabilityTarget: { interPanel: number; vsGroundTruth: number };
  };
  source: "engine" | "keyword";
};

/** Deterministic decomposition · also the fallback when the model is unavailable. */
export function matchCapabilities(task: string): Capability[] {
  const hits = CAPABILITIES.filter((c) => c.match.test(task));
  // a task always needs at least a quality read, so nothing ships unmeasured
  if (hits.length === 0 && task.trim().length > 20) return [CAPABILITIES.find((c) => c.key === "vibe")!];
  return hits;
}

/** Process design: redundancy, hidden ground truth, throughput, panel size, cost. */
export function designProcess(subtasks: Capability[], callsPerWeek: number): EngineDesign["process"] {
  const sampleRate = callsPerWeek > 2000 ? 0.2 : callsPerWeek > 500 ? 0.35 : 0.6;
  const sampled = Math.max(60, Math.round(callsPerWeek * sampleRate));
  const redundancy = subtasks.length ? Math.max(...subtasks.map((s) => s.redundancy)) : 3;
  // reviewer-hours = for each sub-task, sampled units x its redundancy / throughput
  const hours = subtasks.reduce((h, s) => h + (sampled * s.redundancy) / s.perHour, 0);
  const weeklyCost = subtasks.reduce((c, s) => c + sampled * s.redundancy * s.rateInr, 0);
  return {
    callsPerWeek,
    sampledPerWeek: sampled,
    reviewerHoursPerWeek: Math.round(hours),
    panelSize: Math.max(3, Math.ceil(hours / 20)),      // ~20 productive hrs/reviewer/week
    hiddenGtPerWeek: Math.max(12, Math.round(sampled * 0.1)),
    redundancy,
    weeklyCostInr: Math.round(weeklyCost),
    daysToLive: subtasks.some((s) => s.lane === "human_only") ? 5 : 3,
    reliabilityTarget: { interPanel: 88, vsGroundTruth: 85 },
  };
}

export function buildDesign(task: string, callsPerWeek: number, caps?: Capability[]): EngineDesign {
  const subtasks = (caps && caps.length ? caps : matchCapabilities(task)) as SubTask[];
  return {
    subtasks,
    screening: subtasks.map((s) => ({ capability: s.label, proves: s.screening })),
    process: designProcess(subtasks, callsPerWeek),
    source: "keyword",
  };
}
