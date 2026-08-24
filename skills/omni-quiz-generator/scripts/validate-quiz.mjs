#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const QUIZ_BLOCK = /```quiz[ \t]*\r?\n([\s\S]*?)\r?\n```/g;
const LEVELS = ["L1", "L2", "L3", "L4"];
const TYPES = ["single", "multiple", "true_false", "fill_blank"];
const QUIZ_KEYS = new Set(["schemaVersion", "id", "title", "mode", "difficulty", "questions"]);
const DIFFICULTY_KEYS = new Set(["min", "max"]);
const COMMON_QUESTION_KEYS = ["id", "type", "level", "question", "explanation"];
const TYPE_KEYS = {
	single: new Set([...COMMON_QUESTION_KEYS, "options", "answer"]),
	multiple: new Set([...COMMON_QUESTION_KEYS, "options", "answer"]),
	true_false: new Set([...COMMON_QUESTION_KEYS, "answer"]),
	fill_blank: new Set([...COMMON_QUESTION_KEYS, "answers", "caseSensitive"]),
};
const OPTION_KEYS = new Set(["id", "text"]);

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

function requireEnum(value, allowed, location) {
	if (typeof value !== "string" || !allowed.includes(value)) {
		throw new ValidationError(`${location} must be one of: ${allowed.join(", ")}`);
	}
	return value;
}

function rejectUnknownKeys(value, allowed, location) {
	const unknown = Object.keys(value).filter((key) => !allowed.has(key)).sort();
	if (unknown.length > 0) {
		throw new ValidationError(`${location} contains unsupported fields: ${unknown.join(", ")}`);
	}
}

