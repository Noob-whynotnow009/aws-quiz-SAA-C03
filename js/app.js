/**
 * app.js — Main application controller for the AWS SAA-C03 Quiz App
 * Handles: routing between screens, event wiring, UI rendering
 */

/* ============================================================
   DOM References
   ============================================================ */
const $ = id => document.getElementById(id);

const screens = {
  home: $('screen-home'),
  quiz: $('screen-quiz'),
  results: $('screen-results'),
  review: $('screen-review'),
};

/* ============================================================
   Screen Navigation
   ============================================================ */
let currentScreen = 'home';

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
  currentScreen = name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   Theme (Light / Dark Mode)
   ============================================================ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icons = document.querySelectorAll('.theme-toggle');
  icons.forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  });
}

function toggleTheme() {
  const prefs = Storage.getPreferences();
  const next = prefs.theme === 'dark' ? 'light' : 'dark';
  Storage.setPreference('theme', next);
  applyTheme(next);
}

/* ============================================================
   Toast Notifications
   ============================================================ */
function showToast(message, type = 'info', duration = 3000) {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/* ============================================================
   Modal
   ============================================================ */
function showModal({ icon = '❓', title, body, actions = [] }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-icon">${icon}</div>
      <h2 class="modal-title" id="modal-title">${title}</h2>
      <p class="modal-body">${body}</p>
      <div class="modal-actions">
        ${actions.map((a, i) =>
          `<button class="btn ${a.class || 'btn-secondary'}" data-action="${i}">${a.label}</button>`
        ).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.action, 10);
      overlay.remove();
      if (actions[idx] && typeof actions[idx].onClick === 'function') {
        actions[idx].onClick();
      }
    });
  });

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });

  // Focus first button for accessibility
  setTimeout(() => overlay.querySelector('button')?.focus(), 50);
}

/* ============================================================
   HOME SCREEN
   ============================================================ */
let selectedMode = 'practice';

function initHomeScreen() {
  renderHomeStats();
  renderRecentSessions();
  renderTopicAnalytics();
  populateCategoryOptions();

  // Mode card selection
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-checked', 'true');
      selectedMode = card.dataset.mode;

      // Show/hide timer info
      const examTip = $('exam-time-tip');
      if (examTip) examTip.style.display = selectedMode === 'exam' ? 'block' : 'none';
    });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') card.click(); });
  });

  // Remove btn-resume-quiz reference (not in HTML, kept for future use)
  $('btn-start-quiz')?.addEventListener('click', startQuizFromHome);
  $('btn-clear-data')?.addEventListener('click', confirmClearData);
}

function renderHomeStats() {
  const analytics = Storage.getAnalytics();
  const sessions = Storage.getSessions();

  const totalAttempted = analytics.totalAttempted;
  const totalCorrect = analytics.totalCorrect;
  const overallPct = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const totalSessions = sessions.length;
  const bookmarkCount = Storage.getBookmarks().size;

  // Hero section stats
  $('stat-total-questions').textContent = totalAttempted || 0;
  $('stat-accuracy').textContent = totalAttempted > 0 ? `${overallPct}%` : '—';
  $('stat-sessions').textContent = totalSessions;
  $('stat-bookmarks').textContent = bookmarkCount;

  // Analytics section stat cards (same data, different layout)
  const el2 = $('stat-total-questions-2');
  const el3 = $('stat-accuracy-2');
  const el4 = $('stat-sessions-2');
  const el5 = $('stat-bookmarks-2');
  if (el2) el2.textContent = totalAttempted || 0;
  if (el3) el3.textContent = totalAttempted > 0 ? `${overallPct}%` : '—';
  if (el4) el4.textContent = totalSessions;
  if (el5) el5.textContent = bookmarkCount;
}

