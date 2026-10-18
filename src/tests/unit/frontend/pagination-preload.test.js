/**
 * Tests for Preload Next Page in public/render/features/pagination/pagination-core.js:
 * a preloaded page is held per gallery under its exact request and used by the
 * next request for that page, so with preload on each page is requested once.
 *
 * Case IDs refer to the test plan for FotoGrids/backstage#467.
 */

const MODULE = '../../../public/render/features/pagination/pagination-core';

let idleQueue;
let filterState;

function installRuntime(breakpoint = 'desktop', { idle = true } = {}) {
	const subscribers = [];
	let active = breakpoint;
	window.FotoGrids = {
		modules: {},
		activeBreakpoint: jest.fn(() => active),
		setBreakpoint(bp) {
			active = bp;
		},
		onGallery(cb) {
			subscribers.push(cb);
		},
		boot() {
			document
				.querySelectorAll('.fotogrids-gallery')
				.forEach((el) => subscribers.forEach((cb) => cb(el)));
		},
	};
	idleQueue = [];
	if (idle) {
		window.requestIdleCallback = jest.fn((cb) => {
			idleQueue.push(cb);
		});
	} else {
		delete window.requestIdleCallback;
	}
}

function installFilters() {
	filterState = {};
	window.FotoGrids.modules.filters = {
		getActive: () => ({ ...filterState }),
		fingerprint: (map) =>
			Object.keys(map)
				.sort()
				.map((k) => k + '=' + map[k])
				.join('&'),
	};
}

function makeGallery({
	id = '5',
	preload = true,
	total = 5,
	sizes = null,
	randomMode = null,
	strategy = null,
} = {}) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.dataset.fgGalleryId = id;
	el.dataset.fgPaginated = 'true';
	el.dataset.fgPageCurrent = '1';
	el.dataset.fgPageTotal = String(total);
	el.dataset.fgPageSize = '12';
	el.dataset.fgPaginationPreload = preload ? 'true' : 'false';
	el.dataset.fgRenderUrl =
		'https://example.com/wp-json/fotogrids/v1/gallery/render';
	el.dataset.fgRenderNonce = 'n';
	if (sizes) {
		el.dataset.fgPageSizes = sizes;
	}
	if (randomMode) {
		el.setAttribute('data-fg-random-mode', randomMode);
	}
	if (strategy) {
		el.dataset.fgFilterStrategy = strategy;
	}
	el.innerHTML =
		'<div class="fg-grid-track" data-fg-items-root="true"><figure class="fg-item" data-page="1"></figure></div>';
	document.body.appendChild(el);
	return el;
}

function pagePayload(body, total) {
	return {
		html:
			'<div class="fg-grid-track" data-fg-items-root="true"><figure class="fg-item" data-page="' +
			body.page +
			'" data-gallery="' +
			body.gallery_id +
			'"></figure></div>',
		css: {},
		page: body.page,
		page_size: 12,
		total_pages: total,
		has_more: body.page < total,
	};
}

/**
 * Stubs fetch. Every request resolves with the page it asked for, unless a
 * `respond` override returns something else (a Promise, or a payload).
 */
function stubFetch({ total = 5, respond = null } = {}) {
	window.fetch = jest.fn((url, init) => {
		const body = JSON.parse(init.body);
		const custom = respond ? respond(body, init) : undefined;
		if (custom !== undefined) {
			return custom;
		}
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve(pagePayload(body, total)),
		});
	});
}

