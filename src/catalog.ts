import type { App, TFile } from "obsidian";
import { parseQuiz, QuizParseError } from "./parser";
import type { QuizData } from "./types";

export interface QuizCatalogEntry {
	quizKey: string;
	filePath: string;
	blockIndex: number;
	topics: string[];
	quiz: QuizData;
}

export interface QuizCatalogError {
	filePath: string;
	blockIndex: number;
	message: string;
}

export interface QuizCatalog {
	entries: QuizCatalogEntry[];
	errors: QuizCatalogError[];
}

const QUIZ_BLOCK_PATTERN = /^```quiz[\t ]*\r?\n([\s\S]*?)^```[\t ]*$/gm;

export function normalizeTopicTags(tags: readonly string[]): string[] {
	const normalized = new Set<string>();
	for (const tag of tags) {
		const topic = tag
			.trim()
			.replace(/^#+/, "")
			.split("/")
			.map((segment) => segment.trim())
			.filter(Boolean)
			.join("/");
		if (topic) normalized.add(topic);
	}
	return [...normalized].sort((left, right) => left.localeCompare(right));
}

export function extractQuizCatalog(
	filePath: string,
	markdown: string,
	topics: readonly string[] = [],
): QuizCatalog {
	const entries: QuizCatalogEntry[] = [];
	const errors: QuizCatalogError[] = [];
	let blockIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = QUIZ_BLOCK_PATTERN.exec(markdown)) !== null) {
		blockIndex += 1;
		try {
			const quiz = parseQuiz(match[1] ?? "");
			entries.push({
				quizKey: `${filePath}::${quiz.id}`,
				filePath,
				blockIndex,
				topics: normalizeTopicTags(topics),
				quiz,
			});
		} catch (error) {
			errors.push({
				filePath,
				blockIndex,
				message:
					error instanceof QuizParseError ? error.message : "Quiz 格式错误",
			});
		}
	}
	return { entries, errors };
}

export async function scanQuizCatalog(
	app: App,
	getTopics: (file: TFile) => readonly string[],
): Promise<QuizCatalog> {
	const entries: QuizCatalogEntry[] = [];
	const errors: QuizCatalogError[] = [];
	const seenKeys = new Set<string>();

	for (const file of app.vault.getMarkdownFiles()) {
		let source: string;
		try {
			source = await app.vault.cachedRead(file);
		} catch {
			errors.push({
				filePath: file.path,
				blockIndex: 0,
				message: "无法读取文件",
			});
			continue;
		}
		const result = extractQuizCatalog(file.path, source, getTopics(file));
		for (const entry of result.entries) {
			if (seenKeys.has(entry.quizKey)) {
				errors.push({
					filePath: file.path,
					blockIndex: entry.blockIndex,
					message: `Quiz ID ${entry.quiz.id} 在同一文件中重复`,
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
