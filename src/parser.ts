import type {
	CognitiveLevel,
	FillBlankQuestion,
	MultipleQuestion,
	QuizData,
	QuizDifficulty,
	QuizMode,
	QuizOption,
	QuizQuestion,
	SingleQuestion,
	TrueFalseQuestion,
} from "./types";

export class QuizParseError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "QuizParseError";
	}
}

const LEVELS: CognitiveLevel[] = ["L1", "L2", "L3", "L4"];
const QUESTION_TYPES = [
	"single",
	"multiple",
	"true_false",
	"fill_blank",
] as const;

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

function parseLevel(
	value: unknown,
	questionId: string,
	legacy: boolean,
): CognitiveLevel {
	if (legacy && value === undefined) return "L1";
	if (typeof value !== "string" || !LEVELS.includes(value as CognitiveLevel)) {
		throw new QuizParseError(`题目 ${questionId} 的 level 必须是 L1–L4`);
	}
	return value as CognitiveLevel;
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

function parseOptions(value: unknown, questionId: string): QuizOption[] {
	if (!Array.isArray(value) || value.length < 2) {
		throw new QuizParseError(`题目 ${questionId} 至少需要 2 个选项`);
	}
	const options = value.map((option) => parseOption(option, questionId));
	const optionIds = new Set<string>();
	for (const option of options) {
		if (optionIds.has(option.id)) {
			throw new QuizParseError(`题目 ${questionId} 存在重复选项 ID`);
		}
		optionIds.add(option.id);
	}
	return options;
}

function parseExplanation(
	value: unknown,
	questionId: string,
): { explanation?: string } {
	if (value !== undefined && typeof value !== "string") {
		throw new QuizParseError(`题目 ${questionId} 的 explanation 无效`);
	}
	return typeof value === "string" ? { explanation: value } : {};
}

function parseQuestion(value: unknown, legacy: boolean): QuizQuestion {
	if (!isRecord(value)) throw new QuizParseError("Quiz 包含无效题目");

	const id = readRequiredString(value.id, "id", "题目");
	const question = readRequiredString(value.question, "question", `题目 ${id}`);
	const rawType = value.type ?? (legacy ? "single" : undefined);
	if (
		typeof rawType !== "string" ||
		!QUESTION_TYPES.includes(rawType as (typeof QUESTION_TYPES)[number])
	) {
		throw new QuizParseError(`题目 ${id} 的 type 无效`);
	}

	const common = {
		id,
		question,
		level: parseLevel(value.level, id, legacy),
		...parseExplanation(value.explanation, id),
	};

	if (rawType === "single") {
		const options = parseOptions(value.options, id);
		const answer = readRequiredString(value.answer, "answer", `题目 ${id}`);
		if (!options.some((option) => option.id === answer)) {
			throw new QuizParseError(`题目 ${id} 的正确答案无效`);
		}
		return { ...common, type: "single", options, answer } satisfies SingleQuestion;
	}

	if (rawType === "multiple") {
		const options = parseOptions(value.options, id);
		if (!Array.isArray(value.answer) || value.answer.length === 0) {
			throw new QuizParseError(`题目 ${id} 至少需要 1 个正确答案`);
		}
		const answer = value.answer.map((item) =>
			readRequiredString(item, "answer", `题目 ${id}`),
		);
		if (
			new Set(answer).size !== answer.length ||
			answer.some((item) => !options.some((option) => option.id === item))
		) {
			throw new QuizParseError(`题目 ${id} 的正确答案无效`);
		}
		return { ...common, type: "multiple", options, answer } satisfies MultipleQuestion;
	}

	if (rawType === "true_false") {
		if (typeof value.answer !== "boolean") {
			throw new QuizParseError(`题目 ${id} 的 answer 必须是布尔值`);
		}
		return {
			...common,
			type: "true_false",
			answer: value.answer,
		} satisfies TrueFalseQuestion;
	}

	if (!Array.isArray(value.answers) || value.answers.length === 0) {
		throw new QuizParseError(`题目 ${id} 至少需要 1 个参考答案`);
	}
	const answers = value.answers.map((item) =>
		readRequiredString(item, "answers", `题目 ${id}`),
	);
	if (value.caseSensitive !== undefined && typeof value.caseSensitive !== "boolean") {
		throw new QuizParseError(`题目 ${id} 的 caseSensitive 无效`);
	}
	return {
		...common,
		type: "fill_blank",
		answers,
		caseSensitive: value.caseSensitive === true,
	} satisfies FillBlankQuestion;
}

function parseMode(value: unknown, legacy: boolean): QuizMode {
	if (value === undefined && legacy) return "quick";
	if (value !== "quick" && value !== "standard") {
		throw new QuizParseError("Quiz 的 mode 必须是 quick 或 standard");
	}
	return value;
}

function parseDifficulty(value: unknown): QuizDifficulty | undefined {
	if (value === undefined) return undefined;
	if (!isRecord(value)) throw new QuizParseError("Quiz 的 difficulty 无效");
	const min = value.min;
	const max = value.max;
	if (
		typeof min !== "string" ||
		typeof max !== "string" ||
		!LEVELS.includes(min as CognitiveLevel) ||
		!LEVELS.includes(max as CognitiveLevel)
	) {
		throw new QuizParseError("Quiz 的 difficulty 必须使用 L1–L4");
	}
	if (LEVELS.indexOf(min as CognitiveLevel) > LEVELS.indexOf(max as CognitiveLevel)) {
		throw new QuizParseError("Quiz 的 difficulty.min 不能高于 max");
	}
	return { min: min as CognitiveLevel, max: max as CognitiveLevel };
}

export function parseQuiz(source: string): QuizData {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source) as unknown;
	} catch (error) {
		throw new QuizParseError("Quiz JSON 格式错误", { cause: error });
	}
	if (!isRecord(parsed)) throw new QuizParseError("Quiz 格式错误");

	const rawVersion = parsed.schemaVersion;
	if (rawVersion !== undefined && rawVersion !== 2) {
		throw new QuizParseError("Quiz 的 schemaVersion 仅支持 2");
	}
	const legacy = rawVersion === undefined;
	const id = readRequiredString(parsed.id, "id");
	const title = readRequiredString(parsed.title, "title");
	if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
		throw new QuizParseError("Quiz 中没有题目");
	}
	const questions = parsed.questions.map((item) => parseQuestion(item, legacy));
	const questionIds = new Set<string>();
	for (const item of questions) {
		if (questionIds.has(item.id)) throw new QuizParseError("存在重复题目 ID");
		questionIds.add(item.id);
	}

	const difficulty = parseDifficulty(parsed.difficulty);
	return {
		schemaVersion: legacy ? 1 : 2,
		id,
		title,
		mode: parseMode(parsed.mode, legacy),
		...(difficulty ? { difficulty } : {}),
		questions,
	};
}