function populateCategoryOptions() {
  const select = $('filter-category');
  if (!select) return;
  const cats = Quiz.getCategories();
  select.innerHTML = '<option value="all">All Categories</option>';
  cats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function renderRecentSessions() {
  const sessions = Storage.getSessions().slice(0, 5);
  const container = $('recent-sessions-list');
  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No sessions yet. Start your first quiz!</p></div>';
    return;
  }

  container.innerHTML = sessions.map(s => {
    const pct = s.pct || 0;
    const scoreClass = pct >= 70 ? 'good' : pct >= 50 ? 'average' : 'poor';
    const modeLabel = s.mode === 'exam' ? '🕐 Timed Exam' : '📚 Practice';
    const catLabel = s.category !== 'all' ? s.category : 'All Categories';
    const diffLabel = s.difficulty !== 'all' ? ` · ${s.difficulty}` : '';
    const time = Analytics.timeAgo(s.timestamp || s.id);
    return `
      <div class="session-item">
        <div class="session-meta">
          <span class="session-mode">${modeLabel}</span>
          <span class="session-details">${catLabel}${diffLabel} · ${s.score}/${s.total} · ${time}</span>
        </div>
        <span class="session-score ${scoreClass}">${pct}%</span>
      </div>`;
  }).join('');
}

function renderTopicAnalytics() {
  const analytics = Storage.getAnalytics();
  const container = $('topic-performance-list');
  if (!container) return;

  const catData = Analytics.getCategoryAccuracy(analytics.byCategory);

  if (catData.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Complete a quiz to see topic performance.</p>';
    return;
  }

  container.innerHTML = catData.slice(0, 8).map(({ category, accuracy, correct, total }) => `
    <div class="topic-bar-item">
      <span class="topic-bar-label" title="${correct}/${total}">${category}</span>
      <div class="topic-bar-track">
        <div class="topic-bar-fill" style="width:${accuracy}%" data-pct="${accuracy}"></div>
      </div>
      <span class="topic-bar-pct">${accuracy}%</span>
    </div>`).join('');

  // Animate bars after render
  requestAnimationFrame(() => {
    container.querySelectorAll('.topic-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  });
}

async function startQuizFromHome() {
  const category = $('filter-category')?.value || 'all';
  const difficulty = $('filter-difficulty')?.value || 'all';
  const countRaw = parseInt($('filter-count')?.value || '20', 10);
  const count = Math.min(Math.max(countRaw || 20, 5), 75);

  const pool = Quiz.filterQuestions({ category, difficulty });
  if (pool.length === 0) {
    showToast('No questions match the selected filters. Please adjust your settings.', 'warning');
    return;
  }

  const actualCount = Math.min(count, pool.length);

  const started = Quiz.initQuiz({
    mode: selectedMode,
    category,
    difficulty,
    count: actualCount,
    shuffleQ: true,
    shuffleA: true,
  });

  if (!started) {
    showToast('Could not start quiz. Please try different filters.', 'warning');
    return;
  }

  showScreen('quiz');
  renderQuizScreen();
}

function resumeQuiz() {
  if (!Quiz.state.questions.length || Quiz.state.isFinished) {
    showToast('No active quiz to resume.', 'warning');
    return;
  }
  showScreen('quiz');
  renderQuizScreen();
}

function confirmClearData() {
  showModal({
    icon: '🗑️',
    title: 'Clear All Data?',
    body: 'This will delete all sessions, analytics, and bookmarks. This action cannot be undone.',
    actions: [
      { label: 'Cancel', class: 'btn-secondary' },
      {
        label: 'Clear Everything', class: 'btn-danger',
        onClick: () => {
          Storage.clearSessions();
          Storage.clearAnalytics();
          safeSet(KEYS_BOOKMARKS, []);
          renderHomeStats();
          renderRecentSessions();
          renderTopicAnalytics();
          showToast('All data cleared.', 'info');
        }
      },
    ],
  });
}

// Helper for clear data (access storage key directly)
const KEYS_BOOKMARKS = 'awsquiz_bookmarks';
function safeSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ============================================================
   QUIZ SCREEN
   ============================================================ */
function renderQuizScreen() {
  const q = Quiz.getCurrentQuestion();
  if (!q) return;

  const { mode } = Quiz.state;
  const progress = Quiz.getProgress();

  // Header
  $('quiz-progress-text').textContent = `Question ${progress.current} of ${progress.total}`;
  $('quiz-progress-sub').textContent = `${progress.answeredCount} answered`;

  // Timer
  const timerEl = $('quiz-timer');
  if (mode === 'exam') {
    timerEl.classList.remove('hidden');
    updateTimerDisplay(Quiz.state.timerSeconds);
  } else {
    timerEl.classList.add('hidden');
  }

  // Progress bar
  $('progress-bar-fill').style.width = `${progress.pct}%`;

  // Question meta badges
  $('badge-category').textContent = q.category;
  $('badge-difficulty').textContent = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);
  $('badge-difficulty').className = `badge badge-${q.difficulty}`;

  // Bookmark button
  const bmBtn = $('bookmark-btn');
  bmBtn.classList.toggle('bookmarked', Storage.isBookmarked(q.id));
  bmBtn.textContent = Storage.isBookmarked(q.id) ? '⭐' : '☆';
  bmBtn.setAttribute('aria-label', Storage.isBookmarked(q.id) ? 'Remove bookmark' : 'Bookmark question');

  // Question text
  $('question-text').textContent = q.question;

  // Render options
  renderOptions(q);

  // Explanation (hidden by default; shown in practice mode after answering)
  const explBox = $('explanation-box');
  explBox.classList.add('hidden');

  // Navigation buttons
  updateNavButtons();

  // Set up timer callbacks
  Quiz.state.onTimerTick = secs => updateTimerDisplay(secs);
  Quiz.state.onTimeUp = handleTimeUp;

  // Animate card entrance
  const card = $('question-card');
  card.classList.remove('fade-in');
  void card.offsetWidth; // Reflow
  card.classList.add('fade-in');
}

function renderOptions(question) {
  const container = $('options-list');
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const userAnswer = Quiz.getUserAnswer();
  const answered = userAnswer !== -1;
  const isPractice = Quiz.state.mode === 'practice';

  container.innerHTML = question.options.map((opt, i) => {
    let cls = 'option-btn';
    let icon = '';

    if (answered) {
      if (isPractice) {
        if (i === question.correct) { cls += ' correct'; icon = '<span class="option-result-icon">✅</span>'; }
        else if (i === userAnswer) { cls += ' incorrect'; icon = '<span class="option-result-icon">❌</span>'; }
        else { cls += ' disabled'; }
      } else {
        // Exam mode: just highlight selected
        if (i === userAnswer) cls += ' selected-exam';
        else cls += ' disabled';
      }
    }

    return `
      <button class="${cls}" data-index="${i}" ${answered ? 'disabled' : ''} aria-label="Option ${letters[i]}: ${opt}">
        <span class="option-letter">${letters[i]}</span>
        <span class="option-text">${opt}</span>
        ${icon}
      </button>`;
  }).join('');

  // Show explanation if already answered in practice mode
  if (answered && isPractice) {
    showExplanation(question.explanation);
  }

  // Bind click events (only if not answered)
  if (!answered) {
    container.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => handleAnswer(parseInt(btn.dataset.index, 10)));
    });
  }
}

