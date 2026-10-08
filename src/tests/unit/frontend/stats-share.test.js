/**
 * Tests for public/render/features/stats/stats.js (IIFE; wires its listeners
 * on import).
 *
 * Every share the Sharing module reports records one share when the
 * collection it belongs to has statistics enabled: an item share on any
 * network, and a whole-gallery or album share from the view-page footer.
 */

const MODULE = '../../../public/render/features/stats/stats';

const NETWORKS = [
	'facebook',
	'twitter',
	'pinterest',
	'linkedin',
	'whatsapp',
	'telegram',
	'reddit',
	'email',
	'copy',
];

function makeCollection(kind, objectId, stats = true) {
	const el = document.createElement('div');
	el.className = `fotogrids-collection fotogrids-gallery fotogrids-${kind}`;
	if (stats) {
		el.dataset.fgStats = JSON.stringify({
			enabled: true,
			restUrl: 'http://localhost/wp-json/fotogrids/v1/',
			objectType: kind,
			objectId,
		});
	}
	document.body.appendChild(el);
	return el;
}

function share(detail) {
	document.dispatchEvent(
		new window.CustomEvent('fotogrids:share', { detail })
	);
}

function shareBodies() {
	return global.fetch.mock.calls
		.filter(([url]) => url.endsWith('stats/share'))
		.map(([, init]) => JSON.parse(init.body));
}

describe('stats: shares', () => {
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

	it.each(NETWORKS)('records an item share on %s', (network) => {
		const galleryEl = makeCollection('gallery', 7);

		share({ itemId: '42', network, galleryEl });

		expect(shareBodies()).toEqual([
			{ object_type: 'item', object_id: 42, network },
		]);
	});

	it('skips an item share when its gallery has statistics off', () => {
		makeCollection('gallery', 7);
		const galleryEl = makeCollection('gallery', 8, false);

		share({ itemId: '42', network: 'facebook', galleryEl });

		expect(shareBodies()).toHaveLength(0);
	});

	it('records an item share against its own gallery, not the first on the page', () => {
		makeCollection('gallery', 7, false);
		const galleryEl = makeCollection('gallery', 8);

		share({ itemId: '42', network: 'copy', galleryEl });

		expect(shareBodies()).toEqual([
			{ object_type: 'item', object_id: 42, network: 'copy' },
		]);
	});

	it('skips an item share that carries no gallery', () => {
		makeCollection('gallery', 7);

		share({ itemId: '42', network: 'facebook' });

		expect(shareBodies()).toHaveLength(0);
	});

	it.each([
		['gallery', 7],
		['album', 12],
	])('records a footer share as a share of the %s', (kind, objectId) => {
		makeCollection(kind, objectId);

		share({
			itemId: '',
			network: 'linkedin',
			objectType: kind,
			objectId: String(objectId),
		});

		expect(shareBodies()).toEqual([
			{ object_type: kind, object_id: objectId, network: 'linkedin' },
		]);
	});

	it('skips a footer share when that collection has statistics off', () => {
		makeCollection('gallery', 7, false);
		makeCollection('gallery', 8);

		share({
			itemId: '',
			network: 'copy',
			objectType: 'gallery',
			objectId: '7',
		});

		expect(shareBodies()).toHaveLength(0);
	});
});
