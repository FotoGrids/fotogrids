/**
 * Tests for the script injection order of the two client-side loaders that
 * swap a server-rendered gallery into an already-loaded page:
 * gates/password/password-gate.js (unlock) and
 * decorators/album-to-gallery-ajax/album-to-gallery-ajax.js (album swap).
 *
 * The server returns its js map in collection order, which can list a module
 * before a script it depends on. Injected scripts run in insertion order, so
 * each loader has to append dependencies first.
 */

const JS_MAP = {
	'fotogrids-fg-tooltip': {
		src: 'https://example.com/fg-tooltip.js',
		in_footer: true,
		deps: [],
	},
	'fotogrids-sharing': {
		src: 'https://example.com/sharing.js',
		in_footer: true,
		deps: ['fotogrids-runtime', 'fotogrids-fg-tooltip'],
	},
	'fotogrids-lazy-load': {
		src: 'https://example.com/lazy-load.js',
		in_footer: true,
		deps: ['fotogrids-runtime'],
	},
	'fotogrids-runtime': {
		src: 'https://example.com/fotogrids-runtime.js',
		in_footer: true,
		deps: [],
	},
};

const GALLERY_HTML =
	'<div class="fotogrids-gallery" data-fg-gallery-id="7"></div>';

function respondWith(payload) {
	global.fetch = jest.fn(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve(payload),
		})
	);
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function injectedHandles() {
	return Array.prototype.map.call(
		document.head.querySelectorAll('script[id^="fotogrids-js-"]'),
		(script) => script.id.replace('fotogrids-js-', '')
	);
}

function expectDependenciesFirst(order) {
	Object.keys(JS_MAP).forEach((handle) => {
		JS_MAP[handle].deps.forEach((dep) => {
			if (order.includes(dep)) {
				expect(order.indexOf(dep)).toBeLessThan(order.indexOf(handle));
			}
		});
	});
}

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	window.FotoGrids = { onAlbum: jest.fn(), modules: {} };
});

afterEach(() => {
	delete global.fetch;
});

describe('password-gate unlock', () => {
	function loadGate() {
		jest.isolateModules(() => {
			require('../../../public/render/gates/password/password-gate.js');
		});
	}

	function renderLockScreen() {
		document.body.innerHTML =
			'<div class="fotogrids-gate">' +
			'<div class="fg-gate-card">' +
			'<form class="fg-lock-form" data-gallery-id="7"' +
			' data-unlock-url="https://example.com/unlock" data-nonce="n">' +
			'<input class="fg-lock-input" type="password" value="secret" />' +
			'<button class="fg-lock-submit" type="submit">Unlock</button>' +
			'<p class="fg-lock-error"></p>' +
			'</form></div></div>';
		return document.querySelector('.fg-lock-form');
	}

	async function unlock(form) {
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		await flush();
		await flush();
	}

	it('injects the runtime before the modules that depend on it', async () => {
		respondWith({ success: true, html: GALLERY_HTML, js: JS_MAP });
		const form = renderLockScreen();
		loadGate();

		await unlock(form);

		const order = injectedHandles();
		expect(order).toHaveLength(4);
		expect(order[0]).toBe('fotogrids-fg-tooltip');
		expectDependenciesFirst(order);
		expect(document.querySelector('.fotogrids-gallery')).not.toBeNull();
	});

	it('skips a dependency that is already on the page', async () => {
		const existing = document.createElement('script');
		existing.id = 'fotogrids-runtime-js';
		document.head.appendChild(existing);

		respondWith({ success: true, html: GALLERY_HTML, js: JS_MAP });
		const form = renderLockScreen();
		loadGate();

		await unlock(form);

		const order = injectedHandles();
		expect(order).not.toContain('fotogrids-runtime');
		expect(order.indexOf('fotogrids-fg-tooltip')).toBeLessThan(
			order.indexOf('fotogrids-sharing')
		);
	});
});

describe('album-to-gallery-ajax swap', () => {
	function loadAlbumAjax() {
		jest.isolateModules(() => {
			require('../../../public/render/decorators/album-to-gallery-ajax/album-to-gallery-ajax.js');
		});
	}

	function renderAlbum() {
		document.body.innerHTML =
			'<div class="fotogrids-gallery fotogrids-album">' +
			'<a href="https://example.com/gallery/7" data-fg-album-ajax-trigger' +
			' data-fg-gallery-id="7"' +
			' data-fg-render-url="https://example.com/render"' +
			' data-fg-render-nonce="n">Gallery</a>' +
			'</div>';
		return document.querySelector('.fotogrids-album');
	}

	it('injects the runtime before the modules that depend on it', async () => {
		respondWith({ html: GALLERY_HTML, js: JS_MAP });
		const album = renderAlbum();
		loadAlbumAjax();

		const attach = window.FotoGrids.onAlbum.mock.calls[0][0];
		attach(album);
		album
			.querySelector('[data-fg-album-ajax-trigger]')
			.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true })
			);
		await flush();
		await flush();

		const order = injectedHandles();
		expect(order).toHaveLength(4);
		expectDependenciesFirst(order);
		expect(album.querySelector('.fotogrids-gallery')).not.toBeNull();
	});
});
