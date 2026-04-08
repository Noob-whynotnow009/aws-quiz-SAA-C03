/**
 * quiz.js — Quiz state management
 * Handles question loading, filtering, shuffling, and scoring
 */

/* ============================================================
   Question Loading & Filtering
   ============================================================ */

let _allQuestions = []; // Cached from questions.json

/**
 * Load all questions from the JSON file (fetched once, then cached).
 * @returns {Promise<Array>}
 */
async function loadQuestions() {
  if (_allQuestions.length > 0) return _allQuestions;
  const res = await fetch('data/questions.json');
  if (!res.ok) throw new Error('Failed to load questions.json');
  const data = await res.json();
  _allQuestions = data.questions || [];
  return _allQuestions;
}

/**
 * Filter questions by category and/or difficulty.
 * @param {Object} opts - { category: string, difficulty: string }
 * @returns {Array}
 */
function filterQuestions({ category = 'all', difficulty = 'all' } = {}) {
  return _allQuestions.filter(q => {
    const catMatch = category === 'all' || q.category === category;
    const diffMatch = difficulty === 'all' || q.difficulty === difficulty;
    return catMatch && diffMatch;
  });
}

/**
 * Get unique categories from all questions.
 * @returns {string[]}
 */
function getCategories() {
  const cats = new Set(_allQuestions.map(q => q.category));
  return [...cats].sort();
}

/* ============================================================
   Shuffling
   ============================================================ */

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 * @param {Array} arr
 * @returns {Array}
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
 * Shuffle the answer options for a question while keeping track of the correct answer index.
 * Returns a new question object with shuffled options and updated correct index.
 * @param {Object} question
 * @returns {Object}
 */
function shuffleOptions(question) {
  const indices = question.options.map((_, i) => i);
  const shuffledIndices = shuffle(indices);
  const newCorrect = shuffledIndices.indexOf(question.correct);
  return {
    ...question,
    options: shuffledIndices.map(i => question.options[i]),
    correct: newCorrect,
    _originalCorrect: question.correct,
  };
}

/* ============================================================
   Quiz State
   ============================================================ */

const QuizState = {
  // Configuration
  mode: 'practice',         // 'practice' | 'exam'
  category: 'all',
  difficulty: 'all',
  totalQuestions: 20,
  shuffleQuestions: true,
  shuffleAnswers: true,

  // Runtime state
  questions: [],            // Active question list (filtered + shuffled)
  currentIndex: 0,
  answers: [],              // User's chosen option index per question (-1 = unanswered)
  answeredAt: [],           // Timestamp when each question was answered
  startTime: null,
  endTime: null,
  timerSeconds: 0,          // Remaining time (exam mode)
  timerInterval: null,
  isFinished: false,
  bookmarks: new Set(),

  // Callbacks
  onTimerTick: null,
  onTimeUp: null,
};

/** Reset quiz state to defaults, keeping config. */
function resetState() {
  QuizState.questions = [];
  QuizState.currentIndex = 0;
  QuizState.answers = [];
  QuizState.answeredAt = [];
  QuizState.startTime = null;
  QuizState.endTime = null;
  QuizState.timerSeconds = 0;
  QuizState.isFinished = false;
  stopTimer();
}

/* ============================================================
   Quiz Lifecycle
   ============================================================ */

/**
 * Initialize a new quiz session.
 * @param {Object} config - { mode, category, difficulty, count, shuffleQ, shuffleA }
 * @returns {boolean} true if quiz was started, false if not enough questions
 */
function initQuiz(config) {
  const {
    mode = 'practice',
    category = 'all',
    difficulty = 'all',
    count = 20,
    shuffleQ = true,
    shuffleA = true,
  } = config;

  resetState();

  QuizState.mode = mode;
  QuizState.category = category;
  QuizState.difficulty = difficulty;
  QuizState.totalQuestions = count;
  QuizState.shuffleQuestions = shuffleQ;
  QuizState.shuffleAnswers = shuffleA;

  let pool = filterQuestions({ category, difficulty });

  if (pool.length === 0) return false;

  if (shuffleQ) pool = shuffle(pool);
  pool = pool.slice(0, Math.min(count, pool.length));

  if (shuffleA) pool = pool.map(shuffleOptions);

  QuizState.questions = pool;
  QuizState.answers = new Array(pool.length).fill(-1);
  QuizState.answeredAt = new Array(pool.length).fill(null);
  QuizState.startTime = Date.now();
  QuizState.bookmarks = Storage.getBookmarks();

  // Start timer for exam mode
  if (mode === 'exam') {
    // 90 seconds per question is typical for SAA-C03
    QuizState.timerSeconds = pool.length * 90;
    startTimer();
  }

  return true;
}

