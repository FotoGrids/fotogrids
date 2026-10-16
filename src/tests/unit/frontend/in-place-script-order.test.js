/**
 * Galleries swapped in by album-to-gallery-ajax.js and password-gate.js reach
 * the page only after the module scripts their render declared have loaded.
 */

const ALBUM_MODULE =
	'../../../public/render/decorators/album-to-gallery-ajax/album-to-gallery-ajax';
const GATE_MODULE = '../../../public/render/gates/password/password-gate';

const RENDER_URL = 'https://example.com/wp-json/fotogrids/v1/gallery/render';
const SCRIPT_ID = 'fotogrids-js-fotogrids-pagination-load-more';
const GALLERY_HTML =
	'<div id="fg-7-1" class="fotogrids-collection fotogrids-gallery" data-fg-gallery-id="7"></div>';

const PAYLOAD = {
	success: true,
	html: GALLERY_HTML,
	js: {
		'fotogrids-pagination-load-more': {
			src: 'https://example.com/load-more.js',
			in_footer: true,
		},
	},
};

function stubFetch() {
	const calls = [];
	window.fetch = jest.fn(() => {
		let settle;
		const pending = new Promise((resolve) => {
			settle = resolve;
		});
		calls.push({ settle });
		return pending;
	});
	return calls;
}

function flush() {
	let flushed = Promise.resolve();
	for (let i = 0; i < 12; i++) {
		flushed = flushed.then(() => undefined);
	}
	return flushed;
}

function respond(call, payload) {
	call.settle({ ok: true, json: () => Promise.resolve(payload) });
	return flush();
}

function load(path) {
	jest.isolateModules(() => {
		require(path);
	});
}

function swappedIn() {
	return document.querySelector('.fotogrids-gallery');
}

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	delete window.FotoGrids;
});

afterEach(() => {
	delete window.fetch;
});

describe('album to gallery swap', () => {
	function openAlbum() {
		const albumCallbacks = [];
		window.FotoGrids = {
			modules: {},
			onAlbum(cb) {
				albumCallbacks.push(cb);
			},
		};
		const album = document.createElement('div');
		album.className = 'fotogrids-collection fotogrids-album';
		album.innerHTML =
			'<a href="/gallery/7" data-fg-album-ajax-trigger data-fg-gallery-id="7"' +
			` data-fg-render-url="${RENDER_URL}" data-fg-render-nonce="n">Open</a>`;
		document.body.appendChild(album);

		const calls = stubFetch();
		load(ALBUM_MODULE);
		albumCallbacks.forEach((cb) => cb(album));
		album.querySelector('[data-fg-album-ajax-trigger]').dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				button: 0,
			})
		);
		return calls;
	}

	it('waits for a missing module script before inserting the gallery', async () => {
		const calls = openAlbum();
		await respond(calls[0], PAYLOAD);

		const script = document.getElementById(SCRIPT_ID);
		expect(script).not.toBeNull();
		expect(swappedIn()).toBeNull();

		script.dispatchEvent(new Event('load'));
		await flush();

		expect(swappedIn()).not.toBeNull();
	});

	it('still inserts the gallery when a module script fails to load', async () => {
		const calls = openAlbum();
		await respond(calls[0], PAYLOAD);

		document.getElementById(SCRIPT_ID).dispatchEvent(new Event('error'));
		await flush();

		expect(swappedIn()).not.toBeNull();
	});
});

describe('password unlock', () => {
	function submitGate() {
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

		const calls = stubFetch();
		load(GATE_MODULE);
		gate.querySelector('.fg-lock-form').dispatchEvent(
			new Event('submit', { bubbles: true, cancelable: true })
		);
		return calls;
	}

	it('waits for a missing module script before inserting the gallery', async () => {
		const calls = submitGate();
		await respond(calls[0], PAYLOAD);

		const script = document.getElementById(SCRIPT_ID);
		expect(script).not.toBeNull();
		expect(swappedIn()).toBeNull();
		expect(document.querySelector('.fg-lock-form')).not.toBeNull();

		script.dispatchEvent(new Event('load'));
		await flush();

		expect(swappedIn()).not.toBeNull();
		expect(document.querySelector('.fg-lock-form')).toBeNull();
	});

	it('keeps the lock form and shows no gallery after a wrong password', async () => {
		const calls = submitGate();
		await respond(calls[0], { success: false });

		expect(swappedIn()).toBeNull();
		expect(
			document
				.querySelector('.fg-lock-error')
				.classList.contains('is-visible')
		).toBe(true);
	});
});
