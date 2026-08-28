"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => OmniQuizPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/dashboard.ts
var import_obsidian = require("obsidian");

// src/analytics.ts
var LEVELS = ["L1", "L2", "L3", "L4"];
var UNCATEGORIZED_TOPIC = "\u672A\u5206\u7C7B";
function percentage(correct, answered) {
  return answered === 0 ? null : Math.round(correct / answered * 100);
}
function createLevelAnalytics() {
  return {
    L1: { questionCount: 0, answeredCount: 0, correctCount: 0, accuracy: null },
    L2: { questionCount: 0, answeredCount: 0, correctCount: 0, accuracy: null },
    L3: { questionCount: 0, answeredCount: 0, correctCount: 0, accuracy: null },
    L4: { questionCount: 0, answeredCount: 0, correctCount: 0, accuracy: null }
  };
}
function createTypeCounts() {
  return { single: 0, multiple: 0, true_false: 0, fill_blank: 0 };
}
function getCurrentSession(history) {
  return history?.sessions.at(-1);
}
function getSessionAccuracy(session, entry) {
  let answeredCount = 0;
  let correctCount = 0;
  for (const question of entry.quiz.questions) {
    const latest = session?.answers[question.id]?.at(-1);
    if (!latest) continue;
    answeredCount += 1;
    if (latest.correct) correctCount += 1;
  }
  return {
    answeredCount,
    correctCount,
    accuracy: percentage(correctCount, answeredCount)
  };
}
function getLatestActivity(history) {
  let latest = null;
  for (const session of history?.sessions ?? []) {
    if (session.completedAt !== void 0) {
      latest = Math.max(latest ?? session.completedAt, session.completedAt);
    }
    for (const attempts of Object.values(session.answers)) {
      for (const attempt of attempts) {
        latest = Math.max(latest ?? attempt.answeredAt, attempt.answeredAt);
      }
    }
  }
  return latest;
}
function getQuestionAttempts(history, questionId) {
  return (history?.sessions ?? []).flatMap((session) => session.answers[questionId] ?? []).sort((left, right) => left.answeredAt - right.answeredAt);
}
function expandTopicPaths(topics) {
  if (topics.length === 0) return [UNCATEGORIZED_TOPIC];
  const paths = /* @__PURE__ */ new Set();
  for (const topic of topics) {
    const segments = topic.split("/").filter(Boolean);
    for (let index = 1; index <= segments.length; index += 1) {
      paths.add(segments.slice(0, index).join("/"));
    }
  }
  return [...paths];
}
function getOrCreateTopic(topics, path) {
  const existing = topics.get(path);
  if (existing) return existing;
  const segments = path.split("/");
  const topic = {
    path,
    label: path === UNCATEGORIZED_TOPIC ? path : segments.join(" \u203A "),
    depth: path === UNCATEGORIZED_TOPIC ? 0 : segments.length - 1,
    quizKeys: /* @__PURE__ */ new Set(),
    questionCount: 0,
    wrongQuestionCount: 0,
    answeredCount: 0,
    correctCount: 0,
    accuracy: null
  };
  topics.set(path, topic);
  return topic;
}
function startOfLocalWeek(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date.getTime();
}
function createWeeklyTrend(now) {
  const currentWeek = new Date(startOfLocalWeek(now));
  const result = [];
  for (let offset = 7; offset >= 0; offset -= 1) {
    const week = new Date(currentWeek);
    week.setDate(week.getDate() - offset * 7);
    result.push({
      weekStart: week.getTime(),
      answeredCount: 0,
      correctCount: 0,
      accuracy: null
    });
  }
  return result;
}
function buildDashboardAnalytics(entries, histories, now = Date.now()) {
  const levels = createLevelAnalytics();
  const types = createTypeCounts();
  const quizzes = {};
  const wrongQuestions = [];
  const topicMap = /* @__PURE__ */ new Map();
  const weeklyTrend = createWeeklyTrend(now);
  const trendByWeek = new Map(weeklyTrend.map((point) => [point.weekStart, point]));
  let questionCount = 0;
  let answeredCount = 0;
  let correctCount = 0;
  let attemptedQuizCount = 0;
  let completedSessionCount = 0;
  let incompleteQuizCount = 0;
  let latestActivityAt = null;
  for (const entry of entries) {
    const history = histories[entry.quizKey];
    const currentSession = getCurrentSession(history);
    const current = getSessionAccuracy(currentSession, entry);
    const topicPaths = expandTopicPaths(entry.topics);
    let quizAnswered = 0;
    let quizCorrect = 0;
    let totalAttemptCount = 0;
    let quizWrongQuestionCount = 0;
    questionCount += entry.quiz.questions.length;
    for (const topicPath of topicPaths) {
      const topic = getOrCreateTopic(topicMap, topicPath);
      topic.quizKeys.add(entry.quizKey);
      topic.questionCount += entry.quiz.questions.length;
    }
    for (const question of entry.quiz.questions) {
      levels[question.level].questionCount += 1;
      types[question.type] += 1;
    }
    for (const session of history?.sessions ?? []) {
      for (const question of entry.quiz.questions) {
        const attempts = session.answers[question.id];
        if (!attempts || attempts.length === 0) continue;
        totalAttemptCount += attempts.length;
        quizAnswered += 1;
        answeredCount += 1;
        levels[question.level].answeredCount += 1;
        for (const topicPath of topicPaths) {
          getOrCreateTopic(topicMap, topicPath).answeredCount += 1;
        }
        const firstAttempt = attempts[0];
        if (firstAttempt?.correct) {
          quizCorrect += 1;
          correctCount += 1;
          levels[question.level].correctCount += 1;
          for (const topicPath of topicPaths) {
            getOrCreateTopic(topicMap, topicPath).correctCount += 1;
          }
        }
        if (firstAttempt) {
          const trendPoint = trendByWeek.get(startOfLocalWeek(firstAttempt.answeredAt));
          if (trendPoint) {
            trendPoint.answeredCount += 1;
            if (firstAttempt.correct) trendPoint.correctCount += 1;
          }
        }
      }
    }
    for (const question of entry.quiz.questions) {
      const attempts = getQuestionAttempts(history, question.id);
      const latestAttempt = attempts.at(-1);
      if (!latestAttempt || latestAttempt.correct) continue;
      const wrongAttemptCount = attempts.filter((attempt) => !attempt.correct).length;
      wrongQuestions.push({
        quizKey: entry.quizKey,
        filePath: entry.filePath,
        quizId: entry.quiz.id,
        quizTitle: entry.quiz.title,
        questionId: question.id,
        question: question.question,
        type: question.type,
        level: question.level,
        topics: entry.topics,
        wrongAttemptCount,
        lastWrongAt: latestAttempt.answeredAt
      });
      quizWrongQuestionCount += 1;
      for (const topicPath of topicPaths) {
        getOrCreateTopic(topicMap, topicPath).wrongQuestionCount += 1;
      }
    }
    const completed = history?.sessions.filter((session) => session.completedAt !== void 0).length ?? 0;
    const isInProgress = currentSession?.completedAt === void 0 && current.answeredCount > 0;
    const quizLatestActivity = getLatestActivity(history);
    completedSessionCount += completed;
    if (isInProgress) incompleteQuizCount += 1;
    if (totalAttemptCount > 0) attemptedQuizCount += 1;
    if (quizLatestActivity !== null) {
      latestActivityAt = Math.max(latestActivityAt ?? quizLatestActivity, quizLatestActivity);
    }
    quizzes[entry.quizKey] = {
      quizKey: entry.quizKey,
      completedSessionCount: completed,
      totalAttemptCount,
      currentAnsweredCount: current.answeredCount,
      currentAccuracy: current.accuracy,
      firstAccuracy: percentage(quizCorrect, quizAnswered),
      latestActivityAt: quizLatestActivity,
      wrongQuestionCount: quizWrongQuestionCount,
      isInProgress
    };
  }
  for (const level of LEVELS) {
    levels[level].accuracy = percentage(
      levels[level].correctCount,
      levels[level].answeredCount
    );
  }
  for (const point of weeklyTrend) {
    point.accuracy = percentage(point.correctCount, point.answeredCount);
  }
  wrongQuestions.sort(
    (left, right) => right.wrongAttemptCount - left.wrongAttemptCount || right.lastWrongAt - left.lastWrongAt || left.question.localeCompare(right.question)
  );
  const topics = [...topicMap.values()].map((topic) => ({
    path: topic.path,
    label: topic.label,
    depth: topic.depth,
    quizCount: topic.quizKeys.size,
    questionCount: topic.questionCount,
    wrongQuestionCount: topic.wrongQuestionCount,
    answeredCount: topic.answeredCount,
    correctCount: topic.correctCount,
    accuracy: percentage(topic.correctCount, topic.answeredCount)
  })).sort(
    (left, right) => right.wrongQuestionCount - left.wrongQuestionCount || (left.accuracy ?? 101) - (right.accuracy ?? 101) || left.label.localeCompare(right.label)
  );
  return {
    quizCount: entries.length,
    questionCount,
    attemptedQuizCount,
    completedSessionCount,
    incompleteQuizCount,
    wrongQuestionCount: wrongQuestions.length,
    latestActivityAt,
    answeredCount,
    correctCount,
    accuracy: percentage(correctCount, answeredCount),
    levels,
    types,
    quizzes,
    wrongQuestions,
    topics,
    weeklyTrend
  };
}

