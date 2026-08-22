import assert from "node:assert/strict";
import test from "node:test";
import { QuizStorage, normalizePluginData } from "../src/storage";
import type { QuizData, QuizPluginData } from "../src/types";

const quiz: QuizData = {
	id: "quiz-1",
	title: "测试",
	questions: [
		{
			id: "q1",
			question: "答案？",
			options: [
				{ id: "A", text: "错误" },
				{ id: "B", text: "正确" },
			],
			answer: "B",
		},
		{
			id: "q2",
			question: "第二题？",
			options: [
				{ id: "A", text: "正确" },
				{ id: "B", text: "错误" },
			],
			answer: "A",
		},
	],
};

test("updates an answer and increments attempts without changing its stable key", async () => {
	const data: QuizPluginData = { results: {} };
	let persisted: QuizPluginData | undefined;
	const storage = new QuizStorage(data, async (snapshot) => {
		persisted = snapshot;
	});
	const key = "Quiz/test.md::quiz-1";

	await storage.saveQuestionResult(key, quiz.id, "Quiz/test.md", "q1", "A", false, 1);
	await storage.saveQuestionResult(key, quiz.id, "Quiz/test.md", "q1", "B", true, 2);

	assert.deepEqual(storage.getQuestionResult(key, "q1"), {
		selectedAnswer: "B",
		correct: true,
		attempts: 2,
		updatedAt: 2,
	});
	assert.equal(persisted?.results[key]?.questions.q1?.attempts, 2);
});

test("calculates progress only from questions still present in Markdown", async () => {
	const data = normalizePluginData({
		results: {
			"Quiz/test.md::quiz-1": {
				quizId: "quiz-1",
				filePath: "Quiz/test.md",
				questions: {
					q1: { selectedAnswer: "B", correct: true, attempts: 1, updatedAt: 1 },
					deleted: { selectedAnswer: "A", correct: true, attempts: 1, updatedAt: 1 },
				},
			},
		},
	});
	const storage = new QuizStorage(data, async () => undefined);

	assert.deepEqual(storage.getStatistics("Quiz/test.md::quiz-1", quiz), {
		answeredCount: 1,
		correctCount: 1,
		accuracy: 100,
	});
});

test("restores persisted progress after a simulated plugin reload", async () => {
	let saved: QuizPluginData = { results: {} };
	const key = "Quiz/test.md::quiz-1";
	const firstSession = new QuizStorage(saved, async (snapshot) => {
		saved = structuredClone(snapshot);
	});

	await firstSession.saveQuestionResult(
		key,
		quiz.id,
		"Quiz/test.md",
		"q1",
		"B",
		true,
		123,
	);

	const reloaded = new QuizStorage(normalizePluginData(saved), async () => undefined);
	assert.deepEqual(reloaded.getQuestionResult(key, "q1"), {
		selectedAnswer: "B",
		correct: true,
		attempts: 1,
		updatedAt: 123,
	});

	const editedQuiz = structuredClone(quiz);
	editedQuiz.questions[0]!.question = "修改后的题干仍使用 q1";
	assert.equal(reloaded.getStatistics(key, editedQuiz).answeredCount, 1);
});
