/**
 * Tests for Preload Next Page on a gallery whose random sort refetches page 1
 * (public/render/sorters/random/random-sort.js with
 * public/render/features/pagination/pagination-core.js).
 *
 * When the refetch replaces page 1, page 2 of the new order is preloaded.
 * When it does not - late, failed, gated, empty or never answered - page 2 of
 * the server order is preloaded instead. Either way each page is requested
 * once, under the seed of the order on screen.
 */

const RANDOM = '../../../public/render/sorters/random/random-sort';
const PAGINATION = '../../../public/render/features/pagination/pagination-core';

const SERVER_SEED = 111;
const HOLD_MS = 600;

let idleQueue;
let filterState;

function installRuntime() {
	const subscribers = [];
	window.FotoGrids = {
		modules: {},
		activeBreakpoint: () => 'desktop',
		onCollection(cb, priority) {
			subscribers.push({ cb, priority: priority || 10 });
		},
		onGallery(cb, priority) {
			subscribers.push({ cb, priority: priority || 10 });
		},
		boot() {
			subscribers.sort((a, b) => a.priority - b.priority);
			document
				.querySelectorAll('.fotogrids-gallery')
				.forEach((el) => subscribers.forEach((s) => s.cb(el)));
		},
	};
	idleQueue = [];
	window.requestIdleCallback = jest.fn((cb) => {
		idleQueue.push(cb);
	});
}

function installFilters() {
	filterState = {};
	window.FotoGrids.modules.filters = {
		getActive: () => ({ ...filterState }),
		fingerprint: (map) => JSON.stringify(map),
	};
}

function makeGallery({
	preload = true,
	paginated = true,
	total = 5,
	method = 'load_more',
} = {}) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.setAttribute('data-fg-random-mode', 'refetch');
	el.dataset.fgGalleryId = '9';
	el.dataset.fgRenderUrl =
		'https://example.com/wp-json/fotogrids/v1/gallery/render';
	el.dataset.fgRenderNonce = 'n';
	el.dataset.fgRandomSeed = String(SERVER_SEED);
	if (paginated) {
		el.dataset.fgPaginated = 'true';
		el.dataset.fgPageCurrent = '1';
		el.dataset.fgPageTotal = String(total);
		el.dataset.fgPageSize = '3';
		el.dataset.fgPaginationMethod = method;
		el.dataset.fgPaginationPreload = preload ? 'true' : 'false';
	}
	el.innerHTML = itemsMarkup(['server-1']);
	document.body.appendChild(el);
	return el;
}

function itemsMarkup(ids) {
	return (
		'<div class="fg-grid-track" data-fg-items-root="true">' +
		ids
			.map(
				(id) =>
					`<figure class="fg-item" data-fg-item-id="${id}"></figure>`
			)
			.join('') +
		'</div>'
	);
}

function pageId(body) {
	const filter =
		body.filters && body.filters.tag ? '-' + body.filters.tag : '';
	return 'p' + body.page + '-seed' + body.random_seed + filter;
}

function ok(payload) {
	return { ok: true, json: () => Promise.resolve(payload) };
}

function pagePayload(body, total = 5) {
	return {
		html: itemsMarkup([pageId(body)]),
		css: {},
		page: body.page,
		page_size: 3,
		total_pages: total,
		has_more: body.page < total,
	};
}

const REFETCH = {
	'on time': (body) => Promise.resolve(ok(pagePayload(body))),
	late: (body) =>
		new Promise((resolve) =>
			setTimeout(() => resolve(ok(pagePayload(body))), HOLD_MS + 400)
		),
	'HTTP 500': () => Promise.resolve({ ok: false, status: 500 }),
	'network error': () => Promise.reject(new TypeError('Failed to fetch')),
	gate: () =>
		Promise.resolve(
			ok({ html: '<div class="fotogrids-gate"></div>', css: {} })
		),
	empty: () => Promise.resolve(ok({ html: '', css: {} })),
	'never answers': () => new Promise(() => {}),
};
const FALLBACKS = Object.keys(REFETCH).filter((k) => 'on time' !== k);

/**
 * The first request is the random-sort refetch, answered per `outcome`; every
 * later request answers after `pageMs` with a page named after its body.
 */
function stubFetch(outcome, { pageMs = 0, total = 5 } = {}) {
	let first = true;
	window.fetch = jest.fn((url, init) => {
		const body = JSON.parse(init.body);
		if (first) {
			first = false;
			return REFETCH[outcome](body);
		}
		return new Promise((resolve) =>
			setTimeout(() => resolve(ok(pagePayload(body, total))), pageMs)
		);
	});
}