// src/parser.ts
var QuizParseError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "QuizParseError";
  }
};
var LEVELS2 = ["L1", "L2", "L3", "L4"];
var QUESTION_TYPES = [
  "single",
  "multiple",
  "true_false",
  "fill_blank"
];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readRequiredString(value, field, errorPrefix = "Quiz") {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new QuizParseError(`${errorPrefix} \u7F3A\u5C11\u6709\u6548\u7684 ${field}`);
  }
  return value;
}
function parseLevel(value, questionId, legacy) {
  if (legacy && value === void 0) return "L1";
  if (typeof value !== "string" || !LEVELS2.includes(value)) {
    throw new QuizParseError(`\u9898\u76EE ${questionId} \u7684 level \u5FC5\u987B\u662F L1\u2013L4`);
  }
  return value;
}
function parseOption(value, questionId) {
  if (!isRecord(value)) {
    throw new QuizParseError(`\u9898\u76EE ${questionId} \u5305\u542B\u65E0\u6548\u9009\u9879`);
  }
  return {
    id: readRequiredString(value.id, "id", `\u9898\u76EE ${questionId} \u7684\u9009\u9879`),
    text: readRequiredString(value.text, "text", `\u9898\u76EE ${questionId} \u7684\u9009\u9879`)
  };
}
function parseOptions(value, questionId) {
  if (!Array.isArray(value) || value.length < 2) {
    throw new QuizParseError(`\u9898\u76EE ${questionId} \u81F3\u5C11\u9700\u8981 2 \u4E2A\u9009\u9879`);
  }
  const options = value.map((option) => parseOption(option, questionId));
  const optionIds = /* @__PURE__ */ new Set();
  for (const option of options) {
    if (optionIds.has(option.id)) {
      throw new QuizParseError(`\u9898\u76EE ${questionId} \u5B58\u5728\u91CD\u590D\u9009\u9879 ID`);
    }
    optionIds.add(option.id);
  }
  return options;
}
function parseExplanation(value, questionId) {
  if (value !== void 0 && typeof value !== "string") {
    throw new QuizParseError(`\u9898\u76EE ${questionId} \u7684 explanation \u65E0\u6548`);
  }
  return typeof value === "string" ? { explanation: value } : {};
}
function parseQuestion(value, legacy) {
  if (!isRecord(value)) throw new QuizParseError("Quiz \u5305\u542B\u65E0\u6548\u9898\u76EE");
  const id = readRequiredString(value.id, "id", "\u9898\u76EE");
  const question = readRequiredString(value.question, "question", `\u9898\u76EE ${id}`);
  const rawType = value.type ?? (legacy ? "single" : void 0);
  if (typeof rawType !== "string" || !QUESTION_TYPES.includes(rawType)) {
    throw new QuizParseError(`\u9898\u76EE ${id} \u7684 type \u65E0\u6548`);
  }
  const common = {
    id,
    question,
    level: parseLevel(value.level, id, legacy),
    ...parseExplanation(value.explanation, id)
  };
  if (rawType === "single") {
    const options = parseOptions(value.options, id);
    const answer = readRequiredString(value.answer, "answer", `\u9898\u76EE ${id}`);
    if (!options.some((option) => option.id === answer)) {
      throw new QuizParseError(`\u9898\u76EE ${id} \u7684\u6B63\u786E\u7B54\u6848\u65E0\u6548`);
    }
    return { ...common, type: "single", options, answer };
  }
  if (rawType === "multiple") {
    const options = parseOptions(value.options, id);
    if (!Array.isArray(value.answer) || value.answer.length === 0) {
      throw new QuizParseError(`\u9898\u76EE ${id} \u81F3\u5C11\u9700\u8981 1 \u4E2A\u6B63\u786E\u7B54\u6848`);
    }
    const answer = value.answer.map(
      (item) => readRequiredString(item, "answer", `\u9898\u76EE ${id}`)
    );
    if (new Set(answer).size !== answer.length || answer.some((item) => !options.some((option) => option.id === item))) {
      throw new QuizParseError(`\u9898\u76EE ${id} \u7684\u6B63\u786E\u7B54\u6848\u65E0\u6548`);
    }
    return { ...common, type: "multiple", options, answer };
  }
  if (rawType === "true_false") {
    if (typeof value.answer !== "boolean") {
      throw new QuizParseError(`\u9898\u76EE ${id} \u7684 answer \u5FC5\u987B\u662F\u5E03\u5C14\u503C`);
    }
    return {
      ...common,
      type: "true_false",
      answer: value.answer
    };
  }
  if (!Array.isArray(value.answers) || value.answers.length === 0) {
    throw new QuizParseError(`\u9898\u76EE ${id} \u81F3\u5C11\u9700\u8981 1 \u4E2A\u53C2\u8003\u7B54\u6848`);
  }
  const answers = value.answers.map(
    (item) => readRequiredString(item, "answers", `\u9898\u76EE ${id}`)
  );
  if (value.caseSensitive !== void 0 && typeof value.caseSensitive !== "boolean") {
    throw new QuizParseError(`\u9898\u76EE ${id} \u7684 caseSensitive \u65E0\u6548`);
  }
  return {
    ...common,
    type: "fill_blank",
    answers,
    caseSensitive: value.caseSensitive === true
  };
}
function parseMode(value, legacy) {
  if (value === void 0 && legacy) return "quick";
  if (value !== "quick" && value !== "standard") {
    throw new QuizParseError("Quiz \u7684 mode \u5FC5\u987B\u662F quick \u6216 standard");
  }
  return value;
}
function parseDifficulty(value) {
  if (value === void 0) return void 0;
  if (!isRecord(value)) throw new QuizParseError("Quiz \u7684 difficulty \u65E0\u6548");
  const min = value.min;
  const max = value.max;
  if (typeof min !== "string" || typeof max !== "string" || !LEVELS2.includes(min) || !LEVELS2.includes(max)) {
    throw new QuizParseError("Quiz \u7684 difficulty \u5FC5\u987B\u4F7F\u7528 L1\u2013L4");
  }
  if (LEVELS2.indexOf(min) > LEVELS2.indexOf(max)) {
    throw new QuizParseError("Quiz \u7684 difficulty.min \u4E0D\u80FD\u9AD8\u4E8E max");
  }
  return { min, max };
}
function parseQuiz(source) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new QuizParseError("Quiz JSON \u683C\u5F0F\u9519\u8BEF", { cause: error });
  }
  if (!isRecord(parsed)) throw new QuizParseError("Quiz \u683C\u5F0F\u9519\u8BEF");
  const rawVersion = parsed.schemaVersion;
  if (rawVersion !== void 0 && rawVersion !== 2) {
    throw new QuizParseError("Quiz \u7684 schemaVersion \u4EC5\u652F\u6301 2");
  }
  const legacy = rawVersion === void 0;
  const id = readRequiredString(parsed.id, "id");
  const title = readRequiredString(parsed.title, "title");
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new QuizParseError("Quiz \u4E2D\u6CA1\u6709\u9898\u76EE");
  }
  const questions = parsed.questions.map((item) => parseQuestion(item, legacy));
  const questionIds = /* @__PURE__ */ new Set();
  for (const item of questions) {
    if (questionIds.has(item.id)) throw new QuizParseError("\u5B58\u5728\u91CD\u590D\u9898\u76EE ID");
    questionIds.add(item.id);
  }
  const difficulty = parseDifficulty(parsed.difficulty);
  return {
    schemaVersion: legacy ? 1 : 2,
    id,
    title,
    mode: parseMode(parsed.mode, legacy),
    ...difficulty ? { difficulty } : {},
    questions
  };
}

