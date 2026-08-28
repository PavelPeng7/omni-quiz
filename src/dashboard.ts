import { getAllTags, ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import {
	buildDashboardAnalytics,
	type DashboardAnalytics,
	type QuizEntryAnalytics,
	type TopicAnalytics,
	type WrongQuestionAnalytics,
} from "./analytics";
import {
	scanQuizCatalog,
	type QuizCatalog,
	type QuizCatalogEntry,
} from "./catalog";
import {
	filterQuizCatalogEntries,
	type LibrarySort,
	type LibraryStatus,
} from "./library";
import type { QuizFocusCoordinator } from "./navigation";
import type { QuizStorage } from "./storage";
import type { CognitiveLevel, QuizQuestion } from "./types";

export const QUIZ_DASHBOARD_VIEW = "omni-quiz-dashboard";

const LEVELS: CognitiveLevel[] = ["L1", "L2", "L3", "L4"];
const QUESTION_TYPES: QuizQuestion["type"][] = [
	"single",
	"multiple",
	"true_false",
	"fill_blank",
];
const TYPE_LABELS: Record<QuizQuestion["type"], string> = {
	single: "单选",
	multiple: "多选",
	true_false: "判断",
	fill_blank: "填空",
};
const ACTIVITY_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
	year: "numeric",
	month: "short",
	day: "numeric",
});
const WEEK_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
	month: "numeric",
	day: "numeric",
});

type DashboardSection = "review" | "topics" | "library" | "statistics";
type ModeFilter = "all" | "quick" | "standard";

function formatAccuracy(value: number | null): string {
	return value === null ? "—" : `${value}%`;
}

function formatActivity(value: number | null): string {
	if (value === null) return "尚未开始";
	return ACTIVITY_DATE_FORMATTER.format(value);
}

function displayTopic(topic: string): string {
	return topic.split("/").join(" › ");
}

