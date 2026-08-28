import assert from "node:assert/strict";
import test from "node:test";
import { extractQuizCatalog, normalizeTopicTags } from "../src/catalog";

const validBlock = `
\`\`\`quiz
{
  "schemaVersion": 2,
  "id": "quiz-1",
  "title": "测试",
  "mode": "quick",
  "questions": [
    {
      "id": "q1",
      "type": "true_false",
      "level": "L1",
      "question": "正确吗？",
      "answer": true
    }
  ]
}
\`\`\`
`;

test("extracts quiz blocks and builds stable vault keys", () => {
	const catalog = extractQuizCatalog("Notes/test.md", validBlock, [
		"#开发/TypeScript",
	]);
	assert.equal(catalog.errors.length, 0);
	assert.equal(catalog.entries.length, 1);
	assert.equal(catalog.entries[0]?.quizKey, "Notes/test.md::quiz-1");
	assert.equal(catalog.entries[0]?.blockIndex, 1);
	assert.deepEqual(catalog.entries[0]?.topics, ["开发/TypeScript"]);
});

test("normalizes, deduplicates, and sorts note tags", () => {
	assert.deepEqual(
		normalizeTopicTags([
			"#开发/TypeScript",
			"开发/TypeScript",
			" #学习 ",
			"#开发//Web",
			"#",
		]),
		["学习", "开发/TypeScript", "开发/Web"],
	);
});

test("reports malformed quiz blocks without dropping valid siblings", () => {
	const markdown = `${validBlock}\n\`\`\`quiz\n{"id":"broken"}\n\`\`\``;
	const catalog = extractQuizCatalog("Notes/test.md", markdown);
	assert.equal(catalog.entries.length, 1);
	assert.equal(catalog.errors.length, 1);
	assert.equal(catalog.errors[0]?.blockIndex, 2);
	assert.match(catalog.errors[0]?.message ?? "", /title/);
});

test("ignores quiz-like text outside exact fenced blocks", () => {
	const catalog = extractQuizCatalog(
		"Notes/test.md",
		"Inline ```quiz text``` and a regular ```json block```.",
	);
	assert.deepEqual(catalog, { entries: [], errors: [] });
});