// src/catalog.ts
var QUIZ_BLOCK_PATTERN = /^```quiz[\t ]*\r?\n([\s\S]*?)^```[\t ]*$/gm;
function normalizeTopicTags(tags) {
  const normalized = /* @__PURE__ */ new Set();
  for (const tag of tags) {
    const topic = tag.trim().replace(/^#+/, "").split("/").map((segment) => segment.trim()).filter(Boolean).join("/");
    if (topic) normalized.add(topic);
  }
  return [...normalized].sort((left, right) => left.localeCompare(right));
}
function extractQuizCatalog(filePath, markdown, topics = []) {
  const entries = [];
  const errors = [];
  let blockIndex = 0;
  let match;
  while ((match = QUIZ_BLOCK_PATTERN.exec(markdown)) !== null) {
    blockIndex += 1;
    try {
      const quiz = parseQuiz(match[1] ?? "");
      entries.push({
        quizKey: `${filePath}::${quiz.id}`,
        filePath,
        blockIndex,
        topics: normalizeTopicTags(topics),
        quiz
      });
    } catch (error) {
      errors.push({
        filePath,
        blockIndex,
        message: error instanceof QuizParseError ? error.message : "Quiz \u683C\u5F0F\u9519\u8BEF"
      });
    }
  }
  return { entries, errors };
}
async function scanQuizCatalog(app, getTopics) {
  const entries = [];
  const errors = [];
  const seenKeys = /* @__PURE__ */ new Set();
  for (const file of app.vault.getMarkdownFiles()) {
    let source;
    try {
      source = await app.vault.cachedRead(file);
    } catch {
      errors.push({
        filePath: file.path,
        blockIndex: 0,
        message: "\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6"
      });
      continue;
    }
    const result = extractQuizCatalog(file.path, source, getTopics(file));
    for (const entry of result.entries) {
      if (seenKeys.has(entry.quizKey)) {
        errors.push({
          filePath: file.path,
          blockIndex: entry.blockIndex,
          message: `Quiz ID ${entry.quiz.id} \u5728\u540C\u4E00\u6587\u4EF6\u4E2D\u91CD\u590D`
        });
        continue;
      }
      seenKeys.add(entry.quizKey);
      entries.push(entry);
    }
    errors.push(...result.errors);
  }
  return { entries, errors };
}

// src/library.ts
function filterQuizCatalogEntries(entries, analytics, filters) {
  const query = filters.query.trim().toLowerCase();
  return entries.filter((entry) => {
    const quiz = analytics[entry.quizKey];
    if (filters.mode !== "all" && entry.quiz.mode !== filters.mode) return false;
    if (filters.topic !== "all" && !expandTopicPaths(entry.topics).includes(filters.topic)) return false;
    if (filters.status === "not_started" && (quiz?.totalAttemptCount ?? 0) > 0) return false;
    if (filters.status === "in_progress" && !quiz?.isInProgress) return false;
    if (filters.status === "completed" && (quiz?.completedSessionCount ?? 0) === 0) return false;
    if (filters.status === "wrong" && (quiz?.wrongQuestionCount ?? 0) === 0) return false;
    return query.length === 0 || [
      entry.quiz.title,
      entry.quiz.id,
      entry.filePath,
      ...entry.topics,
      ...entry.topics.map((topic) => topic.split("/").join(" \u203A "))
    ].some((value) => value.toLowerCase().includes(query));
  }).sort((left, right) => compareEntries(left, right, analytics, filters.sort));
}
function compareEntries(left, right, analytics, sort) {
  const leftAnalytics = analytics[left.quizKey];
  const rightAnalytics = analytics[right.quizKey];
  if (sort === "wrong") {
    return (rightAnalytics?.wrongQuestionCount ?? 0) - (leftAnalytics?.wrongQuestionCount ?? 0) || (rightAnalytics?.latestActivityAt ?? 0) - (leftAnalytics?.latestActivityAt ?? 0);
  }
  if (sort === "accuracy") {
    return (leftAnalytics?.firstAccuracy ?? 101) - (rightAnalytics?.firstAccuracy ?? 101) || left.quiz.title.localeCompare(right.quiz.title);
  }
  if (sort === "title") return left.quiz.title.localeCompare(right.quiz.title);
  return (rightAnalytics?.latestActivityAt ?? 0) - (leftAnalytics?.latestActivityAt ?? 0) || left.quiz.title.localeCompare(right.quiz.title);
}

// src/dashboard.ts
var QUIZ_DASHBOARD_VIEW = "omni-quiz-dashboard";
var LEVELS3 = ["L1", "L2", "L3", "L4"];
var QUESTION_TYPES2 = [
  "single",
  "multiple",
  "true_false",
  "fill_blank"
];
var TYPE_LABELS = {
  single: "\u5355\u9009",
  multiple: "\u591A\u9009",
  true_false: "\u5224\u65AD",
  fill_blank: "\u586B\u7A7A"
};
var ACTIVITY_DATE_FORMATTER = new Intl.DateTimeFormat(void 0, {
  year: "numeric",
  month: "short",
  day: "numeric"
});
var WEEK_DATE_FORMATTER = new Intl.DateTimeFormat(void 0, {
  month: "numeric",
  day: "numeric"
});
function formatAccuracy(value) {
  return value === null ? "\u2014" : `${value}%`;
}
function formatActivity(value) {
  if (value === null) return "\u5C1A\u672A\u5F00\u59CB";
  return ACTIVITY_DATE_FORMATTER.format(value);
}
function displayTopic(topic) {
  return topic.split("/").join(" \u203A ");
}
var QuizDashboardView = class extends import_obsidian.ItemView {
  constructor(leaf, storage, focusCoordinator) {
    super(leaf);
    this.storage = storage;
    this.focusCoordinator = focusCoordinator;
    this.icon = "library-big";
    this.navigation = false;
    this.addAction("refresh-cw", "\u5237\u65B0\u6D4B\u8BD5\u9898\u7D22\u5F15", () => {
      void this.reloadCatalog();
    });
  }
  storage;
  focusCoordinator;
  catalog = { entries: [], errors: [] };
  analytics = buildDashboardAnalytics([], {});
  activeSection = "review";
  query = "";
  modeFilter = "all";
  statusFilter = "all";
  sortOption = "recent";
  topicFilter = "all";
  showAllWrong = false;
  scanVersion = 0;
  refreshTimer = null;
  loading = true;
  loadError = null;
  getViewType() {
    return QUIZ_DASHBOARD_VIEW;
  }
  getDisplayText() {
    return "Omni Quiz";
  }
  async onOpen() {
    this.contentEl.addClass("omni-quiz-dashboard");
    this.registerDomEvent(this.contentEl, "input", (event) => this.handleInput(event));
    this.registerDomEvent(this.contentEl, "change", (event) => this.handleChange(event));
    this.registerDomEvent(this.contentEl, "click", (event) => this.handleClick(event));
    const refreshForFile = (file) => {
      if (file instanceof import_obsidian.TFile && file.extension === "md") {
        this.scheduleCatalogReload();
      }
    };
    this.registerEvent(this.app.vault.on("create", refreshForFile));
    this.registerEvent(this.app.vault.on("modify", refreshForFile));
    this.registerEvent(this.app.vault.on("delete", refreshForFile));
    this.registerEvent(this.app.vault.on("rename", refreshForFile));
    this.registerEvent(this.app.metadataCache.on("changed", refreshForFile));
    this.register(this.storage.onChange(() => this.render()));
    this.register(() => {
      const viewWindow = this.contentEl.ownerDocument.defaultView;
      if (viewWindow && this.refreshTimer !== null) {
        viewWindow.clearTimeout(this.refreshTimer);
      }
    });
    await this.reloadCatalog();
  }
  scheduleCatalogReload() {
    const viewWindow = this.contentEl.ownerDocument.defaultView;
    if (!viewWindow) {
      void this.reloadCatalog();
      return;
    }
    if (this.refreshTimer !== null) viewWindow.clearTimeout(this.refreshTimer);
    this.refreshTimer = viewWindow.setTimeout(() => {
      this.refreshTimer = null;
      void this.reloadCatalog();
    }, 350);
  }
  getInput(event) {
    const inputType = this.contentEl.ownerDocument.defaultView?.HTMLInputElement;
    return inputType && event.target instanceof inputType ? event.target : null;
  }
  handleInput(event) {
    const input = this.getInput(event);
    if (!input || input.dataset.role !== "quiz-search") return;
    this.query = input.value;
    this.renderLibraryResults();
  }
  handleChange(event) {
    const selectType = this.contentEl.ownerDocument.defaultView?.HTMLSelectElement;
    if (!selectType || !(event.target instanceof selectType)) return;
    const { role } = event.target.dataset;
    if (role === "mode-filter") this.modeFilter = event.target.value;
    else if (role === "status-filter") this.statusFilter = event.target.value;
    else if (role === "sort-option") this.sortOption = event.target.value;
    else if (role === "topic-filter") this.topicFilter = event.target.value;
    else return;
    this.renderLibraryResults();
  }
  handleClick(event) {
    const elementType = this.contentEl.ownerDocument.defaultView?.Element;
    if (!elementType || !(event.target instanceof elementType)) return;
    const button = event.target.closest("button[data-action]");
    if (!button || !this.contentEl.contains(button)) return;
    const action = button.dataset.action;
    if (action === "switch-section" && button.dataset.section) {
      this.activeSection = button.dataset.section;
      this.render();
    } else if (action === "open-quiz" && button.dataset.filePath) {
      void this.openQuizFile(button.dataset.filePath);
    } else if (action === "focus-question" && button.dataset.filePath && button.dataset.quizId && button.dataset.questionId) {
      void this.openQuizFile(button.dataset.filePath, {
        filePath: button.dataset.filePath,
        quizId: button.dataset.quizId,
        questionId: button.dataset.questionId
      });
    } else if (action === "select-topic" && button.dataset.topic) {
      this.topicFilter = button.dataset.topic;
      this.activeSection = "library";
      this.render();
    } else if (action === "show-all-wrong") {
      this.showAllWrong = true;
      this.render();
    } else if (action === "refresh") {
      void this.reloadCatalog();
    } else if (action === "clear-filters") {
      this.resetFilters();
      this.render();
    }
  }
  resetFilters() {
    this.query = "";
    this.modeFilter = "all";
    this.statusFilter = "all";
    this.sortOption = "recent";
    this.topicFilter = "all";
  }
  async openQuizFile(filePath, focus) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian.TFile)) return;
    await this.app.workspace.getLeaf("tab").openFile(file);
    if (focus) this.focusCoordinator.request(focus);
  }
  async reloadCatalog() {
    const version = ++this.scanVersion;
    this.loading = true;
    this.loadError = null;
    this.render();
    try {
      const catalog = await scanQuizCatalog(this.app, (file) => {
        const cache = this.app.metadataCache.getFileCache(file);
        return cache ? (0, import_obsidian.getAllTags)(cache) ?? [] : [];
      });
      if (version !== this.scanVersion) return;
      this.catalog = catalog;
    } catch (error) {
      if (version !== this.scanVersion) return;
      this.loadError = "\u65E0\u6CD5\u8BFB\u53D6\u77E5\u8BC6\u5E93\u4E2D\u7684\u6D4B\u8BD5\u9898\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5";
      console.error("Omni Quiz failed to scan the vault", error);
    } finally {
      if (version === this.scanVersion) {
        this.loading = false;
        this.render();
      }
    }
  }
  render() {
    this.contentEl.empty();
    if (!this.loading && !this.loadError) {
      this.analytics = buildDashboardAnalytics(
        this.catalog.entries,
        this.storage.getHistories()
      );
    }
    const shell = this.contentEl.createDiv({ cls: "quiz-dashboard-shell" });
    this.renderHero(shell);
    this.renderNavigation(shell);
    if (this.loading) {
      this.renderStatus(shell, "\u6B63\u5728\u7D22\u5F15\u77E5\u8BC6\u5E93\u4E2D\u7684\u6D4B\u8BD5\u9898\u2026", false);
      return;
    }
    if (this.loadError) {
      this.renderStatus(shell, this.loadError, true);
      return;
    }
    if (this.activeSection === "review") this.renderReview(shell);
    else if (this.activeSection === "topics") this.renderTopics(shell);
    else if (this.activeSection === "library") this.renderLibrary(shell);
    else this.renderStatistics(shell);
    this.renderCatalogWarnings(shell);
  }
  renderHero(parent) {
    const hero = parent.createEl("header", { cls: "quiz-dashboard-hero" });
    const copy = hero.createDiv();
    copy.createDiv({ cls: "quiz-dashboard-eyebrow", text: "Review index" });
    copy.createEl("h1", { text: "\u77E5\u8BC6\u590D\u4E60\u53F0" });
    copy.createEl("p", {
      text: "\u4ECE\u5C1A\u672A\u638C\u63E1\u7684\u9898\u76EE\u51FA\u53D1\uFF0C\u6CBF\u7740\u4E3B\u9898\u7D22\u5F15\u56DE\u5230\u77E5\u8BC6\u539F\u6587\u3002"
    });
    const status = hero.createDiv({ cls: "quiz-dashboard-hero-status" });
    status.createSpan({ text: "\u6700\u8FD1\u5B66\u4E60" });
    status.createEl("strong", { text: formatActivity(this.analytics.latestActivityAt) });
  }
  renderNavigation(parent) {
    const nav = parent.createEl("nav", {
      cls: "quiz-dashboard-nav",
      attr: { "aria-label": "\u77E5\u8BC6\u590D\u4E60\u53F0" }
    });
    const sections = [
      ["review", "\u590D\u4E60", "\u5C1A\u672A\u638C\u63E1"],
      ["topics", "\u4E3B\u9898", "\u77E5\u8BC6\u7D22\u5F15"],
      ["library", "\u9898\u5E93", "\u5168\u90E8\u6D4B\u8BD5"],
      ["statistics", "\u7EDF\u8BA1", "\u5B66\u4E60\u4FE1\u53F7"]
    ];
    for (const [section, label, detail] of sections) {
      const button = nav.createEl("button", {
        attr: {
          type: "button",
          "data-action": "switch-section",
          "data-section": section,
          ...this.activeSection === section ? { "aria-current": "page" } : {}
        }
      });
      button.createEl("strong", { text: label });
      button.createSpan({ text: detail });
    }
  }
  renderStatus(parent, message, showRetry) {
    const status = parent.createDiv({ cls: "quiz-dashboard-status" });
    status.createEl("p", { text: message });
    if (showRetry) {
      status.createEl("button", {
        text: "\u91CD\u65B0\u7D22\u5F15",
        attr: { type: "button", "data-action": "refresh" }
      });
    }
  }
  renderReview(parent) {
    const summary = parent.createEl("section", {
      cls: "quiz-review-summary",
      attr: { "aria-label": "\u590D\u4E60\u6982\u89C8" }
    });
    const wrong = summary.createDiv({ cls: "quiz-review-number is-wrong" });
    wrong.createSpan({ text: "\u5F85\u590D\u4E60" });
    wrong.createEl("strong", { text: String(this.analytics.wrongQuestionCount) });
    wrong.createEl("small", { text: "\u9053\u6700\u65B0\u4F5C\u7B54\u4ECD\u9519\u8BEF\u7684\u9898" });
    const progress = summary.createDiv({ cls: "quiz-review-number" });
    progress.createSpan({ text: "\u7EE7\u7EED\u6D4B\u8BD5" });
    progress.createEl("strong", { text: String(this.analytics.incompleteQuizCount) });
    progress.createEl("small", { text: "\u4EFD\u5C1A\u672A\u5B8C\u6210\u7684\u6D4B\u8BD5" });
    const grid = parent.createDiv({ cls: "quiz-review-grid" });
    const queue = grid.createEl("section", { cls: "quiz-review-queue" });
    this.renderSectionHeading(
      queue,
      "\u9519\u9898\u7D22\u5F15",
      this.analytics.wrongQuestionCount === 0 ? "\u5F53\u524D\u6CA1\u6709\u5F85\u590D\u4E60\u9898" : "\u5148\u5904\u7406\u53CD\u590D\u51FA\u9519\u7684\u77E5\u8BC6"
    );
    const wrongLimit = this.showAllWrong ? 100 : 5;
    this.renderWrongQuestions(queue, this.analytics.wrongQuestions.slice(0, wrongLimit));
    if (!this.showAllWrong && this.analytics.wrongQuestionCount > 5) {
      queue.createEl("button", {
        cls: "quiz-text-action",
        text: `\u67E5\u770B\u5168\u90E8 ${this.analytics.wrongQuestionCount} \u9053\u9519\u9898`,
        attr: { type: "button", "data-action": "show-all-wrong" }
      });
    }
    const aside = grid.createEl("aside", { cls: "quiz-review-aside" });
    this.renderContinueList(aside);
    this.renderWeakTopics(aside, this.analytics.topics.slice(0, 4));
    this.renderMiniTrend(aside);
  }
  renderWrongQuestions(parent, questions) {
    if (questions.length === 0) {
      const empty = parent.createDiv({ cls: "quiz-library-empty" });
      empty.createEl("h3", { text: "\u9519\u9898\u5DF2\u7ECF\u6E05\u7A7A" });
      empty.createEl("p", { text: "\u65B0\u7684\u9519\u8BEF\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC\uFF1B\u7B54\u5BF9\u540E\u4F1A\u81EA\u52A8\u79FB\u9664\u3002" });
      return;
    }
    const list = parent.createDiv({ cls: "quiz-wrong-list" });
    for (const item of questions) {
      const card = list.createEl("article", { cls: "quiz-wrong-card" });
      const body = card.createDiv({ cls: "quiz-wrong-card-body" });
      const meta = body.createDiv({ cls: "quiz-card-meta" });
      meta.createSpan({ text: item.quizTitle });
      meta.createSpan({ text: item.level });
      meta.createSpan({ text: TYPE_LABELS[item.type] });
      body.createEl("h3", { text: item.question });
      const details = body.createDiv({ cls: "quiz-wrong-details" });
      details.createSpan({ text: `\u9519\u8BEF ${item.wrongAttemptCount} \u6B21` });
      details.createSpan({ text: formatActivity(item.lastWrongAt) });
      for (const topic of item.topics.slice(0, 2)) {
        details.createSpan({ text: displayTopic(topic) });
      }
      card.createEl("button", {
        text: "\u5B9A\u4F4D\u539F\u9898",
        attr: {
          type: "button",
          "data-action": "focus-question",
          "data-file-path": item.filePath,
          "data-quiz-id": item.quizId,
          "data-question-id": item.questionId
        }
      });
    }
  }
  renderContinueList(parent) {
    const section = parent.createEl("section", { cls: "quiz-aside-panel" });
    this.renderSectionHeading(section, "\u7EE7\u7EED\u6D4B\u8BD5", `${this.analytics.incompleteQuizCount} \u4EFD\u8FDB\u884C\u4E2D`);
    const entries = this.catalog.entries.filter((entry) => this.analytics.quizzes[entry.quizKey]?.isInProgress).sort(
      (left, right) => (this.analytics.quizzes[right.quizKey]?.latestActivityAt ?? 0) - (this.analytics.quizzes[left.quizKey]?.latestActivityAt ?? 0)
    ).slice(0, 3);
    if (entries.length === 0) {
      section.createEl("p", { cls: "quiz-muted-copy", text: "\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u6D4B\u8BD5\u3002" });
      return;
    }
    for (const entry of entries) {
      const item = section.createEl("button", {
        cls: "quiz-continue-item",
        attr: {
          type: "button",
          "data-action": "open-quiz",
          "data-file-path": entry.filePath
        }
      });
      item.createEl("strong", { text: entry.quiz.title });
      item.createSpan({
        text: `${this.analytics.quizzes[entry.quizKey]?.currentAnsweredCount ?? 0} / ${entry.quiz.questions.length}`
      });
    }
  }
  renderWeakTopics(parent, topics) {
    const section = parent.createEl("section", { cls: "quiz-aside-panel" });
    this.renderSectionHeading(section, "\u8584\u5F31\u4E3B\u9898", "\u6309\u5F85\u590D\u4E60\u9898\u6392\u5E8F");
    if (topics.length === 0) {
      section.createEl("p", { cls: "quiz-muted-copy", text: "\u6DFB\u52A0\u7B14\u8BB0\u6807\u7B7E\u540E\u4F1A\u5EFA\u7ACB\u4E3B\u9898\u7D22\u5F15\u3002" });
      return;
    }
    for (const topic of topics) {
      const button = section.createEl("button", {
        cls: "quiz-topic-row",
        attr: {
          type: "button",
          "data-action": "select-topic",
          "data-topic": topic.path
        }
      });
      button.createSpan({ text: topic.label });
      button.createEl("strong", { text: `${topic.wrongQuestionCount} \xB7 ${formatAccuracy(topic.accuracy)}` });
    }
  }
  renderMiniTrend(parent) {
    const section = parent.createEl("section", { cls: "quiz-aside-panel" });
    this.renderSectionHeading(section, "\u8FD1 8 \u5468", "\u9996\u6B21\u56DE\u7B54\u6B63\u786E\u7387");
    this.renderTrendChart(section, true);
  }
  renderTopics(parent) {
    const section = parent.createEl("section", { cls: "quiz-dashboard-section" });
    this.renderSectionHeading(section, "\u4E3B\u9898\u7D22\u5F15", `${this.analytics.topics.length} \u4E2A\u4E3B\u9898\u8DEF\u5F84`);
    section.createEl("p", {
      cls: "quiz-section-intro",
      text: "\u4E3B\u9898\u6765\u81EA\u7B14\u8BB0\u6807\u7B7E\u3002\u5D4C\u5957\u6807\u7B7E\u540C\u65F6\u6C47\u603B\u5230\u7236\u7EA7\uFF0C\u70B9\u51FB\u540E\u67E5\u770B\u8BE5\u4E3B\u9898\u4E0B\u7684\u6D4B\u8BD5\u3002"
    });
    const grid = section.createDiv({ cls: "quiz-topic-grid" });
    for (const topic of this.analytics.topics) this.renderTopicCard(grid, topic);
  }
  renderTopicCard(parent, topic) {
    const card = parent.createEl("button", {
      cls: "quiz-topic-card",
      attr: {
        type: "button",
        "data-action": "select-topic",
        "data-topic": topic.path
      }
    });
    card.createSpan({ cls: "quiz-topic-depth", text: topic.depth === 0 ? "\u4E3B\u9898" : `\u5C42\u7EA7 ${topic.depth + 1}` });
    card.createEl("h3", { text: topic.label });
    const facts = card.createDiv({ cls: "quiz-topic-facts" });
    facts.createSpan({ text: `${topic.quizCount} \u4EFD\u6D4B\u8BD5` });
    facts.createSpan({ text: `${topic.questionCount} \u9053\u9898` });
    facts.createSpan({ text: `${topic.wrongQuestionCount} \u9053\u5F85\u590D\u4E60` });
    const signal = card.createDiv({ cls: "quiz-topic-signal" });
    signal.createSpan({ text: "\u9996\u6B21\u6B63\u786E\u7387" });
    signal.createEl("strong", { text: formatAccuracy(topic.accuracy) });
  }
  renderLibrary(parent) {
    const section = parent.createEl("section", { cls: "quiz-library-section" });
    this.renderSectionHeading(section, "\u6D4B\u8BD5\u9898\u5E93", `${this.catalog.entries.length} \u4EFD\u53EF\u7528\u6D4B\u8BD5`);
    const controls = section.createDiv({ cls: "quiz-library-controls" });
    this.renderSearchControl(controls);
    this.renderSelectControl(controls, "\u6A21\u5F0F", "mode-filter", this.modeFilter, [
      ["all", "\u5168\u90E8\u6A21\u5F0F"],
      ["quick", "\u5FEB\u901F\u6D4B\u9A8C"],
      ["standard", "\u6807\u51C6\u6D4B\u9A8C"]
    ]);
    this.renderSelectControl(controls, "\u72B6\u6001", "status-filter", this.statusFilter, [
      ["all", "\u5168\u90E8\u72B6\u6001"],
      ["not_started", "\u672A\u5F00\u59CB"],
      ["in_progress", "\u8FDB\u884C\u4E2D"],
      ["completed", "\u5DF2\u5B8C\u6210"],
      ["wrong", "\u6709\u5F85\u590D\u4E60\u9898"]
    ]);
    this.renderTopicControl(controls);
    this.renderSelectControl(controls, "\u6392\u5E8F", "sort-option", this.sortOption, [
      ["recent", "\u6700\u8FD1\u5B66\u4E60"],
      ["wrong", "\u5F85\u590D\u4E60\u4F18\u5148"],
      ["accuracy", "\u6B63\u786E\u7387\uFF08\u4F4E\u5230\u9AD8\uFF09"],
      ["title", "\u6807\u9898"]
    ]);
    section.createDiv({ cls: "quiz-library-results" });
    this.renderLibraryResults();
  }
  renderSearchControl(parent) {
    const label = parent.createEl("label", { cls: "quiz-search-field" });
    label.createSpan({ text: "\u641C\u7D22" });
    label.createEl("input", {
      type: "search",
      value: this.query,
      attr: { placeholder: "\u6807\u9898\u3001\u8DEF\u5F84\u3001Quiz ID \u6216\u4E3B\u9898", "data-role": "quiz-search" }
    });
  }
  renderSelectControl(parent, labelText, role, value, options) {
    const label = parent.createEl("label", { cls: "quiz-filter-field" });
    label.createSpan({ text: labelText });
    const select = label.createEl("select", { attr: { "data-role": role } });
    for (const [optionValue, text] of options) select.createEl("option", { value: optionValue, text });
    select.value = value;
  }
  renderTopicControl(parent) {
    const topics = [...this.analytics.topics].sort((left, right) => left.label.localeCompare(right.label));
    this.renderSelectControl(
      parent,
      "\u4E3B\u9898",
      "topic-filter",
      this.topicFilter,
      [["all", "\u5168\u90E8\u4E3B\u9898"], ...topics.map((topic) => [topic.path, topic.label])]
    );
  }
  renderLibraryResults() {
    const results = this.contentEl.querySelector(".quiz-library-results");
    if (!results) return;
    results.empty();
    const entries = this.getFilteredEntries();
    if (entries.length === 0) {
      const empty = results.createDiv({ cls: "quiz-library-empty" });
      empty.createEl("h3", {
        text: this.catalog.entries.length === 0 ? "\u77E5\u8BC6\u5E93\u91CC\u8FD8\u6CA1\u6709\u6D4B\u8BD5\u9898" : "\u6CA1\u6709\u5339\u914D\u7684\u6D4B\u8BD5\u9898"
      });
      empty.createEl("p", {
        text: this.catalog.entries.length === 0 ? "\u5728 Markdown \u4E2D\u52A0\u5165 quiz \u4EE3\u7801\u5757\u540E\uFF0C\u8FD9\u91CC\u4F1A\u81EA\u52A8\u5EFA\u7ACB\u7D22\u5F15\u3002" : "\u4FEE\u6539\u641C\u7D22\u5185\u5BB9\u6216\u6E05\u9664\u7B5B\u9009\u6761\u4EF6\u3002"
      });
      if (this.catalog.entries.length > 0) {
        empty.createEl("button", {
          text: "\u6E05\u9664\u7B5B\u9009",
          attr: { type: "button", "data-action": "clear-filters" }
        });
      }
      return;
    }
    results.createDiv({ cls: "quiz-library-result-count", text: `${entries.length} \u4EFD\u6D4B\u8BD5` });
    const list = results.createDiv({ cls: "quiz-library-list" });
    for (const entry of entries.slice(0, 100)) {
      this.renderQuizCard(list, entry, this.analytics.quizzes[entry.quizKey]);
    }
    if (entries.length > 100) {
      results.createDiv({ cls: "quiz-library-limit", text: `\u5F53\u524D\u663E\u793A\u524D 100 \u4EFD\uFF0C\u8BF7\u7F29\u5C0F ${entries.length} \u4EFD\u7ED3\u679C\u3002` });
    }
  }
  getFilteredEntries() {
    return filterQuizCatalogEntries(this.catalog.entries, this.analytics.quizzes, {
      query: this.query,
      mode: this.modeFilter,
      status: this.statusFilter,
      topic: this.topicFilter,
      sort: this.sortOption
    });
  }
  renderQuizCard(parent, entry, analytics) {
    const card = parent.createEl("article", { cls: "quiz-library-card" });
    if ((analytics?.wrongQuestionCount ?? 0) > 0) card.addClass("has-wrong");
    const body = card.createDiv({ cls: "quiz-library-card-body" });
    const tags = body.createDiv({ cls: "quiz-library-card-tags" });
    tags.createSpan({ cls: "quiz-badge", text: entry.quiz.mode === "standard" ? "\u6807\u51C6\u6D4B\u9A8C" : "\u5FEB\u901F\u6D4B\u9A8C" });
    if (entry.quiz.difficulty) {
      tags.createSpan({ cls: "quiz-badge", text: `${entry.quiz.difficulty.min}\u2013${entry.quiz.difficulty.max}` });
    }
    for (const topic of entry.topics.slice(0, 2)) tags.createSpan({ cls: "quiz-badge", text: displayTopic(topic) });
    if (entry.topics.length > 2) tags.createSpan({ cls: "quiz-badge", text: `+${entry.topics.length - 2}` });
    body.createEl("h3", { text: entry.quiz.title });
    body.createDiv({ cls: "quiz-library-path", text: entry.filePath });
    const facts = body.createDiv({ cls: "quiz-library-facts" });
    facts.createSpan({ text: `${entry.quiz.questions.length} \u9053\u9898` });
    facts.createSpan({ text: `${analytics?.completedSessionCount ?? 0} \u6B21\u5B8C\u6210` });
    facts.createSpan({ text: `\u9996\u6B21\u6B63\u786E\u7387 ${formatAccuracy(analytics?.firstAccuracy ?? null)}` });
    if ((analytics?.wrongQuestionCount ?? 0) > 0) {
      facts.createEl("strong", { text: `${analytics?.wrongQuestionCount} \u9053\u5F85\u590D\u4E60` });
    }
    const progress = card.createDiv({ cls: "quiz-library-card-progress" });
    const label = progress.createDiv({ cls: "quiz-library-progress-label" });
    label.createSpan({ text: analytics?.isInProgress ? "\u5F53\u524D\u8FDB\u5EA6" : "\u6700\u8FD1\u8FDB\u5EA6" });
    label.createSpan({ text: `${analytics?.currentAnsweredCount ?? 0} / ${entry.quiz.questions.length}` });
    progress.createEl("progress", {
      attr: {
        max: String(entry.quiz.questions.length),
        value: String(analytics?.currentAnsweredCount ?? 0),
        "aria-label": `${entry.quiz.title} \u5F53\u524D\u8FDB\u5EA6`
      }
    });
    progress.createDiv({ cls: "quiz-library-activity", text: formatActivity(analytics?.latestActivityAt ?? null) });
    card.createEl("button", {
      cls: "quiz-library-open",
      text: analytics?.isInProgress ? "\u7EE7\u7EED\u6D4B\u8BD5" : "\u6253\u5F00\u6D4B\u8BD5",
      attr: { type: "button", "data-action": "open-quiz", "data-file-path": entry.filePath }
    });
  }
  renderStatistics(parent) {
    const section = parent.createEl("section", { cls: "quiz-dashboard-section" });
    this.renderSectionHeading(section, "\u5B66\u4E60\u7EDF\u8BA1", "\u5F53\u524D\u9898\u5E93\u4E0E\u5386\u53F2\u9996\u6B21\u56DE\u7B54");
    const overview = section.createDiv({ cls: "quiz-dashboard-overview" });
    this.renderMetric(overview, "\u6D4B\u8BD5\u9898", String(this.analytics.quizCount), "\u4EFD");
    this.renderMetric(overview, "\u9898\u76EE", String(this.analytics.questionCount), "\u9053");
    this.renderMetric(overview, "\u5DF2\u5B8C\u6210", String(this.analytics.completedSessionCount), "\u6B21\u4F1A\u8BDD");
    this.renderMetric(overview, "\u9996\u6B21\u6B63\u786E\u7387", formatAccuracy(this.analytics.accuracy), `${this.analytics.answeredCount} \u6B21\u56DE\u7B54`);
    this.renderMetric(overview, "\u5F85\u590D\u4E60", String(this.analytics.wrongQuestionCount), "\u9053\u9898");
    this.renderKnowledgeSignal(section);
    const lower = section.createDiv({ cls: "quiz-statistics-lower" });
    const trend = lower.createEl("section", { cls: "quiz-statistics-panel" });
    this.renderSectionHeading(trend, "\u8FD1 8 \u5468\u8D8B\u52BF", "\u67F1\u9AD8\u4E3A\u56DE\u7B54\u91CF\uFF0C\u586B\u5145\u4E3A\u6B63\u786E\u7387");
    this.renderTrendChart(trend, false);
    const topics = lower.createEl("section", { cls: "quiz-statistics-panel" });
    this.renderSectionHeading(topics, "\u8584\u5F31\u4E3B\u9898", "\u5F85\u590D\u4E60\u6570 \xB7 \u9996\u6B21\u6B63\u786E\u7387");
    this.renderWeakTopicTable(topics);
  }
  renderMetric(parent, label, value, detail) {
    const metric = parent.createDiv({ cls: "quiz-dashboard-metric" });
    metric.createDiv({ cls: "quiz-dashboard-metric-label", text: label });
    metric.createDiv({ cls: "quiz-dashboard-metric-value", text: value });
    metric.createDiv({ cls: "quiz-dashboard-metric-detail", text: detail });
  }
  renderKnowledgeSignal(parent) {
    const signal = parent.createDiv({ cls: "quiz-dashboard-signal" });
    const levels = signal.createEl("section", { cls: "quiz-level-panel" });
    this.renderSectionHeading(levels, "\u8BA4\u77E5\u5C42\u7EA7", "\u9996\u6B21\u56DE\u7B54\u6B63\u786E\u7387");
    const track = levels.createDiv({ cls: "quiz-level-track" });
    for (const level of LEVELS3) {
      const item = track.createDiv({ cls: "quiz-level-segment" });
      const title = item.createDiv({ cls: "quiz-level-title" });
      title.createEl("strong", { text: level });
      title.createSpan({ text: formatAccuracy(this.analytics.levels[level].accuracy) });
      item.createEl("progress", {
        attr: { max: "100", value: String(this.analytics.levels[level].accuracy ?? 0), "aria-label": `${level} \u9996\u6B21\u6B63\u786E\u7387` }
      });
      item.createDiv({ cls: "quiz-level-detail", text: `${this.analytics.levels[level].questionCount} \u9053\u9898 \xB7 ${this.analytics.levels[level].answeredCount} \u6B21\u56DE\u7B54` });
    }
    const types = signal.createEl("section", { cls: "quiz-type-distribution" });
    types.createEl("h3", { text: "\u9898\u578B\u6784\u6210" });
    for (const type of QUESTION_TYPES2) {
      const row = types.createDiv({ cls: "quiz-type-row" });
      const label = row.createDiv({ cls: "quiz-type-label" });
      label.createSpan({ text: TYPE_LABELS[type] });
      label.createSpan({ text: String(this.analytics.types[type]) });
      row.createEl("progress", {
        attr: { max: String(Math.max(this.analytics.questionCount, 1)), value: String(this.analytics.types[type]), "aria-label": `${TYPE_LABELS[type]}\u9898\u6570\u91CF` }
      });
    }
  }
  renderTrendChart(parent, compact) {
    const maxAnswers = Math.max(...this.analytics.weeklyTrend.map((point) => point.answeredCount), 1);
    const chart = parent.createDiv({ cls: compact ? "quiz-trend-chart is-compact" : "quiz-trend-chart" });
    for (const point of this.analytics.weeklyTrend) {
      const column = chart.createDiv({ cls: "quiz-trend-column" });
      const value = column.createDiv({ cls: "quiz-trend-value", text: point.answeredCount === 0 ? "\u2014" : formatAccuracy(point.accuracy) });
      value.setAttr("aria-hidden", "true");
      const bar = column.createDiv({ cls: "quiz-trend-bar" });
      bar.style.setProperty("--quiz-trend-volume", `${Math.round(point.answeredCount / maxAnswers * 100)}%`);
      const accuracy = bar.createDiv({ cls: "quiz-trend-accuracy" });
      accuracy.style.setProperty("--quiz-trend-accuracy", `${point.accuracy ?? 0}%`);
      bar.setAttr("role", "img");
      bar.setAttr("aria-label", `${WEEK_DATE_FORMATTER.format(point.weekStart)}\uFF1A${point.answeredCount} \u6B21\u9996\u6B21\u56DE\u7B54\uFF0C\u6B63\u786E\u7387 ${formatAccuracy(point.accuracy)}`);
      column.createDiv({ cls: "quiz-trend-label", text: WEEK_DATE_FORMATTER.format(point.weekStart) });
    }
  }
  renderWeakTopicTable(parent) {
    const topics = this.analytics.topics.slice(0, 6);
    if (topics.length === 0) {
      parent.createEl("p", { cls: "quiz-muted-copy", text: "\u6682\u65E0\u4E3B\u9898\u7EDF\u8BA1\u3002" });
      return;
    }
    for (const topic of topics) {
      const button = parent.createEl("button", {
        cls: "quiz-topic-stat-row",
        attr: { type: "button", "data-action": "select-topic", "data-topic": topic.path }
      });
      button.createSpan({ text: topic.label });
      button.createEl("strong", { text: `${topic.wrongQuestionCount} \xB7 ${formatAccuracy(topic.accuracy)}` });
    }
  }
  renderSectionHeading(parent, title, detail) {
    const heading = parent.createDiv({ cls: "quiz-dashboard-section-heading" });
    heading.createEl("h2", { text: title });
    heading.createEl("p", { text: detail });
  }
  renderCatalogWarnings(parent) {
    if (this.catalog.errors.length === 0) return;
    const warning = parent.createEl("details", { cls: "quiz-catalog-warning" });
    warning.createEl("summary", { text: `${this.catalog.errors.length} \u4E2A Quiz block \u672A\u80FD\u52A0\u5165\u7D22\u5F15` });
    const list = warning.createEl("ul");
    for (const error of this.catalog.errors.slice(0, 20)) {
      list.createEl("li", { text: `${error.filePath} \xB7 \u7B2C ${error.blockIndex} \u4E2A\uFF1A${error.message}` });
    }
  }
};

