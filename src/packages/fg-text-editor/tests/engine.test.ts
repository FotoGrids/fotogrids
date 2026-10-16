import { bundledProfile } from '../../fg-formatted-text';
import { TextEngine } from '../engine';
import {
	offsetOf,
	pointAt,
	readSelection,
	SENTINEL_CLASS,
	writeSelection,
} from '../selection';

const profile = bundledProfile();

function setup(value: string, canFormat = true) {
	const root = document.createElement('div');
	root.contentEditable = 'true';
	root.tabIndex = 0;
	document.body.appendChild(root);
	const changes: string[] = [];
	const engine = new TextEngine(root, {
		profile,
		value,
		canFormat,
		onChange: (next) => changes.push(next),
	});
	root.focus();
	return { root, engine, changes };
}

function beforeInput(
	root: HTMLElement,
	inputType: string,
	data: string | null = null
): InputEvent {
	const event = new InputEvent('beforeinput', {
		inputType,
		data,
		bubbles: true,
		cancelable: true,
	});
	root.dispatchEvent(event);
	return event;
}

function select(root: HTMLElement, start: number, end = start) {
	writeSelection(root, { start, end });
	document.dispatchEvent(new Event('selectionchange'));
}

function transfer(data: Record<string, string>) {
	return {
		getData: (type: string) => data[type] ?? '',
	} as unknown as DataTransfer;
}

function paste(root: HTMLElement, data: Record<string, string>): Event {
	const event = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clipboardData', { value: transfer(data) });
	root.dispatchEvent(event);
	return event;
}

function key(root: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		bubbles: true,
		cancelable: true,
		...init,
	});
	root.dispatchEvent(event);
	return event;
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('selection offsets', () => {
	it('counts text and breaks but not the sentinel', () => {
		const root = document.createElement('div');
		root.innerHTML = `a<strong>bc</strong><br>d<br><br class="${SENTINEL_CLASS}">`;
		document.body.appendChild(root);
		const strong = root.querySelector('strong')!;
		expect(offsetOf(root, strong.firstChild!, 1)).toBe(2);
		expect(offsetOf(root, root, 3)).toBe(4);
		expect(offsetOf(root, root, root.childNodes.length)).toBe(6);
		expect(pointAt(root, 3)).toEqual({
			node: strong.firstChild,
			offset: 2,
		});
		expect(pointAt(root, 6)).toEqual({ node: root, offset: 5 });

		writeSelection(root, { start: 1, end: 5 });
		expect(readSelection(root)).toMatchObject({ start: 1, end: 5 });
	});
});

