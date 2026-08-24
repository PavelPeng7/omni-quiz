export type QuizMode = "quick" | "standard";

export type CognitiveLevel = "L1" | "L2" | "L3" | "L4";

export interface QuizDifficulty {
	min: CognitiveLevel;
	max: CognitiveLevel;
}

export interface QuizData {
	schemaVersion: 1 | 2;
	id: string;
	title: string;
	mode: QuizMode;
	difficulty?: QuizDifficulty;
	questions: QuizQuestion[];
}

interface BaseQuestion {
	id: string;
	question: string;
	level: CognitiveLevel;
	explanation?: string;
}

export interface QuizOption {
	id: string;
	text: string;
}

export interface SingleQuestion extends BaseQuestion {
	type: "single";
	options: QuizOption[];
	answer: string;
}

export interface MultipleQuestion extends BaseQuestion {
	type: "multiple";
	options: QuizOption[];
	answer: string[];
}

export interface TrueFalseQuestion extends BaseQuestion {
	type: "true_false";
	answer: boolean;
}

export interface FillBlankQuestion extends BaseQuestion {
	type: "fill_blank";
	answers: string[];
	caseSensitive: boolean;
}

export type QuizQuestion =
	| SingleQuestion
	| MultipleQuestion
	| TrueFalseQuestion
	| FillBlankQuestion;

export type AnswerValue = string | string[] | boolean;

export interface QuestionAttempt {
	answer: AnswerValue;
	correct: boolean;
	answeredAt: number;
}

export interface QuizSession {
	id: string;
	startedAt: number;
	completedAt?: number;
	answers: Record<string, QuestionAttempt[]>;
}

export interface QuizHistory {
	quizId: string;
	filePath: string;
	sessions: QuizSession[];
}

export interface QuizPluginData {
	schemaVersion: 2;
	quizzes: Record<string, QuizHistory>;
}

export interface QuizStatistics {
	answeredCount: number;
	correctCount: number;
	firstCorrectCount: number;
	accuracy: number | null;
	firstAccuracy: number | null;
	completedSessionCount: number;
}
