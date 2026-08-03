import type { WeeklyRow } from "./weekly-report";

// The reviewer-facing copy.
//
// Written in plain English on purpose. The panel reads English well but it is
// not most people's first language, and this arrives on a phone. So: short
// sentences, common words, no idioms ("erring strict", "coin flip"), and a
// number is always followed by what to do about it.
//
// Rules this file follows:
//   - say the number, then say what it means, then say the action
//   - never print a metric name a reviewer has not been taught
//   - only show a section when there is enough data to be fair
//   - no ranking against other reviewers by name

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const ISSUE_HELP: Record<string, string> = {
  response_appropriateness:
    "This means the agent gave a reply that did not fit. It answered something the customer did not ask. Or it asked again for something the customer already said. If the customer had to repeat themselves, log it.",
  latency:
    "This means long silence. The customer is left waiting in the middle of the call. It is easy to stop noticing once you get used to the agent's speed.",
  pronunciation:
    "This means brand names, city names and product names said wrongly. Log it even when the rest of the sentence is fine.",
  flag_for_review:
    "This means calls you cannot decide about. Flagging is not a mistake. A confusing call left unflagged is worse.",
  tone: "This means the agent sounded rude, flat, or too cheerful for the situation.",
  barge_in: "This means the agent started talking while the customer was still speaking."
};

function line(label: string, n: number | string, width = 26) {
  return `     ${String(label).padEnd(width)} ${n}`;
}

/** Hard-wrap to ~72 chars. Plain-text mail is not re-flowed by Gmail, so a
 *  long paragraph becomes one unbroken line on a phone. */
