// Shapes shared by /api/ops and the ops console. Kept in one place so a field
// renamed on the server breaks the page at build time rather than at 09:12 on
// a Monday.

export type Spark = { h: string; c: string };

export type OpsUseCase = { key: string; name: string; inFlight: number; ok: boolean };

export type OpsClient = {
  key: string;
  name: string;
  alerts: number;
  useCases: OpsUseCase[];
  runway: string;
  runwaySub: string;
  runwayDays: number;
  totalInFlight: number;
  revenueInr: number;
};

export type OpsDayStat = { label: string; assigned: number; done: number };

export type OpsReviewer = {
  email: string;
  name: string;
  useCase: string;
  assigned: number;
  done: number;
  pendingTotal: number;
  pacePct: number;
  state: "on track" | "behind" | "idle" | "done";
  spark: number[];
  last: string;
  lastIso: string;
  idleDays: number;
  history: { label: string; value: number }[];
  /** last 14 days · assigned = queue rows imported that day, done = reviews submitted that day */
  daily: OpsDayStat[];
  /** last 8 weeks, same definitions summed per week · label is the week's first day */
  weekly: OpsDayStat[];
};

export type OpsAlert = {
  sev: "red" | "amber";
  text: string;
  short: string;
  when: string;
};

export type OpsCheck = { name: string; value: string; tripped: boolean };


export type OpsDelivery = {
  name: string;
  /** unique calls in this group */
  calls: number;
  vibeScored: number;
  low: number;          // rated 1 or 2 in vibe · the issue-logging universe
  issueLogged: number;  // of `low`
  transcribed: number;
  neverReviewed: number;
};

export type OpsAgent = { name: string; calls: number; score: number | null; topIssue: string };

export type OpsAgreement = {
  name: string;
  value: string;
  caption: string;
  spark: number[];
  tone: "ok" | "warn" | "plain";
};

export type OpsCalib = { name: string; value: number; dev: number[]; flag: boolean };

export type OpsMatrixRow = {
  batch: string;
  /** date the batch's queue rows were written */
  assignedOn: string;
  per: { name: string; assigned: number; done: number }[];
  assigned: number;
  done: number;
};

export type OpsGtRow = { name: string; pct: number | null; n: number };

export type OpsClientDetail = {
  key: string;
  name: string;
  useCases: { key: string; name: string }[];
  trendDaily: { label: string; value: number }[];
  trendWeekly: { label: string; value: number }[];
  stats: { value: string; delta: string; label: string; tone: "ok" | "warn" | "plain" }[];
  funnel: { label: string; reviewed: number; low: number; logged: number }[];
  funnelBacklog: { count: number; oldestDays: number };
  issueMix: { name: string; bars: number[]; total: number; deltaPct: number | null }[];
  /** issue-logging agreement · Jaccard of category sets on shared calls */
  issueAgreement: { vsPeers: { pct: number | null; n: number }; vsGT: { pct: number | null; n: number } };
  /** issue findings captured per day (14d) and per week (8w), transcription excluded */
  issueTrend: { daily: { label: string; value: number }[]; weekly: { label: string; value: number }[] };
  /** vibe-work batches × reviewers · calls done of assigned */
  vibeMatrix: OpsMatrixRow[];
  /** per reviewer · % of their scores within ±1 of the expert score on shared calls */
  vibeVsGT: { rows: OpsGtRow[]; overall: number | null; gtCalls: number };
  /** per reviewer · % of their scores within ±1 of each co-rater on shared calls */
  vibeVsPeers: OpsGtRow[];
  deliveries: OpsDelivery[];
  agents: OpsAgent[];
  agreement: OpsAgreement[];
  transcription: {
    /** daily panel agreement, each with the base it stands on */
    panel: { label: string; value: number; segs: number; calls: number }[];
    /** same measure by week (8w) · cross-day overlap inside a week counts here */
    weekly: { label: string; value: number; segs: number; calls: number }[];
    /** the denominator, stated · all-time and this week */
    base: { segs: number; calls: number; pct: number | null; weekSegs: number; weekCalls: number; weekPct: number | null };
    /** per reviewer · agreement with co-raters and with experts, per window ·
     *  day = today, week = last 7 days, all = whole history */
    reviewers: {
      name: string;
      panel: Record<"day" | "week" | "all", { pct: number | null; n: number }>;
      gt: Record<"day" | "week" | "all", { pct: number | null; n: number }>;
    }[];
    gt: { i: number; value: number }[];
    lastCalibrated: string;
    /** segment-level word agreement of the panel against expert transcriptions */
    gtAgreement: number | null;
    gtSegments: number;
    gtCalls: number;
  };
  calib: OpsCalib[];
  flagRate: { label: string; pct: number }[];
  resub: { name: string; pct: number; n: string }[];
};

export type OpsPayload = {
  asOf: string;
  today: string;
  clients: OpsClient[];
  reviewers: OpsReviewer[];
  alerts: OpsAlert[];
  checks: OpsCheck[];
  totals: { done: number; assigned: number };
  details: Record<string, OpsClientDetail>;
  problems: string[];
};
