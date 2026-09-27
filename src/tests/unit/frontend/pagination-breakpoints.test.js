/**
 * Tests for how public/render/features/pagination/pagination-core.js pages a
 * gallery at the visitor's breakpoint: re-requesting page 1 when the visitor's
 * breakpoint pages differently from the server render, keeping appends on the
 * breakpoint of the view they extend, and adopting a page 1 another module
 * fetched.
 */

const MODULE = '../../../public/render/features/pagination/pagination-core';

function installRuntime(breakpoint) {
	const subscribers = [];
	window.FotoGrids = {
		modules: {},
		activeBreakpoint: jest.fn(() => breakpoint),
		onGallery(cb) {
			subscribers.push(cb);
		},
		boot() {
			document
				.querySelectorAll('.fotogrids-gallery')
				.forEach((el) => subscribers.forEach((cb) => cb(el)));
		},
	};
}

function makeGallery({ sizes = '24 18 12', randomMode = null } = {}) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.dataset.fgGalleryId = '5';
	el.dataset.fgPaginated = 'true';
	el.dataset.fgPageCurrent = '1';
	el.dataset.fgPageTotal = '3';
	el.dataset.fgPageSize = '24';
	el.dataset.fgRenderUrl = 'https://example.com/wp-json/fotogrids/v1/gallery/render';
	el.dataset.fgRenderNonce = 'n';
	if (sizes) {
		el.dataset.fgPageSizes = sizes;
	}
	if (randomMode) {
		el.setAttribute('data-fg-random-mode', randomMode);
	}
	el.innerHTML =
		'<div class="fg-grid-track" data-fg-items-root="true"><figure class="fg-item"></figure></div>';
	document.body.appendChild(el);
	return el;
}

function stubFetch(payload) {
	window.fetch = jest.fn(() =>
		Promise.resolve({ ok: true, json: () => Promise.resolve(payload) })
	);
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function requestBody(call = 0) {
	return JSON.parse(window.fetch.mock.calls[call][1].body);
}

function loadModule() {
	jest.isolateModules(() => {
		require(MODULE);
	});
}

const MOBILE_PAGE = {
	html: '<div class="fg-grid-track" data-fg-items-root="true"><figure class="fg-item"></figure></div>',
	css: {},
	page: 1,
	page_size: 12,
	total_pages: 6,
	has_more: true,
};

describe('pagination breakpoints', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		delete window.FotoGrids;
		delete window.fetch;
	});

	it('re-requests page 1 at the mobile breakpoint when it pages differently', async () => {
		installRuntime('mobile');
		const gallery = makeGallery();
		stubFetch(MOBILE_PAGE);

		loadModule();
		window.FotoGrids.boot();
		await flush();

		expect(window.fetch).toHaveBeenCalledTimes(1);
		expect(requestBody()).toMatchObject({ page: 1, breakpoint: 'mobile' });
		expect(gallery.dataset.fgViewBreakpoint).toBe('mobile');
		expect(gallery.dataset.fgPageSize).toBe('12');
		expect(gallery.dataset.fgPageTotal).toBe('6');
	});

	it('marks the re-request as a reflow so the page is not scrolled', async () => {
		installRuntime('mobile');
		const gallery = makeGallery();
		stubFetch(MOBILE_PAGE);
		const seen = [];
		gallery.addEventListener('fotogrids:page_changed', (event) => {
			seen.push(event.detail.reflow);
		});

		loadModule();
		window.FotoGrids.boot();
		await flush();

		expect(seen).toEqual([true]);
	});

	it('leaves the server render alone on desktop', async () => {
		installRuntime('desktop');
		makeGallery();
		stubFetch(MOBILE_PAGE);

		loadModule();
		window.FotoGrids.boot();
		await flush();

		expect(window.fetch).not.toHaveBeenCalled();
	});

	it('leaves the server render alone when the breakpoint pages the same', async () => {
		installRuntime('tablet');
		makeGallery({ sizes: '24 24 12' });
		stubFetch(MOBILE_PAGE);

		loadModule();
		window.FotoGrids.boot();
		await flush();

		expect(window.fetch).not.toHaveBeenCalled();
	});

	it('leaves page 1 to a random-sort refetch', async () => {
		installRuntime('mobile');
		makeGallery({ randomMode: 'refetch' });
		stubFetch(MOBILE_PAGE);

		loadModule();
		window.FotoGrids.boot();
		await flush();

		expect(window.fetch).not.toHaveBeenCalled();
	});

	it('appends at the breakpoint of the view it extends', async () => {
		installRuntime('mobile');
		const gallery = makeGallery({ sizes: null });
		stubFetch({ ...MOBILE_PAGE, page: 2, page_size: 24 });

		loadModule();
		window.FotoGrids.boot();
		await window.FotoGrids.modules.pagination.goToPage(gallery, 2, {
			mode: 'append',
		});

		expect(requestBody()).toMatchObject({ page: 2, breakpoint: 'desktop' });
	});

	it('adopts a page 1 another module fetched', () => {
		installRuntime('mobile');
		const gallery = makeGallery();
		stubFetch(MOBILE_PAGE);

		loadModule();
		window.FotoGrids.modules.pagination.adopt(gallery, MOBILE_PAGE, 'mobile');

		expect(gallery.dataset.fgViewBreakpoint).toBe('mobile');
		expect(gallery.dataset.fgPageTotal).toBe('6');
		expect(gallery.dataset.fgPageSize).toBe('12');
	});
});
