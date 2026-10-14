/**
 * Instance IDs sent by album-to-gallery-ajax.js and password-gate.js.
 */

const ALBUM_MODULE =
	'../../../public/render/decorators/album-to-gallery-ajax/album-to-gallery-ajax';
const GATE_MODULE = '../../../public/render/gates/password/password-gate';

const RENDER_URL = 'https://example.com/wp-json/fotogrids/v1/gallery/render';

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

function addAlbum(id, galleryId, instanceId) {
	const album = document.createElement('div');
	album.id = id;
	album.className = 'fotogrids-collection fotogrids-album';
	album.innerHTML =
		`<a href="/gallery/${galleryId}" data-fg-album-ajax-trigger` +
		` data-fg-gallery-id="${galleryId}" data-fg-render-url="${RENDER_URL}"` +
		(instanceId ? ` data-fg-instance-id="${instanceId}"` : '') +
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

	it('asks for the instance ID the album gave the tile', () => {
		const album = addAlbum('fg-3-2', 7, 'fg-7-a2');
		const calls = stubFetch();
		window.FotoGrids.boot();

		click(album);

		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({
			gallery_id: 7,
			instance_id: 'fg-7-a2',
		});
	});

	it('asks for the same ID whichever album is opened first', () => {
		const first = addAlbum('fg-3-2', 7, 'fg-7-a2');
		const second = addAlbum('fg-3-3', 7, 'fg-7-a3');
		const calls = stubFetch();
		window.FotoGrids.boot();

		click(second);
		click(first);

		expect(calls.map((c) => c.body.instance_id)).toEqual([
			'fg-7-a3',
			'fg-7-a2',
		]);
	});

	it('leaves the ID to the server when the tile carries none', () => {
		const album = addAlbum('fg-3-2', 7);
		const calls = stubFetch();
		window.FotoGrids.boot();

		click(album);

		expect(calls[0].body).not.toHaveProperty('instance_id');
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
