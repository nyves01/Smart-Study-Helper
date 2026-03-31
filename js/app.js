// ─────────────────────────────────────────────
//  app.js  —  State management & event wiring
// ─────────────────────────────────────────────

// ── Application state ─────────────────────────

let historyStack  = [];  // [{ title: string }]  — breadcrumb trail
let currentSummary = null;
let currentRelated = [];
let savedTopics    = [];  // Will be loaded from API
let quizOpen       = false;

// ── DOM references ────────────────────────────

const searchInput  = document.getElementById('searchInput');
const searchBtn    = document.getElementById('searchBtn');
const mainEl       = document.getElementById('main');
const sidebarEl    = document.getElementById('sidebar');
const darkToggle   = document.getElementById('darkToggle');
const sidebarToggle = document.getElementById('sidebarToggle');
const logoutBtn    = document.getElementById('logoutBtn');
const layoutEl     = document.getElementById('layout');

// ── Init dark mode from localStorage ─────────

(function initDarkMode() {
  const dark = localStorage.getItem('ssh_dark') === 'true';
  if (dark) {
    document.body.classList.add('dark');
    darkToggle.textContent = '☀️';
    darkToggle.setAttribute('aria-label', 'Switch to light mode');
  }
})();

// ── Init sidebar ──────────────────────────────

async function initApp() {
  await loadSavedTopics();
  renderSidebar(savedTopics, sidebarEl);
  wireSidebarEvents();
}

initApp();

// ── Saved topics API functions ────────────────

async function loadSavedTopics() {
  try {
    const response = await fetch('/api/saved-topics', {
      credentials: 'include'
    });

    if (response.ok) {
      savedTopics = await response.json();
    } else {
      console.error('Failed to load saved topics');
      savedTopics = [];
    }
  } catch (error) {
    console.error('Error loading saved topics:', error);
    savedTopics = [];
  }
}

async function saveTopicToAPI(title, description, thumb) {
  try {
    const response = await fetch('/api/saved-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title, description, thumb })
    });

    if (response.ok) {
      await loadSavedTopics(); // Refresh the list
      renderSidebar(savedTopics, sidebarEl);
      return true;
    } else {
      console.error('Failed to save topic');
      return false;
    }
  } catch (error) {
    console.error('Error saving topic:', error);
    return false;
  }
}

