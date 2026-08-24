import assert from "node:assert/strict";
import test from "node:test";
import { QuizStorage, normalizePluginData } from "../src/storage";
import type { QuizData, QuizPluginData } from "../src/types";

const quiz: QuizData = {
	schemaVersion: 2,
	id: "quiz-1",
	title: "测试",
	mode: "standard",
	questions: [
		{
			id: "q1",
			type: "single",
			level: "L1",
			question: "答案？",
			options: [
				{ id: "A", text: "错误" },
				{ id: "B", text: "正确" },
			],
			answer: "B",
		},
		{
			id: "q2",
			type: "true_false",
			level: "L2",
			question: "第二题？",
			answer: true,
		},
	],
};

function emptyData(): QuizPluginData {
	return { schemaVersion: 2, quizzes: {} };
}

test("appends attempts without overwriting the first result", async () => {
	const data = emptyData();
	let persisted: QuizPluginData | undefined;
	const storage = new QuizStorage(data, async (snapshot) => {
		persisted = snapshot;
	});
	const key = "Quiz/test.md::quiz-1";
	const session = storage.getOrCreateCurrentSession(key, quiz.id, "Quiz/test.md", 1);

	await storage.saveQuestionAttempt(key, session.id, "q1", "A", false, 2);
	await storage.saveQuestionAttempt(key, session.id, "q1", "B", true, 3);

	assert.deepEqual(storage.getAttempts(key, session.id, "q1"), [
		{ answer: "A", correct: false, answeredAt: 2 },
		{ answer: "B", correct: true, answeredAt: 3 },
	]);
	assert.equal(persisted?.quizzes[key]?.sessions[0]?.answers.q1?.length, 2);
	assert.deepEqual(storage.getStatistics(key, session.id, quiz), {
		answeredCount: 1,
		correctCount: 1,
		firstCorrectCount: 0,
		accuracy: 100,
		firstAccuracy: 0,
		completedSessionCount: 0,
	});
});

test("completes a session only after every current question is answered", async () => {
	const storage = new QuizStorage(emptyData(), async () => undefined);
	const key = "Quiz/test.md::quiz-1";
	const session = storage.getOrCreateCurrentSession(key, quiz.id, "Quiz/test.md", 1);
	await storage.saveQuestionAttempt(key, session.id, "q1", "B", true, 2);
	await assert.rejects(storage.completeSession(key, session.id, quiz, 3));
	await storage.saveQuestionAttempt(key, session.id, "q2", true, true, 4);
	await storage.completeSession(key, session.id, quiz, 5);
	assert.equal(storage.getSession(key, session.id)?.completedAt, 5);

	const next = storage.startNewSession(key, quiz.id, "Quiz/test.md", 6);
	await next.persisted;
	assert.notEqual(next.session.id, session.id);
	assert.equal(storage.getHistory(key)?.sessions.length, 2);
});

test("migrates valid legacy answers into an active session", () => {
	const key = "Quiz/test.md::quiz-1";
	const data = normalizePluginData({
		results: {
			[key]: {
				quizId: "quiz-1",
				filePath: "Quiz/test.md",
				questions: {
					q1: {
						selectedAnswer: "B",
						correct: true,
						attempts: 3,
						updatedAt: 10,
					},
				},
			},
		},
	});
	const session = data.quizzes[key]?.sessions[0];
	assert.equal(data.schemaVersion, 2);
	assert.equal(session?.id, "legacy-10");
	assert.deepEqual(session?.answers.q1, [
		{ answer: "B", correct: true, answeredAt: 10 },
	]);
});

test("normalizes persisted v2 data and rejects malformed attempts", () => {
	const data = normalizePluginData({
		schemaVersion: 2,
		quizzes: {
			key: {
				quizId: "quiz-1",
				filePath: "Quiz/test.md",
				sessions: [
					{
						id: "session-1",
						startedAt: 1,
						answers: {
							q1: [
								{ answer: ["A", "C"], correct: true, answeredAt: 2 },
								{ answer: 123, correct: true, answeredAt: 3 },
							],
						},
					},
				],
			},
		},
	});
	assert.deepEqual(data.quizzes.key?.sessions[0]?.answers.q1, [
		{ answer: ["A", "C"], correct: true, answeredAt: 2 },
	]);
});

test("notifies dashboard subscribers only after data is persisted", async () => {
	const storage = new QuizStorage(emptyData(), async () => undefined);
	const key = "Quiz/test.md::quiz-1";
	const session = storage.getOrCreateCurrentSession(key, quiz.id, "Quiz/test.md", 1);
	let notificationCount = 0;
	const unsubscribe = storage.onChange(() => {
		notificationCount += 1;
	});

	await storage.saveQuestionAttempt(key, session.id, "q1", "B", true, 2);
	assert.equal(notificationCount, 1);
	unsubscribe();
	await storage.saveQuestionAttempt(key, session.id, "q1", "A", false, 3);
	assert.equal(notificationCount, 1);
});

test("keeps quiz history connected when its Markdown file is renamed", async () => {
	const storage = new QuizStorage(emptyData(), async () => undefined);
	const oldKey = "Quiz/old.md::quiz-1";
	const session = storage.getOrCreateCurrentSession(
		oldKey,
		quiz.id,
		"Quiz/old.md",
		1,
	);
	await storage.saveQuestionAttempt(oldKey, session.id, "q1", "B", true, 2);
	await storage.renameFile("Quiz/old.md", "Archive/new.md");

	const newKey = "Archive/new.md::quiz-1";
	assert.equal(storage.getHistory(oldKey), undefined);
	assert.equal(storage.getHistory(newKey)?.filePath, "Archive/new.md");
	assert.deepEqual(storage.getLatestAttempt(newKey, session.id, "q1"), {
		answer: "B",
		correct: true,
		answeredAt: 2,
	});
});
