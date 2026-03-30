---------------------------------------- render.js  —  All DOM building / display ----------------------------------------
  

-------------------- Utilities --------------------

/** Escape a string for safe insertion as HTML text content. */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Bold every occurrence of a keyword from the related-titles list
 * inside an already-escaped HTML string.
 * @param {string}   text     Raw (unescaped) extract text
 * @param {string[]} keywords Related page titles
 * @returns {string} HTML string with <b class="kw"> highlights
 */
function highlightKeywords(text, keywords) {
  if (!text) return '';
  let html = escHtml(text);

  const sorted = [...new Set(keywords)]
    .filter(k => k && k.length > 3)
    .sort((a, b) => b.length - a.length);

  for (const kw of sorted) {
    const safe  = escHtml(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![\\w>])${safe}(?![\\w<])`, 'g');
    html = html.replace(regex, m => `<b class="kw">${m}</b>`);
  }
  return html;
}

/**
 * Wrap filter-query matches in <mark> tags within an already-highlighted
 * HTML string. Works at the HTML text level (avoids breaking tags).
 * @param {string} highlightedHtml Already HTML-escaped + keyword-highlighted string
 * @param {string} query           Raw user filter query
 * @returns {string}
 */
function applyFilter(highlightedHtml, query) {
  if (!query) return highlightedHtml;
  const safe  = escHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safe})`, 'gi');
  // Only replace in text nodes — avoid matching inside HTML tags
  return highlightedHtml.replace(/>([^<]*)</g, (_, text) =>
    `>${text.replace(regex, '<mark>$1</mark>')}<`
  );
}

-------------------- Spinner --------------------

function renderSpinner(label, el) {
  el.innerHTML = `
    <div class="spinner-wrap" role="status" aria-live="polite">
      <div class="spinner"></div>
      <span>Looking up <em>${escHtml(label)}</em>&hellip;</span>
    </div>`;
}

-------------------- Error card --------------------

function renderError(err, el) {
  let heading, body, hint;

  if (err?.type === 'disambiguation') {
    heading = 'Multiple matches found';
    body    = `"${escHtml(err.topic)}" refers to several Wikipedia articles.`;
    hint    = 'Try a more specific search — e.g. <em>"Python programming language"</em> instead of <em>"Python"</em>.';
  } else if (err?.type === 'notfound' || err?.status === 404) {
    heading = 'Topic not found';
    body    = `No Wikipedia article was found for <strong>"${escHtml(err.topic ?? 'that topic')}"</strong>.`;
    hint    = 'Check the spelling or try a broader / different term.';
  } else if (err?.type === 'network' || err instanceof TypeError) {
    heading = 'Connection failed';
    body    = 'Could not reach Wikipedia.';
    hint    = 'Check your internet connection and try again.';
  } else {
    heading = 'Something went wrong';
    body    = 'An unexpected error occurred.';
    hint    = 'Please try again in a moment.';
  }

  el.innerHTML = `
    <div class="error-card" role="alert">
      <div class="error-icon" aria-hidden="true">⚠️</div>
      <div class="error-body">
        <h3>${escHtml(heading)}</h3>
        <p>${body}</p>
        <p class="error-hint">${hint}</p>
        <button class="retry-btn"
                onclick="document.getElementById('searchInput').select();
                         document.getElementById('searchInput').focus()">
          Try a different search
        </button>
      </div>
    </div>`;
}

-------------------- Breadcrumb --------------------

/**
 * @param {{ title: string }[]} history  Stack of previously visited topics
 * @param {string}              current  Title of the current page
 * @returns {string} HTML string
 */
