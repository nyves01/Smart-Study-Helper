// ─────────────────────────────────────────────
//  quiz.js  —  Client-side quiz generation
//  Guaranteed questions even for short summaries
// ─────────────────────────────────────────────

// Common words that happen to be capitalised but aren't useful keywords
const STOP_WORDS = new Set([
  'The','This','That','These','Those','When','While','Although','Because',
  'Since','After','Before','During','However','Also','Additionally',
  'Furthermore','Moreover','Therefore','Thus','Hence','With','From',
  'Into','Onto','Upon','About','Such','Both','Each','Many','Some',
  'Most','Other','Their','There','They','Been','Have','Were','Will',
  'Its','His','Her','Our','Your','Their','Which','Where','What',
]);

/**
 * Extract every meaningful capitalised word from the text.
 * This becomes our keyword + distractor pool when relatedTitles is small.
 * @param {string} text
 * @returns {string[]}
 */
function extractKeywordsFromText(text) {
  const all = text.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  return [...new Set(all)].filter(w => !STOP_WORDS.has(w));
}

/**
 * Split text into sentence-length chunks.
 * Falls back to comma-clauses so even one-sentence summaries yield fragments.
 * @param {string} text
 * @returns {string[]}
 */
function extractSentences(text) {
  // Primary: split on sentence-ending punctuation
  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? [])
    .map(s => s.trim())
    .filter(s => s.length > 25);          // lowered from 50

  if (sentences.length >= 2) return sentences;

  // Fallback: split on commas / semicolons to get clauses from short summaries
  const clauses = text
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  return clauses.length ? clauses : [text];  // absolute fallback: whole text
}

/**
 * Fisher–Yates shuffle (non-mutating).
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick 3 distractors. Priority order:
 *   1. Other keywords found in the text itself
 *   2. Related page titles
 *   3. Generic academic fallback pool
 * @param {string}   correct
 * @param {string[]} textKeywords   Words extracted from the summary
 * @param {string[]} relatedTitles  Wikipedia related page titles
 * @returns {string[]}
 */
function pickDistractors(correct, textKeywords, relatedTitles) {
  const GENERIC_FALLBACK = [
    'Oxygen','Carbon','Nitrogen','Hydrogen','Helium','Sodium','Calcium',
    'Mitosis','Protein','Enzyme','Nucleus','Membrane','Organism',
    'Gravity','Velocity','Momentum','Frequency','Amplitude',
    'Democracy','Parliament','Constitution','Revolution','Republic',
    'Continent','Peninsula','Hemisphere','Equator','Meridian',
    'Renaissance','Baroque','Medieval','Ancient','Modern',
    'Photon','Electron','Proton','Neutron','Isotope',
  ].filter(w => w !== correct);

  // Merge all pools, text keywords first (most relevant distractors)
  const merged = [
    ...textKeywords.filter(w => w !== correct),
    ...relatedTitles.filter(w => w !== correct),
    ...GENERIC_FALLBACK,
  ];

  // Deduplicate while preserving order
  const seen = new Set();
  const unique = merged.filter(w => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });

  return shuffle(unique).slice(0, 3);
}

/**
 * Try to build a fill-in-the-blank question from one chunk of text.
 *
 * Strategy 1: A related-page title appears verbatim in the sentence → use it.
 * Strategy 2: A keyword from the text itself appears mid-sentence → use it.
 * Strategy 3: Replace any significant word in the sentence (last resort).
 *
 * @param {string}   sentence
 * @param {string[]} relatedTitles
 * @param {string[]} textKeywords
 * @returns {{ question, answer, options }|null}
 */