function handleAnswer(optionIndex) {
  const q = Quiz.getCurrentQuestion();
  Quiz.recordAnswer(optionIndex);

  const isPractice = Quiz.state.mode === 'practice';

  // Re-render options with feedback
  renderOptions(q);

  if (isPractice) {
    showExplanation(q.explanation);
    const isCorrect = optionIndex === q.correct;
    showToast(isCorrect ? 'Correct! 🎉' : 'Incorrect. Review the explanation.', isCorrect ? 'success' : 'warning', 2000);
  }

  updateNavButtons();
}

function showExplanation(text) {
  const box = $('explanation-box');
  $('explanation-text').textContent = text;
  box.classList.remove('hidden');
}

function updateNavButtons() {
  const idx = Quiz.state.currentIndex;
  const total = Quiz.state.questions.length;
  const answered = Quiz.getUserAnswer() !== -1;
  const isPractice = Quiz.state.mode === 'practice';
  const isExam = Quiz.state.mode === 'exam';

  const btnPrev = $('btn-prev');
  const btnNext = $('btn-next');
  const btnFinish = $('btn-finish');
  const btnSkip = $('btn-skip');

  // Previous button (exam mode allows going back)
  btnPrev.style.display = isExam ? 'flex' : 'none';
  btnPrev.disabled = idx === 0;

  // Skip button (exam mode only)
  btnSkip.style.display = isExam && !answered ? 'flex' : 'none';

  // Next vs Finish
  const isLast = Quiz.isLastQuestion();

  if (isLast) {
    btnNext.classList.add('hidden');
    btnFinish.classList.remove('hidden');
    btnFinish.disabled = false;
  } else {
    btnNext.classList.remove('hidden');
    btnFinish.classList.add('hidden');
    // In practice mode, Next only enabled after answering
    btnNext.disabled = isPractice && !answered;
  }
}

