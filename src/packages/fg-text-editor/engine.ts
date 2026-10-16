import {
	nodesToFragment,
	parse,
	toPlainText,
	type Profile,
} from '../fg-formatted-text';
import {
	hasMark,
	insertBreak,
	linkAt,
	marksAt,
	replaceRange,
	textUnits,
	toggleMark,
	type EditResult,
	type LinkRange,
	type Range,
} from './commands';
import { History, type Snapshot } from './history';
import {
	emptyDoc,
	endsWithBreak,
	fromNodes,
	fromUnits,
	load,
	read,
	serialize,
	toNodes,
	toUnits,
	type Doc,
	type Mark,
	type Unit,
} from './model';
import {
	SENTINEL_CLASS,
	offsetOf,
	readSelection,
	writeSelection,
} from './selection';

export interface EngineState {
	selection: Range;
	focused: boolean;
	canUndo: boolean;
	canRedo: boolean;
	link: LinkRange | null;
	/** Whether the marks with these names cover the selection. */
	isMarked: (names: string[]) => boolean;
}

export interface EngineOptions {
	profile: Profile;
	value: string;
	/** Formatting commands and formatted paste are allowed. */
	canFormat: boolean;
	onChange?: (value: string) => void;
	onState?: (state: EngineState) => void;
	/** Handles a key press first; return true when it was handled. */
	onKeyDown?: (event: KeyboardEvent) => boolean;
}

export type Command = (doc: Doc, selection: Range) => EditResult | null;

/**
 * The editing engine. It owns the document, renders it into a
 * contenteditable element and turns user input into document changes.
 *
 * Typing, deleting, spell-check and composition stay native; the engine
 * reads the result back through the formatter. Line breaks, formatting,
 * paste, drop and undo go through the engine.
 */
export class TextEngine {
	readonly root: HTMLElement;

	private options: EngineOptions;

	private doc: Doc = emptyDoc();

	private selection: Range = { start: 0, end: 0 };

	private value = '';

	private composing = false;

	private storedMarks: Mark[] | null = null;

	private storedAt = -1;

	private readonly history = new History();

	private readonly listeners: Array<[EventTarget, string, EventListener]> =
		[];

	constructor(root: HTMLElement, options: EngineOptions) {
		this.root = root;
		this.options = options;
		this.setValue(options.value);

		this.listen(root, 'beforeinput', (event) =>
			this.onBeforeInput(event as InputEvent)
		);
		this.listen(root, 'input', () => this.onInput());
		this.listen(root, 'compositionstart', () => {
			this.composing = true;
		});
		this.listen(root, 'compositionend', () => {
			this.composing = false;
			this.onInput();
		});
		this.listen(root, 'keydown', (event) =>
			this.onKeyDown(event as KeyboardEvent)
		);
		this.listen(root, 'paste', (event) =>
			this.onPaste(event as ClipboardEvent)
		);
		this.listen(root, 'drop', (event) => this.onDrop(event as DragEvent));
		this.listen(root, 'dragstart', (event) => event.preventDefault());
		this.listen(root, 'focus', () => this.emitState());
		this.listen(root, 'blur', () => this.emitState());
		this.listen(root.ownerDocument, 'selectionchange', () =>
			this.onSelectionChange()
		);
	}

	/** Updates options that may change between renders. */
	configure(options: Partial<EngineOptions>): void {
		this.options = { ...this.options, ...options };
	}

	/**
	 * Replaces the content with a stored value and clears the history.
	 *
	 * @param value Stored caption or description.
	 */
	setValue(value: string): void {
		this.doc = load(String(value ?? ''), this.options.profile).doc;
		this.value = serialize(this.doc, this.options.profile);
		this.selection = { start: 0, end: 0 };
		this.storedMarks = null;
		this.history.clear();
		this.render();
		this.emitState();
	}

	/** The stored form of the current content. */
	getValue(): string {
		return this.value;
	}

	profile(): Profile {
		return this.options.profile;
	}