// src/navigation.ts
var QuizFocusCoordinator = class {
  pending = null;
  listeners = /* @__PURE__ */ new Set();
  request(target) {
    this.pending = target;
    this.deliver(target);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    if (this.pending) this.deliver(this.pending);
    return () => this.listeners.delete(listener);
  }
  deliver(target) {
    let handled = false;
    for (const listener of this.listeners) {
      if (listener(target)) handled = true;
    }
    if (handled && this.pending === target) this.pending = null;
  }
};

// src/renderer.ts
var import_obsidian2 = require("obsidian");

// src/evaluator.ts
function areStringArraysEqual(left, right) {
  if (left.length !== right.length) return false;
  if (new Set(left).size !== left.length) return false;
  const expected = new Set(right);
  return expected.size === right.length && left.every((item) => expected.has(item));
}
function normalizeFillAnswer(value, caseSensitive) {
  const trimmed = value.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}
function evaluateAnswer(question, answer) {
  switch (question.type) {
    case "single":
      return typeof answer === "string" && answer === question.answer;
    case "multiple":
      return Array.isArray(answer) && areStringArraysEqual(answer, question.answer);
    case "true_false":
      return typeof answer === "boolean" && answer === question.answer;
    case "fill_blank": {
      if (typeof answer !== "string") return false;
      const candidate = normalizeFillAnswer(answer, question.caseSensitive);
      return question.answers.some(
        (expected) => normalizeFillAnswer(expected, question.caseSensitive) === candidate
      );
    }
  }
}
function formatAnswer(question, answer) {
  if (question.type === "true_false" && typeof answer === "boolean") {
    return answer ? "\u6B63\u786E" : "\u9519\u8BEF";
  }
  if (Array.isArray(answer)) return answer.join("\u3001");
  return String(answer);
}
function formatCorrectAnswer(question) {
  switch (question.type) {
    case "single":
      return question.answer;
    case "multiple":
      return question.answer.join("\u3001");
    case "true_false":
      return question.answer ? "\u6B63\u786E" : "\u9519\u8BEF";
    case "fill_blank":
      return question.answers.join(" / ");
  }
}

