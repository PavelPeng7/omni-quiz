import type { QuizData, QuizOption, QuizQuestion } from "./types";

export class QuizParseError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "QuizParseError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(
	value: unknown,
	field: string,
	errorPrefix = "Quiz",
): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new QuizParseError(`${errorPrefix} 缺少有效的 ${field}`);
	}

	return value;
}

function parseOption(value: unknown, questionId: string): QuizOption {
	if (!isRecord(value)) {
		throw new QuizParseError(`题目 ${questionId} 包含无效选项`);
	}

	return {
		id: readRequiredString(value.id, "id", `题目 ${questionId} 的选项`),
		text: readRequiredString(value.text, "text", `题目 ${questionId} 的选项`),
	};
}

function parseQuestion(value: unknown): QuizQuestion {
	if (!isRecord(value)) {
		throw new QuizParseError("Quiz 包含无效题目");
	}

	const id = readRequiredString(value.id, "id", "题目");
	const question = readRequiredString(value.question, "question", `题目 ${id}`);

	if (!Array.isArray(value.options) || value.options.length < 2) {
		throw new QuizParseError(`题目 ${id} 至少需要 2 个选项`);
	}

	const options = value.options.map((option) => parseOption(option, id));
	const optionIds = new Set<string>();
	for (const option of options) {
		if (optionIds.has(option.id)) {
			throw new QuizParseError(`题目 ${id} 存在重复选项 ID`);
		}
		optionIds.add(option.id);
	}

	const answer = readRequiredString(value.answer, "answer", `题目 ${id}`);
	if (!optionIds.has(answer)) {
		throw new QuizParseError(`题目 ${id} 的正确答案无效`);
	}

	if (value.explanation !== undefined && typeof value.explanation !== "string") {
		throw new QuizParseError(`题目 ${id} 的 explanation 无效`);
	}

	return {
		id,
		question,
		options,
		answer,
		...(typeof value.explanation === "string"
			? { explanation: value.explanation }
			: {}),
	};
}

export function parseQuiz(source: string): QuizData {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source) as unknown;
	} catch (error) {
		throw new QuizParseError("Quiz JSON 格式错误", { cause: error });
	}

	if (!isRecord(parsed)) {
		throw new QuizParseError("Quiz 格式错误");
	}

	const id = readRequiredString(parsed.id, "id");
	const title = readRequiredString(parsed.title, "title");

	if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
		throw new QuizParseError("Quiz 中没有题目");
	}

	const questions = parsed.questions.map(parseQuestion);
	const questionIds = new Set<string>();
	for (const question of questions) {
		if (questionIds.has(question.id)) {
			throw new QuizParseError("存在重复题目 ID");
		}
		questionIds.add(question.id);
	}

	return { id, title, questions };
}