function validateFrontmatter(markdown) {
	if (!markdown.startsWith("---")) return;
	const closing = markdown.indexOf("\n---", 3);
	if (closing < 0) throw new ValidationError("frontmatter is not closed");
	const frontmatter = markdown.slice(3, closing);
	const typeMatch = /^type\s*:\s*([^\r\n]+)$/m.exec(frontmatter);
	const type = typeMatch?.[1]?.trim().replace(/^["']|["']$/g, "");
	if (type !== "quiz") throw new ValidationError("frontmatter must contain 'type: quiz'");
}

export function parseMarkdown(markdown) {
	validateFrontmatter(markdown);
	const blocks = [...markdown.matchAll(QUIZ_BLOCK)];
	if (blocks.length !== 1) {
		throw new ValidationError(`expected exactly one quiz block, found ${blocks.length}`);
	}
	try {
		return requireObject(JSON.parse(blocks[0][1]), "quiz");
	} catch (error) {
		if (error instanceof ValidationError) throw error;
		throw new ValidationError(`quiz block is not valid JSON: ${error.message}`);
	}
}

function validateOptions(value, location) {
	if (!Array.isArray(value) || value.length < 2) {
		throw new ValidationError(`${location} must contain at least two options`);
	}
	const ids = new Set();
	value.forEach((candidate, index) => {
		const optionLocation = `${location}[${index + 1}]`;
		const option = requireObject(candidate, optionLocation);
		rejectUnknownKeys(option, OPTION_KEYS, optionLocation);
		const id = requireNonEmptyString(option.id, `${optionLocation}.id`);
		requireNonEmptyString(option.text, `${optionLocation}.text`);
		if (ids.has(id)) throw new ValidationError(`${location} contains duplicate option ID: ${id}`);
		ids.add(id);
	});
	return ids;
}

function validateQuestion(candidate, index) {
	const location = `questions[${index + 1}]`;
	const question = requireObject(candidate, location);
	const type = requireEnum(question.type, TYPES, `${location}.type`);
	rejectUnknownKeys(question, TYPE_KEYS[type], location);
	const id = requireNonEmptyString(question.id, `${location}.id`);
	const level = requireEnum(question.level, LEVELS, `${location}.level`);
	requireNonEmptyString(question.question, `${location}.question`);
	if (Object.hasOwn(question, "explanation") && typeof question.explanation !== "string") {
		throw new ValidationError(`${location}.explanation must be a string`);
	}

	if (type === "single" || type === "multiple") {
		const optionIds = validateOptions(question.options, `${location}.options`);
		if (type === "single") {
			const answer = requireNonEmptyString(question.answer, `${location}.answer`);
			if (!optionIds.has(answer)) {
				throw new ValidationError(`${location}.answer '${answer}' does not match an option ID`);
			}
		} else {
			if (!Array.isArray(question.answer) || question.answer.length === 0) {
				throw new ValidationError(`${location}.answer must contain at least one option ID`);
			}
			const answers = question.answer.map((answer, answerIndex) =>
				requireNonEmptyString(answer, `${location}.answer[${answerIndex + 1}]`),
			);
			if (new Set(answers).size !== answers.length) {
				throw new ValidationError(`${location}.answer contains duplicate option IDs`);
			}
			const unknown = answers.filter((answer) => !optionIds.has(answer));
			if (unknown.length > 0) {
				throw new ValidationError(`${location}.answer contains unknown option IDs: ${unknown.join(", ")}`);
			}
		}
	} else if (type === "true_false") {
		if (typeof question.answer !== "boolean") {
			throw new ValidationError(`${location}.answer must be a boolean`);
		}
	} else {
		if (!Array.isArray(question.answers) || question.answers.length === 0) {
			throw new ValidationError(`${location}.answers must contain at least one accepted answer`);
		}
		question.answers.forEach((answer, answerIndex) =>
			requireNonEmptyString(answer, `${location}.answers[${answerIndex + 1}]`),
		);
		if (Object.hasOwn(question, "caseSensitive") && typeof question.caseSensitive !== "boolean") {
			throw new ValidationError(`${location}.caseSensitive must be a boolean`);
		}
	}

	return { id, type, level };
}

export function validateQuiz(quiz) {
	rejectUnknownKeys(quiz, QUIZ_KEYS, "quiz");
	if (quiz.schemaVersion !== 2) throw new ValidationError("quiz.schemaVersion must be 2");
	const quizId = requireNonEmptyString(quiz.id, "quiz.id");
	requireNonEmptyString(quiz.title, "quiz.title");
	const mode = requireEnum(quiz.mode, ["quick", "standard"], "quiz.mode");
	if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
		throw new ValidationError("quiz.questions must contain at least one question");
	}

	const questions = quiz.questions.map(validateQuestion);
	const questionIds = new Set();
	for (const question of questions) {
		if (questionIds.has(question.id)) throw new ValidationError(`duplicate question ID: ${question.id}`);
		questionIds.add(question.id);
	}

	const levelIndexes = questions.map((question) => LEVELS.indexOf(question.level));
	const levelRange = {
		min: LEVELS[Math.min(...levelIndexes)],
		max: LEVELS[Math.max(...levelIndexes)],
	};
	if (quiz.difficulty !== undefined) {
		const difficulty = requireObject(quiz.difficulty, "quiz.difficulty");
		rejectUnknownKeys(difficulty, DIFFICULTY_KEYS, "quiz.difficulty");
		const min = requireEnum(difficulty.min, LEVELS, "quiz.difficulty.min");
		const max = requireEnum(difficulty.max, LEVELS, "quiz.difficulty.max");
		if (LEVELS.indexOf(min) > LEVELS.indexOf(max)) {
			throw new ValidationError("quiz.difficulty.min cannot be higher than max");
		}
		if (min !== levelRange.min || max !== levelRange.max) {
			throw new ValidationError(`quiz.difficulty must match actual question range ${levelRange.min}-${levelRange.max}`);
		}
	}

	return {
		quizId,
		questionCount: questions.length,
		mode,
		types: [...new Set(questions.map((question) => question.type))],
		levelRange,
	};
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
			const result = await validateFile(path);
			console.log(`OK: ${path} (${result.questionCount} questions, ${result.mode}, ${result.types.join("/")}, ${result.levelRange.min}-${result.levelRange.max}, quiz ID: ${result.quizId})`);
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
