/**
 * Tests for public/render/sorters/random/random-sort.js (IIFE; subscribes to
 * the runtime on import).
 *
 * The module undoes what a page cache freezes, so the assertions are about
 * what the visitor ends up looking at: that the order changes, that fetch
 * mode replaces the items rather than rearranging them, that the items stay
 * hidden until the response lands, and that the shuffle runs before the
 * layout modules that read DOM order.
 */

const MODULE = '../../../public/render/sorters/random/random-sort';

/**
 * Minimal stand-in for window.FotoGrids reproducing the two behaviours the
 * module depends on: a priority-ordered callback queue, and callbacks running
 * against every collection at boot.
 */
function installRuntime() {
	const queue = [];
	let seq = 0;

	window.FotoGrids = {
		onCollection(cb, priority) {
			queue.push({
				cb,
				priority: typeof priority === 'number' ? priority : 10,
				seq: seq++,
			});
			queue.sort((a, b) =>
				a.priority !== b.priority
					? a.priority - b.priority
					: a.seq - b.seq
			);
		},
		boot() {
			document
				.querySelectorAll('.fotogrids-collection')
				.forEach((el) => {
					queue.forEach((entry) => entry.cb(el));
				});
		},
	};
}

function makeCollection(ids, { mode = 'reorder', withRenderUrl = true } = {}) {
	const collection = document.createElement('div');
	collection.className = 'fotogrids-collection fotogrids-gallery';
	collection.dataset.fgGalleryId = '9';
	if (mode) {
		collection.setAttribute('data-fg-random-mode', mode);
	}
	if (withRenderUrl) {
		collection.dataset.fgRenderUrl =
			'https://example.com/wp-json/fotogrids/v1/gallery/render';
		collection.dataset.fgRenderNonce = 'test-nonce';
	}

	const root = document.createElement('div');
	root.className = 'fg-grid-track';
	root.setAttribute('data-fg-items-root', 'true');

	ids.forEach((id) => {
		root.appendChild(makeItem(id));
	});

	collection.appendChild(root);
	document.body.appendChild(collection);
	return { collection, root };
}

function makeItem(id) {
	const figure = document.createElement('figure');
	figure.className = 'fg-item';
	figure.dataset.fgItemId = String(id);
	return figure;
}

