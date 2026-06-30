/**
 * Tests for renderCodeArea.js (validation + rendering; CodeMirror absent in tests)
 */
import '@/admin/plain/render-settings/renderCodeArea';
import { renderElement, click, act } from '@tests/helpers/render-component';

const __ = (t) => t;
const flush = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

// Positional signature: (setting, value, onChange, errors, isDisabled, getFieldState, __)
const build = (setting, value, deps = {}) =>
	window.FotoGridsRenderSettings.renderCodeArea(
		setting,
		value,
		deps.onChange || jest.fn(),
		deps.errors || [],
		deps.isDisabled || false,
		deps.getFieldState,
		__
	);

describe('renderCodeArea', () => {
	afterEach(() => {
		delete window.FotoGridsCodeMirror;
	});

	it('renders a label, description and a hint', () => {
		const { container } = renderElement(
			build(
				{
					key: 'css',
					label: 'Custom CSS',
					description: 'Add styles',
					hint: 'Be careful',
				},
				''
			)
		);
		expect(container.textContent).toContain('Custom CSS');
		expect(container.textContent).toContain('Add styles');
		expect(container.textContent).toContain('Be careful');
	});

	it('renders a hint link anchor pointing at the settings tab/field', () => {
		const { container } = renderElement(
			build(
				{
					key: 'css',
					label: 'L',
					hint_link: { label: 'Docs', tab: 'general', field: 'css' },
				},
				''
			)
		);
		const link = container.querySelector(
			'.fotogrids-codearea-hint-link__anchor'
		);
		expect(link).not.toBeNull();
		expect(link.getAttribute('href')).toContain('tab=general');
		expect(link.textContent).toBe('Docs');
	});

	const expandDetails = (handle) => {
		const summary = handle.container.querySelector(
			'.fotogrids-codearea-error-summary'
		);
		click(summary);
		return handle.container.querySelector(
			'.fotogrids-codearea-error-details'
		).textContent;
	};

	it('surfaces a CSS mismatched-braces error from the value', async () => {
		const handle = renderElement(
			build({ key: 'css', label: 'CSS', language: 'css' }, '.a { color: red;')
		);
		await flush();
		expect(expandDetails(handle)).toMatch(/Mismatched braces/);
	});

	it('surfaces a CSS missing-semicolon error', async () => {
		const handle = renderElement(
			build(
				{ key: 'css', label: 'CSS', language: 'css' },
				'.a {\ncolor: red\n}'
			)
		);
		await flush();
		expect(expandDetails(handle)).toMatch(/Missing semicolon/);
	});

	it('surfaces a JavaScript syntax error', async () => {
		const handle = renderElement(
			build({ key: 'js', label: 'JS', language: 'js' }, 'function( {')
		);
		await flush();
		expect(expandDetails(handle)).toMatch(
			/JavaScript|parenthes|braces/i
		);
	});

	it('reports no errors for valid CSS', async () => {
		const handle = renderElement(
			build(
				{ key: 'css', label: 'CSS', language: 'css' },
				'.a { color: red; }'
			)
		);
		await flush();
		expect(handle.container.textContent).not.toMatch(/Mismatched/);
	});

	it('expands and collapses the error summary', async () => {
		const handle = renderElement(
			build({ key: 'css', label: 'CSS', language: 'css' }, '.a { color: red;')
		);
		await flush();
		const summary = handle.container.querySelector(
			'.fotogrids-codearea-error-summary'
		);
		click(summary);
		expect(
			handle.container.querySelector(
				'.fotogrids-codearea-error-summary-expanded'
			)
		).not.toBeNull();
	});

	it('shows a Locked badge from field state', () => {
		const { container } = renderElement(
			build({ key: 'css', label: 'L' }, '', {
				getFieldState: () => 'locked',
			})
		);
		expect(
			container.querySelector('.fotogrids-pro-badge').textContent
		).toBe('Locked');
	});
});

describe('renderCodeArea CodeMirror integration', () => {
	// Minimal CodeMirror stub: enough for initializeEditor + the CSS selector
	// highlight plugin to run without a real editor.
	let editorInstances;
	const makeCodeMirror = () => {
		editorInstances = [];
		class EditorView {
			constructor(config) {
				this.config = config;
				this.state = { doc: { toString: () => config.doc, length: 0 } };
				this.dispatch = jest.fn();
				this.destroy = jest.fn();
				editorInstances.push(this);
			}
		}
		EditorView.theme = jest.fn(() => ({ extension: 'theme' }));
		EditorView.updateListener = { of: jest.fn((cb) => ({ cb })) };
		EditorView.editable = { of: jest.fn((v) => ({ editable: v })) };
		return {
			EditorView,
			basicSetup: { extension: 'basic' },
			css: jest.fn(() => ({ extension: 'css' })),
			javascript: jest.fn(() => ({ extension: 'js' })),
			RangeSetBuilder: class {
				add() {}
				finish() {
					return { ranges: [] };
				}
			},
			Decoration: { mark: jest.fn(() => ({ class: 'm' })) },
			ViewPlugin: {
				fromClass: jest.fn(() => ({ extension: 'plugin' })),
			},
		};
	};

	afterEach(() => {
		delete window.FotoGridsCodeMirror;
	});

	it('mounts a CodeMirror editor for a CSS field when CM is available', () => {
		window.FotoGridsCodeMirror = makeCodeMirror();
		renderElement(
			build({ key: 'css', label: 'CSS', language: 'css' }, '.a{}')
		);
		expect(editorInstances.length).toBe(1);
		expect(window.FotoGridsCodeMirror.css).toHaveBeenCalled();
	});

	it('mounts a CodeMirror editor for a JS field', () => {
		window.FotoGridsCodeMirror = makeCodeMirror();
		renderElement(
			build({ key: 'js', label: 'JS', language: 'js' }, 'var x=1;')
		);
		expect(window.FotoGridsCodeMirror.javascript).toHaveBeenCalled();
		expect(editorInstances.length).toBe(1);
	});

	it('initializes once CodeMirror becomes ready via the event', () => {
		// CM absent on first render; the component waits for the ready event
		renderElement(
			build({ key: 'css', label: 'CSS', language: 'css' }, '.a{}')
		);
		window.FotoGridsCodeMirror = makeCodeMirror();
		act(() => {
			window.dispatchEvent(new window.Event('fotogridsCodeMirrorReady'));
		});
		expect(editorInstances.length).toBeGreaterThanOrEqual(1);
	});
});