	getDoc(): Doc {
		return this.doc;
	}

	/**
	 * The selection, read from the page when it is inside the editing area,
	 * since selectionchange arrives after the key or click that moved it.
	 */
	getSelection(): Range {
		const live = readSelection(this.root);
		if (live) {
			this.selection = { start: live.start, end: live.end };
		}
		return { ...this.selection };
	}

	focus(): void {
		this.root.focus();
		writeSelection(this.root, this.selection);
	}

	/**
	 * Runs a command against the current document and selection.
	 *
	 * @param command Command to run.
	 * @param group   History group; empty starts a new undo step.
	 */
	run(command: Command, group = ''): boolean {
		const result = command(this.doc, this.getSelection());
		if (!result) {
			return false;
		}
		this.apply(result, group);
		return true;
	}

	/**
	 * Toggles a mark. With a collapsed selection the change applies to the
	 * next typed text.
	 *
	 * @param names Equivalent element names; the first is the one added.
	 */
	toggleMark(names: string[]): void {
		if (!this.options.canFormat) {
			return;
		}
		const { start, end } = this.getSelection();
		if (start === end) {
			const current = this.storedMarks ?? marksAt(this.doc, start);
			const active = current.some((mark) => names.includes(mark.name));
			this.storedMarks = active
				? current.filter((mark) => !names.includes(mark.name))
				: [...current, { name: names[0], attributes: [] }];
			this.storedAt = start;
			this.emitState();
			return;
		}
		this.run((doc, selection) =>
			toggleMark(doc, selection, names, this.options.profile)
		);
	}

	undo(): void {
		const previous = this.history.undo(this.snapshot());
		if (previous) {
			this.restore(previous);
		}
	}

	redo(): void {
		const next = this.history.redo(this.snapshot());
		if (next) {
			this.restore(next);
		}
	}

	state(): EngineState {
		const selection = this.getSelection();
		const stored = this.storedMarks;
		return {
			selection,
			focused: this.root.ownerDocument.activeElement === this.root,
			canUndo: this.history.canUndo(),
			canRedo: this.history.canRedo(),
			link: linkAt(this.doc, selection),
			isMarked: (names: string[]) =>
				stored && selection.start === selection.end
					? stored.some((mark) => names.includes(mark.name))
					: hasMark(this.doc, selection, names),
		};
	}

	destroy(): void {
		for (const [target, type, listener] of this.listeners) {
			target.removeEventListener(type, listener);
		}
		this.listeners.length = 0;
	}

	private listen(
		target: EventTarget,
		type: string,
		listener: EventListener
	): void {
		target.addEventListener(type, listener);
		this.listeners.push([target, type, listener]);
	}

	private snapshot(): Snapshot {
		return { doc: this.doc, selection: this.getSelection() };
	}

	private restore(snapshot: Snapshot): void {
		this.doc = snapshot.doc;
		this.selection = { ...snapshot.selection };
		this.storedMarks = null;
		this.render();
		writeSelection(this.root, this.selection);
		this.emitChange();
		this.emitState();
	}

	private apply(result: EditResult, group: string): void {
		this.history.record(this.snapshot(), group);
		this.doc = result.doc;
		this.selection = { ...result.selection };
		this.storedMarks = null;
		this.render();
		if (this.root.ownerDocument.activeElement === this.root) {
			writeSelection(this.root, this.selection);
		}
		this.emitChange();
		this.emitState();
	}

	private build(doc: Doc): DocumentFragment {
		const fragment = nodesToFragment(
			toNodes(doc, this.options.profile),
			this.root.ownerDocument
		);
		if (endsWithBreak(doc)) {
			const sentinel = this.root.ownerDocument.createElement('br');
			sentinel.className = SENTINEL_CLASS;
			fragment.appendChild(sentinel);
		}
		return fragment;
	}

	private render(): void {
		this.root.replaceChildren(this.build(this.doc));
	}

