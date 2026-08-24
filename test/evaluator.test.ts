import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAnswer } from "../src/evaluator";
import type { QuizQuestion } from "../src/types";

const questions: QuizQuestion[] = [
	{
		id: "single",
		type: "single",
		level: "L1",
		question: "单选",
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
		question: "多选",
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
		question: "判断",
		answer: false,
	},
	{
		id: "blank",
		type: "fill_blank",
		level: "L2",
		question: "填空",
		answers: ["State", "状态"],
		caseSensitive: false,
	},
];

test("evaluates single, multiple, and true/false answers", () => {
	assert.equal(evaluateAnswer(questions[0]!, "A"), true);
	assert.equal(evaluateAnswer(questions[1]!, ["C", "A"]), true);
	assert.equal(evaluateAnswer(questions[1]!, ["A"]), false);
	assert.equal(evaluateAnswer(questions[1]!, ["A", "A"]), false);
	assert.equal(evaluateAnswer(questions[2]!, false), true);
});

test("normalizes fill-blank whitespace and case", () => {
	assert.equal(evaluateAnswer(questions[3]!, "  STATE  "), true);
	assert.equal(evaluateAnswer(questions[3]!, "Strategy"), false);
});