function makeFillBlank(sentence, relatedTitles, textKeywords) {
  let keyword = null;

  // Strategy 1 — related title found in this sentence
  const sortedTitles = [...relatedTitles].sort((a, b) => b.length - a.length);
  for (const title of sortedTitles) {
    if (sentence.includes(title)) { keyword = title; break; }
  }

  // Strategy 2 — capitalised keyword from the text, NOT at position 0
  if (!keyword) {
    // skip the first word (sentence-starter) by slicing past it
    const afterFirst = sentence.replace(/^\S+\s+/, '');
    const candidates = afterFirst.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
    keyword = candidates.find(w => !STOP_WORDS.has(w)) ?? null;
  }

  // Strategy 3 — any meaningful word anywhere, including lowercase nouns
  if (!keyword) {
    // Pick the longest word (≥5 chars) that isn't a stop word
    const words = sentence.match(/\b[a-zA-Z]{5,}\b/g) ?? [];
    const candidates = words.filter(w => !STOP_WORDS.has(w) && !/^[a-z]/.test(w) === false);
    // Just take the first word from textKeywords that appears here
    keyword = textKeywords.find(kw => sentence.includes(kw)) ?? null;
  }

  if (!keyword) return null;

  // Only replace the FIRST occurrence so the question stays readable
  const question = sentence.replace(keyword, '______');
  if (!question.includes('______')) return null;

  const distractors = pickDistractors(keyword, textKeywords, relatedTitles);
  if (distractors.length < 2) return null;

  return {
    question,
    answer:  keyword,
    options: shuffle([keyword, ...distractors]).slice(0, 4),
  };
}

/**
 * Build a "which is true?" question from a sentence as a guaranteed fallback.
 * The correct option is the real sentence; wrong options are other sentences.
 * @param {string[]} sentences  All sentences from the extract
 * @param {number}   idx        Index of the sentence to use as the correct answer
 * @returns {{ question, answer, options }}
 */
function makeTrueFalseQuestion(sentences, idx) {
  const correct = sentences[idx].trim().replace(/[.!?]+$/, '');
  // Use other sentences as wrong options; pad with a negated version if needed
  const others = sentences
    .filter((_, i) => i !== idx)
    .map(s => s.trim().replace(/[.!?]+$/, ''))
    .filter(s => s.length > 15);

  const wrongOptions = shuffle(others).slice(0, 3);

  // If we still don't have 3 wrong options pad with a generic distractor
  while (wrongOptions.length < 3) {
    wrongOptions.push(`None of the above statements about this topic are accurate.`);
  }

  return {
    question: 'Which of the following statements is true according to the summary?',
    answer:   correct,
    options:  shuffle([correct, ...wrongOptions]).slice(0, 4),
  };
}

/**
 * Generate up to `n` quiz questions — ALWAYS returns at least 1.
 *
 * Pass 1: fill-in-the-blank from every sentence
 * Pass 2: if still short, add "which is true?" questions from unused sentences
 *
 * @param {string}   extract       Wikipedia summary text
 * @param {string[]} relatedTitles Related page titles
 * @param {number}   n             Max questions (default 5)
 * @returns {{ question: string, answer: string, options: string[] }[]}
 */
function generateQuiz(extract, relatedTitles, n = 5) {
  if (!extract) return [];

  const textKeywords = extractKeywordsFromText(extract);
  const sentences    = extractSentences(extract);
  const questions    = [];
  const usedIdxs     = new Set();

  // ── Pass 1: fill-in-the-blank ──────────────
  for (let i = 0; i < sentences.length && questions.length < n; i++) {
    const q = makeFillBlank(sentences[i], relatedTitles, textKeywords);
    if (q) {
      questions.push(q);
      usedIdxs.add(i);
    }
  }

  // ── Pass 2: "which is true?" fallback ──────
  // Used when sentences are too short/simple for fill-in-the-blank
  if (questions.length === 0 && sentences.length > 0) {
    // Build true/false style questions from sentence pairs
    const eligible = sentences.filter((s, i) => !usedIdxs.has(i) && s.length > 20);
    for (let i = 0; i < eligible.length && questions.length < n; i++) {
      // Find the original index so makeTrueFalseQuestion can exclude it
      const origIdx = sentences.indexOf(eligible[i]);
      questions.push(makeTrueFalseQuestion(sentences, origIdx));
    }
  }

  // ── Pass 3: supplement with true/false up to n ──
  if (questions.length < n) {
    const remaining = sentences.filter((_, i) => !usedIdxs.has(i) && sentences.length > 1);
    for (let i = 0; i < remaining.length && questions.length < n; i++) {
      const origIdx = sentences.indexOf(remaining[i]);
      questions.push(makeTrueFalseQuestion(sentences, origIdx));
    }
  }

  return questions;
}
