import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Editor, { CHANGE_EVENT } from '../Editor';
import { createFeatureRegistry, registerBuiltInFeatures } from '../features';
import { writeSelection } from '../selection';

const h = React.createElement;

function renderElement(element) {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => root.render(element));
	return {
		rerender: (next) => act(() => root.render(next)),
		unmount: () => {
			act(() => root.unmount());
			container.remove();
		},
	};
}

function click(node) {
	act(() => {
		node.dispatchEvent(
			new window.MouseEvent('click', { bubbles: true, cancelable: true })
		);
	});
}

function changeValue(node, value) {
	const proto =
		node instanceof window.HTMLTextAreaElement
			? window.HTMLTextAreaElement.prototype
			: window.HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
	act(() => {
		setter.call(node, value);
		node.dispatchEvent(new window.Event('input', { bubbles: true }));
	});
}

function mount(props = {}) {
	const onChange = jest.fn();
	const view = renderElement(
		h(Editor, {
			label: 'Caption',
			value: '',
			onChange,
			id: 'cap',
			...props,
		})
	);
	return { ...view, onChange };
}

const area = () => document.getElementById('cap');
const tool = (label) =>
	Array.from(document.querySelectorAll('.fotogrids-text-editor__tool')).find(
		(node) =>
			node.getAttribute('aria-label') === label ||
			node.textContent === label
	);

