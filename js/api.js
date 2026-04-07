// ─────────────────────────────────────────────
//  api.js  —  All external API calls (proxied through backend)
// ─────────────────────────────────────────────

// Build API URLs that work for same-origin deploys and local split-port setups.
function getApiBaseUrl() {
  if (typeof window === 'undefined' || !window.location) return '';

  const { protocol, hostname, port } = window.location;

  if (protocol === 'file:') {
    return 'http://localhost:3000';
  }

  // GitHub Codespaces preview hosts include the port in the subdomain.
  // Example: <name>-5500.app.github.dev -> <name>-3000.app.github.dev
  const codespacesMatch = hostname.match(/^(.*)-(\d+)\.(app\.github\.dev)$/);
  if (codespacesMatch && codespacesMatch[2] !== '3000') {
    return `${protocol}//${codespacesMatch[1]}-3000.${codespacesMatch[3]}`;
  }

  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocalHost && port && port !== '3000') {
    return `${protocol}//${hostname}:3000`;
  }

  return '';
}

function withApiBase(path) {
  return `${getApiBaseUrl()}${path}`;
}

window.withApiBase = withApiBase;


// -------------------- Custom error types --------------------


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


// --------------------Wikipedia --------------------


/**
 * Fetches page summary + related pages in parallel.
 * @param {string} topic  Raw topic string from the user
 * @returns {{ summary: object, related: object[] }}
 */
async function fetchTopic(topic) {
  try {
    const url = withApiBase(`/api/topic/${encodeURIComponent(topic)}`);
    console.log('[Search] Fetching topic from:', url);
    const response = await fetch(url);
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
    const response = await fetch(withApiBase(`/api/definition/${encodeURIComponent(word)}`));
    if (!response.ok) {
      throw new Error('No definition found');
    }
    return await response.json();
  } catch (error) {
    throw new NetworkError('Could not reach the dictionary server.');
  }
}
