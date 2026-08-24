#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const QUIZ_BLOCK = /```quiz[ \t]*\r?\n([\s\S]*?)\r?\n```/g;
const ALLOWED_QUIZ_KEYS = new Set(["id", "title", "questions"]);
const ALLOWED_QUESTION_KEYS = new Set([
	"id",
	"question",
	"options",
	"answer",
	"explanation",
]);
const ALLOWED_OPTION_KEYS = new Set(["id", "text"]);

export class ValidationError extends Error {
	constructor(message) {
		super(message);
		this.name = "ValidationError";
	}
}

function requireObject(value, location) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new ValidationError(`${location} must be a JSON object`);
	}
	return value;
}

function requireNonEmptyString(value, location) {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new ValidationError(`${location} must be a non-empty string`);
	}
	return value;
}

function rejectUnknownKeys(value, allowed, location) {
	const unknown = Object.keys(value).filter((key) => !allowed.has(key)).sort();
	if (unknown.length > 0) {
		throw new ValidationError(
			`${location} contains unsupported fields: ${unknown.join(", ")}`,
		);
	}
}

function validateFrontmatter(markdown) {
	if (!markdown.startsWith("---")) return;
	const closing = markdown.indexOf("\n---", 3);
	if (closing < 0) throw new ValidationError("frontmatter is not closed");

	const frontmatter = markdown.slice(3, closing);
	const typeMatch = /^type\s*:\s*([^\r\n]+)$/m.exec(frontmatter);
	const type = typeMatch?.[1]?.trim().replace(/^["']|["']$/g, "");
	if (type !== "quiz") {
		throw new ValidationError("frontmatter must contain 'type: quiz'");
	}
}

export function parseMarkdown(markdown) {
	validateFrontmatter(markdown);
	const blocks = [...markdown.matchAll(QUIZ_BLOCK)];
	if (blocks.length !== 1) {
		throw new ValidationError(
			`expected exactly one quiz block, found ${blocks.length}`,
		);
	}

	try {
		return requireObject(JSON.parse(blocks[0][1]), "quiz");
	} catch (error) {
		if (error instanceof ValidationError) throw error;
		throw new ValidationError(`quiz block is not valid JSON: ${error.message}`);
	}
}

export function validateQuiz(quiz) {
	rejectUnknownKeys(quiz, ALLOWED_QUIZ_KEYS, "quiz");
	const quizId = requireNonEmptyString(quiz.id, "quiz.id");
	requireNonEmptyString(quiz.title, "quiz.title");
	if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
		throw new ValidationError("quiz.questions must contain at least one question");
	}

	const questionIds = new Set();
	quiz.questions.forEach((candidate, questionIndex) => {
		const location = `questions[${questionIndex + 1}]`;
		const question = requireObject(candidate, location);
		rejectUnknownKeys(question, ALLOWED_QUESTION_KEYS, location);
		const questionId = requireNonEmptyString(question.id, `${location}.id`);
		if (questionIds.has(questionId)) {
			throw new ValidationError(`duplicate question ID: ${questionId}`);
		}
		questionIds.add(questionId);
		requireNonEmptyString(question.question, `${location}.question`);
		if (
			Object.hasOwn(question, "explanation") &&
			typeof question.explanation !== "string"
		) {
			throw new ValidationError(`${location}.explanation must be a string`);
		}

		if (!Array.isArray(question.options) || question.options.length < 2) {
			throw new ValidationError(`${location}.options must contain at least two options`);
		}

		const optionIds = new Set();
		question.options.forEach((candidateOption, optionIndex) => {
			const optionLocation = `${location}.options[${optionIndex + 1}]`;
			const option = requireObject(candidateOption, optionLocation);
			rejectUnknownKeys(option, ALLOWED_OPTION_KEYS, optionLocation);
			const optionId = requireNonEmptyString(option.id, `${optionLocation}.id`);
			requireNonEmptyString(option.text, `${optionLocation}.text`);
			if (optionIds.has(optionId)) {
				throw new ValidationError(
					`question ${questionId} has duplicate option ID: ${optionId}`,
				);
			}
			optionIds.add(optionId);
		});

		const answer = requireNonEmptyString(question.answer, `${location}.answer`);
		if (!optionIds.has(answer)) {
			throw new ValidationError(
				`question ${questionId} answer '${answer}' does not match an option ID`,
			);
		}
	});

	return { quizId, questionCount: quiz.questions.length };
}

export async function validateFile(path) {
	const markdown = await readFile(path, "utf8");
	return validateQuiz(parseMarkdown(markdown.replace(/^\uFEFF/, "")));
}

async function main() {
	const paths = process.argv.slice(2);
	if (paths.length === 0) {
		console.error("Usage: node validate-quiz.mjs <quiz.md> [more.quiz.md ...]");
		return 2;
	}

	let failed = false;
	for (const path of paths) {
		try {
			const { quizId, questionCount } = await validateFile(path);
			console.log(`OK: ${path} (${questionCount} questions, quiz ID: ${quizId})`);
		} catch (error) {
			failed = true;
			console.error(`ERROR: ${path}: ${error.message}`);
		}
	}
	return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main();
}
