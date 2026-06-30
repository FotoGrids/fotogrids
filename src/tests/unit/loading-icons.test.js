/**
 * Tests for admin/plain/loading-icons.js (getLoadingIconSvg / randomId).
 *
 * The module runs an async bootstrap IIFE on first load. We require() it (not
 * static-import) so the globals below are in place first and that one-time
 * bootstrap resolves quietly instead of retrying ~5s and warning into a later
 * test's output.
 */
window.fotogridsAdmin = { pluginUrl: 'https://x/plugin/' };
global.fetch = jest.fn(() =>
	Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
);

const mod = require('@/admin/plain/loading-icons');
const LoadingIcons = mod.default || mod;
const { getLoadingIconSvg, randomId } = mod;

describe('loading-icons', () => {
	beforeEach(() => {
		// seed a couple of icon templates on the shared object
		LoadingIcons.spinner = '<svg id="__FG_ID__-spinner"></svg>';
		LoadingIcons['12-dots'] = '<svg id="__FG_ID__-dots"></svg>';
	});

	it('returns the SVG for a known key', () => {
		expect(getLoadingIconSvg('12-dots')).toContain('dots');
	});

	it('falls back to the spinner for an unknown key', () => {
		expect(getLoadingIconSvg('nope')).toContain('spinner');
	});

	it('replaces __FG_ID__ with the instance id', () => {
		const out = getLoadingIconSvg('spinner', 'abc123');
		expect(out).toContain('abc123-spinner');
		expect(out).not.toContain('__FG_ID__');
	});

	it('returns an empty string when nothing matches and no spinner exists', () => {
		delete LoadingIcons.spinner;
		expect(getLoadingIconSvg('missing')).toBe('');
	});

	it('randomId returns a short unique-ish string', () => {
		const a = randomId();
		const b = randomId();
		expect(typeof a).toBe('string');
		expect(a.length).toBeGreaterThan(0);
		expect(a).not.toBe(b);
	});

	it('exposes the API on window.FotoGridsLoadingIcons', () => {
		expect(typeof window.FotoGridsLoadingIcons.getLoadingIconSvg).toBe(
			'function'
		);
		expect(typeof window.FotoGridsLoadingIcons.randomId).toBe('function');
	});
});

describe('loading-icons bootstrap (async IIFE)', () => {
	const flushMicro = async (n = 8) => {
		for (let i = 0; i < n; i++) await Promise.resolve();
	};

	beforeEach(() => {
		jest.useFakeTimers();
		window.fotogridsAdmin = { pluginUrl: 'https://x/plugin/' };
		window.FotoGridsIcons = {};
	});

	afterEach(() => {
		jest.useRealTimers();
		delete window.fotogridsAdmin;
		delete window.FotoGridsIcons;
	});

	const load = () =>
		jest.isolateModules(() => require('@/admin/plain/loading-icons'));

	it('fetches the icon JSON and merges it into FotoGridsIcons', async () => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ spinner: '<svg>s</svg>' }),
			})
		);
		load();
		await flushMicro();
		jest.advanceTimersByTime(250);
		await flushMicro();
		expect(global.fetch).toHaveBeenCalledWith(
			'https://x/plugin/config/loading-icons-smil.json'
		);
		// merged under the loading_icon_ prefix into the shared icon map
		expect(window.FotoGridsIcons.loading_icon_spinner).toBe('<svg>s</svg>');
	});

	it('warns when the JSON request is not ok', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
		load();
		await flushMicro();
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Could not load')
		);
		warn.mockRestore();
	});

	it('warns when the fetch throws', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() => Promise.reject(new Error('net')));
		load();
		await flushMicro();
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Error loading'),
			expect.any(Error)
		);
		warn.mockRestore();
	});

	it('warns and bails when the plugin URL never resolves', async () => {
		delete window.fotogridsAdmin;
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn();
		load();
		// the retry loop polls 50x at 100ms before giving up
		for (let i = 0; i < 55; i++) {
			jest.advanceTimersByTime(100);
			await flushMicro(2);
		}
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Plugin URL not available')
		);
		expect(global.fetch).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('schedules a deferred merge when FotoGridsIcons already exists', () => {
		global.fetch = jest.fn(() => new Promise(() => {}));
		load();
		// the setTimeout(mergeLoadingIcons, 200) branch fires without throwing
		expect(() => jest.advanceTimersByTime(300)).not.toThrow();
	});
});
