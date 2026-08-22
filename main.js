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
var import_obsidian2 = require("obsidian");

// src/parser.ts
var QuizParseError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "QuizParseError";
  }
};
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readRequiredString(value, field, errorPrefix = "Quiz") {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new QuizParseError(`${errorPrefix} \u7F3A\u5C11\u6709\u6548\u7684 ${field}`);
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
function parseQuestion(value) {
  if (!isRecord(value)) {
    throw new QuizParseError("Quiz \u5305\u542B\u65E0\u6548\u9898\u76EE");
  }
  const id = readRequiredString(value.id, "id", "\u9898\u76EE");
  const question = readRequiredString(value.question, "question", `\u9898\u76EE ${id}`);
  if (!Array.isArray(value.options) || value.options.length < 2) {
    throw new QuizParseError(`\u9898\u76EE ${id} \u81F3\u5C11\u9700\u8981 2 \u4E2A\u9009\u9879`);
  }
  const options = value.options.map((option) => parseOption(option, id));
  const optionIds = /* @__PURE__ */ new Set();
  for (const option of options) {
    if (optionIds.has(option.id)) {
      throw new QuizParseError(`\u9898\u76EE ${id} \u5B58\u5728\u91CD\u590D\u9009\u9879 ID`);
    }
    optionIds.add(option.id);
  }
  const answer = readRequiredString(value.answer, "answer", `\u9898\u76EE ${id}`);
  if (!optionIds.has(answer)) {
    throw new QuizParseError(`\u9898\u76EE ${id} \u7684\u6B63\u786E\u7B54\u6848\u65E0\u6548`);
  }
  if (value.explanation !== void 0 && typeof value.explanation !== "string") {
    throw new QuizParseError(`\u9898\u76EE ${id} \u7684 explanation \u65E0\u6548`);
  }
  return {
    id,
    question,
    options,
    answer,
    ...typeof value.explanation === "string" ? { explanation: value.explanation } : {}
  };
}
function parseQuiz(source) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new QuizParseError("Quiz JSON \u683C\u5F0F\u9519\u8BEF", { cause: error });
  }
  if (!isRecord(parsed)) {
    throw new QuizParseError("Quiz \u683C\u5F0F\u9519\u8BEF");
  }
  const id = readRequiredString(parsed.id, "id");
  const title = readRequiredString(parsed.title, "title");
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new QuizParseError("Quiz \u4E2D\u6CA1\u6709\u9898\u76EE");
  }
  const questions = parsed.questions.map(parseQuestion);
  const questionIds = /* @__PURE__ */ new Set();
  for (const question of questions) {
    if (questionIds.has(question.id)) {
      throw new QuizParseError("\u5B58\u5728\u91CD\u590D\u9898\u76EE ID");
    }
    questionIds.add(question.id);
  }
  return { id, title, questions };
}