function updateTimerDisplay(seconds) {
  const timerEl = $('quiz-timer');
  timerEl.querySelector('.timer-value').textContent = Analytics.formatTime(seconds);

  timerEl.classList.remove('warning', 'danger');
  if (seconds <= 60) timerEl.classList.add('danger');
  else if (seconds <= 300) timerEl.classList.add('warning');
}

function handleTimeUp() {
  showToast('Time is up! Submitting your answers.', 'warning', 4000);
  finishAndShowResults();
}

function wireQuizEvents() {
  $('btn-next')?.addEventListener('click', () => {
    if (Quiz.nextQuestion()) renderQuizScreen();
  });

  $('btn-prev')?.addEventListener('click', () => {
    if (Quiz.prevQuestion()) renderQuizScreen();
  });

  $('btn-skip')?.addEventListener('click', () => {
    Quiz.recordAnswer(-1);
    if (!Quiz.nextQuestion()) {
      // Last question, just update nav
    }
    renderQuizScreen();
  });

  $('btn-finish')?.addEventListener('click', () => {
    const unanswered = Quiz.state.answers.filter(a => a === -1).length;
    if (unanswered > 0) {
      showModal({
        icon: '⚠️',
        title: `${unanswered} Unanswered Question${unanswered > 1 ? 's' : ''}`,
        body: `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Do you want to submit anyway?`,
        actions: [
          { label: 'Review First', class: 'btn-secondary' },
          { label: 'Submit Now', class: 'btn-primary', onClick: finishAndShowResults },
        ],
      });
    } else {
      finishAndShowResults();
    }
  });

  $('btn-quit-quiz')?.addEventListener('click', () => {
    showModal({
      icon: '🚪',
      title: 'Quit Quiz?',
      body: 'Your progress will be lost if you quit now. Are you sure?',
      actions: [
        { label: 'Continue Quiz', class: 'btn-primary' },
        {
          label: 'Quit', class: 'btn-secondary',
          onClick: () => {
            Quiz.stopTimer();
            showScreen('home');
          }
        },
      ],
    });
  });

  $('bookmark-btn')?.addEventListener('click', () => {
    const q = Quiz.getCurrentQuestion();
    if (!q) return;
    const nowBookmarked = Storage.toggleBookmark(q.id);
    const btn = $('bookmark-btn');
    btn.textContent = nowBookmarked ? '⭐' : '☆';
    btn.classList.toggle('bookmarked', nowBookmarked);
    btn.setAttribute('aria-label', nowBookmarked ? 'Remove bookmark' : 'Bookmark question');
    showToast(nowBookmarked ? 'Bookmarked!' : 'Bookmark removed', 'info', 1500);
    // Update bookmark count on home screen
    $('stat-bookmarks').textContent = Storage.getBookmarks().size;
  });
}

/* ============================================================
   KEYBOARD NAVIGATION
   ============================================================ */
function wireKeyboard() {
  document.addEventListener('keydown', e => {
    if (currentScreen !== 'quiz') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    const key = e.key;

    // Number keys 1-4 to select options
    if (['1', '2', '3', '4'].includes(key) && !Quiz.hasAnsweredCurrent()) {
      const idx = parseInt(key, 10) - 1;
      const btn = $('options-list')?.children[idx];
      if (btn && !btn.disabled) btn.click();
      return;
    }

    // Arrow Right / Enter / N — Next question
    if ((key === 'ArrowRight' || key === 'n' || key === 'Enter') && !e.shiftKey) {
      const nextBtn = $('btn-next');
      if (nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('hidden')) nextBtn.click();
      return;
    }

    // Arrow Left / P — Previous question (exam mode)
    if (key === 'ArrowLeft' || key === 'p') {
      const prevBtn = $('btn-prev');
      if (prevBtn && !prevBtn.disabled) prevBtn.click();
      return;
    }

    // B — Bookmark
    if (key === 'b') {
      $('bookmark-btn')?.click();
      return;
    }
  });
}

