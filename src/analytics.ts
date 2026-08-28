import type { QuizCatalogEntry } from "./catalog";
import type {
	CognitiveLevel,
	QuestionAttempt,
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
	wrongQuestionCount: number;
	isInProgress: boolean;
}

export interface WrongQuestionAnalytics {
	quizKey: string;
	filePath: string;
	quizId: string;
	quizTitle: string;
	questionId: string;
	question: string;
	type: QuizQuestion["type"];
	level: CognitiveLevel;
	topics: string[];
	wrongAttemptCount: number;
	lastWrongAt: number;
}

export interface TopicAnalytics extends AccuracySummary {
	path: string;
	label: string;
	depth: number;
	quizCount: number;
	questionCount: number;
	wrongQuestionCount: number;
}

export interface WeeklyTrendPoint extends AccuracySummary {
	weekStart: number;
}

export interface DashboardAnalytics extends AccuracySummary {
	quizCount: number;
	questionCount: number;
	attemptedQuizCount: number;
	completedSessionCount: number;
	incompleteQuizCount: number;
	wrongQuestionCount: number;
	latestActivityAt: number | null;
	levels: Record<CognitiveLevel, LevelAnalytics>;
	types: Record<QuizQuestion["type"], number>;
	quizzes: Record<string, QuizEntryAnalytics>;
	wrongQuestions: WrongQuestionAnalytics[];
	topics: TopicAnalytics[];
	weeklyTrend: WeeklyTrendPoint[];
}

const LEVELS: CognitiveLevel[] = ["L1", "L2", "L3", "L4"];
const UNCATEGORIZED_TOPIC = "未分类";

interface MutableTopic extends AccuracySummary {
	path: string;
	label: string;
	depth: number;
	quizKeys: Set<string>;
	questionCount: number;
	wrongQuestionCount: number;
}

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

function getQuestionAttempts(
	history: QuizHistory | undefined,
	questionId: string,
): QuestionAttempt[] {
	return (history?.sessions ?? [])
		.flatMap((session) => session.answers[questionId] ?? [])
		.sort((left, right) => left.answeredAt - right.answeredAt);
}

export function expandTopicPaths(topics: readonly string[]): string[] {
	if (topics.length === 0) return [UNCATEGORIZED_TOPIC];
	const paths = new Set<string>();
	for (const topic of topics) {
		const segments = topic.split("/").filter(Boolean);
		for (let index = 1; index <= segments.length; index += 1) {
			paths.add(segments.slice(0, index).join("/"));
		}
	}
	return [...paths];
}

function getOrCreateTopic(
	topics: Map<string, MutableTopic>,
	path: string,
): MutableTopic {
	const existing = topics.get(path);
	if (existing) return existing;
	const segments = path.split("/");
	const topic: MutableTopic = {
		path,
		label: path === UNCATEGORIZED_TOPIC ? path : segments.join(" › "),
		depth: path === UNCATEGORIZED_TOPIC ? 0 : segments.length - 1,
		quizKeys: new Set(),
		questionCount: 0,
		wrongQuestionCount: 0,
		answeredCount: 0,
		correctCount: 0,
		accuracy: null,
	};
	topics.set(path, topic);
	return topic;
}

function startOfLocalWeek(timestamp: number): number {
	const date = new Date(timestamp);
	const day = date.getDay();
	date.setHours(0, 0, 0, 0);
	date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
	return date.getTime();
}

function createWeeklyTrend(now: number): WeeklyTrendPoint[] {
	const currentWeek = new Date(startOfLocalWeek(now));
	const result: WeeklyTrendPoint[] = [];
	for (let offset = 7; offset >= 0; offset -= 1) {
		const week = new Date(currentWeek);
		week.setDate(week.getDate() - offset * 7);
		result.push({
			weekStart: week.getTime(),
			answeredCount: 0,
			correctCount: 0,
			accuracy: null,
		});
	}
	return result;
}

