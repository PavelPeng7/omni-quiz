import assert from "node:assert/strict";
import test from "node:test";
import type { QuizEntryAnalytics } from "../src/analytics";
import type { QuizCatalogEntry } from "../src/catalog";
import { filterQuizCatalogEntries, type LibraryFilters } from "../src/library";

function makeEntry(
	id: string,
	title: string,
	mode: "quick" | "standard",
	topics: string[],
): QuizCatalogEntry {
	return {
		quizKey: `Notes/${id}.md::${id}`,
		filePath: `Notes/${id}.md`,
		blockIndex: 1,
		topics,
		quiz: {
			schemaVersion: 2,
			id,
			title,
			mode,
			questions: [
				{ id: "q1", type: "true_false", level: "L1", question: title, answer: true },
			],
		},
	};
}

function makeAnalytics(
	quizKey: string,
	overrides: Partial<QuizEntryAnalytics>,
): QuizEntryAnalytics {
	return {
		quizKey,
		completedSessionCount: 0,
		totalAttemptCount: 0,
		currentAnsweredCount: 0,
		currentAccuracy: null,
		firstAccuracy: null,
		latestActivityAt: null,
		wrongQuestionCount: 0,
		isInProgress: false,
		...overrides,
	};
}

const typescript = makeEntry("ts", "TypeScript 基础", "standard", ["开发/TypeScript"]);
const design = makeEntry("design", "视觉设计", "quick", ["设计"]);
const entries = [typescript, design];
const analytics = {
	[typescript.quizKey]: makeAnalytics(typescript.quizKey, {
		totalAttemptCount: 3,
		firstAccuracy: 40,
		latestActivityAt: 20,
		wrongQuestionCount: 2,
		isInProgress: true,
	}),
	[design.quizKey]: makeAnalytics(design.quizKey, {
		completedSessionCount: 1,
		totalAttemptCount: 1,
		firstAccuracy: 100,
		latestActivityAt: 10,
	}),
};
const defaults: LibraryFilters = {
	query: "",
	mode: "all",
	status: "all",
	topic: "all",
	sort: "recent",
};

test("combines parent topic, mode, and wrong-answer filters", () => {
	const result = filterQuizCatalogEntries(entries, analytics, {
		...defaults,
		mode: "standard",
		status: "wrong",
		topic: "开发",
	});
	assert.deepEqual(result.map((entry) => entry.quiz.id), ["ts"]);
});

test("searches displayed nested topic labels and sorts low accuracy first", () => {
	const result = filterQuizCatalogEntries(entries, analytics, {
		...defaults,
		query: "开发 › typescript",
		sort: "accuracy",
	});
	assert.deepEqual(result.map((entry) => entry.quiz.id), ["ts"]);
	assert.deepEqual(
		filterQuizCatalogEntries(entries, analytics, { ...defaults, sort: "accuracy" })
			.map((entry) => entry.quiz.id),
		["ts", "design"],
	);
});

test("distinguishes in-progress and completed learning states", () => {
	assert.deepEqual(
		filterQuizCatalogEntries(entries, analytics, { ...defaults, status: "in_progress" })
			.map((entry) => entry.quiz.id),
		["ts"],
	);
	assert.deepEqual(
		filterQuizCatalogEntries(entries, analytics, { ...defaults, status: "completed" })
			.map((entry) => entry.quiz.id),
		["design"],
	);
});
