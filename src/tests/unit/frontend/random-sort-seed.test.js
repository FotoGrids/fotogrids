/**
 * Tests for the seed a random-sort refetch leaves on the gallery wrapper
 * (public/render/sorters/random/random-sort.js), and for the requests
 * pagination-core.js builds from it.
 *
 * The wrapper's data-fg-random-seed must always be the seed of the order on
 * screen: the minted seed once its page 1 is painted, the server's seed when
 * the refetch is late, fails or is claimed by a gate.
 */

const RANDOM = '../../../public/render/sorters/random/random-sort';
const PAGINATION = '../../../public/render/features/pagination/pagination-core';

const SERVER_SEED = '111';
const HOLD_MS = 600;

function installRuntime() {
	const subscribers = [];
	window.FotoGrids = {
		modules: {},
		activeBreakpoint: () => 'desktop',
		onCollection(cb, priority) {
			subscribers.push({ cb, priority: priority || 10 });
			subscribers.sort((a, b) => a.priority - b.priority);
		},
		onGallery(cb, priority) {
			subscribers.push({ cb, priority: priority || 10 });
			subscribers.sort((a, b) => a.priority - b.priority);
		},
		boot() {
			document
				.querySelectorAll('.fotogrids-gallery')
				.forEach((el) => subscribers.forEach((s) => s.cb(el)));
		},
	};
}

function makeGallery({ seed = SERVER_SEED, paginated = false } = {}) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.setAttribute('data-fg-random-mode', 'refetch');
	el.dataset.fgGalleryId = '9';
	el.dataset.fgRenderUrl =
		'https://example.com/wp-json/fotogrids/v1/gallery/render';
	el.dataset.fgRenderNonce = 'n';
	if (seed !== null) {
		el.dataset.fgRandomSeed = seed;
	}
	if (paginated) {
		el.dataset.fgPaginated = 'true';
		el.dataset.fgPageCurrent = '1';
		el.dataset.fgPageTotal = '5';
		el.dataset.fgPageSize = '3';
		el.dataset.fgPaginationPreload = 'false';
	}
	el.innerHTML = itemsMarkup(['a', 'b', 'c']);
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

function shown(el) {
	return Array.from(el.querySelectorAll('.fg-item')).map(
		(n) => n.dataset.fgItemId
	);
}

function pagePayload(page, ids) {
	return {
		html: itemsMarkup(ids),
		css: {},
		page,
		page_size: 3,
		total_pages: 5,
		has_more: page < 5,
	};
}

function ok(payload) {
	return { ok: true, json: () => Promise.resolve(payload) };
}

/**
 * The random-sort refetch is the first request; its response is controlled
 * by `refetch`. Every later request (pagination) answers at once with a page
 * named after the seed it carried.
 */
function stubFetch(refetch) {
	let first = true;
	window.fetch = jest.fn((url, init) => {
		const body = JSON.parse(init.body);
		if (first) {
			first = false;
			return refetch(body);
		}
		return Promise.resolve(
			ok(
				pagePayload(body.page, [
					'p' + body.page + '-seed' + body.random_seed,
				])
			)
		);
	});
}

function bodies() {
	return window.fetch.mock.calls.map((c) => JSON.parse(c[1].body));
}

function mintedSeed() {
	return String(bodies()[0].random_seed);
}

function load(...modules) {
	jest.isolateModules(() => {
		modules.forEach((m) => require(m));
	});
}

async function settle(ms = 0) {
	await jest.advanceTimersByTimeAsync(ms);
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
}

const REFETCH = {
	'on time': (body) => Promise.resolve(ok(pagePayload(1, ['x', 'y', 'z']))),
	late: (body) =>
		new Promise((resolve) =>
			setTimeout(
				() => resolve(ok(pagePayload(1, ['x', 'y', 'z']))),
				HOLD_MS + 300
			)
		),
	'HTTP 403': () => Promise.resolve({ ok: false, status: 403 }),
	'HTTP 500': () => Promise.resolve({ ok: false, status: 500 }),
	'network error': () => Promise.reject(new TypeError('Failed to fetch')),
	'malformed JSON': () =>
		Promise.resolve({
			ok: true,
			json: () => Promise.reject(new SyntaxError('bad')),
		}),
	'gate response': () =>
		Promise.resolve(
			ok({
				html: '<div class="fotogrids-gate"><form class="fg-gate-card"></form></div>',
				css: {},
			})
		),
	'empty response': () => Promise.resolve(ok({ html: '', css: {} })),
};

const FAILURES = Object.keys(REFETCH).filter((k) => k !== 'on time');

beforeEach(() => {
	jest.useFakeTimers();
	document.body.innerHTML = '';
	delete window.FotoGrids;
	delete window.fetch;
	jest.restoreAllMocks();
});

afterEach(() => {
	jest.useRealTimers();
});

