import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseQuiz, QuizParseError } from "../src/parser";

const validQuiz = JSON.stringify({
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

test("parses a valid single-choice quiz", () => {
	const quiz = parseQuiz(validQuiz);
	assert.equal(quiz.questions[0]?.answer, "B");
});

test("reports invalid JSON without leaking the native parse message", () => {
	assert.throws(
		() => parseQuiz("{"),
		(error: unknown) =>
			error instanceof QuizParseError && error.message === "Quiz JSON 格式错误",
	);
});

test("rejects an empty question list", () => {
	assert.throws(
		() => parseQuiz('{"id":"quiz-1","title":"测试","questions":[]}'),
		/Quiz 中没有题目/,
	);
});

test("rejects an answer that does not exist in options", () => {
	const source = validQuiz.replace('"answer":"B"', '"answer":"C"');
	assert.throws(() => parseQuiz(source), /题目 q1 的正确答案无效/);
});

test("rejects duplicate question IDs", () => {
	const source = JSON.stringify({
		...JSON.parse(validQuiz),
		questions: [
			JSON.parse(validQuiz).questions[0],
			JSON.parse(validQuiz).questions[0],
		],
	});
	assert.throws(() => parseQuiz(source), /存在重复题目 ID/);
});

test("the bundled sample contains ten valid questions", async () => {
	const markdown = await readFile(new URL("../sample-quiz.md", import.meta.url), "utf8");
	const block = /```quiz\s*([\s\S]*?)```/.exec(markdown);
	assert.ok(block?.[1]);
	assert.equal(parseQuiz(block[1]).questions.length, 10);
});