/* ============================================================
   RESULTS SCREEN
   ============================================================ */
function finishAndShowResults() {
  Quiz.finishQuiz();
  const results = Quiz.computeResults();

  // Save session
  Storage.saveSession({
    mode: results.mode,
    category: results.category,
    difficulty: results.difficulty,
    score: results.score,
    total: results.total,
    pct: results.pct,
    timestamp: results.timestamp,
  });

  // Update analytics
  const analyticsData = results.perQuestion.map(r => ({
    category: r.question.category,
    difficulty: r.question.difficulty,
    isCorrect: r.isCorrect,
  }));
  Storage.updateAnalytics(analyticsData);

  renderResultsScreen(results);
  showScreen('results');
}

function renderResultsScreen(results) {
  const { score, total, pct, unanswered, totalElapsedSeconds, catBreakdown, diffBreakdown, mode } = results;
  const grade = Analytics.getGrade(pct);

  // Score circle
  const degrees = Math.round((pct / 100) * 360);
  const circle = $('score-circle');
  circle.style.background = `conic-gradient(var(--aws-orange) ${degrees}deg, rgba(255,255,255,0.15) ${degrees}deg)`;

  $('score-pct-value').textContent = `${pct}%`;
  $('score-correct').textContent = score;
  $('result-incorrect-count').textContent = results.incorrect;
  $('result-unanswered-count').textContent = unanswered;

  // Grade
  $('grade-letter').textContent = grade.grade;
  $('grade-letter').style.color = grade.color;
  $('grade-message').textContent = grade.message;

  // Time stats
  const elapsed = totalElapsedSeconds;
  const avgPerQ = total > 0 ? Math.round(elapsed / total) : 0;
  $('time-total').textContent = Analytics.formatTime(elapsed);
  $('time-per-q').textContent = `${avgPerQ}s`;
  $('time-mode').textContent = mode === 'exam' ? 'Timed Exam' : 'Practice';
  if (mode === 'exam') {
    const remaining = Quiz.state.timerSeconds;
    $('time-remaining-row').style.display = 'flex';
    $('time-remaining').textContent = Analytics.formatTime(remaining);
  } else {
    $('time-remaining-row').style.display = 'none';
  }

  // Category breakdown
  renderCategoryBreakdown(catBreakdown);

  // Difficulty breakdown
  renderDifficultyBreakdown(diffBreakdown);

  // Store results for review
  $('btn-review-incorrect').style.display = results.incorrectItems.length > 0 ? 'flex' : 'none';

  // Wire results action buttons
  wireResultsButtons(results);
}

