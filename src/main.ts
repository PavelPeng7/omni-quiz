import { Plugin } from "obsidian";
import { parseQuiz, QuizParseError } from "./parser";
import { QuizRenderer } from "./renderer";
import { normalizePluginData, QuizStorage } from "./storage";

export default class OmniQuizPlugin extends Plugin {
	async onload(): Promise<void> {
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
}
