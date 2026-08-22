export interface QuizData {
	id: string;
	title: string;
	questions: QuizQuestion[];
}

export interface QuizQuestion {
	id: string;
	question: string;
	options: QuizOption[];
	answer: string;
	explanation?: string;
}

export interface QuizOption {
	id: string;
	text: string;
}

export interface QuizPluginData {
	results: Record<string, QuizResult>;
}

export interface QuizResult {
	quizId: string;
	filePath: string;
	questions: Record<string, QuestionResult>;
}

export interface QuestionResult {
	selectedAnswer: string;
	correct: boolean;
	attempts: number;
	updatedAt: number;
}

export interface QuizStatistics {
	answeredCount: number;
	correctCount: number;
	accuracy: number | null;
}
