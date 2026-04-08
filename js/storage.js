/**
 * storage.js — LocalStorage management for the AWS SAA-C03 Quiz App
 * Handles persistence of: sessions, bookmarks, analytics, preferences
 */

const KEYS = {
  SESSIONS: 'awsquiz_sessions',
  BOOKMARKS: 'awsquiz_bookmarks',
  ANALYTICS: 'awsquiz_analytics',
  PREFERENCES: 'awsquiz_preferences',
  CURRENT_QUIZ: 'awsquiz_current',
};

const MAX_SESSIONS = 10; // Keep last N sessions

/* ---- Generic helpers ---- */

function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // QuotaExceededError or private mode
  }
}

/* ---- Sessions ---- */

/**
 * Save a completed quiz session.
 * @param {Object} session
 */
function saveSession(session) {
  const sessions = getSessions();
  sessions.unshift({ ...session, id: Date.now() });
  // Keep only the last MAX_SESSIONS entries
  if (sessions.length > MAX_SESSIONS) sessions.splice(MAX_SESSIONS);
  safeSet(KEYS.SESSIONS, sessions);
}

/** Return all saved sessions (newest first). */
function getSessions() {
  return safeGet(KEYS.SESSIONS, []);
}

/** Clear all saved sessions. */
function clearSessions() {
  safeSet(KEYS.SESSIONS, []);
}

/* ---- Bookmarks ---- */

/** Return the Set of bookmarked question IDs. */
function getBookmarks() {
  return new Set(safeGet(KEYS.BOOKMARKS, []));
}

/** Toggle a bookmark for the given question ID. Returns the new state. */
function toggleBookmark(questionId) {
  const bookmarks = getBookmarks();
  if (bookmarks.has(questionId)) {
    bookmarks.delete(questionId);
  } else {
    bookmarks.add(questionId);
  }
  safeSet(KEYS.BOOKMARKS, [...bookmarks]);
  return bookmarks.has(questionId);
}

/** Check if a question is bookmarked. */
function isBookmarked(questionId) {
  return getBookmarks().has(questionId);
}

/* ---- Analytics ---- */

/**
 * Update cumulative analytics after a quiz session.
 * @param {Object} sessionResult - { category, difficulty, correct, total }[]
 */
function updateAnalytics(sessionResults) {
  const analytics = safeGet(KEYS.ANALYTICS, {
    totalAttempted: 0,
    totalCorrect: 0,
    byCategory: {},
    byDifficulty: { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } },
    lastUpdated: null,
  });

  sessionResults.forEach(({ category, difficulty, isCorrect }) => {
    analytics.totalAttempted += 1;
    if (isCorrect) analytics.totalCorrect += 1;

    // By category
    if (!analytics.byCategory[category]) {
      analytics.byCategory[category] = { correct: 0, total: 0 };
    }
    analytics.byCategory[category].total += 1;
    if (isCorrect) analytics.byCategory[category].correct += 1;

    // By difficulty
    const diff = difficulty.toLowerCase();
    if (analytics.byDifficulty[diff]) {
      analytics.byDifficulty[diff].total += 1;
      if (isCorrect) analytics.byDifficulty[diff].correct += 1;
    }
  });

  analytics.lastUpdated = new Date().toISOString();
  safeSet(KEYS.ANALYTICS, analytics);
  return analytics;
}

/** Return cumulative analytics object. */
function getAnalytics() {
  return safeGet(KEYS.ANALYTICS, {
    totalAttempted: 0,
    totalCorrect: 0,
    byCategory: {},
    byDifficulty: { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } },
    lastUpdated: null,
  });
}

/** Clear all analytics data. */
function clearAnalytics() {
  safeSet(KEYS.ANALYTICS, null);
}

/* ---- Preferences ---- */

/** Return user preferences (theme, sound, etc). */
function getPreferences() {
  return safeGet(KEYS.PREFERENCES, {
    theme: 'light',
    soundEnabled: false,
  });
}

/** Save a preference value. */
function setPreference(key, value) {
  const prefs = getPreferences();
  prefs[key] = value;
  safeSet(KEYS.PREFERENCES, prefs);
}

/* ---- In-progress quiz state ---- */

function saveCurrentQuiz(state) {
  safeSet(KEYS.CURRENT_QUIZ, state);
}

function getCurrentQuiz() {
  return safeGet(KEYS.CURRENT_QUIZ, null);
}

function clearCurrentQuiz() {
  localStorage.removeItem(KEYS.CURRENT_QUIZ);
}

/* ---- Public API ---- */
const Storage = {
  saveSession,
  getSessions,
  clearSessions,
  getBookmarks,
  toggleBookmark,
  isBookmarked,
  updateAnalytics,
  getAnalytics,
  clearAnalytics,
  getPreferences,
  setPreference,
  saveCurrentQuiz,
  getCurrentQuiz,
  clearCurrentQuiz,
};
