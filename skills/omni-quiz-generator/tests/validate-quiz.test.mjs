import assert from "node:assert/strict";
import test from "node:test";
import {
	ValidationError,
	parseMarkdown,
	validateQuiz,
} from "../scripts/validate-quiz.mjs";

function markdown(answer = "B", extraField = "") {
	return `---
type: quiz
title: 测试
---

\`\`\`quiz
{
  "id": "test-quiz-001",
  "title": "测试",
  "questions": [
    {
      "id": "q001",
      "question": "正确答案是什么？",
      "options": [
        { "id": "A", "text": "错误" },
        { "id": "B", "text": "正确" }
      ],
      "answer": "${answer}",
      "explanation": "用于验证结构。"${extraField}
    }
  ]
}
\`\`\`
`;
}

test("accepts valid Markdown", () => {
	assert.deepEqual(validateQuiz(parseMarkdown(markdown())), {
		quizId: "test-quiz-001",
		questionCount: 1,
	});
});

test("rejects an answer not present in options", () => {
	assert.throws(
		() => validateQuiz(parseMarkdown(markdown("C"))),
		(error) => error instanceof ValidationError && /does not match/.test(error.message),
	);
});

test("rejects persisted progress fields", () => {
	assert.throws(
		() => validateQuiz(parseMarkdown(markdown("B", ',\n      "attempts": 1'))),
		/unsupported fields/,
	);
});

test("rejects multiple quiz blocks", () => {
	assert.throws(() => parseMarkdown(markdown() + markdown()), /exactly one/);
});