// src/renderer.ts
var TYPE_LABELS2 = {
  single: "\u5355\u9009",
  multiple: "\u591A\u9009",
  true_false: "\u5224\u65AD",
  fill_blank: "\u586B\u7A7A"
};
function cloneAnswer(answer) {
  return Array.isArray(answer) ? [...answer] : answer;
}
var QuizRenderer = class extends import_obsidian2.MarkdownRenderChild {
  constructor(containerEl, quiz, quizKey, filePath, storage, focusCoordinator) {
    super(containerEl);
    this.quiz = quiz;
    this.quizKey = quizKey;
    this.filePath = filePath;
    this.storage = storage;
    this.focusCoordinator = focusCoordinator;
    this.sessionId = storage.getOrCreateCurrentSession(
      quizKey,
      quiz.id,
      filePath
    ).id;
  }
  quiz;
  quizKey;
  filePath;
  storage;
  focusCoordinator;
  drafts = /* @__PURE__ */ new Map();
  editing = /* @__PURE__ */ new Set();
  pending = /* @__PURE__ */ new Set();
  submittedThisSession = /* @__PURE__ */ new Set();
  sessionId;
  sessionActionPending = false;
  saveError = null;
  focusedQuestionId = null;
  onload() {
    this.registerDomEvent(this.containerEl, "change", (event) => {
      this.handleChange(event);
    });
    this.registerDomEvent(this.containerEl, "input", (event) => {
      this.handleInput(event);
    });
    this.registerDomEvent(this.containerEl, "click", (event) => {
      this.handleClick(event);
    });
    this.render();
    this.register(
      this.focusCoordinator.subscribe((target) => this.handleFocusRequest(target))
    );
  }
  getInput(event) {
    const inputType = this.containerEl.ownerDocument.defaultView?.HTMLInputElement;
    return inputType && event.target instanceof inputType ? event.target : null;
  }
  handleInput(event) {
    const input = this.getInput(event);
    if (!input || input.type !== "text") return;
    const questionId = input.dataset.questionId;
    if (!questionId) return;
    this.drafts.set(questionId, input.value);
    this.saveError = null;
    this.updateSubmitButton(questionId);
  }
  handleChange(event) {
    const input = this.getInput(event);
    if (!input || input.type !== "radio" && input.type !== "checkbox") return;
    const questionId = input.dataset.questionId;
    const optionId = input.dataset.optionId;
    if (!questionId || optionId === void 0) return;
    const question = this.quiz.questions.find((item) => item.id === questionId);
    if (!question) return;
    if (question.type === "multiple") {
      const current = this.drafts.get(questionId);
      const selected = new Set(Array.isArray(current) ? current : []);
      if (input.checked) selected.add(optionId);
      else selected.delete(optionId);
      this.drafts.set(questionId, [...selected]);
    } else if (question.type === "true_false") {
      this.drafts.set(questionId, optionId === "true");
    } else {
      this.drafts.set(questionId, optionId);
    }
    this.saveError = null;
    this.render();
  }
  handleClick(event) {
    const elementType = this.containerEl.ownerDocument.defaultView?.Element;
    if (!elementType || !(event.target instanceof elementType)) return;
    const button = event.target.closest("button[data-action]");
    if (!button || !this.containerEl.contains(button)) return;
    const action = button.dataset.action;
    const questionId = button.dataset.questionId;
    if (action === "retry" && questionId) {
      this.retry(questionId);
    } else if (action === "submit" && questionId) {
      void this.submit(questionId);
    } else if (action === "complete") {
      void this.complete();
    } else if (action === "restart") {
      void this.restart();
    } else if (action === "review" && questionId) {
      void this.reviewQuestion(questionId);
    }
  }
  handleFocusRequest(target) {
    if (target.filePath !== this.filePath || target.quizId !== this.quiz.id) {
      return false;
    }
    if (!this.quiz.questions.some((question) => question.id === target.questionId)) {
      return false;
    }
    this.focusedQuestionId = target.questionId;
    this.render();
    this.focusQuestion(target.questionId);
    return true;
  }
  focusQuestion(questionId) {
    const questionEl = [...this.containerEl.querySelectorAll(
      ".quiz-question[data-question-id]"
    )].find((element) => element.dataset.questionId === questionId);
    if (!questionEl) return;
    const viewWindow = this.containerEl.ownerDocument.defaultView;
    const reduceMotion = viewWindow?.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    questionEl.addClass("is-navigation-target");
    questionEl.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth"
    });
    questionEl.querySelector(
      'button[data-action="retry"], button[data-action="review"], input:not(:disabled), button[data-action="submit"]'
    )?.focus({ preventScroll: true });
    if (viewWindow) {
      const timer = viewWindow.setTimeout(() => {
        questionEl.removeClass("is-navigation-target");
      }, 2200);
      this.register(() => viewWindow.clearTimeout(timer));
    }
  }
  retry(questionId) {
    const saved = this.storage.getLatestAttempt(
      this.quizKey,
      this.sessionId,
      questionId
    );
    if (saved) this.drafts.set(questionId, cloneAnswer(saved.answer));
    this.submittedThisSession.delete(questionId);
    this.editing.add(questionId);
    this.saveError = null;
    this.render();
  }
  async submit(questionId) {
    const question = this.quiz.questions.find((item) => item.id === questionId);
    const answer = this.drafts.get(questionId);
    if (!question || answer === void 0 || !this.isAnswerReady(answer) || this.pending.has(questionId)) {
      return;
    }
    this.pending.add(questionId);
    this.editing.delete(questionId);
    this.submittedThisSession.add(questionId);
    this.saveError = null;
    const savePromise = this.storage.saveQuestionAttempt(
      this.quizKey,
      this.sessionId,
      questionId,
      answer,
      evaluateAnswer(question, answer)
    );
    this.render();
    try {
      await savePromise;
    } catch (error) {
      this.saveError = "\u7B54\u9898\u8BB0\u5F55\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5";
      console.error("Omni Quiz failed to save an answer", error);
    } finally {
      this.pending.delete(questionId);
      this.render();
    }
  }
  async complete() {
    if (this.sessionActionPending) return;
    this.sessionActionPending = true;
    this.saveError = null;
    this.render();
    try {
      await this.storage.completeSession(
        this.quizKey,
        this.sessionId,
        this.quiz
      );
    } catch (error) {
      this.saveError = "\u6D4B\u9A8C\u7ED3\u679C\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5";
      console.error("Omni Quiz failed to complete a session", error);
    } finally {
      this.sessionActionPending = false;
      this.render();
    }
  }
  async restart() {
    await this.startNewSession();
  }
  async reviewQuestion(questionId) {
    await this.startNewSession(questionId);
  }
  async startNewSession(questionId) {
    if (this.sessionActionPending) return;
    this.sessionActionPending = true;
    this.saveError = null;
    const result = this.storage.startNewSession(
      this.quizKey,
      this.quiz.id,
      this.filePath
    );
    this.sessionId = result.session.id;
    this.drafts.clear();
    this.editing.clear();
    this.submittedThisSession.clear();
    this.focusedQuestionId = questionId ?? null;
    this.render();
    if (questionId) this.focusQuestion(questionId);
    try {
      await result.persisted;
    } catch (error) {
      this.saveError = "\u65B0\u6D4B\u9A8C\u521B\u5EFA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5";
      console.error("Omni Quiz failed to start a session", error);
    } finally {
      this.sessionActionPending = false;
      this.render();
      if (questionId) this.focusQuestion(questionId);
    }
  }
  render() {
    this.containerEl.empty();
    this.containerEl.addClass("quiz-container");
    const header = this.containerEl.createDiv({ cls: "quiz-header" });
    header.createEl("h3", { text: this.quiz.title });
    this.renderMetadata(header);
    this.renderStatistics(header);
    if (this.saveError) {
      this.containerEl.createDiv({ cls: "quiz-error", text: this.saveError });
    }
    this.quiz.questions.forEach((question, index) => {
      this.renderQuestion(question, index);
    });
    this.renderSessionActions();
  }
  renderMetadata(parent) {
    const metadata = parent.createDiv({ cls: "quiz-metadata" });
    metadata.createSpan({
      cls: "quiz-badge",
      text: this.quiz.mode === "standard" ? "\u6807\u51C6\u6D4B\u9A8C" : "\u5FEB\u901F\u6D4B\u9A8C"
    });
    if (this.quiz.difficulty) {
      metadata.createSpan({
        cls: "quiz-badge",
        text: `${this.quiz.difficulty.min}\u2013${this.quiz.difficulty.max}`
      });
    }
  }
  renderStatistics(parent) {
    const statistics = this.storage.getStatistics(
      this.quizKey,
      this.sessionId,
      this.quiz
    );
    const stats = parent.createDiv({ cls: "quiz-stats" });
    stats.createSpan({
      text: `\u8FDB\u5EA6\uFF1A${statistics.answeredCount} / ${this.quiz.questions.length}`
    });
    stats.createSpan({ text: `\u5F53\u524D\u6B63\u786E\uFF1A${statistics.correctCount}` });
    stats.createSpan({
      text: `\u9996\u6B21\u6B63\u786E\u7387\uFF1A${statistics.firstAccuracy === null ? "-" : `${statistics.firstAccuracy}%`}`
    });
    stats.createSpan({ text: `\u5DF2\u5B8C\u6210\uFF1A${statistics.completedSessionCount} \u6B21` });
  }
  renderQuestion(question, index) {
    const saved = this.storage.getLatestAttempt(
      this.quizKey,
      this.sessionId,
      question.id
    );
    const session = this.storage.getSession(this.quizKey, this.sessionId);
    const isCompleted = session?.completedAt !== void 0;
    const isEditing = this.editing.has(question.id) && !isCompleted;
    const isPending = this.pending.has(question.id);
    const isLocked = Boolean(saved) && !isEditing || isCompleted;
    const answer = isEditing ? this.drafts.get(question.id) ?? saved?.answer : saved?.answer ?? this.drafts.get(question.id);
    const questionEl = this.containerEl.createDiv({
      cls: "quiz-question",
      attr: { "data-question-id": question.id }
    });
    const heading = questionEl.createDiv({ cls: "quiz-question-heading" });
    heading.createEl("h4", {
      cls: "quiz-question-title",
      text: `${index + 1}. ${question.question}`
    });
    const tags = heading.createDiv({ cls: "quiz-question-tags" });
    tags.createSpan({ cls: "quiz-badge", text: TYPE_LABELS2[question.type] });
    tags.createSpan({ cls: "quiz-badge", text: question.level });
    if (question.type === "fill_blank") {
      this.renderFillBlank(questionEl, question, answer, isLocked || isPending);
    } else if (question.type === "true_false") {
      this.renderChoices(
        questionEl,
        question,
        [
          { id: "true", text: "\u6B63\u786E" },
          { id: "false", text: "\u9519\u8BEF" }
        ],
        answer,
        isLocked || isPending
      );
    } else {
      this.renderChoices(
        questionEl,
        question,
        question.options,
        answer,
        isLocked || isPending
      );
    }
    if (isLocked && saved) {
      this.renderResult(questionEl, question, saved);
      if (!isCompleted) {
        const retry = questionEl.createEl("button", {
          cls: "quiz-retry",
          text: "\u91CD\u65B0\u4F5C\u7B54",
          attr: {
            type: "button",
            "data-action": "retry",
            "data-question-id": question.id
          }
        });
        retry.disabled = isPending;
      } else if (this.focusedQuestionId === question.id) {
        questionEl.createEl("button", {
          cls: "quiz-retry",
          text: "\u91CD\u505A\u6B64\u9898",
          attr: {
            type: "button",
            "data-action": "review",
            "data-question-id": question.id
          }
        });
      }
    } else if (!isCompleted) {
      const submit = questionEl.createEl("button", {
        cls: "quiz-submit",
        text: isPending ? "\u4FDD\u5B58\u4E2D\u2026" : "\u63D0\u4EA4\u7B54\u6848",
        attr: {
          type: "button",
          "data-action": "submit",
          "data-question-id": question.id
        }
      });
      submit.disabled = !this.isAnswerReady(answer) || isPending;
    }
  }
  renderChoices(parent, question, options, answer, disabled) {
    const multiple = question.type === "multiple";
    const selectedIds = new Set(
      Array.isArray(answer) ? answer : question.type === "true_false" && typeof answer === "boolean" ? [String(answer)] : typeof answer === "string" ? [answer] : []
    );
    const correctIds = new Set(
      question.type === "multiple" ? question.answer : question.type === "true_false" ? [String(question.answer)] : [question.answer]
    );
    const optionGroup = parent.createDiv({ cls: "quiz-options" });
    optionGroup.setAttr("role", multiple ? "group" : "radiogroup");
    optionGroup.setAttr("aria-label", question.question);
    for (const option of options) {
      const optionEl = optionGroup.createEl("label", { cls: "quiz-option" });
      if (disabled) optionEl.addClass("is-disabled");
      if (selectedIds.has(option.id)) optionEl.addClass("quiz-option-selected");
      if (disabled && correctIds.has(option.id)) {
        optionEl.addClass("quiz-option-correct");
      }
      if (disabled && selectedIds.has(option.id) && !correctIds.has(option.id)) {
        optionEl.addClass("quiz-option-wrong");
      }
      const input = optionEl.createEl("input", {
        type: multiple ? "checkbox" : "radio",
        attr: {
          name: `${this.quizKey}::${this.sessionId}::${question.id}`,
          value: option.id,
          "data-question-id": question.id,
          "data-option-id": option.id
        }
      });
      input.checked = selectedIds.has(option.id);
      input.disabled = disabled;
      optionEl.createSpan({ text: `${option.id}. ${option.text}` });
    }
  }
  renderFillBlank(parent, question, answer, disabled) {
    const input = parent.createEl("input", {
      cls: "quiz-fill-input",
      type: "text",
      attr: {
        "aria-label": question.question,
        placeholder: "\u8F93\u5165\u7B54\u6848",
        "data-question-id": question.id
      }
    });
    input.value = typeof answer === "string" ? answer : "";
    input.disabled = disabled;
  }
  renderResult(parent, question, attempt) {
    const resultEl = parent.createDiv({ cls: "quiz-result" });
    resultEl.addClass(attempt.correct ? "is-correct" : "is-wrong");
    resultEl.createDiv({
      cls: "quiz-result-status",
      text: attempt.correct ? "\u2713 \u56DE\u7B54\u6B63\u786E" : "\u2715 \u56DE\u7B54\u9519\u8BEF"
    });
    if (!attempt.correct) {
      resultEl.createDiv({
        text: `${this.submittedThisSession.has(question.id) ? "\u4F60\u7684\u7B54\u6848" : "\u4F60\u4E0A\u6B21\u56DE\u7B54"}\uFF1A${formatAnswer(question, attempt.answer)}`
      });
      resultEl.createDiv({ text: `\u6B63\u786E\u7B54\u6848\uFF1A${formatCorrectAnswer(question)}` });
    } else if (!this.submittedThisSession.has(question.id)) {
      resultEl.createDiv({
        text: `\u4F60\u4E0A\u6B21\u56DE\u7B54\uFF1A${formatAnswer(question, attempt.answer)}`
      });
    }
    if (question.explanation) {
      resultEl.createDiv({ cls: "quiz-explanation", text: question.explanation });
    }
    const attempts = this.storage.getAttempts(
      this.quizKey,
      this.sessionId,
      question.id
    ).length;
    resultEl.createDiv({ cls: "quiz-attempts", text: `\u672C\u6B21\u5C1D\u8BD5\uFF1A${attempts}` });
  }
  renderSessionActions() {
    const session = this.storage.getSession(this.quizKey, this.sessionId);
    if (!session) return;
    const statistics = this.storage.getStatistics(
      this.quizKey,
      this.sessionId,
      this.quiz
    );
    const actions = this.containerEl.createDiv({ cls: "quiz-session-actions" });
    if (session.completedAt !== void 0) {
      const summary = actions.createDiv({ cls: "quiz-summary" });
      summary.createEl("h4", { text: "\u672C\u6B21\u6D4B\u9A8C\u5DF2\u5B8C\u6210" });
      summary.createDiv({
        text: `\u6700\u7EC8\u5F97\u5206\uFF1A${statistics.correctCount} / ${this.quiz.questions.length}\uFF08${statistics.accuracy ?? 0}%\uFF09`
      });
      summary.createDiv({
        text: `\u9996\u6B21\u6B63\u786E\u7387\uFF1A${statistics.firstAccuracy ?? 0}%`
      });
      actions.createEl("button", {
        cls: "quiz-restart",
        text: this.sessionActionPending ? "\u521B\u5EFA\u4E2D\u2026" : "\u5F00\u59CB\u65B0\u6D4B\u9A8C",
        attr: { type: "button", "data-action": "restart" }
      }).disabled = this.sessionActionPending;
      return;
    }
    const complete = actions.createEl("button", {
      cls: "quiz-complete",
      text: this.sessionActionPending ? "\u4FDD\u5B58\u4E2D\u2026" : "\u5B8C\u6210\u6D4B\u9A8C",
      attr: { type: "button", "data-action": "complete" }
    });
    complete.disabled = statistics.answeredCount !== this.quiz.questions.length || this.pending.size > 0 || this.sessionActionPending;
  }
  isAnswerReady(answer) {
    if (answer === void 0) return false;
    if (typeof answer === "string") return answer.trim().length > 0;
    if (Array.isArray(answer)) return answer.length > 0;
    return true;
  }
  updateSubmitButton(questionId) {
    const button = Array.from(
      this.containerEl.querySelectorAll(
        'button[data-action="submit"]'
      )
    ).find((candidate) => candidate.dataset.questionId === questionId);
    if (button) button.disabled = !this.isAnswerReady(this.drafts.get(questionId));
  }
};