describe('the wrapper seed after a refetch', () => {
	it('SEED-01: on time — the minted seed, with its page 1 on screen', async () => {
		installRuntime();
		const g = makeGallery();
		stubFetch(REFETCH['on time']);
		load(RANDOM);
		window.FotoGrids.boot();
		await settle();

		expect(shown(g)).toEqual(['x', 'y', 'z']);
		expect(g.dataset.fgRandomSeed).toBe(mintedSeed());
		expect(g.dataset.fgRandomSeed).not.toBe(SERVER_SEED);
	});

	it('SEED-02: while the refetch is in flight — still the server seed', async () => {
		installRuntime();
		const g = makeGallery();
		stubFetch(() => new Promise(() => {}));
		load(RANDOM);
		window.FotoGrids.boot();
		await settle(HOLD_MS - 100);

		expect(shown(g)).toEqual(['a', 'b', 'c']);
		expect(g.dataset.fgRandomSeed).toBe(SERVER_SEED);
	});

	it.each(FAILURES)(
		'SEED-03: %s — the server seed, with the server order on screen',
		async (name) => {
			installRuntime();
			const g = makeGallery();
			stubFetch(REFETCH[name]);
			load(RANDOM);
			window.FotoGrids.boot();
			await settle(HOLD_MS + 1000);

			expect(shown(g)).toEqual(['a', 'b', 'c']);
			expect(g.dataset.fgRandomSeed).toBe(SERVER_SEED);
		}
	);

	it('SEED-04: a refetch that never answers — the server seed after the hold', async () => {
		installRuntime();
		const g = makeGallery();
		stubFetch(() => new Promise(() => {}));
		load(RANDOM);
		window.FotoGrids.boot();
		await settle(HOLD_MS + 5000);

		expect(g.querySelector('.fg-random-pending')).toBeNull();
		expect(g.dataset.fgRandomSeed).toBe(SERVER_SEED);
	});

	it('SEED-05: a wrapper without a server seed gets none written when the refetch fails', async () => {
		installRuntime();
		const g = makeGallery({ seed: null });
		stubFetch(REFETCH['HTTP 500']);
		load(RANDOM);
		window.FotoGrids.boot();
		await settle(HOLD_MS + 1000);

		expect(g.hasAttribute('data-fg-random-seed')).toBe(false);
	});

	it('SEED-06: the refetch request carries the minted seed, not the server seed', () => {
		installRuntime();
		makeGallery();
		stubFetch(() => new Promise(() => {}));
		load(RANDOM);
		window.FotoGrids.boot();

		expect(bodies()[0].random_seed).toBeGreaterThan(0);
		expect(String(bodies()[0].random_seed)).not.toBe(SERVER_SEED);
	});
});

describe('handing the refetched page to pagination', () => {
	function withAdoptSpy() {
		const adopt = jest.fn();
		window.FotoGrids.modules.pagination = { adopt };
		return adopt;
	}

	it('SEED-07: on time — adopt() is called with the painted page', async () => {
		installRuntime();
		const g = makeGallery({ paginated: true });
		const adopt = withAdoptSpy();
		stubFetch(REFETCH['on time']);
		load(RANDOM);
		window.FotoGrids.boot();
		await settle();

		expect(adopt).toHaveBeenCalledTimes(1);
		expect(adopt.mock.calls[0][0]).toBe(g);
	});

	it.each(FAILURES)('SEED-08: %s — adopt() is not called', async (name) => {
		installRuntime();
		makeGallery({ paginated: true });
		const adopt = withAdoptSpy();
		stubFetch(REFETCH[name]);
		load(RANDOM);
		window.FotoGrids.boot();
		await settle(HOLD_MS + 1000);

		expect(adopt).not.toHaveBeenCalled();
	});
});

describe('later requests draw from the order on screen', () => {
	async function bootPaginated(name) {
		installRuntime();
		const g = makeGallery({ paginated: true });
		stubFetch(REFETCH[name]);
		load(RANDOM, PAGINATION);
		window.FotoGrids.boot();
		await settle(HOLD_MS + 1000);
		return g;
	}

	function pagination() {
		return window.FotoGrids.modules.pagination;
	}

	it('SEED-09: on time — Load More requests page 2 with the minted seed', async () => {
		const g = await bootPaginated('on time');
		const minted = mintedSeed();
		await pagination().goToPage(g, 2, { mode: 'append' });

		expect(bodies()[1]).toMatchObject({
			page: 2,
			random_seed: Number(minted),
		});
		expect(shown(g)).toEqual(['x', 'y', 'z', 'p2-seed' + minted]);
	});

	it.each(FAILURES)(
		'SEED-10: %s — Load More requests page 2 with the server seed',
		async (name) => {
			const g = await bootPaginated(name);
			await pagination().goToPage(g, 2, { mode: 'append' });

			expect(bodies()[1]).toMatchObject({
				page: 2,
				random_seed: Number(SERVER_SEED),
			});
			expect(shown(g)).toEqual(['a', 'b', 'c', 'p2-seed' + SERVER_SEED]);
		}
	);

	it.each(['late', 'HTTP 403', 'network error'])(
		'SEED-11: %s — Page Buttons requests every page with the server seed',
		async (name) => {
			const g = await bootPaginated(name);
			for (const p of [2, 3, 5]) {
				await pagination().goToPage(g, p, { mode: 'replace' });
			}

			expect(
				bodies()
					.slice(1)
					.map((b) => [b.page, b.random_seed])
			).toEqual([
				[2, Number(SERVER_SEED)],
				[3, Number(SERVER_SEED)],
				[5, Number(SERVER_SEED)],
			]);
		}
	);

	it.each(['late', 'HTTP 403', 'network error'])(
		'SEED-12: %s — a filter change requests page 1 with the server seed',
		async (name) => {
			const g = await bootPaginated(name);
			window.FotoGrids.modules.filters = {
				getActive: () => ({ tag: 'red' }),
				fingerprint: () => 'tag=red',
			};
			await pagination().swapToFilterState(g);

			expect(bodies()[1]).toMatchObject({
				page: 1,
				filters: { tag: 'red' },
				random_seed: Number(SERVER_SEED),
			});
		}
	);

	it('SEED-13: late — pagination state is not taken from the dropped response', async () => {
		const g = await bootPaginated('late');

		expect(g.dataset.fgPageCurrent).toBe('1');
		expect(g.dataset.fgPageTotal).toBe('5');
		expect(g.dataset.fgViewBreakpoint).toBeUndefined();
	});
});