export class QuizDashboardView extends ItemView {
	private catalog: QuizCatalog = { entries: [], errors: [] };
	private analytics: DashboardAnalytics = buildDashboardAnalytics([], {});
	private activeSection: DashboardSection = "review";
	private query = "";
	private modeFilter: ModeFilter = "all";
	private statusFilter: LibraryStatus = "all";
	private sortOption: LibrarySort = "recent";
	private topicFilter = "all";
	private showAllWrong = false;
	private scanVersion = 0;
	private refreshTimer: number | null = null;
	private loading = true;
	private loadError: string | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly storage: QuizStorage,
		private readonly focusCoordinator: QuizFocusCoordinator,
	) {
		super(leaf);
		this.icon = "library-big";
		this.navigation = false;
		this.addAction("refresh-cw", "刷新测试题索引", () => {
			void this.reloadCatalog();
		});
	}

	getViewType(): string {
		return QUIZ_DASHBOARD_VIEW;
	}

	getDisplayText(): string {
		return "Omni Quiz";
	}

	protected async onOpen(): Promise<void> {
		this.contentEl.addClass("omni-quiz-dashboard");
		this.registerDomEvent(this.contentEl, "input", (event) => this.handleInput(event));
		this.registerDomEvent(this.contentEl, "change", (event) => this.handleChange(event));
		this.registerDomEvent(this.contentEl, "click", (event) => this.handleClick(event));
		const refreshForFile = (file: unknown): void => {
			if (file instanceof TFile && file.extension === "md") {
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

	private scheduleCatalogReload(): void {
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

	private getInput(event: Event): HTMLInputElement | null {
		const inputType = this.contentEl.ownerDocument.defaultView?.HTMLInputElement;
		return inputType && event.target instanceof inputType ? event.target : null;
	}

	private handleInput(event: Event): void {
		const input = this.getInput(event);
		if (!input || input.dataset.role !== "quiz-search") return;
		this.query = input.value;
		this.renderLibraryResults();
	}

	private handleChange(event: Event): void {
		const selectType = this.contentEl.ownerDocument.defaultView?.HTMLSelectElement;
		if (!selectType || !(event.target instanceof selectType)) return;
		const { role } = event.target.dataset;
		if (role === "mode-filter") this.modeFilter = event.target.value as ModeFilter;
		else if (role === "status-filter") this.statusFilter = event.target.value as LibraryStatus;
		else if (role === "sort-option") this.sortOption = event.target.value as LibrarySort;
		else if (role === "topic-filter") this.topicFilter = event.target.value;
		else return;
		this.renderLibraryResults();
	}

	private handleClick(event: MouseEvent): void {
		const elementType = this.contentEl.ownerDocument.defaultView?.Element;
		if (!elementType || !(event.target instanceof elementType)) return;
		const button = event.target.closest<HTMLButtonElement>("button[data-action]");
		if (!button || !this.contentEl.contains(button)) return;
		const action = button.dataset.action;
		if (action === "switch-section" && button.dataset.section) {
			this.activeSection = button.dataset.section as DashboardSection;
			this.render();
		} else if (action === "open-quiz" && button.dataset.filePath) {
			void this.openQuizFile(button.dataset.filePath);
		} else if (
			action === "focus-question" &&
			button.dataset.filePath &&
			button.dataset.quizId &&
			button.dataset.questionId
		) {
			void this.openQuizFile(button.dataset.filePath, {
				filePath: button.dataset.filePath,
				quizId: button.dataset.quizId,
				questionId: button.dataset.questionId,
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

	private resetFilters(): void {
		this.query = "";
		this.modeFilter = "all";
		this.statusFilter = "all";
		this.sortOption = "recent";
		this.topicFilter = "all";
	}

	private async openQuizFile(
		filePath: string,
		focus?: { filePath: string; quizId: string; questionId: string },
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;
		await this.app.workspace.getLeaf("tab").openFile(file);
		if (focus) this.focusCoordinator.request(focus);
	}

	private async reloadCatalog(): Promise<void> {
		const version = ++this.scanVersion;
		this.loading = true;
		this.loadError = null;
		this.render();
		try {
			const catalog = await scanQuizCatalog(this.app, (file) => {
				const cache = this.app.metadataCache.getFileCache(file);
				return cache ? getAllTags(cache) ?? [] : [];
			});
			if (version !== this.scanVersion) return;
			this.catalog = catalog;
		} catch (error) {
			if (version !== this.scanVersion) return;
			this.loadError = "无法读取知识库中的测试题，请刷新后重试";
			console.error("Omni Quiz failed to scan the vault", error);
		} finally {
			if (version === this.scanVersion) {
				this.loading = false;
				this.render();
			}
		}
	}

	private render(): void {
		this.contentEl.empty();
		if (!this.loading && !this.loadError) {
			this.analytics = buildDashboardAnalytics(
				this.catalog.entries,
				this.storage.getHistories(),
			);
		}
		const shell = this.contentEl.createDiv({ cls: "quiz-dashboard-shell" });
		this.renderHero(shell);
		this.renderNavigation(shell);
		if (this.loading) {
			this.renderStatus(shell, "正在索引知识库中的测试题…", false);
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

	private renderHero(parent: HTMLElement): void {
		const hero = parent.createEl("header", { cls: "quiz-dashboard-hero" });
		const copy = hero.createDiv();
		copy.createDiv({ cls: "quiz-dashboard-eyebrow", text: "Review index" });
		copy.createEl("h1", { text: "知识复习台" });
		copy.createEl("p", {
			text: "从尚未掌握的题目出发，沿着主题索引回到知识原文。",
		});
		const status = hero.createDiv({ cls: "quiz-dashboard-hero-status" });
		status.createSpan({ text: "最近学习" });
		status.createEl("strong", { text: formatActivity(this.analytics.latestActivityAt) });
	}

	private renderNavigation(parent: HTMLElement): void {
		const nav = parent.createEl("nav", {
			cls: "quiz-dashboard-nav",
			attr: { "aria-label": "知识复习台" },
		});
		const sections: Array<[DashboardSection, string, string]> = [
			["review", "复习", "尚未掌握"],
			["topics", "主题", "知识索引"],
			["library", "题库", "全部测试"],
			["statistics", "统计", "学习信号"],
		];
		for (const [section, label, detail] of sections) {
			const button = nav.createEl("button", {
				attr: {
					type: "button",
					"data-action": "switch-section",
					"data-section": section,
					...(this.activeSection === section ? { "aria-current": "page" } : {}),
				},
			});
			button.createEl("strong", { text: label });
			button.createSpan({ text: detail });
		}
	}

	private renderStatus(parent: HTMLElement, message: string, showRetry: boolean): void {
		const status = parent.createDiv({ cls: "quiz-dashboard-status" });
		status.createEl("p", { text: message });
		if (showRetry) {
			status.createEl("button", {
				text: "重新索引",
				attr: { type: "button", "data-action": "refresh" },
			});
		}
	}

	private renderReview(parent: HTMLElement): void {
		const summary = parent.createEl("section", {
			cls: "quiz-review-summary",
			attr: { "aria-label": "复习概览" },
		});
		const wrong = summary.createDiv({ cls: "quiz-review-number is-wrong" });
		wrong.createSpan({ text: "待复习" });
		wrong.createEl("strong", { text: String(this.analytics.wrongQuestionCount) });
		wrong.createEl("small", { text: "道最新作答仍错误的题" });
		const progress = summary.createDiv({ cls: "quiz-review-number" });
		progress.createSpan({ text: "继续测试" });
		progress.createEl("strong", { text: String(this.analytics.incompleteQuizCount) });
		progress.createEl("small", { text: "份尚未完成的测试" });

		const grid = parent.createDiv({ cls: "quiz-review-grid" });
		const queue = grid.createEl("section", { cls: "quiz-review-queue" });
		this.renderSectionHeading(
			queue,
			"错题索引",
			this.analytics.wrongQuestionCount === 0 ? "当前没有待复习题" : "先处理反复出错的知识",
		);
		const wrongLimit = this.showAllWrong ? 100 : 5;
		this.renderWrongQuestions(queue, this.analytics.wrongQuestions.slice(0, wrongLimit));
		if (!this.showAllWrong && this.analytics.wrongQuestionCount > 5) {
			queue.createEl("button", {
				cls: "quiz-text-action",
				text: `查看全部 ${this.analytics.wrongQuestionCount} 道错题`,
				attr: { type: "button", "data-action": "show-all-wrong" },
			});
		}

		const aside = grid.createEl("aside", { cls: "quiz-review-aside" });
		this.renderContinueList(aside);
		this.renderWeakTopics(aside, this.analytics.topics.slice(0, 4));
		this.renderMiniTrend(aside);
	}

	private renderWrongQuestions(
		parent: HTMLElement,
		questions: WrongQuestionAnalytics[],
	): void {
		if (questions.length === 0) {
			const empty = parent.createDiv({ cls: "quiz-library-empty" });
			empty.createEl("h3", { text: "错题已经清空" });
			empty.createEl("p", { text: "新的错误会自动出现在这里；答对后会自动移除。" });
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
			details.createSpan({ text: `错误 ${item.wrongAttemptCount} 次` });
			details.createSpan({ text: formatActivity(item.lastWrongAt) });
			for (const topic of item.topics.slice(0, 2)) {
				details.createSpan({ text: displayTopic(topic) });
			}
			card.createEl("button", {
				text: "定位原题",
				attr: {
					type: "button",
					"data-action": "focus-question",
					"data-file-path": item.filePath,
					"data-quiz-id": item.quizId,
					"data-question-id": item.questionId,
				},
			});
		}
	}

	private renderContinueList(parent: HTMLElement): void {
		const section = parent.createEl("section", { cls: "quiz-aside-panel" });
		this.renderSectionHeading(section, "继续测试", `${this.analytics.incompleteQuizCount} 份进行中`);
		const entries = this.catalog.entries
			.filter((entry) => this.analytics.quizzes[entry.quizKey]?.isInProgress)
			.sort(
				(left, right) =>
					(this.analytics.quizzes[right.quizKey]?.latestActivityAt ?? 0) -
					(this.analytics.quizzes[left.quizKey]?.latestActivityAt ?? 0),
			)
			.slice(0, 3);
		if (entries.length === 0) {
			section.createEl("p", { cls: "quiz-muted-copy", text: "没有进行中的测试。" });
			return;
		}
		for (const entry of entries) {
			const item = section.createEl("button", {
				cls: "quiz-continue-item",
				attr: {
					type: "button",
					"data-action": "open-quiz",
					"data-file-path": entry.filePath,
				},
			});
			item.createEl("strong", { text: entry.quiz.title });
			item.createSpan({
				text: `${this.analytics.quizzes[entry.quizKey]?.currentAnsweredCount ?? 0} / ${entry.quiz.questions.length}`,
			});
		}
	}

	private renderWeakTopics(parent: HTMLElement, topics: TopicAnalytics[]): void {
		const section = parent.createEl("section", { cls: "quiz-aside-panel" });
		this.renderSectionHeading(section, "薄弱主题", "按待复习题排序");
		if (topics.length === 0) {
			section.createEl("p", { cls: "quiz-muted-copy", text: "添加笔记标签后会建立主题索引。" });
			return;
		}
		for (const topic of topics) {
			const button = section.createEl("button", {
				cls: "quiz-topic-row",
				attr: {
					type: "button",
					"data-action": "select-topic",
					"data-topic": topic.path,
				},
			});
			button.createSpan({ text: topic.label });
			button.createEl("strong", { text: `${topic.wrongQuestionCount} · ${formatAccuracy(topic.accuracy)}` });
		}
	}

	private renderMiniTrend(parent: HTMLElement): void {
		const section = parent.createEl("section", { cls: "quiz-aside-panel" });
		this.renderSectionHeading(section, "近 8 周", "首次回答正确率");
		this.renderTrendChart(section, true);
	}

	private renderTopics(parent: HTMLElement): void {
		const section = parent.createEl("section", { cls: "quiz-dashboard-section" });
		this.renderSectionHeading(section, "主题索引", `${this.analytics.topics.length} 个主题路径`);
		section.createEl("p", {
			cls: "quiz-section-intro",
			text: "主题来自笔记标签。嵌套标签同时汇总到父级，点击后查看该主题下的测试。",
		});
		const grid = section.createDiv({ cls: "quiz-topic-grid" });
		for (const topic of this.analytics.topics) this.renderTopicCard(grid, topic);
	}

	private renderTopicCard(parent: HTMLElement, topic: TopicAnalytics): void {
		const card = parent.createEl("button", {
			cls: "quiz-topic-card",
			attr: {
				type: "button",
				"data-action": "select-topic",
				"data-topic": topic.path,
			},
		});
		card.createSpan({ cls: "quiz-topic-depth", text: topic.depth === 0 ? "主题" : `层级 ${topic.depth + 1}` });
		card.createEl("h3", { text: topic.label });
		const facts = card.createDiv({ cls: "quiz-topic-facts" });
		facts.createSpan({ text: `${topic.quizCount} 份测试` });
		facts.createSpan({ text: `${topic.questionCount} 道题` });
		facts.createSpan({ text: `${topic.wrongQuestionCount} 道待复习` });
		const signal = card.createDiv({ cls: "quiz-topic-signal" });
		signal.createSpan({ text: "首次正确率" });
		signal.createEl("strong", { text: formatAccuracy(topic.accuracy) });
	}

	private renderLibrary(parent: HTMLElement): void {
		const section = parent.createEl("section", { cls: "quiz-library-section" });
		this.renderSectionHeading(section, "测试题库", `${this.catalog.entries.length} 份可用测试`);
		const controls = section.createDiv({ cls: "quiz-library-controls" });
		this.renderSearchControl(controls);
		this.renderSelectControl(controls, "模式", "mode-filter", this.modeFilter, [
			["all", "全部模式"],
			["quick", "快速测验"],
			["standard", "标准测验"],
		]);
		this.renderSelectControl(controls, "状态", "status-filter", this.statusFilter, [
			["all", "全部状态"],
			["not_started", "未开始"],
			["in_progress", "进行中"],
			["completed", "已完成"],
			["wrong", "有待复习题"],
		]);
		this.renderTopicControl(controls);
		this.renderSelectControl(controls, "排序", "sort-option", this.sortOption, [
			["recent", "最近学习"],
			["wrong", "待复习优先"],
			["accuracy", "正确率（低到高）"],
			["title", "标题"],
		]);
		section.createDiv({ cls: "quiz-library-results" });
		this.renderLibraryResults();
	}

	private renderSearchControl(parent: HTMLElement): void {
		const label = parent.createEl("label", { cls: "quiz-search-field" });
		label.createSpan({ text: "搜索" });
		label.createEl("input", {
			type: "search",
			value: this.query,
			attr: { placeholder: "标题、路径、Quiz ID 或主题", "data-role": "quiz-search" },
		});
	}

	private renderSelectControl(
		parent: HTMLElement,
		labelText: string,
		role: string,
		value: string,
		options: Array<[string, string]>,
	): void {
		const label = parent.createEl("label", { cls: "quiz-filter-field" });
		label.createSpan({ text: labelText });
		const select = label.createEl("select", { attr: { "data-role": role } });
		for (const [optionValue, text] of options) select.createEl("option", { value: optionValue, text });
		select.value = value;
	}

	private renderTopicControl(parent: HTMLElement): void {
		const topics = [...this.analytics.topics].sort((left, right) => left.label.localeCompare(right.label));
		this.renderSelectControl(
			parent,
			"主题",
			"topic-filter",
			this.topicFilter,
			[["all", "全部主题"], ...topics.map((topic): [string, string] => [topic.path, topic.label])],
		);
	}

	private renderLibraryResults(): void {
		const results = this.contentEl.querySelector<HTMLElement>(".quiz-library-results");
		if (!results) return;
		results.empty();
		const entries = this.getFilteredEntries();
		if (entries.length === 0) {
			const empty = results.createDiv({ cls: "quiz-library-empty" });
			empty.createEl("h3", {
				text: this.catalog.entries.length === 0 ? "知识库里还没有测试题" : "没有匹配的测试题",
			});
			empty.createEl("p", {
				text: this.catalog.entries.length === 0
					? "在 Markdown 中加入 quiz 代码块后，这里会自动建立索引。"
					: "修改搜索内容或清除筛选条件。",
			});
			if (this.catalog.entries.length > 0) {
				empty.createEl("button", {
					text: "清除筛选",
					attr: { type: "button", "data-action": "clear-filters" },
				});
			}
			return;
		}
		results.createDiv({ cls: "quiz-library-result-count", text: `${entries.length} 份测试` });
		const list = results.createDiv({ cls: "quiz-library-list" });
		for (const entry of entries.slice(0, 100)) {
			this.renderQuizCard(list, entry, this.analytics.quizzes[entry.quizKey]);
		}
		if (entries.length > 100) {
			results.createDiv({ cls: "quiz-library-limit", text: `当前显示前 100 份，请缩小 ${entries.length} 份结果。` });
		}
	}

	private getFilteredEntries(): QuizCatalogEntry[] {
		return filterQuizCatalogEntries(this.catalog.entries, this.analytics.quizzes, {
			query: this.query,
			mode: this.modeFilter,
			status: this.statusFilter,
			topic: this.topicFilter,
			sort: this.sortOption,
		});
	}

	private renderQuizCard(
		parent: HTMLElement,
		entry: QuizCatalogEntry,
		analytics: QuizEntryAnalytics | undefined,
	): void {
		const card = parent.createEl("article", { cls: "quiz-library-card" });
		if ((analytics?.wrongQuestionCount ?? 0) > 0) card.addClass("has-wrong");
		const body = card.createDiv({ cls: "quiz-library-card-body" });
		const tags = body.createDiv({ cls: "quiz-library-card-tags" });
		tags.createSpan({ cls: "quiz-badge", text: entry.quiz.mode === "standard" ? "标准测验" : "快速测验" });
		if (entry.quiz.difficulty) {
			tags.createSpan({ cls: "quiz-badge", text: `${entry.quiz.difficulty.min}–${entry.quiz.difficulty.max}` });
		}
		for (const topic of entry.topics.slice(0, 2)) tags.createSpan({ cls: "quiz-badge", text: displayTopic(topic) });
		if (entry.topics.length > 2) tags.createSpan({ cls: "quiz-badge", text: `+${entry.topics.length - 2}` });
		body.createEl("h3", { text: entry.quiz.title });
		body.createDiv({ cls: "quiz-library-path", text: entry.filePath });
		const facts = body.createDiv({ cls: "quiz-library-facts" });
		facts.createSpan({ text: `${entry.quiz.questions.length} 道题` });
		facts.createSpan({ text: `${analytics?.completedSessionCount ?? 0} 次完成` });
		facts.createSpan({ text: `首次正确率 ${formatAccuracy(analytics?.firstAccuracy ?? null)}` });
		if ((analytics?.wrongQuestionCount ?? 0) > 0) {
			facts.createEl("strong", { text: `${analytics?.wrongQuestionCount} 道待复习` });
		}
		const progress = card.createDiv({ cls: "quiz-library-card-progress" });
		const label = progress.createDiv({ cls: "quiz-library-progress-label" });
		label.createSpan({ text: analytics?.isInProgress ? "当前进度" : "最近进度" });
		label.createSpan({ text: `${analytics?.currentAnsweredCount ?? 0} / ${entry.quiz.questions.length}` });
		progress.createEl("progress", {
			attr: {
				max: String(entry.quiz.questions.length),
				value: String(analytics?.currentAnsweredCount ?? 0),
				"aria-label": `${entry.quiz.title} 当前进度`,
			},
		});
		progress.createDiv({ cls: "quiz-library-activity", text: formatActivity(analytics?.latestActivityAt ?? null) });
		card.createEl("button", {
			cls: "quiz-library-open",
			text: analytics?.isInProgress ? "继续测试" : "打开测试",
			attr: { type: "button", "data-action": "open-quiz", "data-file-path": entry.filePath },
		});
	}

	private renderStatistics(parent: HTMLElement): void {
		const section = parent.createEl("section", { cls: "quiz-dashboard-section" });
		this.renderSectionHeading(section, "学习统计", "当前题库与历史首次回答");
		const overview = section.createDiv({ cls: "quiz-dashboard-overview" });
		this.renderMetric(overview, "测试题", String(this.analytics.quizCount), "份");
		this.renderMetric(overview, "题目", String(this.analytics.questionCount), "道");
		this.renderMetric(overview, "已完成", String(this.analytics.completedSessionCount), "次会话");
		this.renderMetric(overview, "首次正确率", formatAccuracy(this.analytics.accuracy), `${this.analytics.answeredCount} 次回答`);
		this.renderMetric(overview, "待复习", String(this.analytics.wrongQuestionCount), "道题");
		this.renderKnowledgeSignal(section);
		const lower = section.createDiv({ cls: "quiz-statistics-lower" });
		const trend = lower.createEl("section", { cls: "quiz-statistics-panel" });
		this.renderSectionHeading(trend, "近 8 周趋势", "柱高为回答量，填充为正确率");
		this.renderTrendChart(trend, false);
		const topics = lower.createEl("section", { cls: "quiz-statistics-panel" });
		this.renderSectionHeading(topics, "薄弱主题", "待复习数 · 首次正确率");
		this.renderWeakTopicTable(topics);
	}

	private renderMetric(parent: HTMLElement, label: string, value: string, detail: string): void {
		const metric = parent.createDiv({ cls: "quiz-dashboard-metric" });
		metric.createDiv({ cls: "quiz-dashboard-metric-label", text: label });
		metric.createDiv({ cls: "quiz-dashboard-metric-value", text: value });
		metric.createDiv({ cls: "quiz-dashboard-metric-detail", text: detail });
	}

	private renderKnowledgeSignal(parent: HTMLElement): void {
		const signal = parent.createDiv({ cls: "quiz-dashboard-signal" });
		const levels = signal.createEl("section", { cls: "quiz-level-panel" });
		this.renderSectionHeading(levels, "认知层级", "首次回答正确率");
		const track = levels.createDiv({ cls: "quiz-level-track" });
		for (const level of LEVELS) {
			const item = track.createDiv({ cls: "quiz-level-segment" });
			const title = item.createDiv({ cls: "quiz-level-title" });
			title.createEl("strong", { text: level });
			title.createSpan({ text: formatAccuracy(this.analytics.levels[level].accuracy) });
			item.createEl("progress", {
				attr: { max: "100", value: String(this.analytics.levels[level].accuracy ?? 0), "aria-label": `${level} 首次正确率` },
			});
			item.createDiv({ cls: "quiz-level-detail", text: `${this.analytics.levels[level].questionCount} 道题 · ${this.analytics.levels[level].answeredCount} 次回答` });
		}
		const types = signal.createEl("section", { cls: "quiz-type-distribution" });
		types.createEl("h3", { text: "题型构成" });
		for (const type of QUESTION_TYPES) {
			const row = types.createDiv({ cls: "quiz-type-row" });
			const label = row.createDiv({ cls: "quiz-type-label" });
			label.createSpan({ text: TYPE_LABELS[type] });
			label.createSpan({ text: String(this.analytics.types[type]) });
			row.createEl("progress", {
				attr: { max: String(Math.max(this.analytics.questionCount, 1)), value: String(this.analytics.types[type]), "aria-label": `${TYPE_LABELS[type]}题数量` },
			});
		}
	}

	private renderTrendChart(parent: HTMLElement, compact: boolean): void {
		const maxAnswers = Math.max(...this.analytics.weeklyTrend.map((point) => point.answeredCount), 1);
		const chart = parent.createDiv({ cls: compact ? "quiz-trend-chart is-compact" : "quiz-trend-chart" });
		for (const point of this.analytics.weeklyTrend) {
			const column = chart.createDiv({ cls: "quiz-trend-column" });
			const value = column.createDiv({ cls: "quiz-trend-value", text: point.answeredCount === 0 ? "—" : formatAccuracy(point.accuracy) });
			value.setAttr("aria-hidden", "true");
			const bar = column.createDiv({ cls: "quiz-trend-bar" });
			bar.style.setProperty("--quiz-trend-volume", `${Math.round((point.answeredCount / maxAnswers) * 100)}%`);
			const accuracy = bar.createDiv({ cls: "quiz-trend-accuracy" });
			accuracy.style.setProperty("--quiz-trend-accuracy", `${point.accuracy ?? 0}%`);
			bar.setAttr("role", "img");
			bar.setAttr("aria-label", `${WEEK_DATE_FORMATTER.format(point.weekStart)}：${point.answeredCount} 次首次回答，正确率 ${formatAccuracy(point.accuracy)}`);
			column.createDiv({ cls: "quiz-trend-label", text: WEEK_DATE_FORMATTER.format(point.weekStart) });
		}
	}

	private renderWeakTopicTable(parent: HTMLElement): void {
		const topics = this.analytics.topics.slice(0, 6);
		if (topics.length === 0) {
			parent.createEl("p", { cls: "quiz-muted-copy", text: "暂无主题统计。" });
			return;
		}
		for (const topic of topics) {
			const button = parent.createEl("button", {
				cls: "quiz-topic-stat-row",
				attr: { type: "button", "data-action": "select-topic", "data-topic": topic.path },
			});
			button.createSpan({ text: topic.label });
			button.createEl("strong", { text: `${topic.wrongQuestionCount} · ${formatAccuracy(topic.accuracy)}` });
		}
	}

	private renderSectionHeading(parent: HTMLElement, title: string, detail: string): void {
		const heading = parent.createDiv({ cls: "quiz-dashboard-section-heading" });
		heading.createEl("h2", { text: title });
		heading.createEl("p", { text: detail });
	}

	private renderCatalogWarnings(parent: HTMLElement): void {
		if (this.catalog.errors.length === 0) return;
		const warning = parent.createEl("details", { cls: "quiz-catalog-warning" });
		warning.createEl("summary", { text: `${this.catalog.errors.length} 个 Quiz block 未能加入索引` });
		const list = warning.createEl("ul");
		for (const error of this.catalog.errors.slice(0, 20)) {
			list.createEl("li", { text: `${error.filePath} · 第 ${error.blockIndex} 个：${error.message}` });
		}
	}
}
