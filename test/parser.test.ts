import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseQuiz, QuizParseError } from "../src/parser";

const legacyQuiz = JSON.stringify({
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
			explanation: "解释",
		},
	],
});

const standardQuiz = JSON.stringify({
	schemaVersion: 2,
	id: "quiz-2",
	title: "标准测试",
	mode: "standard",
	difficulty: { min: "L1", max: "L3" },
	questions: [
		{
			id: "single",
			type: "single",
			level: "L1",
			question: "单选？",
			options: [
				{ id: "A", text: "A" },
				{ id: "B", text: "B" },
			],
			answer: "A",
		},
		{
			id: "multiple",
			type: "multiple",
			level: "L2",
			question: "多选？",
			options: [
				{ id: "A", text: "A" },
				{ id: "B", text: "B" },
				{ id: "C", text: "C" },
			],
			answer: ["A", "C"],
		},
		{
			id: "boolean",
			type: "true_false",
			level: "L2",
			question: "判断？",
			answer: false,
		},
		{
			id: "blank",
			type: "fill_blank",
			level: "L3",
			question: "填空？",
			answers: ["State", "状态"],
		},
	],
});

test("parses a legacy single-choice quiz with compatible defaults", () => {
	const quiz = parseQuiz(legacyQuiz);
	assert.equal(quiz.schemaVersion, 1);
	assert.equal(quiz.mode, "quick");
	assert.equal(quiz.questions[0]?.type, "single");
	assert.equal(quiz.questions[0]?.level, "L1");
	const question = quiz.questions[0];
	assert.ok(question?.type === "single");
	assert.equal(question.answer, "B");
});

test("parses all objective question types in schema v2", () => {
	const quiz = parseQuiz(standardQuiz);
	assert.equal(quiz.schemaVersion, 2);
	assert.equal(quiz.mode, "standard");
	assert.deepEqual(quiz.difficulty, { min: "L1", max: "L3" });
	assert.deepEqual(
		quiz.questions.map((question) => question.type),
		["single", "multiple", "true_false", "fill_blank"],
	);
});

test("reports invalid JSON without leaking the native parse message", () => {
	assert.throws(
		() => parseQuiz("{"),
		(error: unknown) =>
			error instanceof QuizParseError && error.message === "Quiz JSON 格式错误",
	);
});

test("rejects invalid v2 question metadata", () => {
	const source = standardQuiz.replace('"level":"L1"', '"level":"L5"');
	assert.throws(() => parseQuiz(source), /level 必须是 L1–L4/);
});

test("rejects duplicate or unknown multiple-choice answers", () => {
	const parsed = JSON.parse(standardQuiz) as Record<string, unknown>;
	const questions = parsed.questions as Array<Record<string, unknown>>;
	questions[1]!.answer = ["A", "A"];
	assert.throws(() => parseQuiz(JSON.stringify(parsed)), /正确答案无效/);
});

test("rejects duplicate question IDs", () => {
	const parsed = JSON.parse(legacyQuiz) as Record<string, unknown>;
	const questions = parsed.questions as unknown[];
	parsed.questions = [questions[0], questions[0]];
	assert.throws(() => parseQuiz(JSON.stringify(parsed)), /存在重复题目 ID/);
});

test("the bundled legacy sample still contains ten valid questions", async () => {
	const markdown = await readFile(
		new URL("../sample-quiz.md", import.meta.url),
		"utf8",
	);
	const block = /```quiz\s*([\s\S]*?)```/.exec(markdown);
	assert.ok(block?.[1]);
	assert.equal(parseQuiz(block[1]).questions.length, 10);
});

test("the bundled standard sample demonstrates all supported question types", async () => {
	const markdown = await readFile(
		new URL("../sample-standard-quiz.md", import.meta.url),
		"utf8",
	);
	const block = /```quiz\s*([\s\S]*?)```/.exec(markdown);
	assert.ok(block?.[1]);
	assert.deepEqual(
		parseQuiz(block[1]).questions.map((question) => question.type),
		["single", "multiple", "true_false", "fill_blank"],
	);
});
