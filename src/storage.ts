import type {
	QuestionResult,
	QuizData,
	QuizPluginData,
	QuizResult,
	QuizStatistics,
} from "./types";

export const EMPTY_PLUGIN_DATA: QuizPluginData = { results: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseQuestionResult(value: unknown): QuestionResult | null {
	if (!isRecord(value)) return null;
	if (
		typeof value.selectedAnswer !== "string" ||
		typeof value.correct !== "boolean" ||
		typeof value.attempts !== "number" ||
		!Number.isInteger(value.attempts) ||
		value.attempts < 1 ||
		typeof value.updatedAt !== "number" ||
		!Number.isFinite(value.updatedAt)
	) {
		return null;
	}

	return {
		selectedAnswer: value.selectedAnswer,
		correct: value.correct,
		attempts: value.attempts,
		updatedAt: value.updatedAt,
	};
}

export function normalizePluginData(value: unknown): QuizPluginData {
	if (!isRecord(value) || !isRecord(value.results)) {
		return { results: {} };
	}

	const results: Record<string, QuizResult> = {};
	for (const [key, candidate] of Object.entries(value.results)) {
		if (
			!isRecord(candidate) ||
			typeof candidate.quizId !== "string" ||
			typeof candidate.filePath !== "string" ||
			!isRecord(candidate.questions)
		) {
			continue;
		}

		const questions: Record<string, QuestionResult> = {};
		for (const [questionId, result] of Object.entries(candidate.questions)) {
			const parsed = parseQuestionResult(result);
			if (parsed) questions[questionId] = parsed;
		}

		results[key] = {
			quizId: candidate.quizId,
			filePath: candidate.filePath,
			questions,
		};
	}

	return { results };
}

function cloneData(data: QuizPluginData): QuizPluginData {
	const results: Record<string, QuizResult> = {};
	for (const [key, result] of Object.entries(data.results)) {
		results[key] = {
			quizId: result.quizId,
			filePath: result.filePath,
			questions: { ...result.questions },
		};
	}
	return { results };
}

export class QuizStorage {
	private saveQueue: Promise<void> = Promise.resolve();

	constructor(
		private readonly data: QuizPluginData,
		private readonly persist: (data: QuizPluginData) => Promise<void>,
	) {}

	getQuizResult(quizKey: string): QuizResult | undefined {
		return this.data.results[quizKey];
	}

	getQuestionResult(
		quizKey: string,
		questionId: string,
	): QuestionResult | undefined {
		return this.getQuizResult(quizKey)?.questions[questionId];
	}

	saveQuestionResult(
		quizKey: string,
		quizId: string,
		filePath: string,
		questionId: string,
		selectedAnswer: string,
		correct: boolean,
		now = Date.now(),
	): Promise<void> {
		const existingQuiz = this.data.results[quizKey];
		const existingQuestion = existingQuiz?.questions[questionId];

		this.data.results[quizKey] = {
			quizId,
			filePath,
			questions: {
				...(existingQuiz?.questions ?? {}),
				[questionId]: {
					selectedAnswer,
					correct,
					attempts: (existingQuestion?.attempts ?? 0) + 1,
					updatedAt: now,
				},
			},
		};

		const snapshot = cloneData(this.data);
		this.saveQueue = this.saveQueue
			.catch(() => undefined)
			.then(async () => this.persist(snapshot));
		return this.saveQueue;
	}

	getStatistics(quizKey: string, quiz: QuizData): QuizStatistics {
		const result = this.getQuizResult(quizKey);
		let answeredCount = 0;
		let correctCount = 0;

		for (const question of quiz.questions) {
			const questionResult = result?.questions[question.id];
			if (!questionResult) continue;
			answeredCount += 1;
			if (questionResult.correct) correctCount += 1;
		}

		return {
			answeredCount,
			correctCount,
			accuracy:
				answeredCount === 0
					? null
					: Math.round((correctCount / answeredCount) * 100),
		};
	}
}