// src/renderer.ts
var import_obsidian = require("obsidian");
var QuizRenderer = class extends import_obsidian.MarkdownRenderChild {
  constructor(containerEl, quiz, quizKey, filePath, storage) {
    super(containerEl);
    this.quiz = quiz;
    this.quizKey = quizKey;
    this.filePath = filePath;
    this.storage = storage;
  }
  quiz;
  quizKey;
  filePath;
  storage;
  drafts = /* @__PURE__ */ new Map();
  editing = /* @__PURE__ */ new Set();
  pending = /* @__PURE__ */ new Set();
  submittedThisSession = /* @__PURE__ */ new Set();
  saveError = null;
  onload() {
    this.registerDomEvent(this.containerEl, "change", (event) => {
      this.handleChange(event);
    });
    this.registerDomEvent(this.containerEl, "click", (event) => {
      this.handleClick(event);
    });
    this.render();
  }
  handleChange(event) {
    const inputType = this.containerEl.ownerDocument.defaultView?.HTMLInputElement;
    if (!inputType || !(event.target instanceof inputType)) return;
    if (event.target.type !== "radio") return;
    const questionId = event.target.dataset.questionId;
    const optionId = event.target.dataset.optionId;
    if (!questionId || !optionId) return;
    this.drafts.set(questionId, optionId);
    this.saveError = null;
    this.render();
  }
  handleClick(event) {
    const elementType = this.containerEl.ownerDocument.defaultView?.Element;
    if (!elementType || !(event.target instanceof elementType)) return;
    const button = event.target.closest("button[data-action]");
    if (!button || !this.containerEl.contains(button)) return;
    const questionId = button.dataset.questionId;
    if (!questionId) return;
    if (button.dataset.action === "retry") {
      const saved = this.storage.getQuestionResult(this.quizKey, questionId);
      if (saved) this.drafts.set(questionId, saved.selectedAnswer);
      this.submittedThisSession.delete(questionId);
      this.editing.add(questionId);
      this.saveError = null;
      this.render();
      return;
    }
    if (button.dataset.action === "submit") {
      void this.submit(questionId);
    }
  }
  async submit(questionId) {
    const question = this.quiz.questions.find((item) => item.id === questionId);
    const selectedAnswer = this.drafts.get(questionId);
    if (!question || !selectedAnswer || this.pending.has(questionId)) return;
    this.pending.add(questionId);
    this.editing.delete(questionId);
    this.submittedThisSession.add(questionId);
    this.saveError = null;
    const savePromise = this.storage.saveQuestionResult(
      this.quizKey,
      this.quiz.id,
      this.filePath,
      questionId,
      selectedAnswer,
      selectedAnswer === question.answer
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
  render() {
    this.containerEl.empty();
    this.containerEl.addClass("quiz-container");
    const header = this.containerEl.createDiv({ cls: "quiz-header" });
    header.createEl("h3", { text: this.quiz.title });
    this.renderStatistics(header);
    if (this.saveError) {
      this.containerEl.createDiv({ cls: "quiz-error", text: this.saveError });
    }
    this.quiz.questions.forEach((question, index) => {
      this.renderQuestion(question, index);
    });
  }
  renderStatistics(parent) {
    const statistics = this.storage.getStatistics(this.quizKey, this.quiz);
    const stats = parent.createDiv({ cls: "quiz-stats" });
    stats.createSpan({
      text: `\u8FDB\u5EA6\uFF1A${statistics.answeredCount} / ${this.quiz.questions.length}`
    });
    stats.createSpan({ text: `\u6B63\u786E\uFF1A${statistics.correctCount}` });
    stats.createSpan({
      text: `\u6B63\u786E\u7387\uFF1A${statistics.accuracy === null ? "-" : `${statistics.accuracy}%`}`
    });
  }
  renderQuestion(question, index) {
    const saved = this.storage.getQuestionResult(this.quizKey, question.id);
    const isEditing = this.editing.has(question.id);
    const isPending = this.pending.has(question.id);
    const isLocked = Boolean(saved) && !isEditing;
    const selectedAnswer = isEditing ? this.drafts.get(question.id) ?? saved?.selectedAnswer : saved?.selectedAnswer ?? this.drafts.get(question.id);
    const questionEl = this.containerEl.createDiv({ cls: "quiz-question" });
    questionEl.createEl("h4", {
      cls: "quiz-question-title",
      text: `${index + 1}. ${question.question}`
    });
    const optionGroup = questionEl.createDiv({ cls: "quiz-options" });
    optionGroup.setAttr("role", "radiogroup");
    optionGroup.setAttr("aria-label", question.question);
    for (const option of question.options) {
      const optionEl = optionGroup.createEl("label", { cls: "quiz-option" });
      if (isLocked || isPending) optionEl.addClass("is-disabled");
      if (option.id === selectedAnswer) optionEl.addClass("quiz-option-selected");
      if (isLocked && option.id === question.answer) {
        optionEl.addClass("quiz-option-correct");
      }
      if (isLocked && saved && !saved.correct && option.id === saved.selectedAnswer) {
        optionEl.addClass("quiz-option-wrong");
      }
      const input = optionEl.createEl("input", {
        type: "radio",
        attr: {
          name: `${this.quizKey}::${question.id}`,
          value: option.id,
          "data-question-id": question.id,
          "data-option-id": option.id
        }
      });
      input.checked = option.id === selectedAnswer;
      input.disabled = isLocked || isPending;
      optionEl.createSpan({ text: `${option.id}. ${option.text}` });
    }
    if (isLocked && saved) {
      this.renderResult(questionEl, question, saved);
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
    } else {
      const submit = questionEl.createEl("button", {
        cls: "quiz-submit",
        text: isPending ? "\u4FDD\u5B58\u4E2D\u2026" : "\u63D0\u4EA4\u7B54\u6848",
        attr: {
          type: "button",
          "data-action": "submit",
          "data-question-id": question.id
        }
      });
      submit.disabled = !selectedAnswer || isPending;
    }
  }
  renderResult(parent, question, result) {
    const resultEl = parent.createDiv({ cls: "quiz-result" });
    resultEl.addClass(result.correct ? "is-correct" : "is-wrong");
    resultEl.createDiv({
      cls: "quiz-result-status",
      text: result.correct ? "\u2713 \u56DE\u7B54\u6B63\u786E" : "\u2715 \u56DE\u7B54\u9519\u8BEF"
    });
    if (!result.correct) {
      resultEl.createDiv({
        text: `${this.submittedThisSession.has(question.id) ? "\u4F60\u7684\u7B54\u6848" : "\u4F60\u4E0A\u6B21\u9009\u62E9"}\uFF1A${result.selectedAnswer}`
      });
      resultEl.createDiv({ text: `\u6B63\u786E\u7B54\u6848\uFF1A${question.answer}` });
    } else if (!this.submittedThisSession.has(question.id)) {
      resultEl.createDiv({ text: `\u4F60\u4E0A\u6B21\u9009\u62E9\uFF1A${result.selectedAnswer}` });
    }
    if (question.explanation) {
      resultEl.createDiv({
        cls: "quiz-explanation",
        text: question.explanation
      });
    }
    resultEl.createDiv({
      cls: "quiz-attempts",
      text: `\u7B54\u9898\u6B21\u6570\uFF1A${result.attempts}`
    });
  }
};

// src/storage.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseQuestionResult(value) {
  if (!isRecord2(value)) return null;
  if (typeof value.selectedAnswer !== "string" || typeof value.correct !== "boolean" || typeof value.attempts !== "number" || !Number.isInteger(value.attempts) || value.attempts < 1 || typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) {
    return null;
  }
  return {
    selectedAnswer: value.selectedAnswer,
    correct: value.correct,
    attempts: value.attempts,
    updatedAt: value.updatedAt
  };
}
function normalizePluginData(value) {
  if (!isRecord2(value) || !isRecord2(value.results)) {
    return { results: {} };
  }
  const results = {};
  for (const [key, candidate] of Object.entries(value.results)) {
    if (!isRecord2(candidate) || typeof candidate.quizId !== "string" || typeof candidate.filePath !== "string" || !isRecord2(candidate.questions)) {
      continue;
    }
    const questions = {};
    for (const [questionId, result] of Object.entries(candidate.questions)) {
      const parsed = parseQuestionResult(result);
      if (parsed) questions[questionId] = parsed;
    }
    results[key] = {
      quizId: candidate.quizId,
      filePath: candidate.filePath,
      questions
    };
  }
  return { results };
}
function cloneData(data) {
  const results = {};
  for (const [key, result] of Object.entries(data.results)) {
    results[key] = {
      quizId: result.quizId,
      filePath: result.filePath,
      questions: { ...result.questions }
    };
  }
  return { results };
}
var QuizStorage = class {
  constructor(data, persist) {
    this.data = data;
    this.persist = persist;
  }
  data;
  persist;
  saveQueue = Promise.resolve();
  getQuizResult(quizKey) {
    return this.data.results[quizKey];
  }
  getQuestionResult(quizKey, questionId) {
    return this.getQuizResult(quizKey)?.questions[questionId];
  }
  saveQuestionResult(quizKey, quizId, filePath, questionId, selectedAnswer, correct, now = Date.now()) {
    const existingQuiz = this.data.results[quizKey];
    const existingQuestion = existingQuiz?.questions[questionId];
    this.data.results[quizKey] = {
      quizId,
      filePath,
      questions: {
        ...existingQuiz?.questions ?? {},
        [questionId]: {
          selectedAnswer,
          correct,
          attempts: (existingQuestion?.attempts ?? 0) + 1,
          updatedAt: now
        }
      }
    };
    const snapshot = cloneData(this.data);
    this.saveQueue = this.saveQueue.catch(() => void 0).then(async () => this.persist(snapshot));
    return this.saveQueue;
  }
  getStatistics(quizKey, quiz) {
    const result = this.getQuizResult(quizKey);
    let answeredCount = 0;
    let correctCount = 0;
    for (const question of quiz.questions) {
      const questionResult = result?.questions[question.id];
      if (!questionResult) continue;
      answeredCount += 1;
      if (questionResult.correct) correctCount += 1;
    }
    return {
      answeredCount,
      correctCount,
      accuracy: answeredCount === 0 ? null : Math.round(correctCount / answeredCount * 100)
    };
  }
};

// src/main.ts
var OmniQuizPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    const data = normalizePluginData(await this.loadData());
    const storage = new QuizStorage(data, async (nextData) => {
      await this.saveData(nextData);
    });
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
};
