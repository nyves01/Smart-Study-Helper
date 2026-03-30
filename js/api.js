// ─────────────────────────────────────────────
//  api.js  —  All external API calls
// ─────────────────────────────────────────────

const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page';
const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en';

// ── Custom error types ────────────────────────

class TopicNotFoundError extends Error {
  constructor(topic, status) {
    super(`No Wikipedia article found for: ${topic}`);
    this.topic  = topic;
    this.status = status;
    this.type   = 'notfound';
  }
}

class DisambiguationError extends Error {
  constructor(topic) {
    super(`Disambiguation page for: ${topic}`);
    this.topic = topic;
    this.type  = 'disambiguation';
  }
}

class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.type = 'network';
  }
}

// ── Wikipedia ─────────────────────────────────

/**
 * Fetches page summary + related pages in parallel.
 * @param {string} topic  Raw topic string from the user
 * @returns {{ summary: object, related: object[] }}
 */
async function fetchTopic(topic) {
  const key = encodeURIComponent(topic.trim().replace(/ /g, '_'));
  const headers = { Accept: 'application/json' };

  let sumResult, relResult;
  try {
    [sumResult, relResult] = await Promise.allSettled([
      fetch(`${WIKI_API}/summary/${key}`, { headers }),
      fetch(`${WIKI_API}/related/${key}`,  { headers }),
    ]);
  } catch (e) {
    throw new NetworkError('Could not reach Wikipedia. Check your internet connection.');
  }

  // Summary is required — fail fast
  if (sumResult.status === 'rejected') {
    throw new NetworkError(sumResult.reason?.message);
  }
  if (!sumResult.value.ok) {
    throw new TopicNotFoundError(topic, sumResult.value.status);
  }

  let summary;
  try {
    summary = await sumResult.value.json();
  } catch {
    throw new NetworkError('Received an invalid response from Wikipedia.');
  }

  if (summary.type === 'disambiguation') {
    throw new DisambiguationError(topic);
  }

  // Related pages are optional — degrade silently
  let related = [];
  if (relResult.status === 'fulfilled' && relResult.value.ok) {
    try {
      const relData = await relResult.value.json();
      related = relData.pages ?? [];
    } catch {
      // silently ignore malformed related response
    }
  }

  return { summary, related };
}

// ── Free Dictionary API ───────────────────────

/**
 * Fetches definition(s) for a single English word.
 * @param {string} word
 * @returns {object[]}  Array of dictionary entries
 */
async function fetchDefinition(word) {
  let res;
  try {
    res = await fetch(`${DICT_API}/${encodeURIComponent(word.toLowerCase())}`);
  } catch {
    throw new NetworkError('Could not reach the dictionary API.');
  }
  if (!res.ok) throw new Error('No definition found');
  return res.json();
}
