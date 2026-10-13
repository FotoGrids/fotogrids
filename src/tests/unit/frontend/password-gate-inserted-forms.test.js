/**
 * Lock forms password-gate.js finds after load.
 *
 * Loaded once: each load adds another document listener.
 */

const GATE_MODULE = '../../../public/render/gates/password/password-gate';

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

function submit(gate) {
	gate.querySelector('.fg-lock-form').dispatchEvent(
		new Event('submit', { bubbles: true, cancelable: true })
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

describe('lock forms inserted after load', () => {
	beforeAll(() => {
		document.body.innerHTML = '';
		addGate('fg-5-1', 5);
		jest.isolateModules(() => {
			require(GATE_MODULE);
		});
	});

	afterEach(() => {
		delete window.fetch;
	});

	it('sends one unlock request per submit', () => {
		const calls = stubFetch();
		const inserted = addGate('fg-6-2', 6);

		submit(inserted);

		expect(calls).toHaveLength(1);
		expect(calls[0].body.password).toBe('secret');
	});

	it('can try again after a wrong password', async () => {
		const calls = stubFetch();
		const inserted = addGate('fg-7-3', 7);

		submit(inserted);
		await respond(calls[0], { success: false }, false);
		expect(inserted.querySelector('.fg-lock-error').className).toContain(
			'is-visible'
		);

		inserted.querySelector('.fg-lock-input').value = 'secret';
		submit(inserted);

		expect(calls).toHaveLength(2);
		expect(calls[1].body.password).toBe('secret');
	});

	it('stays in place when the gallery comes back', async () => {
		const calls = stubFetch();
		const inserted = addGate('fg-8-4', 8);

		submit(inserted);
		await respond(calls[0], {
			success: true,
			html: '<div id="fg-8-4" class="fotogrids-collection fotogrids-gallery" data-fg-gallery-id="8"></div>',
		});

		expect(calls).toHaveLength(1);
		expect(document.getElementById('fg-8-4').className).toContain(
			'fotogrids-gallery'
		);
		expect(document.getElementById('fg-5-1').className).toBe(
			'fotogrids-gate'
		);
	});
});