// src/storage.ts
var EMPTY_PLUGIN_DATA = {
  schemaVersion: 2,
  quizzes: {}
};
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseAnswerValue(value) {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return [...value];
  }
  return null;
}
function parseAttempt(value) {
  if (!isRecord2(value)) return null;
  const answer = parseAnswerValue(value.answer);
  if (answer === null || typeof value.correct !== "boolean" || typeof value.answeredAt !== "number" || !Number.isFinite(value.answeredAt)) {
    return null;
  }
  return { answer, correct: value.correct, answeredAt: value.answeredAt };
}
function parseSession(value) {
  if (!isRecord2(value) || typeof value.id !== "string" || typeof value.startedAt !== "number" || !Number.isFinite(value.startedAt) || !isRecord2(value.answers)) {
    return null;
  }
  if (value.completedAt !== void 0 && (typeof value.completedAt !== "number" || !Number.isFinite(value.completedAt))) {
    return null;
  }
  const answers = {};
  for (const [questionId, candidate] of Object.entries(value.answers)) {
    if (!Array.isArray(candidate)) continue;
    const attempts = candidate.map(parseAttempt).filter((attempt) => attempt !== null);
    if (attempts.length > 0) answers[questionId] = attempts;
  }
  return {
    id: value.id,
    startedAt: value.startedAt,
    ...typeof value.completedAt === "number" ? { completedAt: value.completedAt } : {},
    answers
  };
}
function parseV2Data(value) {
  if (value.schemaVersion !== 2 || !isRecord2(value.quizzes)) return null;
  const quizzes = {};
  for (const [quizKey, candidate] of Object.entries(value.quizzes)) {
    if (!isRecord2(candidate) || typeof candidate.quizId !== "string" || typeof candidate.filePath !== "string" || !Array.isArray(candidate.sessions)) {
      continue;
    }
    quizzes[quizKey] = {
      quizId: candidate.quizId,
      filePath: candidate.filePath,
      sessions: candidate.sessions.map(parseSession).filter((session) => session !== null)
    };
  }
  return { schemaVersion: 2, quizzes };
}
function migrateLegacyData(value) {
  if (!isRecord2(value.results)) return { ...EMPTY_PLUGIN_DATA, quizzes: {} };
  const quizzes = {};
  for (const [quizKey, candidate] of Object.entries(value.results)) {
    if (!isRecord2(candidate) || typeof candidate.quizId !== "string" || typeof candidate.filePath !== "string" || !isRecord2(candidate.questions)) {
      continue;
    }
    const answers = {};
    let startedAt = Number.POSITIVE_INFINITY;
    for (const [questionId, result] of Object.entries(candidate.questions)) {
      if (!isRecord2(result) || typeof result.selectedAnswer !== "string" || typeof result.correct !== "boolean" || typeof result.updatedAt !== "number" || !Number.isFinite(result.updatedAt)) {
        continue;
      }
      answers[questionId] = [
        {
          answer: result.selectedAnswer,
          correct: result.correct,
          answeredAt: result.updatedAt
        }
      ];
      startedAt = Math.min(startedAt, result.updatedAt);
    }
    quizzes[quizKey] = {
      quizId: candidate.quizId,
      filePath: candidate.filePath,
      sessions: Object.keys(answers).length === 0 ? [] : [
        {
          id: `legacy-${startedAt}`,
          startedAt,
          answers
        }
      ]
    };
  }
  return { schemaVersion: 2, quizzes };
}
function normalizePluginData(value) {
  if (!isRecord2(value)) return { ...EMPTY_PLUGIN_DATA, quizzes: {} };
  return parseV2Data(value) ?? migrateLegacyData(value);
}
function cloneAnswer2(answer) {
  return Array.isArray(answer) ? [...answer] : answer;
}
function cloneData(data) {
  const quizzes = {};
  for (const [quizKey, history] of Object.entries(data.quizzes)) {
    quizzes[quizKey] = {
      quizId: history.quizId,
      filePath: history.filePath,
      sessions: history.sessions.map((session) => ({
        id: session.id,
        startedAt: session.startedAt,
        ...session.completedAt !== void 0 ? { completedAt: session.completedAt } : {},
        answers: Object.fromEntries(
          Object.entries(session.answers).map(([questionId, attempts]) => [
            questionId,
            attempts.map((attempt) => ({
              answer: cloneAnswer2(attempt.answer),
              correct: attempt.correct,
              answeredAt: attempt.answeredAt
            }))
          ])
        )
      }))
    };
  }
  return { schemaVersion: 2, quizzes };
}
function createSession(now, sequence) {
  return {
    id: `session-${now}-${sequence}`,
    startedAt: now,
    answers: {}
  };
}
var QuizStorage = class {
  constructor(data, persist) {
    this.data = data;
    this.persist = persist;
  }
  data;
  persist;
  saveQueue = Promise.resolve();
  sessionSequence = 0;
  changeListeners = /* @__PURE__ */ new Set();
  getHistory(quizKey) {
    return this.data.quizzes[quizKey];
  }
  getHistories() {
    return this.data.quizzes;
  }
  onChange(listener) {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }
  getOrCreateCurrentSession(quizKey, quizId, filePath, now = Date.now()) {
    const history = this.data.quizzes[quizKey];
    const current = history?.sessions.at(-1);
    if (current) return current;
    const session = createSession(now, ++this.sessionSequence);
    this.data.quizzes[quizKey] = {
      quizId,
      filePath,
      sessions: [session]
    };
    return session;
  }
  getSession(quizKey, sessionId) {
    return this.data.quizzes[quizKey]?.sessions.find(
      (session) => session.id === sessionId
    );
  }
  getAttempts(quizKey, sessionId, questionId) {
    return this.getSession(quizKey, sessionId)?.answers[questionId] ?? [];
  }
  getLatestAttempt(quizKey, sessionId, questionId) {
    return this.getAttempts(quizKey, sessionId, questionId).at(-1);
  }
  saveQuestionAttempt(quizKey, sessionId, questionId, answer, correct, now = Date.now()) {
    const session = this.getSession(quizKey, sessionId);
    if (!session || session.completedAt !== void 0) {
      return Promise.reject(new Error("Quiz session is unavailable"));
    }
    session.answers[questionId] = [
      ...session.answers[questionId] ?? [],
      { answer: cloneAnswer2(answer), correct, answeredAt: now }
    ];
    return this.enqueuePersist();
  }
  completeSession(quizKey, sessionId, quiz, now = Date.now()) {
    const session = this.getSession(quizKey, sessionId);
    if (!session) return Promise.reject(new Error("Quiz session is unavailable"));
    const answeredAll = quiz.questions.every(
      (question) => (session.answers[question.id]?.length ?? 0) > 0
    );
    if (!answeredAll) return Promise.reject(new Error("Quiz session is incomplete"));
    if (session.completedAt === void 0) session.completedAt = now;
    return this.enqueuePersist();
  }
  startNewSession(quizKey, quizId, filePath, now = Date.now()) {
    const session = createSession(now, ++this.sessionSequence);
    const history = this.data.quizzes[quizKey];
    this.data.quizzes[quizKey] = {
      quizId,
      filePath,
      sessions: [...history?.sessions ?? [], session]
    };
    return { session, persisted: this.enqueuePersist() };
  }
  renameFile(oldPath, newPath) {
    if (oldPath === newPath) return Promise.resolve();
    const oldPrefix = `${oldPath}::`;
    let changed = false;
    for (const [quizKey, history] of Object.entries(this.data.quizzes)) {
      if (!quizKey.startsWith(oldPrefix)) continue;
      const quizId = quizKey.slice(oldPrefix.length);
      const nextKey = `${newPath}::${quizId}`;
      const existing = this.data.quizzes[nextKey];
      const sessionsById = new Map(
        (existing?.sessions ?? []).map((session) => [session.id, session])
      );
      for (const session of history.sessions) sessionsById.set(session.id, session);
      this.data.quizzes[nextKey] = {
        quizId: history.quizId,
        filePath: newPath,
        sessions: [...sessionsById.values()].sort(
          (left, right) => left.startedAt - right.startedAt
        )
      };
      delete this.data.quizzes[quizKey];
      changed = true;
    }
    return changed ? this.enqueuePersist() : Promise.resolve();
  }
  getStatistics(quizKey, sessionId, quiz) {
    const session = this.getSession(quizKey, sessionId);
    let answeredCount = 0;
    let correctCount = 0;
    let firstCorrectCount = 0;
    for (const question of quiz.questions) {
      const attempts = session?.answers[question.id];
      if (!attempts || attempts.length === 0) continue;
      answeredCount += 1;
      if (attempts.at(-1)?.correct) correctCount += 1;
      if (attempts[0]?.correct) firstCorrectCount += 1;
    }
    const history = this.getHistory(quizKey);
    return {
      answeredCount,
      correctCount,
      firstCorrectCount,
      accuracy: answeredCount === 0 ? null : Math.round(correctCount / answeredCount * 100),
      firstAccuracy: answeredCount === 0 ? null : Math.round(firstCorrectCount / answeredCount * 100),
      completedSessionCount: history?.sessions.filter((item) => item.completedAt !== void 0).length ?? 0
    };
  }
  enqueuePersist() {
    const snapshot = cloneData(this.data);
    this.saveQueue = this.saveQueue.catch(() => void 0).then(async () => {
      await this.persist(snapshot);
      for (const listener of this.changeListeners) listener();
    });
    return this.saveQueue;
  }
};

