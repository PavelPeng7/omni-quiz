import type {
	AnswerValue,
	QuestionAttempt,
	QuizData,
	QuizHistory,
	QuizPluginData,
	QuizSession,
	QuizStatistics,
} from "./types";

export const EMPTY_PLUGIN_DATA: QuizPluginData = {
	schemaVersion: 2,
	quizzes: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAnswerValue(value: unknown): AnswerValue | null {
	if (typeof value === "string" || typeof value === "boolean") return value;
	if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
		return [...value];
	}
	return null;
}

function parseAttempt(value: unknown): QuestionAttempt | null {
	if (!isRecord(value)) return null;
	const answer = parseAnswerValue(value.answer);
	if (
		answer === null ||
		typeof value.correct !== "boolean" ||
		typeof value.answeredAt !== "number" ||
		!Number.isFinite(value.answeredAt)
	) {
		return null;
	}
	return { answer, correct: value.correct, answeredAt: value.answeredAt };
}

function parseSession(value: unknown): QuizSession | null {
	if (
		!isRecord(value) ||
		typeof value.id !== "string" ||
		typeof value.startedAt !== "number" ||
		!Number.isFinite(value.startedAt) ||
		!isRecord(value.answers)
	) {
		return null;
	}
	if (
		value.completedAt !== undefined &&
		(typeof value.completedAt !== "number" || !Number.isFinite(value.completedAt))
	) {
		return null;
	}

	const answers: Record<string, QuestionAttempt[]> = {};
	for (const [questionId, candidate] of Object.entries(value.answers)) {
		if (!Array.isArray(candidate)) continue;
		const attempts = candidate
			.map(parseAttempt)
			.filter((attempt): attempt is QuestionAttempt => attempt !== null);
		if (attempts.length > 0) answers[questionId] = attempts;
	}

	return {
		id: value.id,
		startedAt: value.startedAt,
		...(typeof value.completedAt === "number"
			? { completedAt: value.completedAt }
			: {}),
		answers,
	};
}

function parseV2Data(value: Record<string, unknown>): QuizPluginData | null {
	if (value.schemaVersion !== 2 || !isRecord(value.quizzes)) return null;
	const quizzes: Record<string, QuizHistory> = {};
	for (const [quizKey, candidate] of Object.entries(value.quizzes)) {
		if (
			!isRecord(candidate) ||
			typeof candidate.quizId !== "string" ||
			typeof candidate.filePath !== "string" ||
			!Array.isArray(candidate.sessions)
		) {
			continue;
		}
		quizzes[quizKey] = {
			quizId: candidate.quizId,
			filePath: candidate.filePath,
			sessions: candidate.sessions
				.map(parseSession)
				.filter((session): session is QuizSession => session !== null),
		};
	}
	return { schemaVersion: 2, quizzes };
}

function migrateLegacyData(value: Record<string, unknown>): QuizPluginData {
	if (!isRecord(value.results)) return { ...EMPTY_PLUGIN_DATA, quizzes: {} };
	const quizzes: Record<string, QuizHistory> = {};

	for (const [quizKey, candidate] of Object.entries(value.results)) {
		if (
			!isRecord(candidate) ||
			typeof candidate.quizId !== "string" ||
			typeof candidate.filePath !== "string" ||
			!isRecord(candidate.questions)
		) {
			continue;
		}
		const answers: Record<string, QuestionAttempt[]> = {};
		let startedAt = Number.POSITIVE_INFINITY;
		for (const [questionId, result] of Object.entries(candidate.questions)) {
			if (
				!isRecord(result) ||
				typeof result.selectedAnswer !== "string" ||
				typeof result.correct !== "boolean" ||
				typeof result.updatedAt !== "number" ||
				!Number.isFinite(result.updatedAt)
			) {
				continue;
			}
			answers[questionId] = [
				{
					answer: result.selectedAnswer,
					correct: result.correct,
					answeredAt: result.updatedAt,
				},
			];
			startedAt = Math.min(startedAt, result.updatedAt);
		}
		quizzes[quizKey] = {
			quizId: candidate.quizId,
			filePath: candidate.filePath,
			sessions:
				Object.keys(answers).length === 0
					? []
					: [
							{
								id: `legacy-${startedAt}`,
								startedAt,
								answers,
							},
						],
		};
	}

	return { schemaVersion: 2, quizzes };
}

export function normalizePluginData(value: unknown): QuizPluginData {
	if (!isRecord(value)) return { ...EMPTY_PLUGIN_DATA, quizzes: {} };
	return parseV2Data(value) ?? migrateLegacyData(value);
}

function cloneAnswer(answer: AnswerValue): AnswerValue {
	return Array.isArray(answer) ? [...answer] : answer;
}

function cloneData(data: QuizPluginData): QuizPluginData {
	const quizzes: Record<string, QuizHistory> = {};
	for (const [quizKey, history] of Object.entries(data.quizzes)) {
		quizzes[quizKey] = {
			quizId: history.quizId,
			filePath: history.filePath,
			sessions: history.sessions.map((session) => ({
				id: session.id,
				startedAt: session.startedAt,
				...(session.completedAt !== undefined
					? { completedAt: session.completedAt }
					: {}),
				answers: Object.fromEntries(
					Object.entries(session.answers).map(([questionId, attempts]) => [
						questionId,
						attempts.map((attempt) => ({
							answer: cloneAnswer(attempt.answer),
							correct: attempt.correct,
							answeredAt: attempt.answeredAt,
						})),
					]),
				),
			})),
		};
	}
	return { schemaVersion: 2, quizzes };
}

function createSession(now: number, sequence: number): QuizSession {
	return {
		id: `session-${now}-${sequence}`,
		startedAt: now,
		answers: {},
	};
}

