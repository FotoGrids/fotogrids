/**
 * Pagination, random refetch, album-to-gallery and password unlock add only
 * the stylesheets a response needs that the page does not already link,
 * including ones WordPress printed as `{handle}-css`.
 */

const PAGINATION = '../../../public/render/features/pagination/pagination-core';
const RANDOM = '../../../public/render/sorters/random/random-sort';
const ALBUM =
	'../../../public/render/decorators/album-to-gallery-ajax/album-to-gallery-ajax';
const GATE = '../../../public/render/gates/password/password-gate';

const RENDER_URL = 'https://example.com/wp-json/fotogrids/v1/gallery/render';
const PRINTED_URL = 'https://example.com/captions.css';
const MISSING_URL = 'https://example.com/lightbox.css';
const CSS = {
	'fotogrids-captions': PRINTED_URL,
	'fotogrids-lightbox': MISSING_URL,
};
const ITEMS =
	'<div class="fg-grid-track" data-fg-items-root="true"><figure class="fg-item"></figure></div>';
const GALLERY =
	'<div class="fotogrids-collection fotogrids-gallery" data-fg-gallery-id="7"></div>';

function printStylesheet() {
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.id = 'fotogrids-captions-css';
	link.href = PRINTED_URL;
	document.head.appendChild(link);
}

function linksTo(url) {
	return Array.from(
		document.querySelectorAll('link[rel="stylesheet"]')
	).filter((link) => link.href === url);
}

function stubFetch(payload) {
	window.fetch = jest.fn(() =>
		Promise.resolve({ ok: true, json: () => Promise.resolve(payload) })
	);
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function load(path) {
	jest.isolateModules(() => {
		require(path);
	});
}

function expectOnlyMissingAdded() {
	expect(linksTo(PRINTED_URL)).toHaveLength(1);
	expect(linksTo(MISSING_URL)).toHaveLength(1);
	expect(
		document.getElementById('fotogrids-css-fotogrids-captions')
	).toBeNull();
	expect(
		document.getElementById('fotogrids-css-fotogrids-lightbox')
	).not.toBeNull();
}

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	delete window.FotoGrids;
	printStylesheet();
});

afterEach(() => {
	delete window.fetch;
});

it('pagination adds only the stylesheets the page does not link', async () => {
	const subscribers = [];
	window.FotoGrids = {
		modules: {},
		activeBreakpoint: () => 'mobile',
		onGallery(cb) {
			subscribers.push(cb);
		},
	};
	const gallery = document.createElement('div');
	gallery.className = 'fotogrids-collection fotogrids-gallery';
	gallery.dataset.fgGalleryId = '5';
	gallery.dataset.fgPaginated = 'true';
	gallery.dataset.fgPageCurrent = '1';
	gallery.dataset.fgPageTotal = '3';
	gallery.dataset.fgPageSize = '24';
	gallery.dataset.fgPageSizes = '24 18 12';
	gallery.dataset.fgRenderUrl = RENDER_URL;
	gallery.dataset.fgRenderNonce = 'n';
	gallery.innerHTML = ITEMS;
	document.body.appendChild(gallery);
	stubFetch({
		html: ITEMS,
		css: CSS,
		page: 1,
		page_size: 12,
		total_pages: 6,
		has_more: true,
	});

	load(PAGINATION);
	subscribers.forEach((cb) => cb(gallery));
	await flush();

	expect(window.fetch).toHaveBeenCalledTimes(1);
	expectOnlyMissingAdded();
});

it('random refetch adds only the stylesheets the page does not link', async () => {
	const subscribers = [];
	window.FotoGrids = {
		onCollection(cb) {
			subscribers.push(cb);
		},
	};
	const collection = document.createElement('div');
	collection.className = 'fotogrids-collection fotogrids-gallery';
	collection.dataset.fgGalleryId = '9';
	collection.setAttribute('data-fg-random-mode', 'refetch');
	collection.dataset.fgRenderUrl = RENDER_URL;
	collection.dataset.fgRenderNonce = 'n';
	collection.innerHTML = ITEMS;
	document.body.appendChild(collection);
	stubFetch({ html: ITEMS, css: CSS });

	load(RANDOM);
	subscribers.forEach((cb) => cb(collection));
	await flush();

	expect(window.fetch).toHaveBeenCalledTimes(1);
	expectOnlyMissingAdded();
});

it('album-to-gallery adds only the stylesheets the page does not link', async () => {
	const subscribers = [];
	window.FotoGrids = {
		modules: {},
		onAlbum(cb) {
			subscribers.push(cb);
		},
	};
	const album = document.createElement('div');
	album.className = 'fotogrids-collection fotogrids-album';
	album.innerHTML =
		'<a href="/gallery/7" data-fg-album-ajax-trigger data-fg-gallery-id="7"' +
		` data-fg-render-url="${RENDER_URL}" data-fg-render-nonce="n">Open</a>`;
	document.body.appendChild(album);
	stubFetch({ success: true, html: GALLERY, css: CSS, js: {} });

	load(ALBUM);
	subscribers.forEach((cb) => cb(album));
	album
		.querySelector('[data-fg-album-ajax-trigger]')
		.dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				button: 0,
			})
		);
	await flush();

	expect(window.fetch).toHaveBeenCalledTimes(1);
	expectOnlyMissingAdded();
});

it('password unlock adds only the stylesheets the page does not link', async () => {
	const gate = document.createElement('div');
	gate.className = 'fotogrids-gate';
	gate.innerHTML =
		'<div class="fg-gate-card">' +
		'<form class="fg-lock-form" data-gallery-id="7"' +
		' data-unlock-url="https://example.com/wp-json/fotogrids/v1/gallery/7/unlock"' +
		' data-nonce="n">' +
		'<input class="fg-lock-input" type="password" value="secret" />' +
		'<button class="fg-lock-submit" type="submit">Unlock</button>' +
		'<p class="fg-lock-error"></p>' +
		'</form></div>';
	document.body.appendChild(gate);
	stubFetch({ success: true, html: GALLERY, css: CSS, js: {} });

	load(GATE);
	gate.querySelector('.fg-lock-form').dispatchEvent(
		new Event('submit', { bubbles: true, cancelable: true })
	);
	await flush();

	expect(window.fetch).toHaveBeenCalledTimes(1);
	expectOnlyMissingAdded();
});