function load(...modules) {
	jest.isolateModules(() => {
		modules.forEach((m) => require(m));
	});
}

async function advance(ms) {
	await jest.advanceTimersByTimeAsync(ms);
}

async function runIdle() {
	const queued = idleQueue.splice(0);
	queued.forEach((cb) => cb({ didTimeout: false, timeRemaining: () => 50 }));
	await advance(1);
}

/** Requests sent after the refetch, as page + seed (+ filter, + slice). */
function laterRequests() {
	return window.fetch.mock.calls.slice(1).map((c) => {
		const b = JSON.parse(c[1].body);
		return {
			page: b.page,
			seed: b.random_seed,
			...(b.filters && b.filters.tag ? { tag: b.filters.tag } : {}),
			...(b.length ? { offset: b.offset, length: b.length } : {}),
		};
	});
}

function noDuplicateBodies() {
	const all = window.fetch.mock.calls.map((c) => c[1].body);
	expect(new Set(all).size).toBe(all.length);
}

function shown(el) {
	return Array.from(el.querySelectorAll('.fg-item')).map(
		(n) => n.dataset.fgItemId
	);
}

function pagination() {
	return window.FotoGrids.modules.pagination;
}

async function boot(outcome, galleryOptions = {}, fetchOptions = {}) {
	installRuntime();
	const g = makeGallery(galleryOptions);
	stubFetch(outcome, fetchOptions);
	load(RANDOM, PAGINATION);
	window.FotoGrids.boot();
	return g;
}

/** Waits out the hold and any late response, running idle work as it comes. */
async function settleRefetch() {
	await advance(HOLD_MS + 50);
	await runIdle();
	await advance(1000);
	await runIdle();
}

beforeEach(() => {
	jest.useFakeTimers();
	document.body.innerHTML = '';
	delete window.FotoGrids;
	delete window.fetch;
	delete window.requestIdleCallback;
	jest.restoreAllMocks();
});

afterEach(() => {
	jest.useRealTimers();
});

describe('the visitor waits for the hold to end', () => {
	it.each(FALLBACKS)(
		'FB-01: refetch %s — page 2 of the server order is preloaded once, and Load More uses it',
		async (outcome) => {
			const g = await boot(outcome);
			await settleRefetch();

			expect(laterRequests()).toEqual([{ page: 2, seed: SERVER_SEED }]);

			const click = pagination().goToPage(g, 2, { mode: 'append' });
			await advance(10);
			await click;

			expect(laterRequests()).toEqual([{ page: 2, seed: SERVER_SEED }]);
			expect(shown(g)).toEqual(['server-1', 'p2-seed' + SERVER_SEED]);
			noDuplicateBodies();
		}
	);

	it('FB-02: a late response landing after page 2 is preloaded is dropped, and Load More uses the preload', async () => {
		const g = await boot('late');
		await advance(HOLD_MS + 50);
		await runIdle();
		expect(laterRequests()).toEqual([{ page: 2, seed: SERVER_SEED }]);

		await advance(1000);
		expect(g.dataset.fgRandomSeed).toBe(String(SERVER_SEED));
		expect(shown(g)).toEqual(['server-1']);

		const click = pagination().goToPage(g, 2, { mode: 'append' });
		await advance(10);
		await click;

		expect(laterRequests()).toEqual([{ page: 2, seed: SERVER_SEED }]);
		expect(shown(g)).toEqual(['server-1', 'p2-seed' + SERVER_SEED]);
	});

	it('FB-03: refetch on time — page 2 of the new order only', async () => {
		const g = await boot('on time');
		await settleRefetch();
		const minted = JSON.parse(
			window.fetch.mock.calls[0][1].body
		).random_seed;

		expect(laterRequests()).toEqual([{ page: 2, seed: minted }]);

		const click = pagination().goToPage(g, 2, { mode: 'append' });
		await advance(10);
		await click;

		expect(laterRequests()).toEqual([{ page: 2, seed: minted }]);
		noDuplicateBodies();
	});
});