function renderBreadcrumb(history, current) {
  if (!history.length) return '';

  const crumbs = history.map((h, i) => `
    <span class="bread-item" data-bread="${i}" tabindex="0" role="button"
          aria-label="Go back to ${escHtml(h.title)}">
      ${escHtml(h.title)}
    </span>
    <span class="bread-sep" aria-hidden="true">›</span>`).join('');

  return `
    <nav class="breadcrumb" aria-label="Topic history">
      <span class="bread-home" data-bread="-1" tabindex="0" role="button" aria-label="Go to start">
        🏠
      </span>
      <span class="bread-sep" aria-hidden="true">›</span>
      ${crumbs}
      <span class="bread-current" aria-current="page">${escHtml(current)}</span>
    </nav>`;
}

-------------------- Main result card --------------------

/**
 * Build and inject the full result card into el.
 * @param {object}   summary   Wikipedia summary object
 * @param {object[]} related   Related pages array
 * @param {HTMLElement} el     Container element
 * @param {object[]} history   Breadcrumb history stack
 */
function renderResult(summary, related, el, history = []) {
  const title     = summary.title       ?? '';
  const desc      = summary.description ?? '';
  const extract   = summary.extract     ?? 'No summary available.';
  const thumb     = summary.thumbnail?.source ?? null;
  const wikiUrl   = summary.content_urls?.desktop?.page ?? '#';
  const relTitles = related.map(r => r.title);

  el.innerHTML = `
    ${renderBreadcrumb(history, title)}
    <div class="result-card">

      <div class="result-header">
        ${thumb ? `
          <img class="result-thumb"
               src="${escHtml(thumb)}"
               alt="Image for ${escHtml(title)}"
               loading="lazy" />` : ''}
        <div class="result-meta">
          <h2 class="result-title">${escHtml(title)}</h2>
          ${desc ? `<p class="result-desc">${escHtml(desc)}</p>` : ''}
          <div class="result-actions">
            <a class="wiki-link"
               href="${escHtml(wikiUrl)}"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Read full Wikipedia article about ${escHtml(title)}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Read on Wikipedia
            </a>
            <button class="save-btn" id="saveBtn" aria-label="Save this topic">
              ☆ Save Topic
            </button>
          </div>
        </div>
      </div>

      <div class="result-body">

        <div class="section-row">
          <span class="section-label">Summary</span>
          <span class="hint-text">💡 Double-click any word for its definition</span>
        </div>

        <div class="filter-wrap">
          <input id="filterInput"
                 type="search"
                 placeholder="🔍  Filter within this summary…"
                 aria-label="Filter summary text" />
        </div>

        <p class="summary-text" id="summaryText">
          ${highlightKeywords(extract, relTitles)}
        </p>

        ${related.length ? `
          <hr class="divider" />
          <div class="section-label">Related Topics</div>
          <div class="related-grid">
            ${related.slice(0, 10).map(r => renderChip(r)).join('')}
          </div>` : ''}

        <hr class="divider" />
        <div class="quiz-row">
          <button class="quiz-btn" id="quizBtn">📝 Take Quiz</button>
          <span class="quiz-hint" id="quizHint"></span>
        </div>
        <div class="quiz-panel hidden" id="quizPanel"></div>

      </div>
    </div>`;
}

-------------------- Related topic chip --------------------

function renderChip(r) {
  const letter = escHtml((r.title ?? '?').charAt(0).toUpperCase());
  const thumb  = r.thumbnail?.source
    ? `<img class="chip-thumb" src="${escHtml(r.thumbnail.source)}" alt="" loading="lazy" />`
    : `<div class="chip-placeholder" aria-hidden="true">${letter}</div>`;

  return `
    <div class="related-chip"
         data-related="${escHtml(r.title)}"
         tabindex="0"
         role="button"
         aria-label="Explore: ${escHtml(r.title)}">
      ${thumb}
      <div class="chip-info">
        <div class="chip-title">${escHtml(r.title)}</div>
        ${r.description ? `<div class="chip-desc">${escHtml(r.description)}</div>` : ''}
      </div>
    </div>`;
}

-------------------- Quiz panel --------------------