function deferredResponse() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function okResponse(payload) {
	return { ok: true, json: () => Promise.resolve(payload) };
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

async function runIdle() {
	const queued = idleQueue.splice(0);
	queued.forEach((cb) => cb({ didTimeout: false, timeRemaining: () => 50 }));
	await flush();
}

function bodies() {
	return window.fetch.mock.calls.map((call) => JSON.parse(call[1].body));
}

function requestedPages() {
	return bodies().map((b) => b.page);
}

function shownPages(gallery) {
	return Array.from(gallery.querySelectorAll('.fg-item')).map(
		(el) => el.dataset.page
	);
}

function loadModule() {
	jest.isolateModules(() => {
		require(MODULE);
	});
}

function api() {
	return window.FotoGrids.modules.pagination;
}

/** Load More / Endless Scroll: append the next page, as load-more.js does. */
function loadMore(gallery) {
	return api().goToPage(gallery, api().state(gallery).page + 1, {
		mode: 'append',
	});
}

/** Page Buttons: show one page, as page-buttons.js does. */
function showPage(gallery, page) {
	return api().goToPage(gallery, page, { mode: 'replace' });
}

beforeEach(() => {
	document.body.innerHTML = '';
	delete window.FotoGrids;
	delete window.fetch;
	delete window.requestIdleCallback;
	jest.restoreAllMocks();
});

describe('request counts (§4)', () => {
	it('CNT-01: Load More twice requests pages 2, 3, 4 with preload on, 2, 3 with it off', async () => {
		for (const [preload, expected] of [
			[true, [2, 3, 4]],
			[false, [2, 3]],
		]) {
			document.body.innerHTML = '';
			installRuntime();
			const gallery = makeGallery({ preload });
			stubFetch();
			loadModule();
			window.FotoGrids.boot();

			await runIdle();
			await loadMore(gallery);
			await runIdle();
			await loadMore(gallery);
			await runIdle();

			expect(requestedPages()).toEqual(expected);
			expect(shownPages(gallery)).toEqual(['1', '2', '3']);
		}
	});

	it('CNT-02: no preload after the last page', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		for (let i = 0; i < 4; i++) {
			await runIdle();
			await loadMore(gallery);
		}
		await runIdle();

		expect(requestedPages()).toEqual([2, 3, 4, 5]);
		expect(shownPages(gallery)).toEqual(['1', '2', '3', '4', '5']);
		expect(api().state(gallery).hasMore).toBe(false);
	});

	it('CNT-04: Page Buttons Next twice requests pages 2, 3, 4', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		await runIdle();
		await showPage(gallery, 2);
		await runIdle();
		await showPage(gallery, 3);
		await runIdle();

		expect(requestedPages()).toEqual([2, 3, 4]);
		expect(shownPages(gallery)).toEqual(['3']);
	});

	it('CNT-05: a jump to page 4 leaves the held page 2 unused and preloads page 5', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		await runIdle();
		await showPage(gallery, 4);
		await runIdle();
		await showPage(gallery, 5);

		expect(requestedPages()).toEqual([2, 4, 5]);
		expect(shownPages(gallery)).toEqual(['5']);
	});

	it('CNT-06: Next then Prev requests 2, 3, 1, 2', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		await runIdle();
		await showPage(gallery, 2);
		await runIdle();
		await showPage(gallery, 1);
		await runIdle();

		expect(requestedPages()).toEqual([2, 3, 1, 2]);
		expect(shownPages(gallery)).toEqual(['1']);
	});

	it('CNT-07: a gallery that fits one page preloads nothing', async () => {
		installRuntime();
		makeGallery({ total: 1 });
		stubFetch({ total: 1 });
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		expect(window.fetch).not.toHaveBeenCalled();
		expect(window.requestIdleCallback).not.toHaveBeenCalled();
	});
});