function renderCategoryBreakdown(catBreakdown) {
  const container = $('category-breakdown');
  if (!container) return;

  const cats = Object.entries(catBreakdown).map(([cat, { correct, total }]) => ({
    cat, correct, total,
    pct: total > 0 ? Math.round((correct / total) * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  if (cats.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No category data.</p>';
    return;
  }

  container.innerHTML = cats.map(({ cat, correct, total, pct }) => {
    const fillClass = pct >= 70 ? 'good' : pct >= 50 ? 'average' : 'poor';
    return `
      <div class="category-result-item">
        <span class="cat-name" title="${correct}/${total}">${cat}</span>
        <div class="cat-bar-track">
          <div class="cat-bar-fill ${fillClass}" style="width:0%" data-pct="${pct}"></div>
        </div>
        <span class="cat-pct">${pct}%</span>
      </div>`;
  }).join('');

  // Animate bars
  requestAnimationFrame(() => {
    container.querySelectorAll('.cat-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  });
}

function renderDifficultyBreakdown(diffBreakdown) {
  ['easy', 'medium', 'hard'].forEach(diff => {
    const { correct, total } = diffBreakdown[diff] || { correct: 0, total: 0 };
    const pct = total > 0 ? Math.round((correct / total) * 100) : null;
    const el = $(`diff-${diff}`);
    if (el) {
      el.querySelector('.diff-pct').textContent = pct !== null ? `${pct}%` : '—';
      el.querySelector('.diff-count').textContent = total > 0 ? `${correct}/${total}` : 'N/A';
    }
  });
}

function wireResultsButtons(results) {
  $('btn-review-incorrect')?.addEventListener('click', () => {
    renderReviewScreen(results.incorrectItems);
    showScreen('review');
  });

  $('btn-retry-same')?.addEventListener('click', () => {
    Quiz.initQuiz({
      mode: results.mode,
      category: results.category,
      difficulty: results.difficulty,
      count: results.total,
      shuffleQ: true,
      shuffleA: true,
    });
    showScreen('quiz');
    renderQuizScreen();
  });

  $('btn-new-quiz')?.addEventListener('click', () => {
    renderHomeStats();
    renderRecentSessions();
    renderTopicAnalytics();
    showScreen('home');
  });

  $('btn-export-results')?.addEventListener('click', () => exportResults(results));
}

/* ============================================================
   REVIEW SCREEN
   ============================================================ */
function renderReviewScreen(incorrectItems) {
  const container = $('review-list');
  const letters = ['A', 'B', 'C', 'D', 'E'];

  $('review-count').textContent = `${incorrectItems.length} question${incorrectItems.length !== 1 ? 's' : ''}`;

  if (incorrectItems.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><p>Perfect score! No incorrect answers to review.</p></div>';
    return;
  }

  container.innerHTML = incorrectItems.map((item, i) => {
    const q = item.question;
    const userAns = item.userAnswer;
    const correctAns = item.correct;
    const wasSkipped = !item.wasAnswered;

    return `
      <div class="review-item">
        <div class="review-item-header">
          <span class="question-num">Q${i + 1} · ${wasSkipped ? 'Skipped' : 'Incorrect'}</span>
          <span class="badge badge-category">${q.category}</span>
          <span class="badge badge-${q.difficulty}">${q.difficulty}</span>
        </div>
        <div class="review-item-body">
          <p class="review-question-text">${q.question}</p>
          <div class="review-options">
            ${wasSkipped ? '<div class="review-option your-answer">⚠️ This question was skipped</div>' :
              `<div class="review-option your-answer">
                ❌ Your answer: <strong>${letters[userAns]}. ${q.options[userAns]}</strong>
              </div>`}
            <div class="review-option correct-answer">
              ✅ Correct: <strong>${letters[correctAns]}. ${q.options[correctAns]}</strong>
            </div>
          </div>
          <div class="review-explanation">
            <div class="expl-label">📖 Explanation</div>
            <p>${q.explanation}</p>
          </div>
        </div>
      </div>`;
  }).join('');
}

function wireReviewEvents() {
  $('btn-back-to-results')?.addEventListener('click', () => showScreen('results'));
}

/* ============================================================
   EXPORT RESULTS
   ============================================================ */
function exportResults(results) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    mode: results.mode,
    category: results.category,
    difficulty: results.difficulty,
    score: `${results.score}/${results.total}`,
    percentage: `${results.pct}%`,
    grade: Analytics.getGrade(results.pct).grade,
    timeTaken: Analytics.formatTime(results.totalElapsedSeconds),
    categoryBreakdown: Object.entries(results.catBreakdown).map(([cat, { correct, total }]) => ({
      category: cat,
      score: `${correct}/${total}`,
      accuracy: `${total > 0 ? Math.round((correct / total) * 100) : 0}%`,
    })),
    questions: results.perQuestion.map((r, i) => ({
      number: i + 1,
      question: r.question.question,
      yourAnswer: r.userAnswer >= 0 ? r.question.options[r.userAnswer] : 'Skipped',
      correctAnswer: r.question.options[r.correct],
      isCorrect: r.isCorrect,
      explanation: r.question.explanation,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aws-quiz-results-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Results exported!', 'success');
}

/* ============================================================
   INITIALIZATION
   ============================================================ */
async function init() {
  // Apply saved theme
  const prefs = Storage.getPreferences();
  applyTheme(prefs.theme);

  // Wire global theme toggles
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // Load questions
  try {
    await Quiz.loadQuestions();
  } catch (err) {
    console.error('Failed to load questions:', err);
    showToast('Failed to load questions. Please refresh.', 'warning');
    return;
  }

  // Initialize home screen
  initHomeScreen();

  // Wire quiz events
  wireQuizEvents();
  wireKeyboard();

  // Wire review events
  wireReviewEvents();

  // Show home screen
  showScreen('home');
}

// Start the app once DOM is ready
document.addEventListener('DOMContentLoaded', init);
