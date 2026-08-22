import { MarkdownRenderChild } from "obsidian";
import type { QuizStorage } from "./storage";
import type { QuestionResult, QuizData, QuizQuestion } from "./types";

export class QuizRenderer extends MarkdownRenderChild {
	private readonly drafts = new Map<string, string>();
	private readonly editing = new Set<string>();
	private readonly pending = new Set<string>();
	private readonly submittedThisSession = new Set<string>();
	private saveError: string | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly quiz: QuizData,
		private readonly quizKey: string,
		private readonly filePath: string,
		private readonly storage: QuizStorage,
	) {
		super(containerEl);
	}

	onload(): void {
		this.registerDomEvent(this.containerEl, "change", (event) => {
			this.handleChange(event);
		});
		this.registerDomEvent(this.containerEl, "click", (event) => {
			this.handleClick(event);
		});
		this.render();
	}

	private handleChange(event: Event): void {
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

	private handleClick(event: MouseEvent): void {
		const elementType = this.containerEl.ownerDocument.defaultView?.Element;
		if (!elementType || !(event.target instanceof elementType)) return;

		const button = event.target.closest<HTMLButtonElement>("button[data-action]");
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

	private async submit(questionId: string): Promise<void> {
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
			selectedAnswer === question.answer,
		);
		this.render();

		try {
			await savePromise;
		} catch (error) {
			this.saveError = "答题记录保存失败，请重试";
			console.error("Omni Quiz failed to save an answer", error);
		} finally {
			this.pending.delete(questionId);
			this.render();
		}
	}

	private render(): void {
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

	private renderStatistics(parent: HTMLElement): void {
		const statistics = this.storage.getStatistics(this.quizKey, this.quiz);
		const stats = parent.createDiv({ cls: "quiz-stats" });
		stats.createSpan({
			text: `进度：${statistics.answeredCount} / ${this.quiz.questions.length}`,
		});
		stats.createSpan({ text: `正确：${statistics.correctCount}` });
		stats.createSpan({
			text: `正确率：${statistics.accuracy === null ? "-" : `${statistics.accuracy}%`}`,
		});
	}

	private renderQuestion(question: QuizQuestion, index: number): void {
		const saved = this.storage.getQuestionResult(this.quizKey, question.id);
		const isEditing = this.editing.has(question.id);
		const isPending = this.pending.has(question.id);
		const isLocked = Boolean(saved) && !isEditing;
		const selectedAnswer = isEditing
			? (this.drafts.get(question.id) ?? saved?.selectedAnswer)
			: (saved?.selectedAnswer ?? this.drafts.get(question.id));

		const questionEl = this.containerEl.createDiv({ cls: "quiz-question" });
		questionEl.createEl("h4", {
			cls: "quiz-question-title",
			text: `${index + 1}. ${question.question}`,
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
			if (
				isLocked &&
				saved &&
				!saved.correct &&
				option.id === saved.selectedAnswer
			) {
				optionEl.addClass("quiz-option-wrong");
			}

			const input = optionEl.createEl("input", {
				type: "radio",
				attr: {
					name: `${this.quizKey}::${question.id}`,
					value: option.id,
					"data-question-id": question.id,
					"data-option-id": option.id,
				},
			});
			input.checked = option.id === selectedAnswer;
			input.disabled = isLocked || isPending;
			optionEl.createSpan({ text: `${option.id}. ${option.text}` });
		}

		if (isLocked && saved) {
			this.renderResult(questionEl, question, saved);
			const retry = questionEl.createEl("button", {
				cls: "quiz-retry",
				text: "重新作答",
				attr: {
					type: "button",
					"data-action": "retry",
					"data-question-id": question.id,
				},
			});
			retry.disabled = isPending;
		} else {
			const submit = questionEl.createEl("button", {
				cls: "quiz-submit",
				text: isPending ? "保存中…" : "提交答案",
				attr: {
					type: "button",
					"data-action": "submit",
					"data-question-id": question.id,
				},
			});
			submit.disabled = !selectedAnswer || isPending;
		}
	}

	private renderResult(
		parent: HTMLElement,
		question: QuizQuestion,
		result: QuestionResult,
	): void {
		const resultEl = parent.createDiv({ cls: "quiz-result" });
		resultEl.addClass(result.correct ? "is-correct" : "is-wrong");
		resultEl.createDiv({
			cls: "quiz-result-status",
			text: result.correct ? "✓ 回答正确" : "✕ 回答错误",
		});
		if (!result.correct) {
			resultEl.createDiv({
				text: `${this.submittedThisSession.has(question.id) ? "你的答案" : "你上次选择"}：${result.selectedAnswer}`,
			});
			resultEl.createDiv({ text: `正确答案：${question.answer}` });
		} else if (!this.submittedThisSession.has(question.id)) {
			resultEl.createDiv({ text: `你上次选择：${result.selectedAnswer}` });
		}

		if (question.explanation) {
			resultEl.createDiv({
				cls: "quiz-explanation",
				text: question.explanation,
			});
		}
		resultEl.createDiv({
			cls: "quiz-attempts",
			text: `答题次数：${result.attempts}`,
		});
	}
}
