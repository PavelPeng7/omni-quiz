import type { AnswerValue, QuizQuestion } from "./types";

function areStringArraysEqual(left: string[], right: string[]): boolean {
	if (left.length !== right.length) return false;
	if (new Set(left).size !== left.length) return false;
	const expected = new Set(right);
	return expected.size === right.length && left.every((item) => expected.has(item));
}

function normalizeFillAnswer(value: string, caseSensitive: boolean): string {
	const trimmed = value.trim();
	return caseSensitive ? trimmed : trimmed.toLowerCase();
}

export function evaluateAnswer(
	question: QuizQuestion,
	answer: AnswerValue,
): boolean {
	switch (question.type) {
		case "single":
			return typeof answer === "string" && answer === question.answer;
		case "multiple":
			return Array.isArray(answer) && areStringArraysEqual(answer, question.answer);
		case "true_false":
			return typeof answer === "boolean" && answer === question.answer;
		case "fill_blank": {
			if (typeof answer !== "string") return false;
			const candidate = normalizeFillAnswer(answer, question.caseSensitive);
			return question.answers.some(
				(expected) =>
					normalizeFillAnswer(expected, question.caseSensitive) === candidate,
			);
		}
	}
}

export function formatAnswer(
	question: QuizQuestion,
	answer: AnswerValue,
): string {
	if (question.type === "true_false" && typeof answer === "boolean") {
		return answer ? "正确" : "错误";
	}
	if (Array.isArray(answer)) return answer.join("、");
	return String(answer);
}

export function formatCorrectAnswer(question: QuizQuestion): string {
	switch (question.type) {
		case "single":
			return question.answer;
		case "multiple":
			return question.answer.join("、");
		case "true_false":
			return question.answer ? "正确" : "错误";
		case "fill_blank":
			return question.answers.join(" / ");
	}
}
