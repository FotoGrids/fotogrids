/**
 * SORT-08: the seed a random-sort refetch mints stays inside 1..2^31-1, the
 * range the server mints from, at both ends of Math.random().
 */

const RANDOM = '../../../public/render/sorters/random/random-sort';

const SEED_MAX = 2147483647;

function installRuntime() {
	const subscribers = [];
	window.FotoGrids = {
		modules: {},
		activeBreakpoint: () => 'desktop',
		onCollection(cb) {
			subscribers.push(cb);
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
}

function makeGallery() {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.setAttribute('data-fg-random-mode', 'refetch');
	el.dataset.fgGalleryId = '9';
	el.dataset.fgRenderUrl =
		'https://example.com/wp-json/fotogrids/v1/gallery/render';
	el.dataset.fgRenderNonce = 'n';
	el.dataset.fgRandomSeed = '111';
	el.innerHTML =
		'<div class="fg-grid-track" data-fg-items-root="true">' +
		'<figure class="fg-item" data-fg-item-id="a"></figure>' +
		'<figure class="fg-item" data-fg-item-id="b"></figure>' +
		'</div>';
	document.body.appendChild(el);
}

/** The seed the refetch request carries when Math.random() returns `value`. */
function seedFor(value) {
	document.body.innerHTML = '';
	installRuntime();
	makeGallery();
	window.fetch = jest.fn(() => new Promise(() => {}));
	jest.spyOn(Math, 'random').mockReturnValue(value);
	jest.isolateModules(() => {
		require(RANDOM);
	});
	window.FotoGrids.boot();

	return JSON.parse(window.fetch.mock.calls[0][1].body).random_seed;
}

beforeEach(() => {
	jest.useFakeTimers();
	delete window.FotoGrids;
	delete window.fetch;
	jest.restoreAllMocks();
});

afterEach(() => {
	jest.useRealTimers();
});

describe('the minted seed', () => {
	it('SORT-08: is 1 when Math.random() returns 0', () => {
		expect(seedFor(0)).toBe(1);
	});

	it('SORT-08: never passes 2^31-1 when Math.random() is just under 1', () => {
		const seed = seedFor(0.9999999999999999);

		expect(Number.isInteger(seed)).toBe(true);
		expect(seed).toBeLessThanOrEqual(SEED_MAX);
		expect(seed).toBeGreaterThan(SEED_MAX - 2);
	});
});
