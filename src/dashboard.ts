import { ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import {
	buildDashboardAnalytics,
	type DashboardAnalytics,
} from "./analytics";
import {
	scanQuizCatalog,
	type QuizCatalog,
	type QuizCatalogEntry,
} from "./catalog";
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

type ModeFilter = "all" | "quick" | "standard";

function formatAccuracy(value: number | null): string {
	return value === null ? "—" : `${value}%`;
}

function formatActivity(value: number | null): string {
	if (value === null) return "尚未开始";
	return ACTIVITY_DATE_FORMATTER.format(value);
}

export class QuizDashboardView extends ItemView {
	private catalog: QuizCatalog = { entries: [], errors: [] };
	private analytics: DashboardAnalytics = buildDashboardAnalytics([], {});
	private query = "";
	private modeFilter: ModeFilter = "all";
	private scanVersion = 0;
	private refreshTimer: number | null = null;
	private loading = true;
	private loadError: string | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly storage: QuizStorage,
	) {
		super(leaf);
		this.icon = "bar-chart-3";
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
		this.registerDomEvent(this.contentEl, "input", (event) => {
			this.handleInput(event);
		});
		this.registerDomEvent(this.contentEl, "change", (event) => {
			this.handleChange(event);
		});
		this.registerDomEvent(this.contentEl, "click", (event) => {
			this.handleClick(event);
		});
		const refreshForFile = (file: unknown): void => {
			if (file instanceof TFile && file.extension === "md") {
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
			}),
		);
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
		this.renderLibrary();
	}

	private handleChange(event: Event): void {
		const selectType = this.contentEl.ownerDocument.defaultView?.HTMLSelectElement;
		if (!selectType || !(event.target instanceof selectType)) return;
		if (event.target.dataset.role !== "mode-filter") return;
		if (
			event.target.value === "all" ||
			event.target.value === "quick" ||
			event.target.value === "standard"
		) {
			this.modeFilter = event.target.value;
			this.renderLibrary();
		}
	}

	private handleClick(event: MouseEvent): void {
		const elementType = this.contentEl.ownerDocument.defaultView?.Element;
		if (!elementType || !(event.target instanceof elementType)) return;
		const button = event.target.closest<HTMLButtonElement>("button[data-action]");
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

	private async openQuizFile(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;
		await this.app.workspace.getLeaf("tab").openFile(file);
	}

	private async reloadCatalog(): Promise<void> {
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
		const shell = this.contentEl.createDiv({ cls: "quiz-dashboard-shell" });
		this.renderHero(shell);

		if (this.loading) {
			this.renderStatus(shell, "正在索引知识库中的测试题…", false);
			return;
		}
		if (this.loadError) {
			this.renderStatus(shell, this.loadError, true);
			return;
		}

		this.analytics = buildDashboardAnalytics(
			this.catalog.entries,
			this.storage.getHistories(),
		);
		this.renderOverview(shell, this.analytics);
		this.renderKnowledgeSignal(shell, this.analytics);
		this.renderCatalogWarnings(shell);
		this.renderControls(shell);
		this.renderLibrary();
	}

	private renderHero(parent: HTMLElement): void {
		const hero = parent.createEl("header", { cls: "quiz-dashboard-hero" });
		hero.createDiv({ cls: "quiz-dashboard-eyebrow", text: "Knowledge signal" });
		hero.createEl("h1", { text: "知识测量台" });
		hero.createEl("p", {
			text: "浏览知识库中的测试题，观察哪些知识真正经得起第一次回答。",
		});
	}

	private renderStatus(
		parent: HTMLElement,
		message: string,
		showRetry: boolean,
	): void {
		const status = parent.createDiv({ cls: "quiz-dashboard-status" });
		status.createEl("p", { text: message });
		if (showRetry) {
			status.createEl("button", {
				text: "重新索引",
				attr: { type: "button", "data-action": "refresh" },
			});
		}
	}

	private renderOverview(
		parent: HTMLElement,
		analytics: DashboardAnalytics,
	): void {
		const section = parent.createEl("section", {
			cls: "quiz-dashboard-overview",
			attr: { "aria-label": "学习概览" },
		});
		this.renderMetric(section, "测试题", String(analytics.quizCount), "份");
		this.renderMetric(section, "题目", String(analytics.questionCount), "道");
		this.renderMetric(
			section,
			"已测试",
			String(analytics.attemptedQuizCount),
			`/ ${analytics.quizCount}`,
		);
		this.renderMetric(
			section,
			"首次正确率",
			formatAccuracy(analytics.accuracy),
			`${analytics.completedSessionCount} 次完成`,
		);
	}

	private renderMetric(
		parent: HTMLElement,
		label: string,
		value: string,
		detail: string,
	): void {
		const metric = parent.createDiv({ cls: "quiz-dashboard-metric" });
		metric.createDiv({ cls: "quiz-dashboard-metric-label", text: label });
		metric.createDiv({ cls: "quiz-dashboard-metric-value", text: value });
		metric.createDiv({ cls: "quiz-dashboard-metric-detail", text: detail });
	}

	private renderKnowledgeSignal(
		parent: HTMLElement,
		analytics: DashboardAnalytics,
	): void {
		const section = parent.createEl("section", { cls: "quiz-dashboard-signal" });
		const heading = section.createDiv({ cls: "quiz-dashboard-section-heading" });
		heading.createEl("h2", { text: "认知层级" });
		heading.createEl("p", { text: "按每次测验的首次回答计算" });
		const track = section.createDiv({ cls: "quiz-level-track" });
		for (const level of LEVELS) {
			const item = track.createDiv({ cls: "quiz-level-segment" });
			const title = item.createDiv({ cls: "quiz-level-title" });
			title.createEl("strong", { text: level });
			title.createSpan({ text: formatAccuracy(analytics.levels[level].accuracy) });
			item.createEl("progress", {
				attr: {
					max: "100",
					value: String(analytics.levels[level].accuracy ?? 0),
					"aria-label": `${level} 首次正确率`,
				},
			});
			item.createDiv({
				cls: "quiz-level-detail",
				text: `${analytics.levels[level].questionCount} 道题 · ${analytics.levels[level].answeredCount} 次回答`,
			});
		}

		const typePanel = section.createDiv({ cls: "quiz-type-distribution" });
		typePanel.createEl("h3", { text: "题型构成" });
		for (const type of QUESTION_TYPES) {
			const row = typePanel.createDiv({ cls: "quiz-type-row" });
			const label = row.createDiv({ cls: "quiz-type-label" });
			label.createSpan({ text: TYPE_LABELS[type] });
			label.createSpan({ text: String(analytics.types[type]) });
			row.createEl("progress", {
				attr: {
					max: String(Math.max(analytics.questionCount, 1)),
					value: String(analytics.types[type]),
					"aria-label": `${TYPE_LABELS[type]}题数量`,
				},
			});
		}
	}

	private renderCatalogWarnings(parent: HTMLElement): void {
		if (this.catalog.errors.length === 0) return;
		const warning = parent.createEl("details", { cls: "quiz-catalog-warning" });
		warning.createEl("summary", {
			text: `${this.catalog.errors.length} 个 Quiz block 未能加入索引`,
		});
		const list = warning.createEl("ul");
		for (const error of this.catalog.errors.slice(0, 20)) {
			list.createEl("li", {
				text: `${error.filePath} · 第 ${error.blockIndex} 个：${error.message}`,
			});
		}
	}

	private renderControls(parent: HTMLElement): void {
		const section = parent.createEl("section", { cls: "quiz-library-section" });
		const heading = section.createDiv({ cls: "quiz-dashboard-section-heading" });
		heading.createEl("h2", { text: "测试题库" });
		heading.createEl("p", { text: `${this.catalog.entries.length} 份可用测试` });
		const controls = section.createDiv({ cls: "quiz-library-controls" });
		const searchLabel = controls.createEl("label", { cls: "quiz-search-field" });
		searchLabel.createSpan({ text: "搜索" });
		searchLabel.createEl("input", {
			type: "search",
			value: this.query,
			attr: {
				placeholder: "标题、文件路径或 Quiz ID",
				"data-role": "quiz-search",
			},
		});
		const filterLabel = controls.createEl("label", { cls: "quiz-filter-field" });
		filterLabel.createSpan({ text: "模式" });
		const select = filterLabel.createEl("select", {
			attr: { "data-role": "mode-filter" },
		});
		select.createEl("option", { text: "全部", value: "all" });
		select.createEl("option", { text: "快速测验", value: "quick" });
		select.createEl("option", { text: "标准测验", value: "standard" });
		select.value = this.modeFilter;
		section.createDiv({ cls: "quiz-library-results" });
	}

	private renderLibrary(): void {
		const results = this.contentEl.querySelector<HTMLElement>(
			".quiz-library-results",
		);
		if (!results) return;
		results.empty();
		const entries = this.getFilteredEntries(this.analytics.quizzes);
		if (entries.length === 0) {
			const empty = results.createDiv({ cls: "quiz-library-empty" });
			empty.createEl("h3", {
				text: this.catalog.entries.length === 0 ? "知识库里还没有测试题" : "没有匹配的测试题",
			});
			empty.createEl("p", {
				text:
					this.catalog.entries.length === 0
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

		const list = results.createDiv({ cls: "quiz-library-list" });
		for (const entry of entries.slice(0, 100)) {
			this.renderQuizCard(list, entry, this.analytics.quizzes[entry.quizKey]);
		}
		if (entries.length > 100) {
			results.createDiv({
				cls: "quiz-library-limit",
				text: `当前显示前 100 份，请使用搜索缩小 ${entries.length} 份结果。`,
			});
		}
	}

	private getFilteredEntries(
		analytics: ReturnType<typeof buildDashboardAnalytics>["quizzes"],
	): QuizCatalogEntry[] {
		const query = this.query.trim().toLowerCase();
		return this.catalog.entries
			.filter((entry) => {
				if (this.modeFilter !== "all" && entry.quiz.mode !== this.modeFilter) {
					return false;
				}
				return (
					query.length === 0 ||
					entry.quiz.title.toLowerCase().includes(query) ||
					entry.quiz.id.toLowerCase().includes(query) ||
					entry.filePath.toLowerCase().includes(query)
				);
			})
			.sort((left, right) => {
				const leftActivity = analytics[left.quizKey]?.latestActivityAt ?? 0;
				const rightActivity = analytics[right.quizKey]?.latestActivityAt ?? 0;
				return (
					rightActivity - leftActivity ||
					left.quiz.title.localeCompare(right.quiz.title)
				);
			});
	}

	private renderQuizCard(
		parent: HTMLElement,
		entry: QuizCatalogEntry,
		analytics: ReturnType<typeof buildDashboardAnalytics>["quizzes"][string] | undefined,
	): void {
		const card = parent.createEl("article", { cls: "quiz-library-card" });
		const body = card.createDiv({ cls: "quiz-library-card-body" });
		const tags = body.createDiv({ cls: "quiz-library-card-tags" });
		tags.createSpan({
			cls: "quiz-badge",
			text: entry.quiz.mode === "standard" ? "标准测验" : "快速测验",
		});
		if (entry.quiz.difficulty) {
			tags.createSpan({
				cls: "quiz-badge",
				text: `${entry.quiz.difficulty.min}–${entry.quiz.difficulty.max}`,
			});
		}
		body.createEl("h3", { text: entry.quiz.title });
		body.createDiv({ cls: "quiz-library-path", text: entry.filePath });
		const facts = body.createDiv({ cls: "quiz-library-facts" });
		facts.createSpan({ text: `${entry.quiz.questions.length} 道题` });
		facts.createSpan({
			text: `${analytics?.completedSessionCount ?? 0} 次完成`,
		});
		facts.createSpan({
			text: `首次正确率 ${formatAccuracy(analytics?.firstAccuracy ?? null)}`,
		});

		const progress = card.createDiv({ cls: "quiz-library-card-progress" });
		const progressLabel = progress.createDiv({ cls: "quiz-library-progress-label" });
		progressLabel.createSpan({ text: "当前进度" });
		progressLabel.createSpan({
			text: `${analytics?.currentAnsweredCount ?? 0} / ${entry.quiz.questions.length}`,
		});
		progress.createEl("progress", {
			attr: {
				max: String(entry.quiz.questions.length),
				value: String(analytics?.currentAnsweredCount ?? 0),
				"aria-label": `${entry.quiz.title} 当前进度`,
			},
		});
		progress.createDiv({
			cls: "quiz-library-activity",
			text: formatActivity(analytics?.latestActivityAt ?? null),
		});
		card.createEl("button", {
			cls: "quiz-library-open",
			text: "打开测试",
			attr: {
				type: "button",
				"data-action": "open-quiz",
				"data-file-path": entry.filePath,
			},
		});
	}
}