describe('invariants (§3)', () => {
	async function observePageTwo(preload) {
		document.body.innerHTML = '';
		installRuntime();
		const gallery = makeGallery({ preload });
		stubFetch();
		const events = [];
		gallery.addEventListener('fotogrids:items_inserted', (e) =>
			events.push(['items_inserted', e.detail.items.length])
		);
		gallery.addEventListener('fotogrids:page_changed', (e) =>
			events.push(['page_changed', { ...e.detail, galleryEl: null }])
		);
		loadModule();
		const changes = [];
		api().onChange(gallery, (d) => changes.push({ ...d, galleryEl: null }));
		window.FotoGrids.boot();
		await runIdle();
		const result = await loadMore(gallery);
		return {
			result,
			html: gallery.innerHTML,
			data: { ...gallery.dataset, fgPaginationPreload: null },
			events,
			changes,
		};
	}

	it('INV-4: a held page paints exactly what a fresh fetch paints', async () => {
		const held = await observePageTwo(true);
		const fresh = await observePageTwo(false);

		expect(held).toEqual(fresh);
	});

	it('INV-5: a held page is used once', async () => {
		installRuntime();
		const gallery = makeGallery({ preload: false });
		stubFetch();
		loadModule();

		await api().prefetch(gallery, 2);
		await showPage(gallery, 2);
		await showPage(gallery, 2);

		expect(requestedPages()).toEqual([2, 2]);
	});

	it('INV-6: a gallery holds one page; a newer preload replaces it', async () => {
		installRuntime();
		const gallery = makeGallery({ preload: false });
		stubFetch();
		loadModule();

		await api().prefetch(gallery, 2);
		await api().prefetch(gallery, 3);
		await showPage(gallery, 2);

		expect(requestedPages()).toEqual([2, 3, 2]);
	});

	it('INV-7: a preload that fails with an HTTP error is not used, and the click fetches fresh', async () => {
		installRuntime();
		const gallery = makeGallery();
		let first = true;
		stubFetch({
			respond: (body) => {
				if (body.page === 2 && first) {
					first = false;
					return Promise.resolve({ ok: false, status: 500 });
				}
				return undefined;
			},
		});
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		const error = jest.spyOn(console, 'error').mockImplementation(() => {});
		loadModule();
		window.FotoGrids.boot();

		await runIdle();
		expect(warn).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();

		await loadMore(gallery);

		expect(requestedPages()).toEqual([2, 2]);
		expect(shownPages(gallery)).toEqual(['1', '2']);
		expect(warn).not.toHaveBeenCalled();
	});

	it('INV-7: a preload that fails on the network is not used', async () => {
		installRuntime();
		const gallery = makeGallery();
		let first = true;
		stubFetch({
			respond: () => {
				if (first) {
					first = false;
					return Promise.reject(new TypeError('Failed to fetch'));
				}
				return undefined;
			},
		});
		loadModule();
		window.FotoGrids.boot();

		await runIdle();
		await loadMore(gallery);

		expect(requestedPages()).toEqual([2, 2]);
		expect(shownPages(gallery)).toEqual(['1', '2']);
	});

	it('INV-8: with preload off nothing is scheduled or held', async () => {
		installRuntime();
		const gallery = makeGallery({ preload: false });
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		await loadMore(gallery);
		await loadMore(gallery);

		expect(window.requestIdleCallback).not.toHaveBeenCalled();
		expect(requestedPages()).toEqual([2, 3]);
	});

	it('INV-10: the preload path writes nothing to the console', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		const spies = ['log', 'warn', 'error', 'info'].map((m) =>
			jest.spyOn(console, m).mockImplementation(() => {})
		);
		loadModule();
		window.FotoGrids.boot();

		await runIdle();
		await loadMore(gallery);
		await runIdle();

		spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
	});
});

describe('timing (§5)', () => {
	it('TIM-01: a click after the preload resolved sends no request', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();
		await runIdle();
		const before = window.fetch.mock.calls.length;

		await loadMore(gallery);

		expect(window.fetch.mock.calls.length).toBe(before);
		expect(shownPages(gallery)).toEqual(['1', '2']);
	});

	it('TIM-02: a click while the preload is in flight waits for it instead of sending another', async () => {
		installRuntime();
		const gallery = makeGallery();
		const pending = deferredResponse();
		stubFetch({
			respond: (body) => (body.page === 2 ? pending.promise : undefined),
		});
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		const click = loadMore(gallery);
		await flush();
		expect(requestedPages()).toEqual([2]);

		pending.resolve(okResponse(pagePayload({ page: 2, gallery_id: 5 }, 5)));
		await expect(click).resolves.toMatchObject({ page: 2, hasMore: true });

		expect(requestedPages()).toEqual([2]);
		expect(shownPages(gallery)).toEqual(['1', '2']);
	});

	it('TIM-03: a click before the idle callback fires is not followed by a preload of the same page', async () => {
		installRuntime();
		const gallery = makeGallery();
		const pending = deferredResponse();
		stubFetch({
			respond: (body) => (body.page === 2 ? pending.promise : undefined),
		});
		loadModule();
		window.FotoGrids.boot();
		expect(idleQueue.length).toBe(1);

		const click = loadMore(gallery);
		await runIdle();
		expect(requestedPages()).toEqual([2]);

		pending.resolve(okResponse(pagePayload({ page: 2, gallery_id: 5 }, 5)));
		await click;
		await runIdle();

		expect(requestedPages()).toEqual([2, 3]);
	});

	it('TIM-03: an idle callback that fires after its page is on screen does nothing', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		await loadMore(gallery);
		await loadMore(gallery);
		await runIdle();

		expect(requestedPages()).toEqual([2, 3, 4]);
	});

	it('TIM-03: Page Buttons — a preload queued for page 4 is dropped once the visitor is on page 1', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();
		await runIdle();
		await showPage(gallery, 2);
		await runIdle();
		await showPage(gallery, 3);
		await showPage(gallery, 1);
		await runIdle();

		expect(requestedPages()).toEqual([2, 3, 1, 2]);
	});

	it('TIM-06: without requestIdleCallback the preload runs on a timeout', async () => {
		installRuntime('desktop', { idle: false });
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(requestedPages()).toEqual([2]);

		await loadMore(gallery);
		expect(requestedPages()).toEqual([2]);
	});

	it('TIM-07: a click on an in-flight preload that then fails falls back to one fresh request', async () => {
		installRuntime();
		const gallery = makeGallery();
		const pending = deferredResponse();
		let first = true;
		stubFetch({
			respond: () => {
				if (first) {
					first = false;
					return pending.promise;
				}
				return undefined;
			},
		});
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		const click = loadMore(gallery);
		pending.reject(new TypeError('Failed to fetch'));
		await expect(click).resolves.toMatchObject({ page: 2 });

		expect(requestedPages()).toEqual([2, 2]);
		expect(shownPages(gallery)).toEqual(['1', '2']);
	});
});

