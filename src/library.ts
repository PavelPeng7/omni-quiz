import { expandTopicPaths, type QuizEntryAnalytics } from "./analytics";
import type { QuizCatalogEntry } from "./catalog";
import type { QuizMode } from "./types";

export type LibraryStatus = "all" | "not_started" | "in_progress" | "completed" | "wrong";
export type LibrarySort = "recent" | "wrong" | "accuracy" | "title";

export interface LibraryFilters {
	query: string;
	mode: "all" | QuizMode;
	status: LibraryStatus;
	topic: string;
	sort: LibrarySort;
}

export function filterQuizCatalogEntries(
	entries: readonly QuizCatalogEntry[],
	analytics: Readonly<Record<string, QuizEntryAnalytics>>,
	filters: LibraryFilters,
): QuizCatalogEntry[] {
	const query = filters.query.trim().toLowerCase();
	return entries
		.filter((entry) => {
			const quiz = analytics[entry.quizKey];
			if (filters.mode !== "all" && entry.quiz.mode !== filters.mode) return false;
			if (filters.topic !== "all" && !expandTopicPaths(entry.topics).includes(filters.topic)) return false;
			if (filters.status === "not_started" && (quiz?.totalAttemptCount ?? 0) > 0) return false;
			if (filters.status === "in_progress" && !quiz?.isInProgress) return false;
			if (filters.status === "completed" && (quiz?.completedSessionCount ?? 0) === 0) return false;
			if (filters.status === "wrong" && (quiz?.wrongQuestionCount ?? 0) === 0) return false;
			return query.length === 0 || [
				entry.quiz.title,
				entry.quiz.id,
				entry.filePath,
				...entry.topics,
				...entry.topics.map((topic) => topic.split("/").join(" › ")),
			].some((value) => value.toLowerCase().includes(query));
		})
		.sort((left, right) => compareEntries(left, right, analytics, filters.sort));
}

function compareEntries(
	left: QuizCatalogEntry,
	right: QuizCatalogEntry,
	analytics: Readonly<Record<string, QuizEntryAnalytics>>,
	sort: LibrarySort,
): number {
	const leftAnalytics = analytics[left.quizKey];
	const rightAnalytics = analytics[right.quizKey];
	if (sort === "wrong") {
		return (rightAnalytics?.wrongQuestionCount ?? 0) - (leftAnalytics?.wrongQuestionCount ?? 0) ||
			(rightAnalytics?.latestActivityAt ?? 0) - (leftAnalytics?.latestActivityAt ?? 0);
	}
	if (sort === "accuracy") {
		return (leftAnalytics?.firstAccuracy ?? 101) - (rightAnalytics?.firstAccuracy ?? 101) ||
			left.quiz.title.localeCompare(right.quiz.title);
	}
	if (sort === "title") return left.quiz.title.localeCompare(right.quiz.title);
	return (rightAnalytics?.latestActivityAt ?? 0) - (leftAnalytics?.latestActivityAt ?? 0) ||
		left.quiz.title.localeCompare(right.quiz.title);
}
