import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardAnalytics, expandTopicPaths } from "../src/analytics";
import type { QuizCatalogEntry } from "../src/catalog";
import type { QuizHistory } from "../src/types";

const entry: QuizCatalogEntry = {
	quizKey: "Notes/test.md::quiz-1",
	filePath: "Notes/test.md",
	blockIndex: 1,
	topics: ["开发/TypeScript"],
	quiz: {
		schemaVersion: 2,
		id: "quiz-1",
		title: "测试",
		mode: "standard",
		questions: [
			{
				id: "q1",
				type: "single",
				level: "L1",
				question: "第一题",
				options: [
					{ id: "A", text: "A" },
					{ id: "B", text: "B" },
				],
				answer: "B",
			},
			{
				id: "q2",
				type: "true_false",
				level: "L2",
				question: "第二题",
				answer: true,
			},
		],
	},
};

const history: QuizHistory = {
	quizId: "quiz-1",
	filePath: "Notes/test.md",
	sessions: [
		{
			id: "session-1",
			startedAt: 1,
			completedAt: 5,
			answers: {
				q1: [
					{ answer: "A", correct: false, answeredAt: 2 },
					{ answer: "B", correct: true, answeredAt: 3 },
				],
				q2: [{ answer: true, correct: true, answeredAt: 4 }],
			},
		},
		{
			id: "session-2",
			startedAt: 6,
			answers: {
				q1: [{ answer: "B", correct: true, answeredAt: 7 }],
			},
		},
	],
};

test("aggregates first-attempt accuracy by quiz and cognitive level", () => {
	const analytics = buildDashboardAnalytics([entry], {
		[entry.quizKey]: history,
	});

	assert.equal(analytics.quizCount, 1);
	assert.equal(analytics.questionCount, 2);
	assert.equal(analytics.completedSessionCount, 1);
	assert.equal(analytics.answeredCount, 3);
	assert.equal(analytics.correctCount, 2);
	assert.equal(analytics.accuracy, 67);
	assert.equal(analytics.levels.L1.accuracy, 50);
	assert.equal(analytics.levels.L2.accuracy, 100);
	assert.equal(analytics.types.single, 1);
	assert.equal(analytics.types.true_false, 1);
});

test("reports current session progress separately from historical accuracy", () => {
	const analytics = buildDashboardAnalytics([entry], {
		[entry.quizKey]: history,
	});
	const quiz = analytics.quizzes[entry.quizKey];
	assert.deepEqual(quiz, {
		quizKey: entry.quizKey,
		completedSessionCount: 1,
		totalAttemptCount: 4,
		currentAnsweredCount: 1,
		currentAccuracy: 100,
		firstAccuracy: 67,
		latestActivityAt: 7,
		wrongQuestionCount: 0,
		isInProgress: true,
	});
});

test("ignores histories that no longer have a matching quiz in the vault", () => {
	const analytics = buildDashboardAnalytics([], {
		orphan: history,
	});
	assert.equal(analytics.quizCount, 0);
	assert.equal(analytics.answeredCount, 0);
	assert.equal(analytics.accuracy, null);
});

test("keeps only questions whose latest attempt is wrong", () => {
	const latestWrong: QuizHistory = {
		...history,
		sessions: [
			...history.sessions,
			{
				id: "session-3",
				startedAt: 8,
				answers: {
					q1: [{ answer: "A", correct: false, answeredAt: 9 }],
					q2: [
						{ answer: false, correct: false, answeredAt: 10 },
						{ answer: true, correct: true, answeredAt: 11 },
					],
				},
			},
		],
	};
	const analytics = buildDashboardAnalytics([entry], {
		[entry.quizKey]: latestWrong,
	});

	assert.equal(analytics.wrongQuestionCount, 1);
	assert.equal(analytics.quizzes[entry.quizKey]?.wrongQuestionCount, 1);
	assert.deepEqual(
		analytics.wrongQuestions.map((item) => [item.questionId, item.wrongAttemptCount]),
		[["q1", 2]],
	);
});

test("aggregates nested topics into parent paths", () => {
	const analytics = buildDashboardAnalytics([entry], {
		[entry.quizKey]: history,
	});

	assert.deepEqual(expandTopicPaths(["开发/TypeScript"]), [
		"开发",
		"开发/TypeScript",
	]);
	assert.deepEqual(
		analytics.topics.map((topic) => [topic.path, topic.quizCount, topic.questionCount]),
		[
			["开发", 1, 2],
			["开发/TypeScript", 1, 2],
		],
	);
	assert.equal(analytics.topics[0]?.accuracy, 67);
});

test("groups first attempts into the current and seven prior local weeks", () => {
	const now = new Date(2026, 7, 28, 12).getTime();
	const monday = new Date(2026, 7, 24, 0).getTime();
	const datedHistory: QuizHistory = {
		...history,
		sessions: [
			{
				id: "dated",
				startedAt: monday,
				answers: {
					q1: [
						{ answer: "A", correct: false, answeredAt: monday + 1_000 },
						{ answer: "B", correct: true, answeredAt: monday + 2_000 },
					],
					q2: [{ answer: true, correct: true, answeredAt: monday + 3_000 }],
				},
			},
		],
	};
	const analytics = buildDashboardAnalytics(
		[entry],
		{ [entry.quizKey]: datedHistory },
		now,
	);
	const currentWeek = analytics.weeklyTrend.at(-1);

	assert.equal(analytics.weeklyTrend.length, 8);
	assert.equal(currentWeek?.weekStart, monday);
	assert.equal(currentWeek?.answeredCount, 2);
	assert.equal(currentWeek?.correctCount, 1);
	assert.equal(currentWeek?.accuracy, 50);
});

test("puts quizzes without note tags in the uncategorized topic", () => {
	const untagged = { ...entry, topics: [] };
	const analytics = buildDashboardAnalytics([untagged], {});
	assert.equal(analytics.topics[0]?.path, "未分类");
});