describe('what invalidates a held page (§6)', () => {
	async function preloadThen(change, { mode = 'append', setup } = {}) {
		installRuntime();
		installFilters();
		const gallery = makeGallery();
		if (setup) {
			setup(gallery);
		}
		stubFetch();
		loadModule();
		window.FotoGrids.boot();
		await runIdle();
		change(gallery);
		await api().goToPage(gallery, 2, { mode });
		return { gallery, sent: bodies() };
	}

	it('INV3-01: a filter change sends a fresh request with the new filters', async () => {
		const { sent } = await preloadThen(() => {
			filterState = { tag: 'red' };
		});

		expect(sent.map((b) => b.page)).toEqual([2, 2]);
		expect(sent[0].filters).toEqual({});
		expect(sent[1].filters).toEqual({ tag: 'red' });
	});

	it('INV3-03: Page Buttons after a breakpoint change sends a fresh request at the new breakpoint', async () => {
		const { sent } = await preloadThen(
			() => window.FotoGrids.setBreakpoint('mobile'),
			{ mode: 'replace' }
		);

		expect(sent.map((b) => [b.page, b.breakpoint])).toEqual([
			[2, 'desktop'],
			[2, 'mobile'],
		]);
	});

	it('INV3-04: an append after a breakpoint change uses the held page (same view breakpoint)', async () => {
		const { sent, gallery } = await preloadThen(() =>
			window.FotoGrids.setBreakpoint('mobile')
		);

		expect(sent.map((b) => b.page)).toEqual([2]);
		expect(shownPages(gallery)).toEqual(['1', '2']);
	});

	it('INV3-05: a container width change sends a fresh request', async () => {
		const { sent } = await preloadThen(
			(g) => {
				g.dataset.fgContainerWidth = '640';
			},
			{
				setup: (g) => {
					g.dataset.fgContainerWidth = '960';
				},
			}
		);

		expect(sent.map((b) => [b.page, b.container_width])).toEqual([
			[2, 960],
			[2, 640],
		]);
	});

	it('INV3-06: a new random seed sends a fresh request', async () => {
		const { sent } = await preloadThen(
			(g) => {
				g.dataset.fgRandomSeed = '222';
			},
			{
				setup: (g) => {
					g.dataset.fgRandomSeed = '111';
				},
			}
		);

		expect(sent.map((b) => [b.page, b.random_seed])).toEqual([
			[2, 111],
			[2, 222],
		]);
	});

	it('INV3-07: unlocking the gallery after the preload sends a fresh request with the token', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		gallery.dataset.fgUnlockToken = 'tok';
		await loadMore(gallery);

		const headers = window.fetch.mock.calls.map(
			(c) => c[1].headers['X-FotoGrids-Unlock']
		);
		expect(requestedPages()).toEqual([2, 2]);
		expect(headers).toEqual([undefined, 'tok']);
	});

	it('INV3-08: a request for a different page does not use the held page', async () => {
		const { sent } = await preloadThen(() => {}, { mode: 'replace' });
		expect(sent.map((b) => b.page)).toEqual([2]);

		await showPage(document.querySelector('.fotogrids-gallery'), 4);
		expect(requestedPages()).toEqual([2, 4]);
	});

	it('INV3-09: a held gate response leaves the view alone, as a fresh one would', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch({
			respond: () =>
				Promise.resolve(
					okResponse({
						html: '<div class="fotogrids-gate"><div class="fg-gate-card"></div></div>',
						css: {},
						page: 2,
						page_size: 12,
						total_pages: 5,
						has_more: true,
					})
				),
		});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		await expect(loadMore(gallery)).rejects.toThrow('pagination/not-items');
		expect(requestedPages()).toEqual([2]);
		expect(shownPages(gallery)).toEqual(['1']);
		expect(gallery.querySelector('.fg-gate-card')).toBeNull();
	});
});

