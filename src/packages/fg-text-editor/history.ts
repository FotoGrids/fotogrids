import type { Range } from './commands';
import type { Doc } from './model';

export interface Snapshot {
	doc: Doc;
	selection: Range;
}

export interface HistoryOptions {
	/** Typing within this many milliseconds joins one undo step. */
	groupDelay?: number;
	/** Most undo steps kept. */
	limit?: number;
	now?: () => number;
}

/**
 * Undo and redo stacks of document snapshots.
 */
export class History {
	private undoStack: Snapshot[] = [];

	private redoStack: Snapshot[] = [];

	private lastPush = 0;

	private lastGroup = '';

	private readonly groupDelay: number;

	private readonly limit: number;

	private readonly now: () => number;

	constructor(options: HistoryOptions = {}) {
		this.groupDelay = options.groupDelay ?? 500;
		this.limit = options.limit ?? 100;
		this.now = options.now ?? (() => Date.now());
	}

	/**
	 * Records the state before a change.
	 *
	 * @param before State before the change.
	 * @param group  Changes of the same non-empty group close together in
	 *               time join one step, e.g. 'typing'.
	 */
	record(before: Snapshot, group = ''): void {
		const time = this.now();
		const joins =
			group !== '' &&
			group === this.lastGroup &&
			time - this.lastPush < this.groupDelay &&
			this.undoStack.length > 0;
		if (!joins) {
			this.undoStack.push(before);
			if (this.undoStack.length > this.limit) {
				this.undoStack.shift();
			}
		}
		this.lastPush = time;
		this.lastGroup = group;
		this.redoStack = [];
	}

	undo(current: Snapshot): Snapshot | null {
		const previous = this.undoStack.pop();
		if (!previous) {
			return null;
		}
		this.redoStack.push(current);
		this.lastGroup = '';
		return previous;
	}

	redo(current: Snapshot): Snapshot | null {
		const next = this.redoStack.pop();
		if (!next) {
			return null;
		}
		this.undoStack.push(current);
		this.lastGroup = '';
		return next;
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.lastGroup = '';
	}
}