function select(start, end = start) {
	act(() => {
		writeSelection(area(), { start, end });
		document.dispatchEvent(new Event('selectionchange'));
	});
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Editor', () => {
	it('renders a labelled multi-line textbox with a toolbar', () => {
		const { unmount } = mount({ value: 'A <em>quiet</em> harbour' });
		expect(area().getAttribute('role')).toBe('textbox');
		expect(area().getAttribute('aria-multiline')).toBe('true');
		expect(area().getAttribute('aria-label')).toBe('Caption');
		expect(area().innerHTML).toBe('A <em>quiet</em> harbour');

		const toolbar = document.querySelector('[role="toolbar"]');
		expect(toolbar.getAttribute('aria-controls')).toBe('cap');
		expect(tool('Bold').getAttribute('aria-keyshortcuts')).toMatch(/\+B$/);
		expect(
			Array.from(toolbar.querySelectorAll('button')).filter(
				(b) => b.tabIndex === 0
			)
		).toHaveLength(1);
		unmount();
	});

	it('does not report a change on load', () => {
		const { onChange, unmount } = mount({ value: 'a<br>b' });
		expect(onChange).not.toHaveBeenCalled();
		unmount();
	});

	it('formats from the toolbar and dispatches the change event', () => {
		const events = [];
		const listener = (event) => events.push(event.detail);
		document.addEventListener(CHANGE_EVENT, listener);
		const { onChange, unmount } = mount({
			value: 'Harbour at dawn',
			field: 'caption',
		});

		act(() => area().focus());
		select(0, 7);
		click(tool('Bold'));

		expect(onChange).toHaveBeenLastCalledWith(
			'<strong>Harbour</strong> at dawn'
		);
		expect(events).toEqual([
			{
				profile: 'item_text',
				field: 'caption',
				value: '<strong>Harbour</strong> at dawn',
			},
		]);
		expect(tool('Bold').getAttribute('aria-pressed')).toBe('true');
		document.removeEventListener(CHANGE_EVENT, listener);
		unmount();
	});

	it('adds a link through the link panel, keeping site defaults implicit', () => {
		const { onChange, unmount } = mount({
			value: 'see the pier',
			linkDefaults: { newTab: true, nofollow: false },
		});
		act(() => area().focus());
		select(4, 12);
		click(tool('Link'));

		const url = document.getElementById('cap-link-url');
		expect(url).toBeTruthy();
		expect(document.getElementById('cap-link-new-tab').checked).toBe(true);
		changeValue(url, 'example.com/pier');
		click(
			Array.from(document.querySelectorAll('button')).find(
				(b) => b.textContent === 'Apply'
			)
		);

		expect(onChange).toHaveBeenLastCalledWith(
			'see <a href="https://example.com/pier">the pier</a>'
		);
		expect(document.getElementById('cap-link-url')).toBeNull();
		unmount();
	});

	it('records a changed link choice on the link', () => {
		const { onChange, unmount } = mount({
			value: 'see <a href="https://a.test">the pier</a>',
			linkDefaults: { newTab: true, nofollow: false },
		});
		act(() => area().focus());
		select(6);
		click(tool('Link'));
		expect(document.getElementById('cap-link-url').value).toBe(
			'https://a.test'
		);

		act(() => {
			document.getElementById('cap-link-nofollow').click();
		});
		click(
			Array.from(document.querySelectorAll('button')).find(
				(b) => b.textContent === 'Apply'
			)
		);
		expect(onChange).toHaveBeenLastCalledWith(
			'see <a href="https://a.test" rel="nofollow">the pier</a>'
		);
		unmount();
	});

	it('writes no link choice when a checkbox ends where it started', () => {
		const { onChange, unmount } = mount({
			value: 'see the pier',
			linkDefaults: { newTab: true, nofollow: false },
		});
		act(() => area().focus());
		select(4, 12);
		click(tool('Link'));
		changeValue(document.getElementById('cap-link-url'), 'https://a.test');
		act(() => {
			document.getElementById('cap-link-new-tab').click();
		});
		act(() => {
			document.getElementById('cap-link-new-tab').click();
		});
		click(
			Array.from(document.querySelectorAll('button')).find(
				(b) => b.textContent === 'Apply'
			)
		);
		expect(onChange).toHaveBeenLastCalledWith(
			'see <a href="https://a.test">the pier</a>'
		);
		unmount();
	});

	it('refuses an unsafe link address', () => {
		const { onChange, unmount } = mount({ value: 'x' });
		act(() => area().focus());
		select(0, 1);
		click(tool('Link'));
		changeValue(
			document.getElementById('cap-link-url'),
			'javascript:alert(1)'
		);
		click(
			Array.from(document.querySelectorAll('button')).find(
				(b) => b.textContent === 'Apply'
			)
		);
		expect(document.querySelector('[role="alert"]')).toBeTruthy();
		expect(onChange).not.toHaveBeenCalled();
		unmount();
	});

	it('opens markup it cannot show in HTML mode and blocks Visual until it is removed', () => {
		const { onChange, unmount } = mount({
			value: 'a <span class="x">b</span>',
		});
		const textarea = document.querySelector('textarea');
		expect(textarea.value).toBe('a <span class="x">b</span>');
		expect(tool('Visual').getAttribute('aria-disabled')).toBe('true');
		expect(
			document.querySelector('.fotogrids-text-editor__notice')
		).toBeTruthy();

		click(tool('Visual'));
		expect(document.querySelector('textarea')).toBeTruthy();

		changeValue(textarea, 'a <strong>b</strong>');
		expect(onChange).toHaveBeenLastCalledWith('a <strong>b</strong>');
		expect(tool('Visual').getAttribute('aria-disabled')).toBeNull();
		click(tool('Visual'));
		expect(area().innerHTML).toBe('a <strong>b</strong>');
		unmount();
	});

	it('shows why formatting is unavailable and keeps typing possible', () => {
		const { unmount } = mount({
			value: 'a <strong>b</strong>',
			disabledReason: "Your role can't add formatting.",
			stripsFormatting: true,
		});
		expect(tool('Bold').getAttribute('aria-disabled')).toBe('true');
		expect(tool('HTML').getAttribute('aria-disabled')).toBe('true');
		const reason = document.querySelector('.fotogrids-text-editor__reason');
		expect(reason.textContent).toContain("Your role can't add formatting.");
		expect(reason.textContent).toContain('saves it without its formatting');
		expect(tool('Bold').getAttribute('aria-describedby')).toBe(reason.id);
		expect(area().getAttribute('contenteditable')).toBe('true');
		unmount();
	});

	it('follows a value set from outside', () => {
		const onChange = jest.fn();
		const view = renderElement(
			h(Editor, { id: 'cap', label: 'C', value: 'one', onChange })
		);
		view.rerender(
			h(Editor, {
				id: 'cap',
				label: 'C',
				value: 'two <em>x</em>',
				onChange,
			})
		);
		expect(area().innerHTML).toBe('two <em>x</em>');
		expect(onChange).not.toHaveBeenCalled();
		view.unmount();
	});

	it('offers only features the profile allows and accepts registered ones', () => {
		const registry = createFeatureRegistry();
		registerBuiltInFeatures(registry, {
			bold: 'Bold',
			italic: 'Italic',
			link: 'Link',
			clear: 'Clear',
		});
		expect(
			registry.register({
				name: 'highlight',
				element: 'mark',
				toolbar: { icon: { text: 'H' }, label: 'Highlight' },
				command: () => {},
			})
		).toBe(true);
		expect(
			registry.register({ name: 'bold', element: 'b', command: () => {} })
		).toBe(false);

		const profile = {
			elements: { strong: {}, br: {} },
			protocols: ['https'],
			breakBefore: [],
			dropWithContent: [],
		};
		const { unmount } = mount({ registry, profile });
		expect(tool('Bold')).toBeTruthy();
		expect(tool('Italic')).toBeUndefined();
		expect(tool('Link')).toBeUndefined();
		expect(tool('Highlight')).toBeUndefined();
		expect(tool('Clear')).toBeTruthy();
		unmount();
	});
});