describe('entry paths (§7)', () => {
	it('ENT-01: a server-rendered page 1 preloads page 2 on idle', async () => {
		installRuntime();
		makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		expect(window.fetch).not.toHaveBeenCalled();
		await runIdle();
		expect(requestedPages()).toEqual([2]);
	});

	it('ENT-02: after re-paging page 1 for the breakpoint, page 2 is preloaded at the new breakpoint only', async () => {
		installRuntime('mobile');
		const gallery = makeGallery({ sizes: '24 18 12' });
		stubFetch({ total: 6 });
		loadModule();
		window.FotoGrids.boot();
		await flush();
		await runIdle();

		expect(bodies().map((b) => [b.page, b.breakpoint])).toEqual([
			[1, 'mobile'],
			[2, 'mobile'],
		]);

		await loadMore(gallery);
		expect(requestedPages()).toEqual([1, 2]);
	});

	it('ENT-04: a filter change (server strategy) preloads page 2 of the new filter', async () => {
		installRuntime();
		installFilters();
		const gallery = makeGallery();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		filterState = { tag: 'red' };
		await api().swapToFilterState(gallery);
		await runIdle();
		await loadMore(gallery);

		expect(bodies().map((b) => [b.page, b.filters])).toEqual([
			[2, {}],
			[1, { tag: 'red' }],
			[2, { tag: 'red' }],
		]);
	});

	it('ENT-06: a gallery inserted later preloads the same way', async () => {
		installRuntime();
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		const late = makeGallery({ id: '9' });
		window.FotoGrids.boot();
		await runIdle();
		await loadMore(late);

		expect(bodies().map((b) => [b.gallery_id, b.page])).toEqual([[9, 2]]);
	});

	it('ENT-07: prefetch() then goToPage() sends one request', async () => {
		installRuntime();
		const gallery = makeGallery();
		stubFetch();
		loadModule();

		await api().prefetch(gallery, 2);
		await loadMore(gallery);

		expect(requestedPages()).toEqual([2]);
		expect(shownPages(gallery)).toEqual(['1', '2']);
	});

	it('ENT-08: prefetch() is held with the preload setting off', async () => {
		installRuntime();
		const gallery = makeGallery({ preload: false });
		stubFetch();
		loadModule();

		await api().prefetch(gallery, 2);
		await loadMore(gallery);

		expect(requestedPages()).toEqual([2]);
	});
});

