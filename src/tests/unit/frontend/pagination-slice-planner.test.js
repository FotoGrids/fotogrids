/**
 * Tests for the slice-planner contract in
 * public/render/features/pagination/pagination-core.js: a layout that knows its
 * own page cuts registers a planner, and every request for that gallery asks for
 * an exact slice (offset + length) instead of a page number.
 */

const MODULE = '../../../public/render/features/pagination/pagination-core';

function installRuntime(breakpoint = 'desktop') {
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

function itemsHtml(from, count) {
	let html = '';
	for (let i = from; i < from + count; i++) {
		html += `<figure class="fg-item" data-fg-sequence-index="${i}"></figure>`;
	}
	return html;
}

function makeGallery({ method = 'load_more', shown = 12, total = 3, current = 1 } = {}) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.dataset.fgGalleryId = '5';
	el.dataset.fgPaginated = 'true';
	el.dataset.fgPaginationMethod = method;
	el.dataset.fgPageCurrent = String(current);
	el.dataset.fgPageTotal = String(total);
	el.dataset.fgPageSize = String(shown);
	el.dataset.fgRenderUrl = 'https://example.com/wp-json/fotogrids/v1/gallery/render';
	el.dataset.fgRenderNonce = 'n';
	el.innerHTML = `<div class="fg-justified-track" data-fg-items-root="true">${itemsHtml(0, shown)}</div>`;
	document.body.appendChild(el);
	return el;
}

function payload(offset, length, extra = {}) {
	return {
		html: `<div class="fg-justified-track" data-fg-items-root="true">${itemsHtml(offset, length)}</div>`,
		css: {},
		page: 1,
		page_size: length,
		total_pages: 1,
		has_more: false,
		offset,
		length,
		...extra,
	};
}

