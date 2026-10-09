/**
 * Tests for the Lightbox Grid share menu (public/render/lightbox/grid/
 * lightbox-grid.js), with the Sharing and Stats modules it hands the share to.
 *
 * The menu shares the page, so a share from it is recorded against the
 * gallery being viewed.
 */

const NETWORKS = [
	'facebook',
	'x',
	'pinterest',
	'linkedin',
	'whatsapp',
	'telegram',
	'reddit',
	'email',
	'copy_link',
];

const REPORTED = { x: 'twitter', copy_link: 'copy' };

const SHARE_LABELS = {
	facebook: 'Facebook',
	x: 'X',
	pinterest: 'Pinterest',
	linkedin: 'LinkedIn',
	whatsapp: 'WhatsApp',
	telegram: 'Telegram',
	reddit: 'Reddit',
	email: 'Email',
	copy_link: 'Copy link',
	share_on: 'Share on %s',
	link_copied: 'Link copied',
	copy_failed: 'Copy failed',
};

const GRID_LABELS = {
	all_photos: 'All photos',
	back: 'Back',
	share: 'Share',
	close_image: 'Close image',
	previous: 'Previous',
	next: 'Next',
	item: 'Item %d',
	item_of: '%1$d of %2$d',
};

function makeGallery(stats) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	el.dataset.fgGalleryId = '7';
	if (stats) {
		el.dataset.fgStats = JSON.stringify({
			enabled: true,
			restUrl: 'http://localhost/wp-json/fotogrids/v1/',
			objectType: 'gallery',
			objectId: 7,
		});
	}
	document.body.appendChild(el);
	return el;
}

function openGrid(galleryEl) {
	window.FotoGrids.modules.lightboxGrid.open({
		items: [{ id: 42, full: 'https://example.com/a.jpg' }],
		galleryEl,
		sharing: {
			enabled: true,
			networks: Object.fromEntries(NETWORKS.map((n) => [n, true])),
			labels: SHARE_LABELS,
		},
		labels: GRID_LABELS,
	});
	document.querySelector('.fg-lb-grid-share').click();
}

async function shareOn(network) {
	document
		.querySelector(`.fg-lb-grid-share-popover [data-network="${network}"]`)
		.click();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function shareBodies() {
	return global.fetch.mock.calls
		.filter(([url]) => url.endsWith('stats/share'))
		.map(([, init]) => JSON.parse(init.body));
}

describe('lightbox grid: share menu', () => {
	beforeAll(() => {
		window.FotoGrids = { modules: {}, scopeCss: () => '' };
		global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: jest.fn(() => Promise.resolve()) },
			configurable: true,
		});
		jest.isolateModules(() => {
			require('../../../public/render/decorators/sharing/sharing');
			require('../../../public/render/features/stats/stats');
			require('../../../public/render/lightbox/grid/lightbox-grid');
		});
	});

	afterAll(() => {
		delete navigator.clipboard;
	});

	beforeEach(() => {
		global.fetch.mockClear();
		jest.spyOn(window, 'open').mockImplementation(() => null);
	});

	afterEach(() => {
		window.FotoGrids.modules.lightboxGrid.close();
		document.body.innerHTML = '';
		window.open.mockRestore();
	});

	it.each(NETWORKS)(
		'records a share on %s against the gallery',
		async (network) => {
			openGrid(makeGallery(true));

			await shareOn(network);

			expect(shareBodies()).toEqual([
				{
					object_type: 'gallery',
					object_id: 7,
					network: REPORTED[network] || network,
				},
			]);
		}
	);

	it('shares the page link', async () => {
		openGrid(makeGallery(true));

		await shareOn('linkedin');

		expect(window.open.mock.calls[0][0]).toContain(
			encodeURIComponent('http://localhost/')
		);
	});

	it('records nothing when the gallery has statistics off', async () => {
		openGrid(makeGallery(false));

		await shareOn('linkedin');

		expect(window.open).toHaveBeenCalledTimes(1);
		expect(shareBodies()).toHaveLength(0);
	});
});