export class QuizStorage {
	private saveQueue: Promise<void> = Promise.resolve();
	private sessionSequence = 0;
	private readonly changeListeners = new Set<() => void>();

	constructor(
		private readonly data: QuizPluginData,
		private readonly persist: (data: QuizPluginData) => Promise<void>,
	) {}

	getHistory(quizKey: string): QuizHistory | undefined {
		return this.data.quizzes[quizKey];
	}

	getHistories(): Readonly<Record<string, QuizHistory>> {
		return this.data.quizzes;
	}

	onChange(listener: () => void): () => void {
		this.changeListeners.add(listener);
		return () => this.changeListeners.delete(listener);
	}

	getOrCreateCurrentSession(
		quizKey: string,
		quizId: string,
		filePath: string,
		now = Date.now(),
	): QuizSession {
		const history = this.data.quizzes[quizKey];
		const current = history?.sessions.at(-1);
		if (current) return current;

		const session = createSession(now, ++this.sessionSequence);
		this.data.quizzes[quizKey] = {
			quizId,
			filePath,
			sessions: [session],
		};
		return session;
	}

	getSession(quizKey: string, sessionId: string): QuizSession | undefined {
		return this.data.quizzes[quizKey]?.sessions.find(
			(session) => session.id === sessionId,
		);
	}

	getAttempts(
		quizKey: string,
		sessionId: string,
		questionId: string,
	): QuestionAttempt[] {
		return this.getSession(quizKey, sessionId)?.answers[questionId] ?? [];
	}

	getLatestAttempt(
		quizKey: string,
		sessionId: string,
		questionId: string,
	): QuestionAttempt | undefined {
		return this.getAttempts(quizKey, sessionId, questionId).at(-1);
	}

	saveQuestionAttempt(
		quizKey: string,
		sessionId: string,
		questionId: string,
		answer: AnswerValue,
		correct: boolean,
		now = Date.now(),
	): Promise<void> {
		const session = this.getSession(quizKey, sessionId);
		if (!session || session.completedAt !== undefined) {
			return Promise.reject(new Error("Quiz session is unavailable"));
		}
		session.answers[questionId] = [
			...(session.answers[questionId] ?? []),
			{ answer: cloneAnswer(answer), correct, answeredAt: now },
		];
		return this.enqueuePersist();
	}

	completeSession(
		quizKey: string,
		sessionId: string,
		quiz: QuizData,
		now = Date.now(),
	): Promise<void> {
		const session = this.getSession(quizKey, sessionId);
		if (!session) return Promise.reject(new Error("Quiz session is unavailable"));
		const answeredAll = quiz.questions.every(
			(question) => (session.answers[question.id]?.length ?? 0) > 0,
		);
		if (!answeredAll) return Promise.reject(new Error("Quiz session is incomplete"));
		if (session.completedAt === undefined) session.completedAt = now;
		return this.enqueuePersist();
	}

	startNewSession(
		quizKey: string,
		quizId: string,
		filePath: string,
		now = Date.now(),
	): { session: QuizSession; persisted: Promise<void> } {
		const session = createSession(now, ++this.sessionSequence);
		const history = this.data.quizzes[quizKey];
		this.data.quizzes[quizKey] = {
			quizId,
			filePath,
			sessions: [...(history?.sessions ?? []), session],
		};
		return { session, persisted: this.enqueuePersist() };
	}

	renameFile(oldPath: string, newPath: string): Promise<void> {
		if (oldPath === newPath) return Promise.resolve();
		const oldPrefix = `${oldPath}::`;
		let changed = false;
		for (const [quizKey, history] of Object.entries(this.data.quizzes)) {
			if (!quizKey.startsWith(oldPrefix)) continue;
			const quizId = quizKey.slice(oldPrefix.length);
			const nextKey = `${newPath}::${quizId}`;
			const existing = this.data.quizzes[nextKey];
			const sessionsById = new Map(
				(existing?.sessions ?? []).map((session) => [session.id, session]),
			);
			for (const session of history.sessions) sessionsById.set(session.id, session);
			this.data.quizzes[nextKey] = {
				quizId: history.quizId,
				filePath: newPath,
				sessions: [...sessionsById.values()].sort(
					(left, right) => left.startedAt - right.startedAt,
				),
			};
			delete this.data.quizzes[quizKey];
			changed = true;
		}
		return changed ? this.enqueuePersist() : Promise.resolve();
	}

	getStatistics(
		quizKey: string,
		sessionId: string,
		quiz: QuizData,
	): QuizStatistics {
		const session = this.getSession(quizKey, sessionId);
		let answeredCount = 0;
		let correctCount = 0;
		let firstCorrectCount = 0;
		for (const question of quiz.questions) {
			const attempts = session?.answers[question.id];
			if (!attempts || attempts.length === 0) continue;
			answeredCount += 1;
			if (attempts.at(-1)?.correct) correctCount += 1;
			if (attempts[0]?.correct) firstCorrectCount += 1;
		}
		const history = this.getHistory(quizKey);
		return {
			answeredCount,
			correctCount,
			firstCorrectCount,
			accuracy:
				answeredCount === 0
					? null
					: Math.round((correctCount / answeredCount) * 100),
			firstAccuracy:
				answeredCount === 0
					? null
					: Math.round((firstCorrectCount / answeredCount) * 100),
			completedSessionCount:
				history?.sessions.filter((item) => item.completedAt !== undefined).length ?? 0,
		};
	}

	private enqueuePersist(): Promise<void> {
		const snapshot = cloneData(this.data);
		this.saveQueue = this.saveQueue
			.catch(() => undefined)
			.then(async () => {
				await this.persist(snapshot);
				for (const listener of this.changeListeners) listener();
			});
		return this.saveQueue;
	}
}
