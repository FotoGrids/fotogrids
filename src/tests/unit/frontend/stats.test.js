/**
 * Tests that public/render/features/stats/stats.js sends one view ping per
 * gallery and per album wrapper, through the real runtime.
 */

const RUNTIME = '../../../public/render/internal/runtime/runtime';
const STATS = '../../../public/render/features/stats/stats';

function loadWithRuntime() {
	jest.isolateModules(() => {
		require(RUNTIME);
	});
	jest.isolateModules(() => {
		require(STATS);
	});
}

function makeCollection(kind, objectId, stats = true) {
	const el = document.createElement('div');
	el.className = `fotogrids-collection fotogrids-${kind}`;
	el.dataset.fgGalleryId = kind === 'gallery' ? String(objectId) : '0';
	if (kind === 'album') {
		el.dataset.fgAlbumId = String(objectId);
	}
	if (stats) {
		el.setAttribute(
			'data-fg-stats',
			JSON.stringify({
				enabled: true,
				restUrl: 'https://example.com/wp-json/fotogrids/v1/',
				nonce: 'abc',
				objectType: kind,
				objectId,
			})
		);
	}
	document.body.appendChild(el);
	return el;
}

function viewBodies() {
	return global.fetch.mock.calls
		.filter(([url]) => url.endsWith('stats/view'))
		.map(([, opts]) => JSON.parse(opts.body));
}

beforeEach(() => {
	document.body.innerHTML = '';
	delete window.FotoGrids;
	global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
});

afterEach(() => {
	delete global.fetch;
});

describe('stats view tracking', () => {
	it('sends one album view for an album wrapper', () => {
		makeCollection('album', 42);
		loadWithRuntime();

		expect(viewBodies()).toEqual([{ object_type: 'album', object_id: 42 }]);
	});

	it('sends one gallery view for a gallery wrapper', () => {
		makeCollection('gallery', 7);
		loadWithRuntime();

		expect(viewBodies()).toEqual([
			{ object_type: 'gallery', object_id: 7 },
		]);
	});

	it('sends a view for every collection on the page', () => {
		makeCollection('album', 42);
		makeCollection('gallery', 7);
		loadWithRuntime();

		expect(viewBodies()).toEqual(
			expect.arrayContaining([
				{ object_type: 'album', object_id: 42 },
				{ object_type: 'gallery', object_id: 7 },
			])
		);
		expect(viewBodies()).toHaveLength(2);
	});

	it('does not send a second view for the same wrapper', () => {
		makeCollection('album', 42);
		loadWithRuntime();
		jest.isolateModules(() => {
			require(STATS);
		});

		expect(viewBodies()).toHaveLength(1);
	});

	it('skips collections without a stats config', () => {
		makeCollection('album', 42, false);
		loadWithRuntime();

		expect(viewBodies()).toHaveLength(0);
	});
});
