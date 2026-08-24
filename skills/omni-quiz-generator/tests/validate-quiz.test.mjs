import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError, parseMarkdown, validateQuiz } from "../scripts/validate-quiz.mjs";

function markdown(questions, difficulty = { min: "L1", max: "L3" }) {
	return `---
type: quiz
title: 测试
---

\`\`\`quiz
${JSON.stringify({
		schemaVersion: 2,
		id: "test-quiz-001",
		title: "测试",
		mode: "standard",
		difficulty,
		questions,
	}, null, 2)}
\`\`\`
`;
}

const questions = [
	{
		id: "q001",
		type: "single",
		level: "L1",
		question: "单选？",
		options: [{ id: "A", text: "错" }, { id: "B", text: "对" }],
		answer: "B",
	},
	{
		id: "q002",
		type: "multiple",
		level: "L2",
		question: "多选？",
		options: [{ id: "A", text: "一" }, { id: "B", text: "二" }, { id: "C", text: "三" }],
		answer: ["A", "C"],
	},
	{ id: "q003", type: "true_false", level: "L2", question: "判断？", answer: false },
	{
		id: "q004",
		type: "fill_blank",
		level: "L3",
		question: "填空 _____。",
		answers: ["State", "状态"],
		caseSensitive: false,
	},
];

test("accepts all current Schema v2 question types", () => {
	assert.deepEqual(validateQuiz(parseMarkdown(markdown(questions))), {
		quizId: "test-quiz-001",
		questionCount: 4,
		mode: "standard",
		types: ["single", "multiple", "true_false", "fill_blank"],
		levelRange: { min: "L1", max: "L3" },
	});
});

test("rejects legacy output from the old generator", () => {
	const legacy = { id: "legacy", title: "旧格式", questions: [] };
	assert.throws(() => validateQuiz(legacy), /schemaVersion must be 2/);
});

test("rejects invalid answers for each objective shape", () => {
	const invalidMultiple = structuredClone(questions);
	invalidMultiple[1].answer = ["A", "A"];
	assert.throws(() => validateQuiz(parseMarkdown(markdown(invalidMultiple))), /duplicate option IDs/);

	const invalidBoolean = structuredClone(questions);
	invalidBoolean[2].answer = "false";
	assert.throws(() => validateQuiz(parseMarkdown(markdown(invalidBoolean))), /must be a boolean/);

	const invalidBlank = structuredClone(questions);
	invalidBlank[3].answers = [];
	assert.throws(() => validateQuiz(parseMarkdown(markdown(invalidBlank))), /at least one accepted/);
});

test("rejects progress fields and mismatched difficulty", () => {
	const withProgress = structuredClone(questions);
	withProgress[0].attempts = 1;
	assert.throws(() => validateQuiz(parseMarkdown(markdown(withProgress))), /unsupported fields/);
	assert.throws(
		() => validateQuiz(parseMarkdown(markdown(questions, { min: "L1", max: "L2" }))),
		/must match actual question range/,
	);
});

test("rejects multiple quiz blocks", () => {
	assert.throws(() => parseMarkdown(markdown(questions) + markdown(questions)), /exactly one/);
});