export function buildDashboardAnalytics(
	entries: QuizCatalogEntry[],
	histories: Readonly<Record<string, QuizHistory>>,
	now = Date.now(),
): DashboardAnalytics {
	const levels = createLevelAnalytics();
	const types = createTypeCounts();
	const quizzes: Record<string, QuizEntryAnalytics> = {};
	const wrongQuestions: WrongQuestionAnalytics[] = [];
	const topicMap = new Map<string, MutableTopic>();
	const weeklyTrend = createWeeklyTrend(now);
	const trendByWeek = new Map(weeklyTrend.map((point) => [point.weekStart, point]));
	let questionCount = 0;
	let answeredCount = 0;
	let correctCount = 0;
	let attemptedQuizCount = 0;
	let completedSessionCount = 0;
	let incompleteQuizCount = 0;
	let latestActivityAt: number | null = null;

	for (const entry of entries) {
		const history = histories[entry.quizKey];
		const currentSession = getCurrentSession(history);
		const current = getSessionAccuracy(currentSession, entry);
		const topicPaths = expandTopicPaths(entry.topics);
		let quizAnswered = 0;
		let quizCorrect = 0;
		let totalAttemptCount = 0;
		let quizWrongQuestionCount = 0;

		questionCount += entry.quiz.questions.length;
		for (const topicPath of topicPaths) {
			const topic = getOrCreateTopic(topicMap, topicPath);
			topic.quizKeys.add(entry.quizKey);
			topic.questionCount += entry.quiz.questions.length;
		}
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
				for (const topicPath of topicPaths) {
					getOrCreateTopic(topicMap, topicPath).answeredCount += 1;
				}
				const firstAttempt = attempts[0];
				if (firstAttempt?.correct) {
					quizCorrect += 1;
					correctCount += 1;
					levels[question.level].correctCount += 1;
					for (const topicPath of topicPaths) {
						getOrCreateTopic(topicMap, topicPath).correctCount += 1;
					}
				}
				if (firstAttempt) {
					const trendPoint = trendByWeek.get(startOfLocalWeek(firstAttempt.answeredAt));
					if (trendPoint) {
						trendPoint.answeredCount += 1;
						if (firstAttempt.correct) trendPoint.correctCount += 1;
					}
				}
			}
		}

		for (const question of entry.quiz.questions) {
			const attempts = getQuestionAttempts(history, question.id);
			const latestAttempt = attempts.at(-1);
			if (!latestAttempt || latestAttempt.correct) continue;
			const wrongAttemptCount = attempts.filter((attempt) => !attempt.correct).length;
			wrongQuestions.push({
				quizKey: entry.quizKey,
				filePath: entry.filePath,
				quizId: entry.quiz.id,
				quizTitle: entry.quiz.title,
				questionId: question.id,
				question: question.question,
				type: question.type,
				level: question.level,
				topics: entry.topics,
				wrongAttemptCount,
				lastWrongAt: latestAttempt.answeredAt,
			});
			quizWrongQuestionCount += 1;
			for (const topicPath of topicPaths) {
				getOrCreateTopic(topicMap, topicPath).wrongQuestionCount += 1;
			}
		}

		const completed =
			history?.sessions.filter((session) => session.completedAt !== undefined)
				.length ?? 0;
		const isInProgress =
			currentSession?.completedAt === undefined && current.answeredCount > 0;
		const quizLatestActivity = getLatestActivity(history);
		completedSessionCount += completed;
		if (isInProgress) incompleteQuizCount += 1;
		if (totalAttemptCount > 0) attemptedQuizCount += 1;
		if (quizLatestActivity !== null) {
			latestActivityAt = Math.max(latestActivityAt ?? quizLatestActivity, quizLatestActivity);
		}
		quizzes[entry.quizKey] = {
			quizKey: entry.quizKey,
			completedSessionCount: completed,
			totalAttemptCount,
			currentAnsweredCount: current.answeredCount,
			currentAccuracy: current.accuracy,
			firstAccuracy: percentage(quizCorrect, quizAnswered),
			latestActivityAt: quizLatestActivity,
			wrongQuestionCount: quizWrongQuestionCount,
			isInProgress,
		};
	}

	for (const level of LEVELS) {
		levels[level].accuracy = percentage(
			levels[level].correctCount,
			levels[level].answeredCount,
		);
	}
	for (const point of weeklyTrend) {
		point.accuracy = percentage(point.correctCount, point.answeredCount);
	}

	wrongQuestions.sort(
		(left, right) =>
			right.wrongAttemptCount - left.wrongAttemptCount ||
			right.lastWrongAt - left.lastWrongAt ||
			left.question.localeCompare(right.question),
	);

	const topics: TopicAnalytics[] = [...topicMap.values()]
		.map((topic) => ({
			path: topic.path,
			label: topic.label,
			depth: topic.depth,
			quizCount: topic.quizKeys.size,
			questionCount: topic.questionCount,
			wrongQuestionCount: topic.wrongQuestionCount,
			answeredCount: topic.answeredCount,
			correctCount: topic.correctCount,
			accuracy: percentage(topic.correctCount, topic.answeredCount),
		}))
		.sort(
			(left, right) =>
				right.wrongQuestionCount - left.wrongQuestionCount ||
				(left.accuracy ?? 101) - (right.accuracy ?? 101) ||
				left.label.localeCompare(right.label),
		);

	return {
		quizCount: entries.length,
		questionCount,
		attemptedQuizCount,
		completedSessionCount,
		incompleteQuizCount,
		wrongQuestionCount: wrongQuestions.length,
		latestActivityAt,
		answeredCount,
		correctCount,
		accuracy: percentage(correctCount, answeredCount),
		levels,
		types,
		quizzes,
		wrongQuestions,
		topics,
		weeklyTrend,
	};
}