// src/main.ts
var OmniQuizPlugin = class extends import_obsidian3.Plugin {
  async onload() {
    const data = normalizePluginData(await this.loadData());
    const storage = new QuizStorage(data, async (nextData) => {
      await this.saveData(nextData);
    });
    const focusCoordinator = new QuizFocusCoordinator();
    this.registerView(
      QUIZ_DASHBOARD_VIEW,
      (leaf) => new QuizDashboardView(leaf, storage, focusCoordinator)
    );
    this.addRibbonIcon("bar-chart-3", "\u6253\u5F00\u6D4B\u8BD5\u9762\u677F", () => {
      void this.activateDashboard();
    });
    this.addCommand({
      id: "open-dashboard",
      name: "\u6253\u5F00\u6D4B\u8BD5\u9762\u677F",
      callback: () => {
        void this.activateDashboard();
      }
    });
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof import_obsidian3.TFile) || file.extension !== "md") return;
        void storage.renameFile(oldPath, file.path).catch((error) => {
          console.error("Omni Quiz failed to migrate renamed quiz history", error);
        });
      })
    );
    this.registerMarkdownCodeBlockProcessor(
      "quiz",
      (source, el, ctx) => {
        try {
          const quiz = parseQuiz(source);
          const quizKey = `${ctx.sourcePath}::${quiz.id}`;
          ctx.addChild(
            new QuizRenderer(
              el,
              quiz,
              quizKey,
              ctx.sourcePath,
              storage,
              focusCoordinator
            )
          );
        } catch (error) {
          const message = error instanceof QuizParseError ? error.message : "Quiz \u683C\u5F0F\u9519\u8BEF";
          el.createDiv({ cls: "quiz-error", text: message });
          console.error("Omni Quiz could not render a quiz block", error);
        }
      }
    );
  }
  async activateDashboard() {
    const existing = this.app.workspace.getLeavesOfType(QUIZ_DASHBOARD_VIEW)[0];
    if (existing) {
      this.app.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: QUIZ_DASHBOARD_VIEW, active: true });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }
};
