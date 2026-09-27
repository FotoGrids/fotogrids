/**
 * Tests that the loading-icon and classic lightbox modules wire collections
 * through the runtime (window.FotoGrids) and the fotogrids:items_inserted
 * event, without installing a MutationObserver of their own.
 */

const RUNTIME = '../../../public/render/internal/runtime/runtime';
const LOADING_ICON =
	'../../../public/render/features/loading-icon/loading-icon';
const LIGHTBOX = '../../../public/render/lightbox/classic/lightbox';

const NativeObserver = window.MutationObserver;
let observersCreated = 0;

/**
 * Loads the runtime, then the given module, in a fresh module registry.
 *
 * @param {string} modulePath
 */
function loadWithRuntime(modulePath) {
	jest.isolateModules(() => {
		require(RUNTIME);
	});
	const afterRuntime = observersCreated;
	jest.isolateModules(() => {
		require(modulePath);
	});
	return observersCreated - afterRuntime;
}

function makeItem() {
	const item = document.createElement('figure');
	item.className = 'fg-item';
	item.setAttribute('data-fg-media-state', 'loading');
	item.innerHTML =
		'<div class="fg-item-loader"><svg></svg></div>' +
		'<div class="fg-item-media"><a href="#" data-fg-lightbox-trigger="1"><img alt=""></a></div>';
	Object.defineProperty(item.querySelector('img'), 'complete', {
		configurable: true,
		get: () => false,
	});
	return item;
}

function makeCollection(kind, attrs = {}) {
	const el = document.createElement('div');
	el.className = `fotogrids-collection fotogrids-${kind}`;
	el.dataset.fgGalleryId = kind === 'gallery' ? '7' : '0';
	Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
	const track = document.createElement('div');
	track.className = 'fg-grid-track';
	track.appendChild(makeItem());
	el.appendChild(track);
	return el;
}

function settleImage(item) {
	item.querySelector('img').dispatchEvent(new Event('load'));
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 60));

beforeEach(() => {
	document.body.innerHTML = '';
	delete window.FotoGrids;
	delete window.fgLoaderHandles;
	observersCreated = 0;
	window.MutationObserver = class extends NativeObserver {
		constructor(cb) {
			super(cb);
			observersCreated++;
		}
	};
});

afterAll(() => {
	window.MutationObserver = NativeObserver;
});

describe('loading-icon.js', () => {
	let animate;

	beforeEach(() => {
		animate = jest.fn(() => [{ cancel: jest.fn() }]);
		window.fotogridsLoadingIcons = { dots: { animate } };
	});

	test('does not construct a MutationObserver', () => {
		expect(loadWithRuntime(LOADING_ICON)).toBe(0);
	});

	test('wires a gallery present at load', async () => {
		const gallery = makeCollection('gallery');
		document.body.appendChild(gallery);
		loadWithRuntime(LOADING_ICON);
		await flush();

		const item = gallery.querySelector('.fg-item');
		expect(animate).toHaveBeenCalled();
		settleImage(item);
		expect(item.getAttribute('data-fg-media-state')).toBe('loaded');
	});

	test.each(['gallery', 'album'])(
		'wires a %s inserted after load',
		async (kind) => {
			loadWithRuntime(LOADING_ICON);
			const collection = makeCollection(kind);
			const wrapper = document.createElement('section');
			wrapper.appendChild(collection);
			document.body.appendChild(wrapper);
			await flush();

			const item = collection.querySelector('.fg-item');
			expect(animate).toHaveBeenCalledTimes(1);
			settleImage(item);
			expect(item.getAttribute('data-fg-media-state')).toBe('loaded');
		}
	);

	test('wires items announced by fotogrids:items_inserted', async () => {
		const gallery = makeCollection('gallery');
		document.body.appendChild(gallery);
		loadWithRuntime(LOADING_ICON);
		await flush();
		animate.mockClear();

		const added = makeItem();
		gallery.querySelector('.fg-grid-track').appendChild(added);
		gallery.dispatchEvent(
			new CustomEvent('fotogrids:items_inserted', {
				bubbles: true,
				detail: { items: [added], galleryEl: gallery },
			})
		);

		expect(animate).toHaveBeenCalledTimes(1);
		expect(window.fgLoaderHandles.has(added)).toBe(true);
		settleImage(added);
		expect(added.getAttribute('data-fg-media-state')).toBe('loaded');
		expect(window.fgLoaderHandles.has(added)).toBe(false);
	});
});

describe('classic lightbox.js', () => {
	const lightboxGallery = () =>
		makeCollection('gallery', {
			'data-fg-click': 'lightbox',
			'data-fg-lightbox-variant': 'full',
		});

	test('does not construct a MutationObserver', () => {
		expect(loadWithRuntime(LIGHTBOX)).toBe(0);
	});

	test('activates a lightbox gallery present at load', () => {
		const gallery = lightboxGallery();
		document.body.appendChild(gallery);
		loadWithRuntime(LIGHTBOX);

		expect(gallery.querySelector('.fg-item').getAttribute('tabindex')).toBe(
			'0'
		);
	});

	test('activates a lightbox gallery inserted after load', async () => {
		loadWithRuntime(LIGHTBOX);
		const gallery = lightboxGallery();
		document.body.appendChild(gallery);
		await flush();

		expect(gallery.querySelector('.fg-item').getAttribute('tabindex')).toBe(
			'0'
		);
	});

	test('leaves galleries without the lightbox click, or with another variant, alone', async () => {
		loadWithRuntime(LIGHTBOX);
		const plain = makeCollection('gallery');
		const mini = makeCollection('gallery', {
			'data-fg-click': 'lightbox',
			'data-fg-lightbox-variant': 'mini',
		});
		document.body.append(plain, mini);
		await flush();

		expect(plain.querySelector('.fg-item').hasAttribute('tabindex')).toBe(
			false
		);
		expect(mini.querySelector('.fg-item').hasAttribute('tabindex')).toBe(
			false
		);
	});
});