async function deleteTopicFromAPI(topicId) {
  try {
    const response = await fetch(`/api/saved-topics/${topicId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.ok) {
      await loadSavedTopics(); // Refresh the list
      renderSidebar(savedTopics, sidebarEl);
      return true;
    } else {
      console.error('Failed to delete topic');
      return false;
    }
  } catch (error) {
    console.error('Error deleting topic:', error);
    return false;
  }
}

// ── Global search events ──────────────────────

searchBtn.addEventListener('click', onSearch);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') onSearch();
});

function onSearch() {
  const q = searchInput.value.trim();
  if (!q) {
    searchInput.focus();
    searchInput.classList.add('shake');
    searchInput.addEventListener('animationend', () => searchInput.classList.remove('shake'), { once: true });
    return;
  }
  historyStack = [];
  loadTopic(q);
}

// ── Dark mode toggle ──────────────────────────

darkToggle.addEventListener('click', () => {
  const nowDark = document.body.classList.toggle('dark');
  localStorage.setItem('ssh_dark', nowDark);
  darkToggle.textContent = nowDark ? '☀️' : '🌙';
  darkToggle.setAttribute('aria-label', nowDark ? 'Switch to light mode' : 'Switch to dark mode');
});

// ── Sidebar toggle (mobile) ───────────────────

sidebarToggle.addEventListener('click', () => {
  layoutEl.classList.toggle('sidebar-open');
  const open = layoutEl.classList.contains('sidebar-open');
  sidebarToggle.setAttribute('aria-expanded', open);
});

// ── Logout button ─────────────────────────────

logoutBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      window.location.href = '/login.html';
    } else {
      alert('Logout failed. Please try again.');
    }
  } catch (error) {
    alert('Network error during logout.');
  }
});

// ── Core fetch + render ───────────────────────

async function loadTopic(topic, isBackNav = false) {
  renderSpinner(topic, mainEl);
  quizOpen = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const { summary, related } = await fetchTopic(topic);
    currentSummary = summary;
    currentRelated = related;

    renderResult(summary, related, mainEl, historyStack);
    wireResultEvents();
    updateSaveBtnState();
  } catch (err) {
    renderError(err, mainEl);
  }
}

// ── Wire events on the result card ────────────

function wireResultEvents() {
  // Related topic chips
  document.querySelectorAll('[data-related]').forEach(el => {
    el.addEventListener('click',   () => navigateTo(el.dataset.related));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') navigateTo(el.dataset.related); });
  });

  // Breadcrumb items
  document.querySelectorAll('[data-bread]').forEach(el => {
    el.addEventListener('click',   () => handleBreadcrumb(el.dataset.bread));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleBreadcrumb(el.dataset.bread); });
  });

  // Filter bar
  const filterInput = document.getElementById('filterInput');
  const summaryEl   = document.getElementById('summaryText');
  if (filterInput && summaryEl) {
    filterInput.addEventListener('input', () => {
      const query     = filterInput.value.trim();
      const relTitles = currentRelated.map(r => r.title);
      const base      = highlightKeywords(currentSummary?.extract ?? '', relTitles);
      summaryEl.innerHTML = query ? applyFilter(base, query) : base;
    });
  }

  // Save / unsave button
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!currentSummary) return;
      toggleSave(currentSummary);
      updateSaveBtnState();
    });
  }

  // Quiz button
  const quizBtn   = document.getElementById('quizBtn');
  const quizPanel = document.getElementById('quizPanel');
  const quizHint  = document.getElementById('quizHint');
  if (quizBtn && quizPanel) {
    quizBtn.addEventListener('click', () => {
      quizOpen = !quizOpen;

      if (quizOpen) {
        const relTitles = currentRelated.map(r => r.title);
        const questions = generateQuiz(currentSummary?.extract ?? '', relTitles);
        if (questions.length === 0) {
          quizPanel.innerHTML = '<p class="quiz-empty">Not enough content to generate quiz questions for this topic. Try a longer article.</p>';
        } else {
          renderQuizPanel(questions, quizPanel);
          wireQuizEvents();
        }
        quizPanel.classList.remove('hidden');
        quizBtn.textContent = '✖ Close Quiz';
        quizPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        quizPanel.classList.add('hidden');
        quizBtn.textContent = '📝 Take Quiz';
        if (quizHint) quizHint.textContent = '';
      }
    });
  }

  // Double-click a word in the summary → fetch definition
  const summaryContainer = document.getElementById('summaryText');
  if (summaryContainer) {
    summaryContainer.addEventListener('dblclick', async () => {
      const selection = window.getSelection()?.toString().trim();
      if (!selection || selection.split(/\s+/).length > 1) return; // single word only
      try {
        const data = await fetchDefinition(selection);
        const meaning = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
        showDefinitionTooltip(selection, meaning ?? 'No definition found.');
      } catch {
        showDefinitionTooltip(selection, 'No definition found for this word.');
      }
    });
  }
}

// ── Quiz submission events ────────────────────

function wireQuizEvents() {
  let answered   = 0;
  let correct    = 0;
  const total    = document.querySelectorAll('.quiz-form').length;
  const scoreEl  = document.getElementById('quizScore');

  document.querySelectorAll('.quiz-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (form.dataset.answered) return;   // prevent double-submit

      const selected  = form.querySelector('input[type=radio]:checked');
      const feedback  = form.querySelector('.quiz-feedback');
      const answer    = form.dataset.answer;

      if (!selected) {
        feedback.textContent = 'Please select an answer first.';
        feedback.className   = 'quiz-feedback warn';
        return;
      }

      form.dataset.answered = '1';
      const isCorrect = selected.value === answer;
      if (isCorrect) correct++;
      answered++;

      feedback.textContent = isCorrect
        ? '✓ Correct!'
        : `✗ Incorrect — the answer is: ${answer}`;
      feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;

      // Style each option
      form.querySelectorAll('.quiz-option').forEach(label => {
        const radio = label.querySelector('input');
        if (radio.value === answer) label.classList.add('option-correct');
        else if (radio.checked)     label.classList.add('option-wrong');
        radio.disabled = true;
      });
      form.querySelector('.check-btn').disabled = true;

      // Update score display
      if (scoreEl) {
        const pct = Math.round((correct / answered) * 100);
        scoreEl.textContent = `Score: ${correct} / ${answered} (${pct}%)`;
        scoreEl.className   = `quiz-score ${pct >= 70 ? 'score-good' : pct >= 40 ? 'score-mid' : 'score-low'}`;
      }
    });
  });
}

// ── Navigation helpers ────────────────────────

function navigateTo(topic) {
  if (currentSummary) {
    historyStack = [...historyStack, { title: currentSummary.title }];
  }
  loadTopic(topic);
}

function handleBreadcrumb(indexStr) {
  const idx = parseInt(indexStr, 10);

  if (idx === -1) {
    // Home — clear everything
    historyStack = [];
    currentSummary = null;
    currentRelated = [];
    mainEl.innerHTML = `
      <div class="empty-state">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
        </svg>
        <h2>Start exploring</h2>
        <p>Type any topic in the search bar to get a summary, related subjects, and a quiz.</p>
      </div>`;
    return;
  }

  const target = historyStack[idx];
  if (!target) return;
  historyStack = historyStack.slice(0, idx);
  loadTopic(target.title, true);
}

// ── Saved topics ──────────────────────────────

async function toggleSave(summary) {
  const isSaved = savedTopics.some(t => t.title === summary.title);

  if (isSaved) {
    // Find and delete the topic
    const topicToDelete = savedTopics.find(t => t.title === summary.title);
    if (topicToDelete && topicToDelete.id) {
      await deleteTopicFromAPI(topicToDelete.id);
    }
  } else {
    // Save the topic
    await saveTopicToAPI(
      summary.title,
      summary.description ?? '',
      summary.thumbnail?.source ?? null
    );
  }
}

function updateSaveBtnState() {
  const saveBtn = document.getElementById('saveBtn');
  if (!saveBtn || !currentSummary) return;
  const isSaved = savedTopics.some(t => t.title === currentSummary.title);
  saveBtn.textContent = isSaved ? '★ Saved' : '☆ Save Topic';
  saveBtn.classList.toggle('is-saved', isSaved);
  saveBtn.setAttribute('aria-label', isSaved ? 'Remove from saved topics' : 'Save this topic');
}

function wireSidebarEvents() {
  // Click saved item to load it
  document.querySelectorAll('[data-saved-topic]').forEach(el => {
    el.addEventListener('click',   () => { historyStack = []; loadTopic(el.dataset.savedTopic); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') el.click(); });
  });

  // Remove button inside each saved item
  document.querySelectorAll('[data-remove-saved]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const topicId = btn.dataset.removeSaved;
      const title = btn.dataset.title;

      if (await deleteTopicFromAPI(topicId)) {
        // Reflect unsaved state on result card if it's the current topic
        if (currentSummary?.title === title) updateSaveBtnState();
      }
    });
  });
}

// ── Keyboard shortcut: / to focus search ─────

document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});