function orderOf(root) {
	return Array.from(root.querySelectorAll(':scope > .fg-item')).map(
		(el) => el.dataset.fgItemId
	);
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

/** Feeds Fisher-Yates a fixed sequence so a "pageview" is reproducible. */
function stubRandom(value) {
	jest.spyOn(Math, 'random').mockReturnValue(value);
}

/** Resolves the fetch with an items_only payload, on demand. */
function stubFetch(payload) {
	let resolveResponse;
	const pending = new Promise((resolve) => {
		resolveResponse = resolve;
	});

	window.fetch = jest.fn(() => pending);

	return {
		settle() {
			resolveResponse({
				ok: true,
				json: () => Promise.resolve(payload),
			});
			// Walk the promise chain: response -> json() -> applyItems ->
			// catch -> release. Six hops covers it with room to spare.
			let flushed = Promise.resolve();
			for (let i = 0; i < 6; i++) {
				flushed = flushed.then(() => undefined);
			}
			return flushed;
		},
	};
}

function loadModule() {
	jest.isolateModules(() => {
		require(MODULE);
	});
}

describe('random-sort', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		delete window.FotoGrids;
		delete window.fetch;
		installRuntime();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	describe('reorder mode', () => {
		it('reorders a collection away from the server order', () => {
			const { root } = makeCollection(['a', 'b', 'c', 'd']);
			stubRandom(0);

			loadModule();
			window.FotoGrids.boot();

			expect(orderOf(root)).toEqual(['b', 'c', 'd', 'a']);
		});

		it('produces a different order on a second pageview of identical HTML', () => {
			const first = makeCollection(['a', 'b', 'c', 'd']);
			stubRandom(0);
			loadModule();
			window.FotoGrids.boot();
			const firstOrder = orderOf(first.root);

			document.body.innerHTML = '';
			delete window.FotoGrids;
			installRuntime();

			const second = makeCollection(['a', 'b', 'c', 'd']);
			Math.random.mockReturnValue(0.5);
			loadModule();
			window.FotoGrids.boot();
			const secondOrder = orderOf(second.root);

			expect(secondOrder).not.toEqual(firstOrder);
			expect(secondOrder).not.toEqual(['a', 'b', 'c', 'd']);
			expect(secondOrder.slice().sort()).toEqual(['a', 'b', 'c', 'd']);
		});

		it('runs before layout modules, so they see the shuffled order', () => {
			const { root } = makeCollection(['a', 'b', 'c', 'd']);
			stubRandom(0);

			loadModule();

			// Mirrors bootLayout()'s default priority of 10.
			let seenByLayout = null;
			window.FotoGrids.onCollection(() => {
				seenByLayout = orderOf(root);
			}, 10);

			window.FotoGrids.boot();

			expect(seenByLayout).toEqual(['b', 'c', 'd', 'a']);
		});

		it('reorders only the inserted batch on fotogrids:items_inserted', () => {
			const { collection, root } = makeCollection(['a', 'b', 'c', 'd']);
			stubRandom(0);

			loadModule();
			window.FotoGrids.boot();

			const initialOrder = orderOf(root);
			const inserted = ['e', 'f', 'g', 'h'].map((id) => {
				const el = makeItem(id);
				root.appendChild(el);
				return el;
			});

			collection.dispatchEvent(
				new CustomEvent('fotogrids:items_inserted', {
					detail: { items: inserted, galleryEl: collection },
				})
			);

			const finalOrder = orderOf(root);

			expect(finalOrder.slice(0, 4)).toEqual(initialOrder);
			expect(finalOrder.slice(4)).toEqual(['f', 'g', 'h', 'e']);
		});

		it('sends no request', () => {
			window.fetch = jest.fn();
			makeCollection(['a', 'b', 'c', 'd']);
			stubRandom(0);

			loadModule();
			window.FotoGrids.boot();

			expect(window.fetch).not.toHaveBeenCalled();
		});
	});

	describe('refetch mode', () => {
		it('replaces the items with the fetched selection', async () => {
			const { root } = makeCollection(['a', 'b', 'c'], { mode: 'refetch' });
			const server = stubFetch({ html: itemsMarkup(['x', 'y', 'z']) });

			loadModule();
			window.FotoGrids.boot();

			expect(orderOf(root)).toEqual(['a', 'b', 'c']);

			await server.settle();

			expect(orderOf(root)).toEqual(['x', 'y', 'z']);
		});

		it('holds the items hidden until the response lands', async () => {
			const { root } = makeCollection(['a', 'b', 'c'], { mode: 'refetch' });
			const server = stubFetch({ html: itemsMarkup(['x', 'y', 'z']) });

			loadModule();
			window.FotoGrids.boot();

			expect(root.classList.contains('fg-random-pending')).toBe(true);

			await server.settle();

			expect(root.classList.contains('fg-random-pending')).toBe(false);
		});

		it('reveals the server items and drops a late response after the hold expires', async () => {
			jest.useFakeTimers();
			const { root } = makeCollection(['a', 'b', 'c'], { mode: 'refetch' });
			const server = stubFetch({ html: itemsMarkup(['x', 'y', 'z']) });

			loadModule();
			window.FotoGrids.boot();

			jest.advanceTimersByTime(600);

			expect(root.classList.contains('fg-random-pending')).toBe(false);
			expect(orderOf(root)).toEqual(['a', 'b', 'c']);

			await server.settle();

			expect(orderOf(root)).toEqual(['a', 'b', 'c']);
		});

		it('mints a fresh seed and sends it so later requests share the permutation', () => {
			const { collection } = makeCollection(['a', 'b', 'c'], {
				mode: 'refetch',
			});
			stubFetch({ html: itemsMarkup(['x']) });

			loadModule();
			window.FotoGrids.boot();

			const body = JSON.parse(window.fetch.mock.calls[0][1].body);

			expect(body.partial).toBe('items_only');
			expect(body.page).toBe(1);
			expect(body.gallery_id).toBe(9);
			expect(body.random_seed).toBeGreaterThan(0);
			expect(body.random_seed).toBeLessThanOrEqual(2147483647);
			expect(collection.dataset.fgRandomSeed).toBe(
				String(body.random_seed)
			);
		});

		it('announces the swapped items so per-item modules re-bind', async () => {
			const { collection, root } = makeCollection(['a', 'b', 'c'], {
				mode: 'refetch',
			});
			const server = stubFetch({ html: itemsMarkup(['x', 'y']) });

			const seen = [];
			collection.addEventListener('fotogrids:items_inserted', (event) => {
				seen.push(event.detail.items.length);
			});

			loadModule();
			window.FotoGrids.boot();
			await server.settle();

			expect(seen).toEqual([2]);
			expect(orderOf(root)).toEqual(['x', 'y']);
		});

		it('leaves the server order alone when the wrapper carries no render URL', () => {
			window.fetch = jest.fn();
			const { root } = makeCollection(['a', 'b', 'c'], {
				mode: 'refetch',
				withRenderUrl: false,
			});

			loadModule();
			window.FotoGrids.boot();

			expect(window.fetch).not.toHaveBeenCalled();
			expect(root.classList.contains('fg-random-pending')).toBe(false);
			expect(orderOf(root)).toEqual(['a', 'b', 'c']);
		});
	});

	it('leaves a collection without a random mode untouched', () => {
		window.fetch = jest.fn();
		const { root } = makeCollection(['a', 'b', 'c', 'd'], { mode: null });
		stubRandom(0);

		loadModule();
		window.FotoGrids.boot();

		expect(orderOf(root)).toEqual(['a', 'b', 'c', 'd']);
		expect(window.fetch).not.toHaveBeenCalled();
	});

	it('falls back to the parent of the items when no items root is marked', () => {
		const { collection, root } = makeCollection(['a', 'b', 'c', 'd']);
		root.removeAttribute('data-fg-items-root');
		stubRandom(0);

		loadModule();
		window.FotoGrids.boot();

		expect(collection.querySelector('.fg-grid-track')).toBe(root);
		expect(orderOf(root)).toEqual(['b', 'c', 'd', 'a']);
	});
});