/**
 * Build and inject the quiz questions into el.
 * @param {{ question: string, answer: string, options: string[] }[]} questions
 * @param {HTMLElement} el
 */
function renderQuizPanel(questions, el) {
  el.innerHTML = `
    <div class="quiz-header">
      <span class="quiz-title">Quiz — ${questions.length} question${questions.length !== 1 ? 's' : ''}</span>
      <span class="quiz-score" id="quizScore"></span>
    </div>
    ${questions.map((q, i) => `
      <form class="quiz-form" data-answer="${escHtml(q.answer)}" data-idx="${i}">
        <p class="quiz-question">
          <span class="q-num">Q${i + 1}.</span>
          ${escHtml(q.question)}
        </p>
        <div class="quiz-options" role="radiogroup">
          ${q.options.map((opt, j) => `
            <label class="quiz-option">
              <input type="radio" name="q${i}" value="${escHtml(opt)}" />
              <span class="option-text">${escHtml(opt)}</span>
            </label>`).join('')}
        </div>
        <div class="quiz-actions">
          <button type="submit" class="check-btn">Check Answer</button>
        </div>
        <div class="quiz-feedback" role="alert" aria-live="polite"></div>
      </form>`).join('')}`;
}

-------------------- Sidebar --------------------

/**
 * Build and inject the saved-topics sidebar.
 * @param {{ title: string, description: string, thumb: string|null }[]} savedTopics
 * @param {HTMLElement} el
 */
function renderSidebar(savedTopics, el) {
  if (!el) return;

  const header = `
    <div class="sidebar-header">
      <h3 class="sidebar-heading">★ Saved Topics</h3>
      ${savedTopics.length ? `<span class="sidebar-count">${savedTopics.length}</span>` : ''}
    </div>`;

  if (!savedTopics.length) {
    el.innerHTML = header + `
      <p class="sidebar-empty">
        No saved topics yet.<br />
        Click <strong>☆ Save Topic</strong> after searching.
      </p>`;
    return;
  }

  const items = savedTopics.map(t => {
    const letter = escHtml(t.title.charAt(0).toUpperCase());
    const thumb  = t.thumb
      ? `<img class="saved-thumb" src="${escHtml(t.thumb)}" alt="" loading="lazy" />`
      : `<div class="saved-placeholder" aria-hidden="true">${letter}</div>`;

    return `
      <li class="saved-item"
          data-saved-topic="${escHtml(t.title)}"
          tabindex="0"
          role="button"
          aria-label="Load saved topic: ${escHtml(t.title)}">
        ${thumb}
        <div class="saved-info">
          <div class="saved-title">${escHtml(t.title)}</div>
          ${t.description ? `<div class="saved-desc">${escHtml(t.description)}</div>` : ''}
        </div>
        <button class="remove-btn"
                data-remove-saved="${escHtml(t.title)}"
                aria-label="Remove ${escHtml(t.title)} from saved topics"
                title="Remove">✕</button>
      </li>`;
  }).join('');

  el.innerHTML = header + `<ul class="saved-list" role="list">${items}</ul>`;
}

-------------------- Definition tooltip --------------------

let _tooltipTimer = null;

/**
 * Show a floating definition tooltip near the bottom of the screen.
 * @param {string} word
 * @param {string} definition
 */
function showDefinitionTooltip(word, definition) {
  let tip = document.getElementById('defTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id        = 'defTooltip';
    tip.className = 'def-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }

  tip.innerHTML = `
    <strong class="tip-word">${escHtml(word)}</strong>
    <p class="tip-def">${escHtml(definition)}</p>
    <button class="tip-close" onclick="this.parentElement.classList.remove('visible')"
            aria-label="Close definition">✕</button>`;

  tip.classList.add('visible');
  clearTimeout(_tooltipTimer);
  _tooltipTimer = setTimeout(() => tip.classList.remove('visible'), 6000);
}