describe('isolation (§8)', () => {
	it('ISO-01: two galleries each request their own pages once', async () => {
		installRuntime();
		const a = makeGallery({ id: '5' });
		const b = makeGallery({ id: '6' });
		stubFetch();
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		await loadMore(a);
		await loadMore(b);

		expect(bodies().map((x) => [x.gallery_id, x.page])).toEqual([
			[5, 2],
			[6, 2],
		]);
		expect(a.querySelector('[data-page="2"]').dataset.gallery).toBe('5');
		expect(b.querySelector('[data-page="2"]').dataset.gallery).toBe('6');
	});

	it('ISO-02: two instances of one gallery never use each other’s held page', async () => {
		installRuntime();
		const a = makeGallery({ id: '5' });
		a.id = 'fg-5-1';
		const b = makeGallery({ id: '5' });
		b.id = 'fg-5-2';
		stubFetch();
		loadModule();

		await api().prefetch(a, 2);
		await loadMore(b);
		await loadMore(a);

		expect(bodies().map((x) => [x.instance_id, x.page])).toEqual([
			['fg-5-1', 2],
			['fg-5-2', 2],
		]);
	});

	it('ISO-04: a superseded request that used the held page does not paint', async () => {
		installRuntime();
		const gallery = makeGallery();
		const pending = deferredResponse();
		stubFetch({
			respond: (body) => (body.page === 2 ? pending.promise : undefined),
		});
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		const first = showPage(gallery, 2);
		const second = showPage(gallery, 3);
		await second;
		pending.resolve(okResponse(pagePayload({ page: 2, gallery_id: 5 }, 5)));

		await expect(first).resolves.toMatchObject({ stale: true });
		expect(shownPages(gallery)).toEqual(['3']);
		expect(requestedPages()).toEqual([2, 3]);
	});
});

describe('decisions (§10)', () => {
	const PAGE_ONE_NEW_ORDER = {
		html: '<div class="fg-grid-track" data-fg-items-root="true"><figure class="fg-item" data-page="1"></figure></div>',
		css: {},
		page: 1,
		page_size: 12,
		total_pages: 5,
		has_more: true,
	};

	it('DEC-01/02: a random refetch gallery preloads only after adopt(), under the new seed', async () => {
		installRuntime();
		const gallery = makeGallery({ randomMode: 'refetch' });
		gallery.dataset.fgRandomSeed = '111';
		stubFetch();
		loadModule();
		window.FotoGrids.boot();
		await runIdle();
		expect(window.fetch).not.toHaveBeenCalled();

		gallery.dataset.fgRandomSeed = '222';
		api().adopt(gallery, PAGE_ONE_NEW_ORDER, 'desktop');
		await runIdle();

		expect(bodies().map((b) => [b.page, b.random_seed])).toEqual([
			[2, 222],
		]);

		await loadMore(gallery);
		await runIdle();
		expect(bodies().map((b) => [b.page, b.random_seed])).toEqual([
			[2, 222],
			[3, 222],
		]);
	});

	it('DEC-03: a filter view restored from the cache preloads its next page', async () => {
		installRuntime();
		installFilters();
		const gallery = makeGallery({ strategy: 'cache' });
		stubFetch();
		loadModule();
		window.FotoGrids.boot();
		await runIdle();

		filterState = { tag: 'red' };
		await api().swapToFilterState(gallery);
		await runIdle();

		filterState = {};
		const restored = await api().swapToFilterState(gallery);
		expect(restored.fromCache).toBe(true);
		await runIdle();
		expect(requestedPages()).toEqual([2, 1, 2, 2]);
		await loadMore(gallery);

		expect(bodies().map((b) => [b.page, b.filters])).toEqual([
			[2, {}],
			[1, { tag: 'red' }],
			[2, { tag: 'red' }],
			[2, {}],
		]);
		expect(shownPages(gallery)).toEqual(['1', '2']);
	});

	it('DEC-04: a restored view with no more pages preloads nothing', async () => {
		installRuntime();
		installFilters();
		const gallery = makeGallery({ strategy: 'cache', total: 1 });
		stubFetch({ total: 1 });
		loadModule();
		window.FotoGrids.boot();

		filterState = { tag: 'red' };
		await api().swapToFilterState(gallery);
		filterState = {};
		await api().swapToFilterState(gallery);
		await runIdle();

		expect(requestedPages()).toEqual([1]);
	});

	it('DEC-05: with preload off, adopt() and a cache restore preload nothing', async () => {
		installRuntime();
		installFilters();
		const random = makeGallery({
			id: '7',
			preload: false,
			randomMode: 'refetch',
		});
		const cached = makeGallery({ preload: false, strategy: 'cache' });
		stubFetch();
		loadModule();
		window.FotoGrids.boot();

		api().adopt(random, PAGE_ONE_NEW_ORDER, 'desktop');
		filterState = { tag: 'red' };
		await api().swapToFilterState(cached);
		filterState = {};
		await api().swapToFilterState(cached);
		await runIdle();

		expect(window.requestIdleCallback).not.toHaveBeenCalled();
		expect(requestedPages()).toEqual([1]);
	});
});
