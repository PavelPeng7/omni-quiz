import assert from "node:assert/strict";
import test from "node:test";
import { QuizFocusCoordinator } from "../src/navigation";

const target = {
	filePath: "Notes/test.md",
	quizId: "quiz-1",
	questionId: "q2",
};

test("delivers a pending focus request when its renderer subscribes", () => {
	const coordinator = new QuizFocusCoordinator();
	const received: string[] = [];
	coordinator.request(target);
	coordinator.subscribe((candidate) => {
		received.push(candidate.questionId);
		return true;
	});
	coordinator.subscribe(() => {
		received.push("duplicate");
		return true;
	});

	assert.deepEqual(received, ["q2"]);
});

test("keeps a focus request pending when mounted renderers do not match", () => {
	const coordinator = new QuizFocusCoordinator();
	const received: string[] = [];
	coordinator.subscribe(() => false);
	coordinator.request(target);
	coordinator.subscribe((candidate) => {
		received.push(candidate.quizId);
		return true;
	});

	assert.deepEqual(received, ["quiz-1"]);
});

test("broadcasts a focus request to every matching mounted renderer", () => {
	const coordinator = new QuizFocusCoordinator();
	const received: string[] = [];
	coordinator.subscribe(() => {
		received.push("first");
		return true;
	});
	coordinator.subscribe(() => {
		received.push("second");
		return true;
	});
	coordinator.request(target);

	assert.deepEqual(received, ["first", "second"]);
});
