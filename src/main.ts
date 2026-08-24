import { Plugin, TFile } from "obsidian";
import { QUIZ_DASHBOARD_VIEW, QuizDashboardView } from "./dashboard";
import { parseQuiz, QuizParseError } from "./parser";
import { QuizRenderer } from "./renderer";
import { normalizePluginData, QuizStorage } from "./storage";

export default class OmniQuizPlugin extends Plugin {
	async onload(): Promise<void> {
		const data = normalizePluginData(await this.loadData());
		const storage = new QuizStorage(data, async (nextData) => {
			await this.saveData(nextData);
		});

		this.registerView(
			QUIZ_DASHBOARD_VIEW,
			(leaf) => new QuizDashboardView(leaf, storage),
		);
		this.addRibbonIcon("bar-chart-3", "打开测试面板", () => {
			void this.activateDashboard();
		});
		this.addCommand({
			id: "open-dashboard",
			name: "打开测试面板",
			callback: () => {
				void this.activateDashboard();
			},
		});
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;
				void storage.renameFile(oldPath, file.path).catch((error: unknown) => {
					console.error("Omni Quiz failed to migrate renamed quiz history", error);
				});
			}),
		);

		this.registerMarkdownCodeBlockProcessor(
			"quiz",
			(source, el, ctx) => {
				try {
					const quiz = parseQuiz(source);
					const quizKey = `${ctx.sourcePath}::${quiz.id}`;
					ctx.addChild(
						new QuizRenderer(el, quiz, quizKey, ctx.sourcePath, storage),
					);
				} catch (error) {
					const message =
						error instanceof QuizParseError ? error.message : "Quiz 格式错误";
					el.createDiv({ cls: "quiz-error", text: message });
					console.error("Omni Quiz could not render a quiz block", error);
				}
			},
		);
	}

	private async activateDashboard(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(QUIZ_DASHBOARD_VIEW)[0];
		if (existing) {
			await this.app.workspace.revealLeaf(existing);
			return;
		}
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: QUIZ_DASHBOARD_VIEW, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}
