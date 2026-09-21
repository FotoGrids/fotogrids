/**
 * Tests for the breakpoint surface of public/render/internal/runtime/runtime.js:
 * reading the site configuration off a wrapper, classifying the visitor under
 * each detection mode, the html[data-fg-breakpoint] attribute device mode
 * relies on, and scopeCss().
 */

const MODULE = '../../../public/render/internal/runtime/runtime';

function addWrapper({ widths = '600 900', detect = 'viewport' } = {}) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.dataset.fgGalleryId = '3';
	if (widths !== null) {
		el.setAttribute('data-fg-breakpoints', widths);
		el.setAttribute('data-fg-breakpoint-detect', detect);
	}
	document.body.appendChild(el);
	return el;
}

/** Answers max-width queries from a fixed width and pointer queries from a flag. */
function stubMedia({ width = 1280, coarse = false } = {}) {
	window.matchMedia = jest.fn((query) => {
		const max = /max-width:\s*(\d+)px/.exec(query);
		if (max) {
			return { matches: width <= parseInt(max[1], 10) };
		}
		if (query.includes('pointer: coarse')) {
			return { matches: coarse };
		}
		return { matches: false };
	});
}

function stubScreen(width, height) {
	Object.defineProperty(window, 'screen', {
		configurable: true,
		value: { width, height },
	});
}

function loadRuntime() {
	jest.isolateModules(() => {
		require(MODULE);
	});
}

describe('runtime breakpoints', () => {
	const originalScreen = window.screen;

	beforeEach(() => {
		document.body.innerHTML = '';
		document.documentElement.removeAttribute('data-fg-breakpoint');
		delete window.FotoGrids;
		delete window.navigator.userAgentData;
	});

	afterEach(() => {
		delete window.matchMedia;
		Object.defineProperty(window, 'screen', {
			configurable: true,
			value: originalScreen,
		});
	});

	it('reads the configuration from the first wrapper', () => {
		addWrapper({ widths: '600 900', detect: 'device' });
		stubMedia();
		loadRuntime();

		expect(window.FotoGrids.getBreakpoints()).toEqual({
			mobile: 600,
			tablet: 900,
			detect: 'device',
		});
	});

	it('falls back to the default widths when no wrapper carries them', () => {
		addWrapper({ widths: null });
		stubMedia();
		loadRuntime();

		expect(window.FotoGrids.getBreakpoints()).toEqual({
			mobile: 767,
			tablet: 1024,
			detect: 'viewport',
		});
	});

	describe('viewport detection', () => {
		it.each([
			[500, 'mobile'],
			[600, 'mobile'],
			[601, 'tablet'],
			[900, 'tablet'],
			[901, 'desktop'],
		])('classifies a %ipx viewport as %s', (width, expected) => {
			addWrapper();
			stubMedia({ width });
			loadRuntime();

			expect(window.FotoGrids.activeBreakpoint()).toBe(expected);
		});

		it('leaves html[data-fg-breakpoint] unset', () => {
			addWrapper();
			stubMedia({ width: 500 });
			loadRuntime();

			expect(
				document.documentElement.hasAttribute('data-fg-breakpoint')
			).toBe(false);
		});
	});

	describe('device detection', () => {
		it('treats a device without a coarse pointer as desktop at any window width', () => {
			addWrapper({ detect: 'device' });
			stubMedia({ width: 400, coarse: false });
			stubScreen(1920, 1080);
			loadRuntime();

			expect(window.FotoGrids.activeBreakpoint()).toBe('desktop');
			expect(
				document.documentElement.getAttribute('data-fg-breakpoint')
			).toBe('desktop');
		});

		it('keeps a phone mobile in landscape', () => {
			addWrapper({ detect: 'device' });
			stubMedia({ width: 844, coarse: true });
			stubScreen(844, 390);
			loadRuntime();

			expect(window.FotoGrids.activeBreakpoint()).toBe('mobile');
		});

		it('places a touch tablet by the short side of its screen', () => {
			addWrapper({ detect: 'device' });
			stubMedia({ width: 1180, coarse: true });
			stubScreen(1180, 820);
			loadRuntime();

			expect(window.FotoGrids.activeBreakpoint()).toBe('tablet');
			expect(
				document.documentElement.getAttribute('data-fg-breakpoint')
			).toBe('tablet');
		});

		it('trusts a mobile User-Agent Client Hint', () => {
			addWrapper({ detect: 'device' });
			stubMedia({ width: 1280, coarse: false });
			window.navigator.userAgentData = { mobile: true };
			loadRuntime();

			expect(window.FotoGrids.activeBreakpoint()).toBe('mobile');
		});
	});

	describe('scopeCss', () => {
		it('emits a max-width block under viewport detection', () => {
			addWrapper({ widths: '600 900' });
			stubMedia();
			loadRuntime();

			expect(window.FotoGrids.scopeCss('tablet', '.s', '--v: 1;')).toBe(
				'@media (max-width: 900px) { .s { --v: 1; } }'
			);
		});

		it('selects on the device class, with a max-width fallback, under device detection', () => {
			addWrapper({ widths: '600 900', detect: 'device' });
			stubMedia();
			stubScreen(1920, 1080);
			loadRuntime();

			const css = window.FotoGrids.scopeCss('tablet', '.s', '--v: 1;');

			expect(css).toContain(
				'html[data-fg-breakpoint="tablet"] .s, html[data-fg-breakpoint="mobile"] .s { --v: 1; }'
			);
			expect(css).toContain(
				'@media (max-width: 900px) { html:not([data-fg-breakpoint]) .s { --v: 1; } }'
			);
		});
	});
});