	private readDom(): Doc {
		const clone = this.root.cloneNode(true) as HTMLElement;
		const sentinels = clone.querySelectorAll('.' + SENTINEL_CLASS);
		sentinels.forEach((node) => node.remove());
		const doc = read(clone.innerHTML, this.options.profile);
		if (sentinels.length > 0) {
			return doc;
		}

		// Browsers add a bare <br> to keep an empty last line visible; it is not content.
		let last: Node | null = clone.lastChild;
		while (
			last &&
			last.nodeType === 1 &&
			last.nodeName !== 'BR' &&
			last.lastChild
		) {
			last = last.lastChild;
		}
		if (last && last.nodeName === 'BR') {
			const units = toUnits(doc);
			const count = units.length;
			if (
				count > 0 &&
				units[count - 1].char === null &&
				(count === 1 || units[count - 2].char === null)
			) {
				return fromUnits(units.slice(0, -1), this.options.profile);
			}
		}
		return doc;
	}

	private onInput(): void {
		if (this.composing) {
			return;
		}
		const before: Snapshot = {
			doc: this.doc,
			selection: { ...this.selection },
		};
		const doc = this.readDom();
		const selection = readSelection(this.root) ?? before.selection;

		const container = this.root.ownerDocument.createElement('div');
		container.appendChild(this.build(doc));
		if (container.innerHTML !== this.root.innerHTML) {
			this.root.replaceChildren(...Array.from(container.childNodes));
			writeSelection(this.root, selection);
		}

		if (JSON.stringify(doc) === JSON.stringify(before.doc)) {
			this.selection = { start: selection.start, end: selection.end };
			this.emitState();
			return;
		}
		this.history.record(before, 'typing');
		this.doc = doc;
		this.selection = { start: selection.start, end: selection.end };
		this.emitChange();
		this.emitState();
	}

	private onBeforeInput(event: InputEvent): void {
		if (this.composing || event.isComposing) {
			return;
		}
		const live = readSelection(this.root);
		if (live) {
			this.selection = { start: live.start, end: live.end };
		}
		switch (event.inputType) {
			case 'insertParagraph':
			case 'insertLineBreak':
				event.preventDefault();
				if (this.options.profile.elements.br) {
					this.run((doc, selection) =>
						insertBreak(doc, selection, this.options.profile)
					);
				}
				return;
			case 'formatBold':
				event.preventDefault();
				this.toggleMark(['strong', 'b']);
				return;
			case 'formatItalic':
				event.preventDefault();
				this.toggleMark(['em', 'i']);
				return;
			case 'historyUndo':
				event.preventDefault();
				this.undo();
				return;
			case 'historyRedo':
				event.preventDefault();
				this.redo();
				return;
			case 'insertFromPaste':
			case 'insertFromPasteAsQuotation':
			case 'insertFromDrop':
				event.preventDefault();
				this.insertTransfer(event.dataTransfer, null);
				return;
			case 'insertText':
				if (typeof event.data !== 'string') {
					return;
				}
				if (this.storedMarks !== null || this.atLinkEnd()) {
					event.preventDefault();
					this.insertStored(event.data);
				}
				return;
			default:
				if (
					event.inputType.startsWith('format') ||
					event.inputType === 'insertLink'
				) {
					event.preventDefault();
				}
		}
	}

	/** Whether the caret sits right after a link, where typing should not extend it. */
	private atLinkEnd(): boolean {
		const { start, end } = this.selection;
		if (start !== end) {
			return false;
		}
		const link = linkAt(this.doc, this.selection);
		return !!link && link.end === start && link.start < start;
	}

	private insertStored(text: string): void {
		const marks = [
			...(this.storedMarks ?? marksAt(this.doc, this.selection.start)),
		];
		const link = linkAt(this.doc, this.selection);
		if (
			link &&
			this.selection.start > link.start &&
			this.selection.start < link.end
		) {
			marks.push(link.mark);
		}
		this.run(
			(doc, selection) =>
				replaceRange(
					doc,
					selection,
					textUnits(text, marks),
					this.options.profile
				),
			'typing'
		);
	}

