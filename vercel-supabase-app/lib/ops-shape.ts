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
};

export type OpsAlert = {
  sev: "red" | "amber";
  text: string;
  short: string;
  when: string;
};

export type OpsCheck = { name: string; value: string; tripped: boolean };

export type OpsBatchOption = { key: string; name: string; pool: number };

export type OpsDelivery = {
  name: string;
  date: string;
  expected: number | null;
  actual: number;
  work: { name: string; pct: number }[];
  remainder: number;
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
  deliveries: OpsDelivery[];
  agents: OpsAgent[];
  agreement: OpsAgreement[];
  transcription: { panel: { label: string; value: number }[]; gt: { i: number; value: number }[]; lastCalibrated: string };
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
  batchOptions: OpsBatchOption[];
  totals: { done: number; assigned: number };
  details: Record<string, OpsClientDetail>;
  problems: string[];
};