describe('the visitor acts during the hold', () => {
	it.each(['late', 'HTTP 500', 'network error'])(
		'FB-04: refetch %s, Load More during the hold — page 2 once, page 3 preloaded once',
		async (outcome) => {
			const g = await boot(outcome, {}, { pageMs: 50 });
			await advance(100);
			const click = pagination().goToPage(g, 2, { mode: 'append' });
			await advance(60);
			await click;
			await settleRefetch();

			expect(laterRequests()).toEqual([
				{ page: 2, seed: SERVER_SEED },
				{ page: 3, seed: SERVER_SEED },
			]);
			expect(shown(g)).toEqual(['server-1', 'p2-seed' + SERVER_SEED]);
			noDuplicateBodies();
		}
	);

	it.each(['late', 'HTTP 500', 'network error'])(
		'FB-05: refetch %s, Page Buttons to page 3 during the hold — page 3 once, page 4 preloaded once',
		async (outcome) => {
			const g = await boot(outcome, { method: 'pages' }, { pageMs: 50 });
			await advance(100);
			const click = pagination().goToPage(g, 3, { mode: 'replace' });
			await advance(60);
			await click;
			await settleRefetch();

			expect(laterRequests()).toEqual([
				{ page: 3, seed: SERVER_SEED },
				{ page: 4, seed: SERVER_SEED },
			]);
			expect(shown(g)).toEqual(['p3-seed' + SERVER_SEED]);
			noDuplicateBodies();
		}
	);

	it.each(['late', 'HTTP 500', 'network error'])(
		'FB-06: refetch %s, filter change during the hold — filtered page 1 once, filtered page 2 preloaded once',
		async (outcome) => {
			installRuntime();
			installFilters();
			const g = makeGallery();
			stubFetch(outcome, { pageMs: 50 });
			load(RANDOM, PAGINATION);
			window.FotoGrids.boot();

			await advance(100);
			filterState = { tag: 'red' };
			g.dispatchEvent(new CustomEvent('fotogrids:filters_changed'));
			const swap = pagination().swapToFilterState(g);
			await advance(60);
			await swap;
			await settleRefetch();

			expect(laterRequests()).toEqual([
				{ page: 1, seed: SERVER_SEED, tag: 'red' },
				{ page: 2, seed: SERVER_SEED, tag: 'red' },
			]);
			expect(shown(g)).toEqual(['p1-seed' + SERVER_SEED + '-red']);
			noDuplicateBodies();
		}
	);
});

describe('where nothing is preloaded', () => {
	it.each(Object.keys(REFETCH))(
		'FB-07: Preload off, refetch %s — no request besides the refetch',
		async (outcome) => {
			await boot(outcome, { preload: false });
			await settleRefetch();

			expect(laterRequests()).toEqual([]);
		}
	);

	it.each(['late', 'HTTP 500'])(
		'FB-08: gallery not paginated, refetch %s — no request besides the refetch',
		async (outcome) => {
			await boot(outcome, { paginated: false });
			await settleRefetch();

			expect(laterRequests()).toEqual([]);
		}
	);

	it.each(['late', 'HTTP 500'])(
		'FB-09: pagination script not on the page, refetch %s — no request besides the refetch, no error',
		async (outcome) => {
			installRuntime();
			makeGallery();
			stubFetch(outcome);
			const errors = jest
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			load(RANDOM);

			expect(() => window.FotoGrids.boot()).not.toThrow();
			await settleRefetch();

			expect(laterRequests()).toEqual([]);
			expect(errors).not.toHaveBeenCalled();
		}
	);

	it.each(['late', 'HTTP 500'])(
		'FB-10: gallery that fits one page, refetch %s — no preload',
		async (outcome) => {
			await boot(outcome, { total: 1 }, { total: 1 });
			await settleRefetch();

			expect(laterRequests()).toEqual([]);
		}
	);
});

describe('galleries paged by a slice planner', () => {
	it('FB-11: late refetch — the preload carries the slice, and Load More uses it', async () => {
		installRuntime();
		const g = makeGallery();
		stubFetch('late');
		load(RANDOM, PAGINATION);
		pagination().setSlicePlanner(g, {
			next: (loaded) =>
				loaded < 15 ? { offset: loaded, length: 3 } : null,
			page: (n) => ({ offset: (n - 1) * 3, length: 3 }),
			pageContaining: (index) => Math.floor(index / 3) + 1,
			total: () => 5,
		});
		window.FotoGrids.boot();
		await settleRefetch();

		expect(laterRequests()).toEqual([
			{ page: 2, seed: SERVER_SEED, offset: 1, length: 3 },
		]);

		const click = pagination().goToPage(g, 2, { mode: 'append' });
		await advance(10);
		await click;

		expect(laterRequests()).toEqual([
			{ page: 2, seed: SERVER_SEED, offset: 1, length: 3 },
		]);
		noDuplicateBodies();
	});
});
