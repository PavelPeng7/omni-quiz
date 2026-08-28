export interface QuizFocusTarget {
	filePath: string;
	quizId: string;
	questionId: string;
}

type FocusListener = (target: QuizFocusTarget) => boolean;

export class QuizFocusCoordinator {
	private pending: QuizFocusTarget | null = null;
	private readonly listeners = new Set<FocusListener>();

	request(target: QuizFocusTarget): void {
		this.pending = target;
		this.deliver(target);
	}

	subscribe(listener: FocusListener): () => void {
		this.listeners.add(listener);
		if (this.pending) this.deliver(this.pending);
		return () => this.listeners.delete(listener);
	}

	private deliver(target: QuizFocusTarget): void {
		let handled = false;
		for (const listener of this.listeners) {
			if (listener(target)) handled = true;
		}
		if (handled && this.pending === target) this.pending = null;
	}
}
