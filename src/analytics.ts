import type { QuizCatalogEntry } from "./catalog";
import type {
	CognitiveLevel,
	QuizHistory,
	QuizQuestion,
	QuizSession,
} from "./types";

export interface AccuracySummary {
	answeredCount: number;
	correctCount: number;
	accuracy: number | null;
}

export interface LevelAnalytics extends AccuracySummary {
	questionCount: number;
}

export interface QuizEntryAnalytics {
	quizKey: string;
	completedSessionCount: number;
	totalAttemptCount: number;
	currentAnsweredCount: number;
	currentAccuracy: number | null;
	firstAccuracy: number | null;
	latestActivityAt: number | null;
}

export interface DashboardAnalytics extends AccuracySummary {
	quizCount: number;
	questionCount: number;
	attemptedQuizCount: number;
	completedSessionCount: number;
	levels: Record<CognitiveLevel, LevelAnalytics>;
	types: Record<QuizQuestion["type"], number>;
	quizzes: Record<string, QuizEntryAnalytics>;
}

const LEVELS: CognitiveLevel[] = ["L1", "L2", "L3", "L4"];

function percentage(correct: number, answered: number): number | null {
	return answered === 0 ? null : Math.round((correct / answered) * 100);
}

function createLevelAnalytics(): Record<CognitiveLevel, LevelAnalytics> {
	return {
		L1: { questionCount: 0, answeredCount: 0, correctCount: 0, accuracy: null },
		L2: { questionCount: 0, answeredCount: 0, correctCount: 0, accuracy: null },
		L3: { questionCount: 0, answeredCount: 0, correctCount: 0, accuracy: null },
		L4: { questionCount: 0, answeredCount: 0, correctCount: 0, accuracy: null },
	};
}

function createTypeCounts(): Record<QuizQuestion["type"], number> {
	return { single: 0, multiple: 0, true_false: 0, fill_blank: 0 };
}

function getCurrentSession(history: QuizHistory | undefined): QuizSession | undefined {
	return history?.sessions.at(-1);
}

function getSessionAccuracy(
	session: QuizSession | undefined,
	entry: QuizCatalogEntry,
): AccuracySummary {
	let answeredCount = 0;
	let correctCount = 0;
	for (const question of entry.quiz.questions) {
		const latest = session?.answers[question.id]?.at(-1);
		if (!latest) continue;
		answeredCount += 1;
		if (latest.correct) correctCount += 1;
	}
	return {
		answeredCount,
		correctCount,
		accuracy: percentage(correctCount, answeredCount),
	};
}

function getLatestActivity(history: QuizHistory | undefined): number | null {
	let latest: number | null = null;
	for (const session of history?.sessions ?? []) {
		if (session.completedAt !== undefined) {
			latest = Math.max(latest ?? session.completedAt, session.completedAt);
		}
		for (const attempts of Object.values(session.answers)) {
			for (const attempt of attempts) {
				latest = Math.max(latest ?? attempt.answeredAt, attempt.answeredAt);
			}
		}
	}
	return latest;
}

export function buildDashboardAnalytics(
	entries: QuizCatalogEntry[],
	histories: Readonly<Record<string, QuizHistory>>,
): DashboardAnalytics {
	const levels = createLevelAnalytics();
	const types = createTypeCounts();
	const quizzes: Record<string, QuizEntryAnalytics> = {};
	let questionCount = 0;
	let answeredCount = 0;
	let correctCount = 0;
	let attemptedQuizCount = 0;
	let completedSessionCount = 0;

	for (const entry of entries) {
		const history = histories[entry.quizKey];
		const current = getSessionAccuracy(getCurrentSession(history), entry);
		let quizAnswered = 0;
		let quizCorrect = 0;
		let totalAttemptCount = 0;

		questionCount += entry.quiz.questions.length;
		for (const question of entry.quiz.questions) {
			levels[question.level].questionCount += 1;
			types[question.type] += 1;
		}

		for (const session of history?.sessions ?? []) {
			for (const question of entry.quiz.questions) {
				const attempts = session.answers[question.id];
				if (!attempts || attempts.length === 0) continue;
				totalAttemptCount += attempts.length;
				quizAnswered += 1;
				answeredCount += 1;
				levels[question.level].answeredCount += 1;
				if (attempts[0]?.correct) {
					quizCorrect += 1;
					correctCount += 1;
					levels[question.level].correctCount += 1;
				}
			}
		}

		const completed =
			history?.sessions.filter((session) => session.completedAt !== undefined)
				.length ?? 0;
		completedSessionCount += completed;
		if (totalAttemptCount > 0) attemptedQuizCount += 1;
		quizzes[entry.quizKey] = {
			quizKey: entry.quizKey,
			completedSessionCount: completed,
			totalAttemptCount,
			currentAnsweredCount: current.answeredCount,
			currentAccuracy: current.accuracy,
			firstAccuracy: percentage(quizCorrect, quizAnswered),
			latestActivityAt: getLatestActivity(history),
		};
	}

	for (const level of LEVELS) {
		levels[level].accuracy = percentage(
			levels[level].correctCount,
			levels[level].answeredCount,
		);
	}

	return {
		quizCount: entries.length,
		questionCount,
		attemptedQuizCount,
		completedSessionCount,
		answeredCount,
		correctCount,
		accuracy: percentage(correctCount, answeredCount),
		levels,
		types,
		quizzes,
	};
}