function wrap(text: string, indent = "  ", width = 72): string[] {
  const out: string[] = [];
  let cur = indent;
  for (const word of text.split(/\s+/)) {
    if (cur.length + word.length + 1 > width && cur.trim()) { out.push(cur); cur = indent; }
    cur += (cur === indent ? "" : " ") + word;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function buildBody(r: WeeklyRow, weekLabel: string): string {
  const L: string[] = [];
  const first = r.name.split(" ")[0];

  L.push(`Hi ${first},`);
  L.push("");
  L.push(`Here is your work for ${weekLabel}.`);
  L.push("");

  // ---------- 1. what you did ----------
  L.push(`YOUR WORK`);
  L.push(`  ${r.total} calls in ${r.activeDays} day${r.activeDays === 1 ? "" : "s"}`);
  const parts: string[] = [];
  if (r.vibe) parts.push(`${r.vibe} vibe score`);
  if (r.issue) parts.push(`${r.issue} issue logging`);
  if (r.transcription) parts.push(`${r.transcription} transcription`);
  if (parts.length) L.push(`  ${parts.join(" · ")}`);
  L.push(`  ${DAY_LABEL.map((d, i) => `${d} ${r.byDay[i]}`).join("   ")}`);
  if (r.perHour) L.push(`  About ${r.perHour} calls per hour.`);
  if (r.resubmissions > 0) {
    L.push(`  You did ${r.resubmissions} call${r.resubmissions === 1 ? "" : "s"} twice. Both times are counted above.`);
  }
  L.push("");

  // ---------- 2. vibe score ----------
  if (r.gtPct !== null) {
    L.push(`VIBE SCORE`);
    L.push(`  We compare your score with the expert score on the same call.`);
    L.push(`  You matched the expert (within 1 point) on ${r.gtPct}% of ${r.gtN} calls.`);
    L.push("");
    const gap = r.gtGap;
    if (r.gtHigh > r.gtLow * 1.5) {
      L.push(`  When you are different, you usually score HIGHER than the expert.`);
      L.push(`  Higher on ${r.gtHigh} calls, lower on ${r.gtLow}.`);
      if (gap !== null && Math.abs(gap) >= 0.1) L.push(`  On average you are ${Math.abs(gap).toFixed(1)} points above.`);
      L.push(`  WHAT TO DO: a call can sound polite and still fail the customer.`);
      L.push(`  Ask: did the customer get what they called for? If not, it is a 1 or 2,`);
      L.push(`  even when the agent was friendly.`);
    } else if (r.gtLow > r.gtHigh * 1.5) {
      L.push(`  When you are different, you usually score LOWER than the expert.`);
      L.push(`  Lower on ${r.gtLow} calls, higher on ${r.gtHigh}.`);
      if (gap !== null && Math.abs(gap) >= 0.1) L.push(`  On average you are ${Math.abs(gap).toFixed(1)} points below.`);
      L.push(`  WHAT TO DO: being strict is safer than being soft, so this is not a`);
      L.push(`  big problem. But if the customer got what they wanted, give a 3 even`);
      L.push(`  if the agent sounded rough on the way.`);
    } else {
      L.push(`  Your differences go both ways (${r.gtHigh} higher, ${r.gtLow} lower).`);
      L.push(`  You are not too strict or too soft. Keep going the same way.`);
    }
    L.push("");
  }
  if (r.agreementPct !== null) {
    L.push(`  You also matched other reviewers on ${r.agreementPct}% of ${r.agreementN} shared ratings.`);
    L.push("");
  }

  // ---------- 3. issue logging ----------
  if (r.missTop.length && r.missCalls >= 10) {
    L.push(`ISSUE LOGGING`);
    L.push(`  On ${r.missCalls} calls, another reviewer looked at the same call.`);
    L.push(`  They logged ${r.missTotal} issue${r.missTotal === 1 ? "" : "s"} that you did not log. Most common:`);
    for (const m of r.missTop) L.push(line(m.label, m.n));
    const help = ISSUE_HELP[r.missTop[0].key];
    if (help) L.push(...wrap(`WHAT TO DO: ${help}`));
    L.push("");
  }

  // ---------- 4. transcription ----------
  if (r.transcriptionPct !== null || r.gtSegPct !== null) {
    L.push(`TRANSCRIPTION`);
    if (r.transcriptionPct !== null) {
      L.push(`  Your words matched other reviewers on ${r.transcriptionPct}% of ${r.transcriptionN.toLocaleString()} shared parts.`);
    }
    if (r.gtSegPct !== null) {
      L.push(`  Your words matched the expert on ${r.gtSegPct}% of ${r.gtSegN.toLocaleString()} shared parts.`);
    }
    L.push("");

    // long vs short · the strongest and most fixable pattern
    if (r.shortPct !== null && r.longPct !== null && r.shortPct - r.longPct >= 10) {
      L.push(`  Short and long turns are very different for you:`);
      L.push(line("1 to 3 words", `${r.shortPct}% correct`, 22));
      L.push(line("4 words or more", `${r.longPct}% correct`, 22));
      L.push(`  WHAT TO DO: long turns are where the mistakes are. On a long turn,`);
      L.push(`  play it twice. Type the first half, then play again for the second half.`);
      L.push(`  Do not try to catch the whole sentence in one listen.`);
      L.push("");
    }

    // the noise boundary · the biggest single problem across the panel
    if (r.noiseForSpeech >= 5 || r.speechForNoise >= 5) {
      if (r.noiseForSpeech > r.speechForNoise) {
        L.push(`  You marked ${r.noiseForSpeech} part${r.noiseForSpeech === 1 ? "" : "s"} as {noise}. The expert heard real words there.`);
        L.push(`  This is the most common mistake in the whole team right now.`);
        L.push(`  WHAT TO DO: before you mark {noise}, press U. This turns off the`);
        L.push(`  agent voice and plays only the customer. A soft "haan ji" or "ok" is`);
        L.push(`  usually easy to hear once the agent voice is gone.`);
      } else {
        L.push(`  You typed words on ${r.speechForNoise} part${r.speechForNoise === 1 ? "" : "s"} where the expert heard only noise.`);
        L.push(`  WHAT TO DO: if you are guessing at the words, mark {noise} instead.`);
        L.push(`  A guess is worse than an honest {noise}.`);
      }
      L.push("");
    }

    // dropped vs added words
    if (r.wordsDropped >= 10 || r.wordsAdded >= 10) {
      if (r.wordsDropped > r.wordsAdded * 1.5) {
        L.push(`  You left out about ${r.wordsDropped} words that the expert typed.`);
        L.push(`  Small words go missing most: hai, ji, ma'am, you, I.`);
        L.push(`  WHAT TO DO: type every word you hear, even filler words.`);
      } else if (r.wordsAdded > r.wordsDropped * 1.5) {
        L.push(`  You typed about ${r.wordsAdded} extra words that the expert did not hear.`);
        L.push(`  WHAT TO DO: type only what you can clearly hear. Do not complete the`);
        L.push(`  sentence from what you expect the customer to say.`);
      }
      L.push("");
    }
  }

  // ---------- 5. anything left open ----------
  if (r.openNow > 0) {
    L.push(`STILL OPEN`);
    L.push(`  ${r.openNow} call${r.openNow === 1 ? " is" : "s are"} still waiting in your queue.`);
    L.push("");
  }

  L.push(`Thank you for the work this week.`);
  L.push(`Nabh and Manavi`);
  L.push("");
  L.push(`Your queue: https://review.realloop.in`);
  return L.join("\n");
}
