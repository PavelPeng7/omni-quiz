import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardAnalytics } from "../src/analytics";
import type { QuizCatalogEntry } from "../src/catalog";
import type { QuizHistory } from "../src/types";

const entry: QuizCatalogEntry = {
	quizKey: "Notes/test.md::quiz-1",
	filePath: "Notes/test.md",
	blockIndex: 1,
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