function stubFetch(...responses) {
	const queue = responses.slice();
	window.fetch = jest.fn(() => {
		const next = queue.length > 1 ? queue.shift() : queue[0];
		return Promise.resolve({ ok: true, json: () => Promise.resolve(next) });
	});
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function body(call = 0) {
	return JSON.parse(window.fetch.mock.calls[call][1].body);
}

function loadModule() {
	jest.isolateModules(() => {
		require(MODULE);
	});
}

function planner(overrides = {}) {
	return {
		next: jest.fn((loaded) => (loaded < 40 ? { offset: loaded, length: 13 } : null)),
		page: jest.fn((n) => ({ offset: (n - 1) * 13, length: 13 })),
		pageContaining: jest.fn((index) => Math.floor(index / 13) + 1),
		total: jest.fn(() => 4),
		...overrides,
	};
}

describe('pagination slice planner', () => {
	let pagination;

	beforeEach(() => {
		document.body.innerHTML = '';
		installRuntime('mobile');
		loadModule();
		pagination = window.FotoGrids.modules.pagination;
	});

	afterEach(() => {
		delete window.FotoGrids;
		delete window.fetch;
		jest.useRealTimers();
	});

	test('the core exposes setSlicePlanner and replan', () => {
		expect(typeof pagination.setSlicePlanner).toBe('function');
		expect(typeof pagination.replan).toBe('function');
	});

	test('CLI-01: an append asks the planner for the slice after the items on screen, at the live breakpoint', async () => {
		const g = makeGallery({ shown: 12 });
		const p = planner();
		pagination.setSlicePlanner(g, p);
		stubFetch(payload(12, 13));

		await pagination.goToPage(g, 2, { mode: 'append' });

		expect(p.next).toHaveBeenCalledWith(12);
		expect(body()).toMatchObject({ offset: 12, length: 13, breakpoint: 'mobile' });
		expect(g.querySelectorAll('.fg-item')).toHaveLength(25);
	});

	test('CLI-01: items still marked as overflow are not counted as loaded', async () => {
		const g = makeGallery({ shown: 12 });
		const root = g.querySelector('[data-fg-items-root]');
		root.insertAdjacentHTML(
			'beforeend',
			'<figure class="fg-item" data-fg-sequence-index="12" data-fg-overflow></figure><figure class="fg-item" data-fg-sequence-index="13" data-fg-overflow></figure>'
		);
		const p = planner();
		pagination.setSlicePlanner(g, p);
		stubFetch(payload(12, 13));

		await pagination.goToPage(g, 2, { mode: 'append' });

		expect(p.next).toHaveBeenCalledWith(12);
		expect(g.querySelectorAll('[data-fg-overflow]')).toHaveLength(0);
		const indices = Array.from(g.querySelectorAll('.fg-item')).map((n) => Number(n.dataset.fgSequenceIndex));
		expect(new Set(indices).size).toBe(indices.length);
	});

	test('CLI-02: a page jump asks the planner for that page\'s slice', async () => {
		const g = makeGallery({ method: 'pages' });
		const p = planner();
		pagination.setSlicePlanner(g, p);
		stubFetch(payload(26, 13));

		await pagination.goToPage(g, 3, { mode: 'replace' });

		expect(p.page).toHaveBeenCalledWith(3);
		expect(body()).toMatchObject({ offset: 26, length: 13 });
		expect(g.dataset.fgPageCurrent).toBe('3');
		expect(g.dataset.fgPageTotal).toBe('4');
	});

	test('CLI-03: a filter change asks for a fresh page 1 with the new sequence\'s aspect ratios', async () => {
		const g = makeGallery();
		pagination.setSlicePlanner(g, planner());
		stubFetch(payload(0, 7, { aspects: [1.5, 1, 0.75, 1.5, 1.5, 2, 1] }));

		await pagination.swapToFilterState(g);

		expect(body()).toMatchObject({ with_aspects: true });
		expect(body()).not.toHaveProperty('offset');
	});

	test('CLI-15: a response carrying aspect ratios is handed to the layout', async () => {
		const g = makeGallery();
		pagination.setSlicePlanner(g, planner());
		const seen = jest.fn();
		g.addEventListener('fotogrids:sequence_changed', (e) => seen(e.detail));
		stubFetch(payload(0, 3, { aspects: [1.5, 1, 0.75] }));

		await pagination.swapToFilterState(g);

		expect(seen).toHaveBeenCalledWith(expect.objectContaining({ aspects: [1.5, 1, 0.75] }));
	});

	test('CLI-05: replan on an append method makes no request', async () => {
		const g = makeGallery({ method: 'load_more' });
		pagination.setSlicePlanner(g, planner());
		stubFetch(payload(0, 13));

		pagination.replan(g);
		await flush();

		expect(window.fetch).not.toHaveBeenCalled();
	});

	test('CLI-06: replan on Page Buttons makes no request when the current page\'s slice is unchanged', async () => {
		const g = makeGallery({ method: 'pages', shown: 13 });
		pagination.setSlicePlanner(g, planner());
		stubFetch(payload(0, 13));

		pagination.replan(g);
		await flush();

		expect(window.fetch).not.toHaveBeenCalled();
	});

	test('CLI-07: replan on Page Buttons moves to the page holding the first item on screen when its slice changed', async () => {
		const g = makeGallery({ method: 'pages', shown: 13, current: 2 });
		g.querySelector('[data-fg-items-root]').innerHTML = itemsHtml(13, 13);
		const p = planner({
			pageContaining: jest.fn(() => 2),
			page: jest.fn(() => ({ offset: 10, length: 10 })),
			total: jest.fn(() => 5),
		});
		pagination.setSlicePlanner(g, p);
		stubFetch(payload(10, 10, { page: 2 }));

		pagination.replan(g);
		await flush();
		await flush();

		expect(p.pageContaining).toHaveBeenCalledWith(13);
		expect(window.fetch).toHaveBeenCalledTimes(1);
		expect(body()).toMatchObject({ offset: 10, length: 10 });
		expect(g.dataset.fgPageCurrent).toBe('2');
		expect(g.dataset.fgPageTotal).toBe('5');
	});

	test('CLI-08: only the last of several replans is painted', async () => {
		const g = makeGallery({ method: 'pages', shown: 13, current: 2 });
		g.querySelector('[data-fg-items-root]').innerHTML = itemsHtml(13, 13);
		let offset = 10;
		const p = planner({
			pageContaining: jest.fn(() => 2),
			page: jest.fn(() => ({ offset, length: 10 })),
		});
		pagination.setSlicePlanner(g, p);
		stubFetch(payload(10, 10), payload(11, 10), payload(12, 10));

		pagination.replan(g);
		offset = 11;
		pagination.replan(g);
		offset = 12;
		pagination.replan(g);
		await flush();
		await flush();

		const first = g.querySelector('.fg-item');
		expect(first.dataset.fgSequenceIndex).toBe('12');
	});

	test('CLI-09: the load after an in-flight append starts after everything that append placed', async () => {
		const g = makeGallery({ shown: 12 });
		const p = planner();
		pagination.setSlicePlanner(g, p);
		stubFetch(payload(12, 13), payload(25, 13));

		const first = pagination.goToPage(g, 2, { mode: 'append' });
		pagination.replan(g);
		await first;
		await pagination.goToPage(g, 3, { mode: 'append' });

		expect(p.next).toHaveBeenLastCalledWith(25);
		expect(body(1)).toMatchObject({ offset: 25 });
	});

	test('CLI-11: state reads totals and has-more from the planner', () => {
		const g = makeGallery({ shown: 12, total: 1 });
		pagination.setSlicePlanner(g, planner());

		const s = pagination.state(g);

		expect(s.totalPages).toBe(4);
		expect(s.hasMore).toBe(true);
	});

	test('CLI-11: has-more is false once the planner has nothing after the items on screen', () => {
		const g = makeGallery({ shown: 40, total: 4, current: 3 });
		pagination.setSlicePlanner(g, planner());

		expect(pagination.state(g).hasMore).toBe(false);
	});

	test('CLI-12: a gallery without a planner still requests by page number', async () => {
		const g = makeGallery();
		stubFetch(payload(12, 12, { page: 2, total_pages: 3, has_more: true }));

		await pagination.goToPage(g, 2, { mode: 'append' });

		expect(body()).toMatchObject({ page: 2 });
		expect(body()).not.toHaveProperty('offset');
		expect(body()).not.toHaveProperty('length');
	});
});