	private onKeyDown(event: KeyboardEvent): void {
		if (this.options.onKeyDown && this.options.onKeyDown(event)) {
			event.preventDefault();
			return;
		}
		const primary = event.metaKey || event.ctrlKey;
		if (!primary || event.altKey) {
			return;
		}
		const key = event.key.toLowerCase();
		if (key === 'z' && !event.shiftKey) {
			event.preventDefault();
			this.undo();
		} else if ((key === 'z' && event.shiftKey) || key === 'y') {
			event.preventDefault();
			this.redo();
		}
	}

	private onPaste(event: ClipboardEvent): void {
		event.preventDefault();
		this.insertTransfer(event.clipboardData, null);
	}

	private onDrop(event: DragEvent): void {
		event.preventDefault();
		const doc = this.root.ownerDocument as Document & {
			caretPositionFromPoint?: (
				x: number,
				y: number
			) => { offsetNode: Node; offset: number } | null;
			caretRangeFromPoint?: (
				x: number,
				y: number
			) => globalThis.Range | null;
		};
		let point: { node: Node; offset: number } | null = null;
		if (typeof doc.caretPositionFromPoint === 'function') {
			const position = doc.caretPositionFromPoint(
				event.clientX,
				event.clientY
			);
			point = position
				? { node: position.offsetNode, offset: position.offset }
				: null;
		} else if (typeof doc.caretRangeFromPoint === 'function') {
			const range = doc.caretRangeFromPoint(event.clientX, event.clientY);
			point = range
				? { node: range.startContainer, offset: range.startOffset }
				: null;
		}
		this.insertTransfer(event.dataTransfer, point);
	}

	private insertTransfer(
		transfer: DataTransfer | null,
		point: { node: Node; offset: number } | null
	): void {
		if (!transfer) {
			return;
		}
		const units = this.transferUnits(transfer);
		if (units.length === 0) {
			return;
		}
		if (point && this.root.contains(point.node)) {
			const offset = offsetOf(this.root, point.node, point.offset);
			this.selection = { start: offset, end: offset };
		}
		this.run((doc, selection) =>
			replaceRange(doc, selection, units, this.options.profile)
		);
	}

	private transferUnits(transfer: DataTransfer): Unit[] {
		const profile = this.options.profile;
		const html = transfer.getData('text/html');
		const text = transfer.getData('text/plain');
		if (html && this.options.canFormat) {
			// Newlines in pasted markup are source formatting, not line breaks.
			const parsed = parse(html.replace(/[\t\n\f\r ]+/g, ' '), profile, {
				mode: 'basic',
				links: true,
				policy: null,
			});
			const units = toUnits(fromNodes(parsed.nodes, profile).doc);
			// Tidying trims the edges; the plain-text flavour shows whether the
			// copied text began or ended with a space.
			if (
				units.length > 0 &&
				/^[ \t]/.test(text) &&
				units[0].char !== ' '
			) {
				units.unshift({ char: ' ', marks: [] });
			}
			if (
				units.length > 0 &&
				/[ \t]$/.test(text) &&
				units[units.length - 1].char !== ' '
			) {
				units.push({ char: ' ', marks: [] });
			}
			return units;
		}
		const plain = text || (html ? toPlainText(html, profile) : '');
		return textUnits(plain);
	}

	private onSelectionChange(): void {
		const live = readSelection(this.root);
		if (!live) {
			return;
		}
		this.selection = { start: live.start, end: live.end };
		if (
			this.storedMarks !== null &&
			(live.start !== this.storedAt || live.end !== this.storedAt)
		) {
			this.storedMarks = null;
		}
		this.emitState();
	}

	private emitChange(): void {
		const value = serialize(this.doc, this.options.profile);
		if (value !== this.value) {
			this.value = value;
			this.options.onChange?.(value);
		}
	}

	private emitState(): void {
		this.options.onState?.(this.state());
	}
}
