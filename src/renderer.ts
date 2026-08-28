import { MarkdownRenderChild } from "obsidian";
import { evaluateAnswer, formatAnswer, formatCorrectAnswer } from "./evaluator";
import type { QuizFocusCoordinator, QuizFocusTarget } from "./navigation";
import type { QuizStorage } from "./storage";
import type {
	AnswerValue,
	QuestionAttempt,
	QuizData,
	QuizOption,
	QuizQuestion,
} from "./types";

const TYPE_LABELS: Record<QuizQuestion["type"], string> = {
	single: "单选",
	multiple: "多选",
	true_false: "判断",
	fill_blank: "填空",
};

function cloneAnswer(answer: AnswerValue): AnswerValue {
	return Array.isArray(answer) ? [...answer] : answer;
}

export class QuizRenderer extends MarkdownRenderChild {
	private readonly drafts = new Map<string, AnswerValue>();
	private readonly editing = new Set<string>();
	private readonly pending = new Set<string>();
	private readonly submittedThisSession = new Set<string>();
	private sessionId: string;
	private sessionActionPending = false;
	private saveError: string | null = null;
	private focusedQuestionId: string | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly quiz: QuizData,
		private readonly quizKey: string,
		private readonly filePath: string,
		private readonly storage: QuizStorage,
		private readonly focusCoordinator: QuizFocusCoordinator,
	) {
		super(containerEl);
		this.sessionId = storage.getOrCreateCurrentSession(
			quizKey,
			quiz.id,
			filePath,
		).id;
	}

	onload(): void {
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
			this.focusCoordinator.subscribe((target) => this.handleFocusRequest(target)),
		);
	}

	private getInput(event: Event): HTMLInputElement | null {
		const inputType = this.containerEl.ownerDocument.defaultView?.HTMLInputElement;
		return inputType && event.target instanceof inputType ? event.target : null;
	}

	private handleInput(event: Event): void {
		const input = this.getInput(event);
		if (!input || input.type !== "text") return;
		const questionId = input.dataset.questionId;
		if (!questionId) return;
		this.drafts.set(questionId, input.value);
		this.saveError = null;
		this.updateSubmitButton(questionId);
	}

	private handleChange(event: Event): void {
		const input = this.getInput(event);
		if (!input || (input.type !== "radio" && input.type !== "checkbox")) return;
		const questionId = input.dataset.questionId;
		const optionId = input.dataset.optionId;
		if (!questionId || optionId === undefined) return;
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

	private handleClick(event: MouseEvent): void {
		const elementType = this.containerEl.ownerDocument.defaultView?.Element;
		if (!elementType || !(event.target instanceof elementType)) return;
		const button = event.target.closest<HTMLButtonElement>("button[data-action]");
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

	private handleFocusRequest(target: QuizFocusTarget): boolean {
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

	private focusQuestion(questionId: string): void {
		const questionEl = [...this.containerEl.querySelectorAll<HTMLElement>(
			".quiz-question[data-question-id]",
		)].find((element) => element.dataset.questionId === questionId);
		if (!questionEl) return;
		const viewWindow = this.containerEl.ownerDocument.defaultView;
		const reduceMotion = viewWindow?.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		questionEl.addClass("is-navigation-target");
		questionEl.scrollIntoView({
			block: "center",
			behavior: reduceMotion ? "auto" : "smooth",
		});
		questionEl
			.querySelector<HTMLElement>(
				'button[data-action="retry"], button[data-action="review"], input:not(:disabled), button[data-action="submit"]',
			)
			?.focus({ preventScroll: true });
		if (viewWindow) {
			const timer = viewWindow.setTimeout(() => {
				questionEl.removeClass("is-navigation-target");
			}, 2200);
			this.register(() => viewWindow.clearTimeout(timer));
		}
	}

	private retry(questionId: string): void {
		const saved = this.storage.getLatestAttempt(
			this.quizKey,
			this.sessionId,
			questionId,
		);
		if (saved) this.drafts.set(questionId, cloneAnswer(saved.answer));
		this.submittedThisSession.delete(questionId);
		this.editing.add(questionId);
		this.saveError = null;
		this.render();
	}

	private async submit(questionId: string): Promise<void> {
		const question = this.quiz.questions.find((item) => item.id === questionId);
		const answer = this.drafts.get(questionId);
		if (
			!question ||
			answer === undefined ||
			!this.isAnswerReady(answer) ||
			this.pending.has(questionId)
		) {
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
			evaluateAnswer(question, answer),
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

	private async complete(): Promise<void> {
		if (this.sessionActionPending) return;
		this.sessionActionPending = true;
		this.saveError = null;
		this.render();
		try {
			await this.storage.completeSession(
				this.quizKey,
				this.sessionId,
				this.quiz,
			);
		} catch (error) {
			this.saveError = "测验结果保存失败，请重试";
			console.error("Omni Quiz failed to complete a session", error);
		} finally {
			this.sessionActionPending = false;
			this.render();
		}
	}

	private async restart(): Promise<void> {
		await this.startNewSession();
	}

	private async reviewQuestion(questionId: string): Promise<void> {
		await this.startNewSession(questionId);
	}

	private async startNewSession(questionId?: string): Promise<void> {
		if (this.sessionActionPending) return;
		this.sessionActionPending = true;
		this.saveError = null;
		const result = this.storage.startNewSession(
			this.quizKey,
			this.quiz.id,
			this.filePath,
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
			this.saveError = "新测验创建失败，请重试";
			console.error("Omni Quiz failed to start a session", error);
		} finally {
			this.sessionActionPending = false;
			this.render();
			if (questionId) this.focusQuestion(questionId);
		}
	}

	private render(): void {
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

	private renderMetadata(parent: HTMLElement): void {
		const metadata = parent.createDiv({ cls: "quiz-metadata" });
		metadata.createSpan({
			cls: "quiz-badge",
			text: this.quiz.mode === "standard" ? "标准测验" : "快速测验",
		});
		if (this.quiz.difficulty) {
			metadata.createSpan({
				cls: "quiz-badge",
				text: `${this.quiz.difficulty.min}–${this.quiz.difficulty.max}`,
			});
		}
	}

	private renderStatistics(parent: HTMLElement): void {
		const statistics = this.storage.getStatistics(
			this.quizKey,
			this.sessionId,
			this.quiz,
		);
		const stats = parent.createDiv({ cls: "quiz-stats" });
		stats.createSpan({
			text: `进度：${statistics.answeredCount} / ${this.quiz.questions.length}`,
		});
		stats.createSpan({ text: `当前正确：${statistics.correctCount}` });
		stats.createSpan({
			text: `首次正确率：${statistics.firstAccuracy === null ? "-" : `${statistics.firstAccuracy}%`}`,
		});
		stats.createSpan({ text: `已完成：${statistics.completedSessionCount} 次` });
	}

	private renderQuestion(question: QuizQuestion, index: number): void {
		const saved = this.storage.getLatestAttempt(
			this.quizKey,
			this.sessionId,
			question.id,
		);
		const session = this.storage.getSession(this.quizKey, this.sessionId);
		const isCompleted = session?.completedAt !== undefined;
		const isEditing = this.editing.has(question.id) && !isCompleted;
		const isPending = this.pending.has(question.id);
		const isLocked = (Boolean(saved) && !isEditing) || isCompleted;
		const answer = isEditing
			? (this.drafts.get(question.id) ?? saved?.answer)
			: (saved?.answer ?? this.drafts.get(question.id));

		const questionEl = this.containerEl.createDiv({
			cls: "quiz-question",
			attr: { "data-question-id": question.id },
		});
		const heading = questionEl.createDiv({ cls: "quiz-question-heading" });
		heading.createEl("h4", {
			cls: "quiz-question-title",
			text: `${index + 1}. ${question.question}`,
		});
		const tags = heading.createDiv({ cls: "quiz-question-tags" });
		tags.createSpan({ cls: "quiz-badge", text: TYPE_LABELS[question.type] });
		tags.createSpan({ cls: "quiz-badge", text: question.level });

		if (question.type === "fill_blank") {
			this.renderFillBlank(questionEl, question, answer, isLocked || isPending);
		} else if (question.type === "true_false") {
			this.renderChoices(
				questionEl,
				question,
				[
					{ id: "true", text: "正确" },
					{ id: "false", text: "错误" },
				],
				answer,
				isLocked || isPending,
			);
		} else {
			this.renderChoices(
				questionEl,
				question,
				question.options,
				answer,
				isLocked || isPending,
			);
		}

		if (isLocked && saved) {
			this.renderResult(questionEl, question, saved);
			if (!isCompleted) {
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
			} else if (this.focusedQuestionId === question.id) {
				questionEl.createEl("button", {
					cls: "quiz-retry",
					text: "重做此题",
					attr: {
						type: "button",
						"data-action": "review",
						"data-question-id": question.id,
					},
				});
			}
		} else if (!isCompleted) {
			const submit = questionEl.createEl("button", {
				cls: "quiz-submit",
				text: isPending ? "保存中…" : "提交答案",
				attr: {
					type: "button",
					"data-action": "submit",
					"data-question-id": question.id,
				},
			});
			submit.disabled = !this.isAnswerReady(answer) || isPending;
		}
	}

	private renderChoices(
		parent: HTMLElement,
		question: Exclude<QuizQuestion, { type: "fill_blank" }>,
		options: QuizOption[],
		answer: AnswerValue | undefined,
		disabled: boolean,
	): void {
		const multiple = question.type === "multiple";
		const selectedIds = new Set(
			Array.isArray(answer)
				? answer
				: question.type === "true_false" && typeof answer === "boolean"
					? [String(answer)]
					: typeof answer === "string"
						? [answer]
						: [],
		);
		const correctIds = new Set(
			question.type === "multiple"
				? question.answer
				: question.type === "true_false"
					? [String(question.answer)]
					: [question.answer],
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
			if (
				disabled &&
				selectedIds.has(option.id) &&
				!correctIds.has(option.id)
			) {
				optionEl.addClass("quiz-option-wrong");
			}
			const input = optionEl.createEl("input", {
				type: multiple ? "checkbox" : "radio",
				attr: {
					name: `${this.quizKey}::${this.sessionId}::${question.id}`,
					value: option.id,
					"data-question-id": question.id,
					"data-option-id": option.id,
				},
			});
			input.checked = selectedIds.has(option.id);
			input.disabled = disabled;
			optionEl.createSpan({ text: `${option.id}. ${option.text}` });
		}
	}

	private renderFillBlank(
		parent: HTMLElement,
		question: Extract<QuizQuestion, { type: "fill_blank" }>,
		answer: AnswerValue | undefined,
		disabled: boolean,
	): void {
		const input = parent.createEl("input", {
			cls: "quiz-fill-input",
			type: "text",
			attr: {
				"aria-label": question.question,
				placeholder: "输入答案",
				"data-question-id": question.id,
			},
		});
		input.value = typeof answer === "string" ? answer : "";
		input.disabled = disabled;
	}

	private renderResult(
		parent: HTMLElement,
		question: QuizQuestion,
		attempt: QuestionAttempt,
	): void {
		const resultEl = parent.createDiv({ cls: "quiz-result" });
		resultEl.addClass(attempt.correct ? "is-correct" : "is-wrong");
		resultEl.createDiv({
			cls: "quiz-result-status",
			text: attempt.correct ? "✓ 回答正确" : "✕ 回答错误",
		});
		if (!attempt.correct) {
			resultEl.createDiv({
				text: `${this.submittedThisSession.has(question.id) ? "你的答案" : "你上次回答"}：${formatAnswer(question, attempt.answer)}`,
			});
			resultEl.createDiv({ text: `正确答案：${formatCorrectAnswer(question)}` });
		} else if (!this.submittedThisSession.has(question.id)) {
			resultEl.createDiv({
				text: `你上次回答：${formatAnswer(question, attempt.answer)}`,
			});
		}
		if (question.explanation) {
			resultEl.createDiv({ cls: "quiz-explanation", text: question.explanation });
		}
		const attempts = this.storage.getAttempts(
			this.quizKey,
			this.sessionId,
			question.id,
		).length;
		resultEl.createDiv({ cls: "quiz-attempts", text: `本次尝试：${attempts}` });
	}

	private renderSessionActions(): void {
		const session = this.storage.getSession(this.quizKey, this.sessionId);
		if (!session) return;
		const statistics = this.storage.getStatistics(
			this.quizKey,
			this.sessionId,
			this.quiz,
		);
		const actions = this.containerEl.createDiv({ cls: "quiz-session-actions" });

		if (session.completedAt !== undefined) {
			const summary = actions.createDiv({ cls: "quiz-summary" });
			summary.createEl("h4", { text: "本次测验已完成" });
			summary.createDiv({
				text: `最终得分：${statistics.correctCount} / ${this.quiz.questions.length}（${statistics.accuracy ?? 0}%）`,
			});
			summary.createDiv({
				text: `首次正确率：${statistics.firstAccuracy ?? 0}%`,
			});
			actions.createEl("button", {
				cls: "quiz-restart",
				text: this.sessionActionPending ? "创建中…" : "开始新测验",
				attr: { type: "button", "data-action": "restart" },
			}).disabled = this.sessionActionPending;
			return;
		}

		const complete = actions.createEl("button", {
			cls: "quiz-complete",
			text: this.sessionActionPending ? "保存中…" : "完成测验",
			attr: { type: "button", "data-action": "complete" },
		});
		complete.disabled =
			statistics.answeredCount !== this.quiz.questions.length ||
			this.pending.size > 0 ||
			this.sessionActionPending;
	}

	private isAnswerReady(answer: AnswerValue | undefined): boolean {
		if (answer === undefined) return false;
		if (typeof answer === "string") return answer.trim().length > 0;
		if (Array.isArray(answer)) return answer.length > 0;
		return true;
	}

	private updateSubmitButton(questionId: string): void {
		const button = Array.from(
			this.containerEl.querySelectorAll<HTMLButtonElement>(
				'button[data-action="submit"]',
			),
		).find((candidate) => candidate.dataset.questionId === questionId);
		if (button) button.disabled = !this.isAnswerReady(this.drafts.get(questionId));
	}
}