describe('TextEngine', () => {
	it('renders the stored value as safe nodes', () => {
		const { root } = setup(
			'A <strong>bold</strong> <a href="https://x.test">link</a><img src=x onerror=alert(1)>'
		);
		expect(root.innerHTML).toBe(
			'A <strong>bold</strong> <a href="https://x.test">link</a>'
		);
	});

	it('reads native typing back and reports the stored form', () => {
		const { root, engine, changes } = setup('Harbour');
		(root.firstChild as Text).data = 'Harbour at dawn';
		select(root, 15);
		root.dispatchEvent(new Event('input', { bubbles: true }));
		expect(changes).toEqual(['Harbour at dawn']);
		expect(engine.getValue()).toBe('Harbour at dawn');
	});

	it('cleans browser markup after typing and keeps the caret', () => {
		const { root, changes } = setup('ab');
		root.innerHTML = 'a<span style="color:red">X</span>b';
		select(root, 2);
		root.dispatchEvent(new Event('input', { bubbles: true }));
		expect(root.innerHTML).toBe('aXb');
		expect(readSelection(root)).toMatchObject({ start: 2, end: 2 });
		expect(changes).toEqual(['aXb']);
	});

	it('turns Enter into a line break and keeps an empty last line visible', () => {
		const { root, changes } = setup('ab');
		select(root, 2);
		const event = beforeInput(root, 'insertParagraph');
		expect(event.defaultPrevented).toBe(true);
		expect(root.innerHTML).toBe(`ab<br><br class="${SENTINEL_CLASS}">`);
		expect(readSelection(root)).toMatchObject({ start: 3, end: 3 });
		expect(changes).toEqual([]);

		root.insertBefore(document.createTextNode('c'), root.lastChild);
		select(root, 4);
		root.dispatchEvent(new Event('input', { bubbles: true }));
		expect(changes).toEqual(['ab\nc']);
	});

	it('ignores the bare br a browser leaves in an emptied field', () => {
		const { root, changes } = setup('a');
		root.innerHTML = '<br>';
		select(root, 0);
		root.dispatchEvent(new Event('input', { bubbles: true }));
		expect(changes).toEqual(['']);
		expect(root.innerHTML).toBe('');
	});

	it('formats a selection with the bold shortcut and undoes it', () => {
		const { root, engine, changes } = setup('Harbour at dawn');
		select(root, 0, 7);
		beforeInput(root, 'formatBold');
		expect(changes.pop()).toBe('<strong>Harbour</strong> at dawn');

		key(root, { key: 'z', ctrlKey: true });
		expect(engine.getValue()).toBe('Harbour at dawn');
		key(root, { key: 'z', ctrlKey: true, shiftKey: true });
		expect(engine.getValue()).toBe('<strong>Harbour</strong> at dawn');
	});

	it('applies a mark toggled at the caret to the next typed text', () => {
		const { root, engine } = setup('ab');
		select(root, 1);
		engine.toggleMark(['em', 'i']);
		expect(engine.state().isMarked(['em', 'i'])).toBe(true);
		const event = beforeInput(root, 'insertText', 'X');
		expect(event.defaultPrevented).toBe(true);
		expect(engine.getValue()).toBe('a<em>X</em>b');
	});

	it('types after a link without extending it', () => {
		const { root, engine } = setup('see <a href="/x">pier</a>');
		select(root, 8);
		const event = beforeInput(root, 'insertText', '!');
		expect(event.defaultPrevented).toBe(true);
		expect(engine.getValue()).toBe('see <a href="/x">pier</a>!');

		select(root, 6);
		expect(beforeInput(root, 'insertText', 'e').defaultPrevented).toBe(
			false
		);
	});

	it('ignores formatting commands without the permission', () => {
		const { root, engine } = setup('Harbour', false);
		select(root, 0, 7);
		const event = beforeInput(root, 'formatBold');
		expect(event.defaultPrevented).toBe(true);
		expect(engine.getValue()).toBe('Harbour');
	});

	it('pastes formatted HTML through the schema', () => {
		const { root, engine } = setup('ab');
		select(root, 1);
		const event = paste(root, {
			'text/html':
				'<meta charset="utf-8"><b style="x">X</b><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Y</a>',
			'text/plain': 'XY',
		});
		expect(event.defaultPrevented).toBe(true);
		expect(engine.getValue()).toBe('a<b>X</b>Yb');
	});

	it('treats newlines in pasted markup as spaces and keeps edge spaces', () => {
		const { root, engine } = setup('ab');
		select(root, 1);
		paste(root, {
			'text/html': '\n<p>one\ntwo</p>\n<p><b>three</b></p> ',
			'text/plain': ' one two\n\nthree ',
		});
		expect(engine.getValue()).toBe('a one two\n\n<b>three</b> b');
	});

	it('pastes plain text only without the permission', () => {
		const { root, engine } = setup('ab', false);
		select(root, 1);
		paste(root, { 'text/html': '<b>X</b>', 'text/plain': 'X\nY' });
		expect(engine.getValue()).toBe('aX\nYb');
	});

	it('replaces the content and clears history on setValue', () => {
		const { root, engine } = setup('one');
		select(root, 0, 3);
		beforeInput(root, 'formatItalic');
		engine.setValue('two');
		expect(root.innerHTML).toBe('two');
		expect(engine.state().canUndo).toBe(false);
	});

	it('stops listening once destroyed', () => {
		const { root, engine, changes } = setup('ab');
		engine.destroy();
		select(root, 0, 2);
		const event = beforeInput(root, 'formatBold');
		expect(event.defaultPrevented).toBe(false);
		expect(changes).toEqual([]);
	});
});
