// ─────────────────────────────────────────────
//  api.js  —  All external API calls (proxied through backend)
// ─────────────────────────────────────────────

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
  try {
    const response = await fetch(`/api/topic/${encodeURIComponent(topic)}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new TopicNotFoundError(topic, response.status);
      } else if (response.status === 400) {
        throw new DisambiguationError(topic);
      } else {
        throw new NetworkError('Could not reach the server.');
      }
    }
    return await response.json();
  } catch (error) {
    if (error instanceof TopicNotFoundError || error instanceof DisambiguationError) {
      throw error;
    }
    throw new NetworkError('Could not reach the server. Check your connection.');
  }
}

// ── Free Dictionary API ───────────────────────

/**
 * Fetches definition(s) for a single English word.
 * @param {string} word
 * @returns {object[]}  Array of dictionary entries
 */
async function fetchDefinition(word) {
  try {
    const response = await fetch(`/api/definition/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error('No definition found');
    }
    return await response.json();
  } catch (error) {
    throw new NetworkError('Could not reach the dictionary server.');
  }
}
