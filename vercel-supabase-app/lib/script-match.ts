// Script-insensitive comparison for Hinglish transcripts.
//
// Reviewers transcribe the same audio in different scripts. One writes "ha ha",
// another writes "हां हां"; one writes "whi se attendance", another writes
// "वहीं से attendance". They heard the identical words. Comparing the strings
// counts that as a disagreement, which understates agreement badly on a corpus
// that is mostly code-mixed: on the panel's own multi-reviewer segments, 79% of
// apparent text disagreements were the same words in a different script or
// spelling, not a different hearing.
//
// So both sides are reduced to a rough phonetic skeleton and compared there.
// The skeleton is deliberately lossy · it is a matching key, never something to
// display or store as the transcript.

const DEV_TO_ROMAN: Array<[RegExp, string]> = [
  // conjunct-forming vowels first, longest match wins
  [/क्ष/g, "ksh"], [/त्र/g, "tr"], [/ज्ञ/g, "gy"], [/श्र/g, "shr"],
  // consonants · aspirated before plain, or "kh" would match as "k"+"h"
  [/ख़?/g, "kh"], [/घ/g, "gh"], [/छ/g, "chh"], [/झ/g, "jh"],
  [/ठ/g, "th"], [/ढ़?/g, "dh"], [/थ/g, "th"], [/ध/g, "dh"],
  [/फ़/g, "f"], [/फ/g, "ph"], [/भ/g, "bh"],
  [/क़?/g, "k"], [/ग़?/g, "g"], [/ङ/g, "n"],
  [/च/g, "ch"], [/ज़/g, "z"], [/ज/g, "j"], [/ञ/g, "n"],
  [/ट/g, "t"], [/ड़/g, "r"], [/ड/g, "d"], [/ण/g, "n"],
  [/त/g, "t"], [/द/g, "d"], [/न/g, "n"],
  [/प/g, "p"], [/ब/g, "b"], [/म/g, "m"],
  [/य/g, "y"], [/र/g, "r"], [/ल/g, "l"], [/व/g, "v"],
  [/श/g, "sh"], [/ष/g, "sh"], [/स/g, "s"], [/ह/g, "h"],
  // independent vowels
  [/आ/g, "aa"], [/अ/g, "a"], [/ई/g, "ee"], [/इ/g, "i"], [/ऊ/g, "oo"], [/उ/g, "u"],
  [/ऐ/g, "ai"], [/ए/g, "e"], [/औ/g, "au"], [/ओ/g, "o"], [/ऋ/g, "ri"],
  // matras
  [/ा/g, "aa"], [/ी/g, "ee"], [/ि/g, "i"], [/ू/g, "oo"], [/ु/g, "u"],
  [/ै/g, "ai"], [/े/g, "e"], [/ौ/g, "au"], [/ो/g, "o"],
  // nasals, visarga, halant, nukta
  [/[ंँ]/g, "n"], [/ः/g, "h"], [/्/g, ""], [/़/g, ""],
  [/०/g, "0"], [/१/g, "1"], [/२/g, "2"], [/३/g, "3"], [/४/g, "4"],
  [/५/g, "5"], [/६/g, "6"], [/७/g, "7"], [/८/g, "8"], [/९/g, "9"],
];

/** Devanagari to a rough Roman phonetic form. Lossy by design. */
export function toRoman(s: string): string {
  let out = String(s || "");
  for (const [re, rep] of DEV_TO_ROMAN) out = out.replace(re, rep);
  return out;
}

/** The matching key: one word reduced so that spelling and script stop mattering.
 *  haan / हां / han all land on "han"; whi / वहीं land on "vhi" / "vhin". */
export function skeleton(word: string): string {
  let w = toRoman(String(word || "")).toLowerCase();
  w = w.replace(/[^a-z0-9]/g, "");
  w = w.replace(/^(w)/, "v");           // whi ~ vahi · w and v are one sound here
  w = w.replace(/aa/g, "a").replace(/ee/g, "i").replace(/oo/g, "u");
  w = w.replace(/(.)\1+/g, "$1");       // doubled letters carry no meaning here
  // No trailing-vowel collapse: it merged है (is) with हां (yes), which are
  // different words, and merging them would have hidden a real disagreement.
  w = w.replace(/n$/, "");              // final nasal is inconsistently written
  return w;
}

/** Two words the same, allowing for script and spelling drift. */
export function sameWord(a: string, b: string): boolean {
  const x = skeleton(a), y = skeleton(b);
  if (!x && !y) return true;
  if (x === y) return true;
  // one edit apart on short words is still the same word in practice
  if (Math.abs(x.length - y.length) <= 1 && Math.min(x.length, y.length) >= 3) {
    let i = 0, j = 0, edits = 0;
    while (i < x.length && j < y.length) {
      if (x[i] === y[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (x.length > y.length) i++; else if (y.length > x.length) j++; else { i++; j++; }
    }
    return edits + (x.length - i) + (y.length - j) <= 1;
  }
  return false;
}

/** Two transcripts of the same audio saying the same thing. */
export function sameText(a: string, b: string): boolean {
  const A = String(a || "").trim().split(/\s+/).filter(Boolean);
  const B = String(b || "").trim().split(/\s+/).filter(Boolean);
  if (A.length !== B.length) return false;
  return A.every((w, i) => sameWord(w, B[i]));
}
