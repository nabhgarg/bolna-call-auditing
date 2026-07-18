// Bolna telemetry helpers. The `data` blob from Bolna carries per-turn ASR
// timings whose clock differs from the recording's clock (delivery delays), so
// user-turn entries are used as ANCHORS: their relative spacing is exact, and
// the client solves a constant offset against the recording waveform.

export type TurnAnchor = { text: string; startSec: number; endSec: number };

export function extractAnchors(raw: unknown): TurnAnchor[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>;
    const turns = (parsed as any)?.transcriber_latencies?.turn_latencies;
    if (!Array.isArray(turns)) return [];
    return turns
      .filter((t: any) => t && typeof t.final_transcript === "string" && Number.isFinite(t.asr_turn_start_ms))
      .map((t: any) => ({
        text: String(t.final_transcript).trim(),
        startSec: t.asr_turn_start_ms / 1000,
        endSec: Number.isFinite(t.asr_finalized_ms) ? t.asr_finalized_ms / 1000 : t.asr_turn_start_ms / 1000 + 1
      }))
      .filter((a: TurnAnchor) => a.text.length > 0)
      .sort((a: TurnAnchor, b: TurnAnchor) => a.startSec - b.startSec);
  } catch {
    return [];
  }
}
