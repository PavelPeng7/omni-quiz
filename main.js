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
function buildDashboardAnalytics(entries, histories) {
  const levels = createLevelAnalytics();
  const types = createTypeCounts();
  const quizzes = {};
  let questionCount = 0;
  let answeredCount = 0;
  let correctCount = 0;
  let attemptedQuizCount = 0;
  let completedSessionCount = 0;
  for (const entry of entries) {
    const history = histories[entry.quizKey];
    const current = getSessionAccuracy(getCurrentSession(history), entry);
    let quizAnswered = 0;
    let quizCorrect = 0;
    let totalAttemptCount = 0;
    questionCount += entry.quiz.questions.length;
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
        if (attempts[0]?.correct) {
          quizCorrect += 1;
          correctCount += 1;
          levels[question.level].correctCount += 1;
        }
      }
    }
    const completed = history?.sessions.filter((session) => session.completedAt !== void 0).length ?? 0;
    completedSessionCount += completed;
    if (totalAttemptCount > 0) attemptedQuizCount += 1;
    quizzes[entry.quizKey] = {
      quizKey: entry.quizKey,
      completedSessionCount: completed,
      totalAttemptCount,
      currentAnsweredCount: current.answeredCount,
      currentAccuracy: current.accuracy,
      firstAccuracy: percentage(quizCorrect, quizAnswered),
      latestActivityAt: getLatestActivity(history)
    };
  }
  for (const level of LEVELS) {
    levels[level].accuracy = percentage(
      levels[level].correctCount,
      levels[level].answeredCount
    );
  }
  return {
    quizCount: entries.length,
    questionCount,
    attemptedQuizCount,
    completedSessionCount,
    answeredCount,
    correctCount,
    accuracy: percentage(correctCount, answeredCount),
    levels,
    types,
    quizzes
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
function extractQuizCatalog(filePath, markdown) {
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
async function scanQuizCatalog(app) {
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
    const result = extractQuizCatalog(file.path, source);
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
function formatAccuracy(value) {
  return value === null ? "\u2014" : `${value}%`;
}
function formatActivity(value) {
  if (value === null) return "\u5C1A\u672A\u5F00\u59CB";
  return ACTIVITY_DATE_FORMATTER.format(value);
}
var QuizDashboardView = class extends import_obsidian.ItemView {
  constructor(leaf, storage) {
    super(leaf);
    this.storage = storage;
    this.icon = "bar-chart-3";
    this.navigation = false;
    this.addAction("refresh-cw", "\u5237\u65B0\u6D4B\u8BD5\u9898\u7D22\u5F15", () => {
      void this.reloadCatalog();
    });
  }
  storage;
  catalog = { entries: [], errors: [] };
  analytics = buildDashboardAnalytics([], {});
  query = "";
  modeFilter = "all";
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
    this.registerDomEvent(this.contentEl, "input", (event) => {
      this.handleInput(event);
    });
    this.registerDomEvent(this.contentEl, "change", (event) => {
      this.handleChange(event);
    });
    this.registerDomEvent(this.contentEl, "click", (event) => {
      this.handleClick(event);
    });
    const refreshForFile = (file) => {
      if (file instanceof import_obsidian.TFile && file.extension === "md") {
        this.scheduleCatalogReload();
      }
    };
    this.registerEvent(this.app.vault.on("create", refreshForFile));
    this.registerEvent(this.app.vault.on("modify", refreshForFile));
    this.registerEvent(this.app.vault.on("delete", refreshForFile));
    this.registerEvent(this.app.vault.on("rename", refreshForFile));
    this.register(
      this.storage.onChange(() => {
        this.render();
      })
    );
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
    this.renderLibrary();
  }
  handleChange(event) {
    const selectType = this.contentEl.ownerDocument.defaultView?.HTMLSelectElement;
    if (!selectType || !(event.target instanceof selectType)) return;
    if (event.target.dataset.role !== "mode-filter") return;
    if (event.target.value === "all" || event.target.value === "quick" || event.target.value === "standard") {
      this.modeFilter = event.target.value;
      this.renderLibrary();
    }
  }
  handleClick(event) {
    const elementType = this.contentEl.ownerDocument.defaultView?.Element;
    if (!elementType || !(event.target instanceof elementType)) return;
    const button = event.target.closest("button[data-action]");
    if (!button || !this.contentEl.contains(button)) return;
    if (button.dataset.action === "open-quiz" && button.dataset.filePath) {
      void this.openQuizFile(button.dataset.filePath);
    } else if (button.dataset.action === "refresh") {
      void this.reloadCatalog();
    } else if (button.dataset.action === "clear-filters") {
      this.query = "";
      this.modeFilter = "all";
      this.render();
    }
  }
  async openQuizFile(filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian.TFile)) return;
    await this.app.workspace.getLeaf("tab").openFile(file);
  }
  async reloadCatalog() {
    const version = ++this.scanVersion;
    this.loading = true;
    this.loadError = null;
    this.render();
    try {
      const catalog = await scanQuizCatalog(this.app);
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
    const shell = this.contentEl.createDiv({ cls: "quiz-dashboard-shell" });
    this.renderHero(shell);
    if (this.loading) {
      this.renderStatus(shell, "\u6B63\u5728\u7D22\u5F15\u77E5\u8BC6\u5E93\u4E2D\u7684\u6D4B\u8BD5\u9898\u2026", false);
      return;
    }
    if (this.loadError) {
      this.renderStatus(shell, this.loadError, true);
      return;
    }
    this.analytics = buildDashboardAnalytics(
      this.catalog.entries,
      this.storage.getHistories()
    );
    this.renderOverview(shell, this.analytics);
    this.renderKnowledgeSignal(shell, this.analytics);
    this.renderCatalogWarnings(shell);
    this.renderControls(shell);
    this.renderLibrary();
  }
  renderHero(parent) {
    const hero = parent.createEl("header", { cls: "quiz-dashboard-hero" });
    hero.createDiv({ cls: "quiz-dashboard-eyebrow", text: "Knowledge signal" });
    hero.createEl("h1", { text: "\u77E5\u8BC6\u6D4B\u91CF\u53F0" });
    hero.createEl("p", {
      text: "\u6D4F\u89C8\u77E5\u8BC6\u5E93\u4E2D\u7684\u6D4B\u8BD5\u9898\uFF0C\u89C2\u5BDF\u54EA\u4E9B\u77E5\u8BC6\u771F\u6B63\u7ECF\u5F97\u8D77\u7B2C\u4E00\u6B21\u56DE\u7B54\u3002"
    });
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
  renderOverview(parent, analytics) {
    const section = parent.createEl("section", {
      cls: "quiz-dashboard-overview",
      attr: { "aria-label": "\u5B66\u4E60\u6982\u89C8" }
    });
    this.renderMetric(section, "\u6D4B\u8BD5\u9898", String(analytics.quizCount), "\u4EFD");
    this.renderMetric(section, "\u9898\u76EE", String(analytics.questionCount), "\u9053");
    this.renderMetric(
      section,
      "\u5DF2\u6D4B\u8BD5",
      String(analytics.attemptedQuizCount),
      `/ ${analytics.quizCount}`
    );
    this.renderMetric(
      section,
      "\u9996\u6B21\u6B63\u786E\u7387",
      formatAccuracy(analytics.accuracy),
      `${analytics.completedSessionCount} \u6B21\u5B8C\u6210`
    );
  }
  renderMetric(parent, label, value, detail) {
    const metric = parent.createDiv({ cls: "quiz-dashboard-metric" });
    metric.createDiv({ cls: "quiz-dashboard-metric-label", text: label });
    metric.createDiv({ cls: "quiz-dashboard-metric-value", text: value });
    metric.createDiv({ cls: "quiz-dashboard-metric-detail", text: detail });
  }
  renderKnowledgeSignal(parent, analytics) {
    const section = parent.createEl("section", { cls: "quiz-dashboard-signal" });
    const heading = section.createDiv({ cls: "quiz-dashboard-section-heading" });
    heading.createEl("h2", { text: "\u8BA4\u77E5\u5C42\u7EA7" });
    heading.createEl("p", { text: "\u6309\u6BCF\u6B21\u6D4B\u9A8C\u7684\u9996\u6B21\u56DE\u7B54\u8BA1\u7B97" });
    const track = section.createDiv({ cls: "quiz-level-track" });
    for (const level of LEVELS3) {
      const item = track.createDiv({ cls: "quiz-level-segment" });
      const title = item.createDiv({ cls: "quiz-level-title" });
      title.createEl("strong", { text: level });
      title.createSpan({ text: formatAccuracy(analytics.levels[level].accuracy) });
      item.createEl("progress", {
        attr: {
          max: "100",
          value: String(analytics.levels[level].accuracy ?? 0),
          "aria-label": `${level} \u9996\u6B21\u6B63\u786E\u7387`
        }
      });
      item.createDiv({
        cls: "quiz-level-detail",
        text: `${analytics.levels[level].questionCount} \u9053\u9898 \xB7 ${analytics.levels[level].answeredCount} \u6B21\u56DE\u7B54`
      });
    }
    const typePanel = section.createDiv({ cls: "quiz-type-distribution" });
    typePanel.createEl("h3", { text: "\u9898\u578B\u6784\u6210" });
    for (const type of QUESTION_TYPES2) {
      const row = typePanel.createDiv({ cls: "quiz-type-row" });
      const label = row.createDiv({ cls: "quiz-type-label" });
      label.createSpan({ text: TYPE_LABELS[type] });
      label.createSpan({ text: String(analytics.types[type]) });
      row.createEl("progress", {
        attr: {
          max: String(Math.max(analytics.questionCount, 1)),
          value: String(analytics.types[type]),
          "aria-label": `${TYPE_LABELS[type]}\u9898\u6570\u91CF`
        }
      });
    }
  }
  renderCatalogWarnings(parent) {
    if (this.catalog.errors.length === 0) return;
    const warning = parent.createEl("details", { cls: "quiz-catalog-warning" });
    warning.createEl("summary", {
      text: `${this.catalog.errors.length} \u4E2A Quiz block \u672A\u80FD\u52A0\u5165\u7D22\u5F15`
    });
    const list = warning.createEl("ul");
    for (const error of this.catalog.errors.slice(0, 20)) {
      list.createEl("li", {
        text: `${error.filePath} \xB7 \u7B2C ${error.blockIndex} \u4E2A\uFF1A${error.message}`
      });
    }
  }
  renderControls(parent) {
    const section = parent.createEl("section", { cls: "quiz-library-section" });
    const heading = section.createDiv({ cls: "quiz-dashboard-section-heading" });
    heading.createEl("h2", { text: "\u6D4B\u8BD5\u9898\u5E93" });
    heading.createEl("p", { text: `${this.catalog.entries.length} \u4EFD\u53EF\u7528\u6D4B\u8BD5` });
    const controls = section.createDiv({ cls: "quiz-library-controls" });
    const searchLabel = controls.createEl("label", { cls: "quiz-search-field" });
    searchLabel.createSpan({ text: "\u641C\u7D22" });
    searchLabel.createEl("input", {
      type: "search",
      value: this.query,
      attr: {
        placeholder: "\u6807\u9898\u3001\u6587\u4EF6\u8DEF\u5F84\u6216 Quiz ID",
        "data-role": "quiz-search"
      }
    });
    const filterLabel = controls.createEl("label", { cls: "quiz-filter-field" });
    filterLabel.createSpan({ text: "\u6A21\u5F0F" });
    const select = filterLabel.createEl("select", {
      attr: { "data-role": "mode-filter" }
    });
    select.createEl("option", { text: "\u5168\u90E8", value: "all" });
    select.createEl("option", { text: "\u5FEB\u901F\u6D4B\u9A8C", value: "quick" });
    select.createEl("option", { text: "\u6807\u51C6\u6D4B\u9A8C", value: "standard" });
    select.value = this.modeFilter;
    section.createDiv({ cls: "quiz-library-results" });
  }
  renderLibrary() {
    const results = this.contentEl.querySelector(
      ".quiz-library-results"
    );
    if (!results) return;
    results.empty();
    const entries = this.getFilteredEntries(this.analytics.quizzes);
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
    const list = results.createDiv({ cls: "quiz-library-list" });
    for (const entry of entries.slice(0, 100)) {
      this.renderQuizCard(list, entry, this.analytics.quizzes[entry.quizKey]);
    }
    if (entries.length > 100) {
      results.createDiv({
        cls: "quiz-library-limit",
        text: `\u5F53\u524D\u663E\u793A\u524D 100 \u4EFD\uFF0C\u8BF7\u4F7F\u7528\u641C\u7D22\u7F29\u5C0F ${entries.length} \u4EFD\u7ED3\u679C\u3002`
      });
    }
  }
  getFilteredEntries(analytics) {
    const query = this.query.trim().toLowerCase();
    return this.catalog.entries.filter((entry) => {
      if (this.modeFilter !== "all" && entry.quiz.mode !== this.modeFilter) {
        return false;
      }
      return query.length === 0 || entry.quiz.title.toLowerCase().includes(query) || entry.quiz.id.toLowerCase().includes(query) || entry.filePath.toLowerCase().includes(query);
    }).sort((left, right) => {
      const leftActivity = analytics[left.quizKey]?.latestActivityAt ?? 0;
      const rightActivity = analytics[right.quizKey]?.latestActivityAt ?? 0;
      return rightActivity - leftActivity || left.quiz.title.localeCompare(right.quiz.title);
    });
  }
  renderQuizCard(parent, entry, analytics) {
    const card = parent.createEl("article", { cls: "quiz-library-card" });
    const body = card.createDiv({ cls: "quiz-library-card-body" });
    const tags = body.createDiv({ cls: "quiz-library-card-tags" });
    tags.createSpan({
      cls: "quiz-badge",
      text: entry.quiz.mode === "standard" ? "\u6807\u51C6\u6D4B\u9A8C" : "\u5FEB\u901F\u6D4B\u9A8C"
    });
    if (entry.quiz.difficulty) {
      tags.createSpan({
        cls: "quiz-badge",
        text: `${entry.quiz.difficulty.min}\u2013${entry.quiz.difficulty.max}`
      });
    }
    body.createEl("h3", { text: entry.quiz.title });
    body.createDiv({ cls: "quiz-library-path", text: entry.filePath });
    const facts = body.createDiv({ cls: "quiz-library-facts" });
    facts.createSpan({ text: `${entry.quiz.questions.length} \u9053\u9898` });
    facts.createSpan({
      text: `${analytics?.completedSessionCount ?? 0} \u6B21\u5B8C\u6210`
    });
    facts.createSpan({
      text: `\u9996\u6B21\u6B63\u786E\u7387 ${formatAccuracy(analytics?.firstAccuracy ?? null)}`
    });
    const progress = card.createDiv({ cls: "quiz-library-card-progress" });
    const progressLabel = progress.createDiv({ cls: "quiz-library-progress-label" });
    progressLabel.createSpan({ text: "\u5F53\u524D\u8FDB\u5EA6" });
    progressLabel.createSpan({
      text: `${analytics?.currentAnsweredCount ?? 0} / ${entry.quiz.questions.length}`
    });
    progress.createEl("progress", {
      attr: {
        max: String(entry.quiz.questions.length),
        value: String(analytics?.currentAnsweredCount ?? 0),
        "aria-label": `${entry.quiz.title} \u5F53\u524D\u8FDB\u5EA6`
      }
    });
    progress.createDiv({
      cls: "quiz-library-activity",
      text: formatActivity(analytics?.latestActivityAt ?? null)
    });
    card.createEl("button", {
      cls: "quiz-library-open",
      text: "\u6253\u5F00\u6D4B\u8BD5",
      attr: {
        type: "button",
        "data-action": "open-quiz",
        "data-file-path": entry.filePath
      }
    });
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
  constructor(containerEl, quiz, quizKey, filePath, storage) {
    super(containerEl);
    this.quiz = quiz;
    this.quizKey = quizKey;
    this.filePath = filePath;
    this.storage = storage;
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
  drafts = /* @__PURE__ */ new Map();
  editing = /* @__PURE__ */ new Set();
  pending = /* @__PURE__ */ new Set();
  submittedThisSession = /* @__PURE__ */ new Set();
  sessionId;
  sessionActionPending = false;
  saveError = null;
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
    this.render();
    try {
      await result.persisted;
    } catch (error) {
      this.saveError = "\u65B0\u6D4B\u9A8C\u521B\u5EFA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5";
      console.error("Omni Quiz failed to start a session", error);
    } finally {
      this.sessionActionPending = false;
      this.render();
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
    const questionEl = this.containerEl.createDiv({ cls: "quiz-question" });
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
    this.registerView(
      QUIZ_DASHBOARD_VIEW,
      (leaf) => new QuizDashboardView(leaf, storage)
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
            new QuizRenderer(el, quiz, quizKey, ctx.sourcePath, storage)
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
