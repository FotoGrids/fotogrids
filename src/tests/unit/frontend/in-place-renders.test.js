/**
 * Tests for the two scripts that render a gallery into a page already open:
 *
 *   - public/render/decorators/album-to-gallery-ajax/album-to-gallery-ajax.js
 *   - public/render/gates/password/password-gate.js
 *
 * The server renders those galleries in a request of its own, so it cannot
 * know which instance IDs the page uses. The page tells it.
 */

const ALBUM_MODULE =
	'../../../public/render/decorators/album-to-gallery-ajax/album-to-gallery-ajax';
const GATE_MODULE = '../../../public/render/gates/password/password-gate';

const RENDER_URL = 'https://example.com/wp-json/fotogrids/v1/gallery/render';

/** Stand-in for window.FotoGrids: an onAlbum queue run against every album. */
function installRuntime() {
	const albumCallbacks = [];
	window.FotoGrids = {
		modules: {},
		onAlbum(cb) {
			albumCallbacks.push(cb);
		},
		boot() {
			document.querySelectorAll('.fotogrids-album').forEach((el) => {
				albumCallbacks.forEach((cb) => cb(el));
			});
		},
	};
}

function addGallery(id) {
	const el = document.createElement('div');
	el.id = id;
	el.className = 'fotogrids-collection fotogrids-gallery';
	document.body.appendChild(el);
	return el;
}

function addAlbum(id, galleryId) {
	const album = document.createElement('div');
	album.id = id;
	album.className = 'fotogrids-collection fotogrids-album';
	album.innerHTML =
		`<a href="/gallery/${galleryId}" data-fg-album-ajax-trigger` +
		` data-fg-gallery-id="${galleryId}" data-fg-render-url="${RENDER_URL}"` +
		' data-fg-render-nonce="n">Open</a>';
	document.body.appendChild(album);
	return album;
}

function click(album) {
	album.querySelector('[data-fg-album-ajax-trigger]').dispatchEvent(
		new MouseEvent('click', {
			bubbles: true,
			cancelable: true,
			button: 0,
		})
	);
}

/** Records every request body and leaves each response for the test to settle. */
function stubFetch() {
	const calls = [];
	window.fetch = jest.fn((url, init) => {
		let settle;
		const pending = new Promise((resolve) => {
			settle = resolve;
		});
		calls.push({ body: JSON.parse(init.body), settle });
		return pending;
	});
	return calls;
}

function respond(call, payload, ok = true) {
	call.settle({
		ok,
		json: () => Promise.resolve(payload),
	});
	let flushed = Promise.resolve();
	for (let i = 0; i < 8; i++) {
		flushed = flushed.then(() => undefined);
	}
	return flushed;
}

function load(path) {
	jest.isolateModules(() => {
		require(path);
	});
}

describe('album to gallery swap', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		delete window.FotoGrids;
		installRuntime();
		load(ALBUM_MODULE);
	});

	afterEach(() => {
		delete window.fetch;
	});

	it('asks for the first instance ID of the gallery the page does not use', () => {
		addGallery('fg-7-1');
		const album = addAlbum('fg-3-2', 7);
		const calls = stubFetch();
		window.FotoGrids.boot();

		click(album);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({
			gallery_id: 7,
			instance_id: 'fg-7-2',
		});
	});

	it('asks for fg-{gallery}-1 when the gallery is not on the page', () => {
		addGallery('fg-8-1');
		const album = addAlbum('fg-3-2', 7);
		const calls = stubFetch();
		window.FotoGrids.boot();

		click(album);

		expect(calls[0].body.instance_id).toBe('fg-7-1');
	});

	it('gives two swaps started together different IDs', () => {
		addGallery('fg-7-1');
		const first = addAlbum('fg-3-2', 7);
		const second = addAlbum('fg-3-3', 7);
		const calls = stubFetch();
		window.FotoGrids.boot();

		click(first);
		click(second);

		expect(calls.map((c) => c.body.instance_id)).toEqual([
			'fg-7-2',
			'fg-7-3',
		]);
	});

	it('skips the ID a finished swap put on the page', async () => {
		addGallery('fg-7-1');
		const first = addAlbum('fg-3-2', 7);
		const second = addAlbum('fg-3-3', 7);
		const calls = stubFetch();
		window.FotoGrids.boot();

		click(first);
		await respond(calls[0], {
			html: '<div id="fg-7-2" class="fotogrids-collection fotogrids-gallery"></div>',
		});
		expect(first.querySelector('#fg-7-2')).not.toBeNull();

		click(second);

		expect(calls[1].body.instance_id).toBe('fg-7-3');
	});

	it('releases the ID of a swap that failed', async () => {
		addGallery('fg-7-1');
		const first = addAlbum('fg-3-2', 7);
		const second = addAlbum('fg-3-3', 7);
		const calls = stubFetch();
		window.FotoGrids.boot();
		// The failed swap falls back to navigating to the trigger's href.
		first
			.querySelector('[data-fg-album-ajax-trigger]')
			.setAttribute('href', '#');

		click(first);
		await respond(calls[0], {}, false);

		click(second);

		expect(calls[1].body.instance_id).toBe('fg-7-2');
	});
});

describe('password unlock', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		delete window.FotoGrids;
	});

	afterEach(() => {
		delete window.fetch;
	});

	function addGate(id, galleryId) {
		const gate = document.createElement('div');
		gate.id = id;
		gate.className = 'fotogrids-gate';
		gate.dataset.fgGalleryId = String(galleryId);
		gate.innerHTML =
			'<div class="fg-gate-card">' +
			`<form class="fg-lock-form" data-gallery-id="${galleryId}"` +
			` data-unlock-url="https://example.com/wp-json/fotogrids/v1/gallery/${galleryId}/unlock"` +
			' data-nonce="n">' +
			'<input class="fg-lock-input" type="password" value="secret" />' +
			'<button class="fg-lock-submit" type="submit">Unlock</button>' +
			'<p class="fg-lock-error"></p>' +
			'</form></div>';
		document.body.appendChild(gate);
		return gate;
	}

	it('asks for the lock screen instance ID it replaces', () => {
		addGate('fg-5-1', 5);
		const second = addGate('fg-5-2', 5);
		const calls = stubFetch();
		load(GATE_MODULE);

		second
			.querySelector('.fg-lock-form')
			.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true })
			);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toEqual({
			password: 'secret',
			instance_id: 'fg-5-2',
		});
	});

	it('puts the unlocked gallery where the lock screen was', async () => {
		addGate('fg-5-1', 5);
		const second = addGate('fg-5-2', 5);
		const calls = stubFetch();
		load(GATE_MODULE);

		second
			.querySelector('.fg-lock-form')
			.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true })
			);
		await respond(calls[0], {
			success: true,
			html: '<div id="fg-5-2" class="fotogrids-collection fotogrids-gallery" data-fg-gallery-id="5"></div>',
		});

		const ids = Array.from(document.body.children).map((el) => el.id);
		expect(ids).toEqual(['fg-5-1', 'fg-5-2']);
		expect(document.getElementById('fg-5-2').className).toContain(
			'fotogrids-gallery'
		);
	});
});
