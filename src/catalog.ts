import type { App } from "obsidian";
import { parseQuiz, QuizParseError } from "./parser";
import type { QuizData } from "./types";

export interface QuizCatalogEntry {
	quizKey: string;
	filePath: string;
	blockIndex: number;
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

export function extractQuizCatalog(
	filePath: string,
	markdown: string,
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

export async function scanQuizCatalog(app: App): Promise<QuizCatalog> {
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
		const result = extractQuizCatalog(file.path, source);
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
