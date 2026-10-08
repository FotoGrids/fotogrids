/**
 * Tests for public/render/features/stats/stats.js (IIFE; wires its listeners
 * on import).
 *
 * Every slide the lightbox shows records one item view, through the stats
 * config of the gallery the lightbox belongs to.
 */

const MODULE = '../../../public/render/features/stats/stats';

const STATS_CONFIG = {
	enabled: true,
	restUrl: 'http://localhost/wp-json/fotogrids/v1/',
	nonce: 'abc123',
	objectType: 'gallery',
	objectId: 7,
};

function makeGallery(config) {
	const gallery = document.createElement('div');
	gallery.className = 'fotogrids-collection fotogrids-gallery';
	gallery.dataset.fgGalleryId = '7';
	if (config) {
		gallery.dataset.fgStats = JSON.stringify(config);
	}
	document.body.appendChild(gallery);
	return gallery;
}

function fireLightbox(galleryEl, name, detail) {
	galleryEl.dispatchEvent(
		new window.CustomEvent(`fotogrids:lightbox:${name}`, {
			bubbles: true,
			detail: { galleryEl, ...detail },
		})
	);
}

function itemViewCalls() {
	return global.fetch.mock.calls
		.map(([url, init]) => ({ url, init, body: JSON.parse(init.body) }))
		.filter(({ body }) => body.object_type === 'item');
}

describe('stats: lightbox item views', () => {
	beforeAll(() => {
		global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
		jest.isolateModules(() => {
			require(MODULE);
		});
	});

	beforeEach(() => {
		global.fetch.mockClear();
		document.body.innerHTML = '';
	});

	it('records a view for the item the lightbox opens on', () => {
		const gallery = makeGallery(STATS_CONFIG);

		fireLightbox(gallery, 'open', { index: 0, item: { id: '42' } });

		const calls = itemViewCalls();
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(
			'http://localhost/wp-json/fotogrids/v1/stats/view'
		);
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.credentials).toBe('omit');
		expect(calls[0].init.headers).not.toHaveProperty('X-WP-Nonce');
		expect(calls[0].body).toEqual({ object_type: 'item', object_id: 42 });
	});

	it('records a view for each slide navigated to', () => {
		const gallery = makeGallery(STATS_CONFIG);

		fireLightbox(gallery, 'open', { index: 0, item: { id: '42' } });
		fireLightbox(gallery, 'navigate', {
			index: 1,
			item: { id: '43' },
			direction: 'next',
		});
		fireLightbox(gallery, 'navigate', {
			index: 0,
			item: { id: '42' },
			direction: 'prev',
		});

		expect(itemViewCalls().map(({ body }) => body.object_id)).toEqual([
			42, 43, 42,
		]);
	});

	it('records nothing for a gallery with statistics disabled', () => {
		const gallery = makeGallery({ ...STATS_CONFIG, enabled: false });

		fireLightbox(gallery, 'open', { index: 0, item: { id: '42' } });

		expect(itemViewCalls()).toHaveLength(0);
	});

	it('records nothing for a gallery without a stats config', () => {
		const gallery = makeGallery(null);

		fireLightbox(gallery, 'open', { index: 0, item: { id: '42' } });

		expect(itemViewCalls()).toHaveLength(0);
	});

	it('records nothing for a slide without an item id', () => {
		const gallery = makeGallery(STATS_CONFIG);

		fireLightbox(gallery, 'open', { index: 0, item: { id: '' } });

		expect(itemViewCalls()).toHaveLength(0);
	});
});