/** Record the user's answer for the current question. */
function recordAnswer(optionIndex) {
  QuizState.answers[QuizState.currentIndex] = optionIndex;
  QuizState.answeredAt[QuizState.currentIndex] = Date.now();
}

/** Move to the next question. Returns false if already at the last. */
function nextQuestion() {
  if (QuizState.currentIndex < QuizState.questions.length - 1) {
    QuizState.currentIndex += 1;
    return true;
  }
  return false;
}

/** Move to the previous question (review/exam navigation). */
function prevQuestion() {
  if (QuizState.currentIndex > 0) {
    QuizState.currentIndex -= 1;
    return true;
  }
  return false;
}

/** Jump to a specific question index. */
function goToQuestion(index) {
  if (index >= 0 && index < QuizState.questions.length) {
    QuizState.currentIndex = index;
    return true;
  }
  return false;
}

/** Mark the quiz as finished and record end time. */
function finishQuiz() {
  stopTimer();
  QuizState.isFinished = true;
  QuizState.endTime = Date.now();
}

/* ============================================================
   Scoring
   ============================================================ */

/** Compute quiz results from current state. */
function computeResults() {
  const { questions, answers, startTime, endTime, mode } = QuizState;
  const totalElapsedMs = (endTime || Date.now()) - startTime;

  let correct = 0;
  const perQuestion = questions.map((q, i) => {
    const userAnswer = answers[i];
    const isCorrect = userAnswer === q.correct;
    if (isCorrect) correct += 1;
    return {
      question: q,
      userAnswer,
      correct: q.correct,
      isCorrect,
      wasAnswered: userAnswer !== -1,
    };
  });

  const total = questions.length;
  const score = correct;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const unanswered = answers.filter(a => a === -1).length;

  const catBreakdown = Analytics.buildCategoryBreakdown(questions, answers);
  const diffBreakdown = Analytics.buildDifficultyBreakdown(questions, answers);

  const incorrectItems = perQuestion.filter(r => !r.isCorrect && r.wasAnswered);
  const unansweredItems = perQuestion.filter(r => !r.wasAnswered);

  return {
    score,
    total,
    pct,
    unanswered,
    correct,
    incorrect: total - correct - unanswered,
    totalElapsedSeconds: Math.floor(totalElapsedMs / 1000),
    mode,
    category: QuizState.category,
    difficulty: QuizState.difficulty,
    catBreakdown,
    diffBreakdown,
    perQuestion,
    incorrectItems: [...incorrectItems, ...unansweredItems],
    timestamp: new Date().toISOString(),
  };
}

/* ============================================================
   Timer (Exam Mode)
   ============================================================ */

function startTimer() {
  stopTimer();
  QuizState.timerInterval = setInterval(() => {
    QuizState.timerSeconds = Math.max(0, QuizState.timerSeconds - 1);
    if (typeof QuizState.onTimerTick === 'function') {
      QuizState.onTimerTick(QuizState.timerSeconds);
    }
    if (QuizState.timerSeconds === 0) {
      stopTimer();
      if (typeof QuizState.onTimeUp === 'function') {
        QuizState.onTimeUp();
      }
    }
  }, 1000);
}

function stopTimer() {
  if (QuizState.timerInterval) {
    clearInterval(QuizState.timerInterval);
    QuizState.timerInterval = null;
  }
}

/* ============================================================
   Getters
   ============================================================ */

function getCurrentQuestion() {
  return QuizState.questions[QuizState.currentIndex] || null;
}

function getUserAnswer() {
  return QuizState.answers[QuizState.currentIndex];
}

function hasAnsweredCurrent() {
  return QuizState.answers[QuizState.currentIndex] !== -1;
}

function isLastQuestion() {
  return QuizState.currentIndex === QuizState.questions.length - 1;
}

function getProgress() {
  return {
    current: QuizState.currentIndex + 1,
    total: QuizState.questions.length,
    pct: Math.round(((QuizState.currentIndex + 1) / QuizState.questions.length) * 100),
    answeredCount: QuizState.answers.filter(a => a !== -1).length,
  };
}

/* ============================================================
   Public API
   ============================================================ */
const Quiz = {
  loadQuestions,
  filterQuestions,
  getCategories,
  shuffle,
  initQuiz,
  recordAnswer,
  nextQuestion,
  prevQuestion,
  goToQuestion,
  finishQuiz,
  computeResults,
  stopTimer,
  getCurrentQuestion,
  getUserAnswer,
  hasAnsweredCurrent,
  isLastQuestion,
  getProgress,
  state: QuizState,
};
