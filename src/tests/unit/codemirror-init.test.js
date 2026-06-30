/**
 * Tests for admin/src/codemirror-init.js
 *
 * The module lazy-loads CodeMirror via dynamic import() and exposes the pieces
 * on window.FotoGridsCodeMirror, then fires a ready event. The @codemirror/*
 * packages are mocked so the test doesn't pull the real (ESM) editor in.
 */

jest.mock(
	'codemirror',
	() => ({ EditorView: class {}, basicSetup: {} }),
	{ virtual: true }
);
jest.mock('@codemirror/lang-css', () => ({ css: () => ({}) }), {
	virtual: true,
});
jest.mock(
	'@codemirror/lang-javascript',
	() => ({ javascript: () => ({}) }),
	{ virtual: true }
);
jest.mock(
	'@codemirror/state',
	() => ({ RangeSetBuilder: class {} }),
	{ virtual: true }
);
jest.mock(
	'@codemirror/view',
	() => ({ Decoration: {}, ViewPlugin: {} }),
	{ virtual: true }
);

const flush = async () => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('codemirror-init', () => {
	afterEach(() => {
		delete window.FotoGridsCodeMirror;
	});

	it('loads CodeMirror modules and fires the ready event', async () => {
		const ready = jest.fn();
		window.addEventListener('fotogridsCodeMirrorReady', ready);

		jest.isolateModules(() => require('@/admin/src/codemirror-init'));
		await flush();

		expect(window.FotoGridsCodeMirror).toBeDefined();
		expect(typeof window.FotoGridsCodeMirror.css).toBe('function');
		expect(window.FotoGridsCodeMirror.EditorView).toBeDefined();
		expect(ready).toHaveBeenCalled();
		window.removeEventListener('fotogridsCodeMirrorReady', ready);
	});
});
