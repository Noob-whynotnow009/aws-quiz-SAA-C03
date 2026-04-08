/**
 * analytics.js — Topic performance tracking helpers
 * Computes and formats analytics data for display
 */

/**
 * Compute per-category accuracy from cumulative analytics.
 * Returns an array sorted by accuracy (ascending) for display.
 * @param {Object} byCategory - { EC2: { correct: 5, total: 8 }, ... }
 * @returns {Array} [{ category, correct, total, accuracy }]
 */
function getCategoryAccuracy(byCategory) {
  return Object.entries(byCategory)
    .map(([category, { correct, total }]) => ({
      category,
      correct,
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy); // weakest first
}

/**
 * Compute per-difficulty accuracy.
 * @param {Object} byDifficulty - { easy: { correct, total }, ... }
 * @returns {Object} { easy: pct, medium: pct, hard: pct }
 */
function getDifficultyAccuracy(byDifficulty) {
  const result = {};
  for (const [diff, { correct, total }] of Object.entries(byDifficulty)) {
    result[diff] = total > 0 ? Math.round((correct / total) * 100) : null;
  }
  return result;
}

/**
 * Derive a letter grade and message from a percentage score.
 * @param {number} pct - 0-100
 * @returns {{ grade: string, message: string, color: string }}
 */
function getGrade(pct) {
  if (pct >= 90) return { grade: 'A+', message: 'Outstanding! Exam-ready!', color: '#38a169' };
  if (pct >= 80) return { grade: 'A', message: 'Excellent! Almost there!', color: '#38a169' };
  if (pct >= 70) return { grade: 'B', message: 'Good job! Keep practicing.', color: '#d69e2e' };
  if (pct >= 60) return { grade: 'C', message: 'Passing score — room to grow.', color: '#d69e2e' };
  if (pct >= 50) return { grade: 'D', message: 'Needs improvement. Review the explanations.', color: '#e53e3e' };
  return { grade: 'F', message: 'Keep studying — you\'ll get there!', color: '#e53e3e' };
}

/**
 * Format seconds into MM:SS string.
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a date as a relative string (e.g. "2 hours ago").
 * @param {string|number} dateInput - ISO string or timestamp
 * @returns {string}
 */
function timeAgo(dateInput) {
  const now = Date.now();
  const then = new Date(dateInput).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateInput).toLocaleDateString();
}

/**
 * Compute session-level category breakdown from answers array.
 * @param {Array} questions - full question objects
 * @param {Array} answers - parallel array of chosen indices (-1 = skipped)
 * @returns {Object} { EC2: { correct, total }, ... }
 */
function buildCategoryBreakdown(questions, answers) {
  const breakdown = {};
  questions.forEach((q, i) => {
    const cat = q.category;
    if (!breakdown[cat]) breakdown[cat] = { correct: 0, total: 0 };
    breakdown[cat].total += 1;
    if (answers[i] === q.correct) breakdown[cat].correct += 1;
  });
  return breakdown;
}

/**
 * Build difficulty breakdown from a quiz session.
 */
function buildDifficultyBreakdown(questions, answers) {
  const breakdown = { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } };
  questions.forEach((q, i) => {
    const diff = (q.difficulty || 'medium').toLowerCase();
    if (breakdown[diff]) {
      breakdown[diff].total += 1;
      if (answers[i] === q.correct) breakdown[diff].correct += 1;
    }
  });
  return breakdown;
}

const Analytics = {
  getCategoryAccuracy,
  getDifficultyAccuracy,
  getGrade,
  formatTime,
  timeAgo,
  buildCategoryBreakdown,
  buildDifficultyBreakdown,
};
