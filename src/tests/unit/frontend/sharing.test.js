/**
 * Tests for public/render/decorators/sharing/sharing.js (IIFE; publishes its
 * API on window.FotoGridsSharing on import).
 *
 * Every network a site owner can enable renders a button, so every button
 * must do something: open the network's share dialog, or write the link to
 * the clipboard, and report the share as a fotogrids:share event.
 */

const MODULE = '../../../public/render/decorators/sharing/sharing';

const ALL_NETWORKS = [
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

const SHARE_TARGET = 'http://localhost/#fg-7-42';

function loadModule() {
	jest.isolateModules(() => {
		require(MODULE);
	});
	return window.FotoGridsSharing;
}

function makeGallery() {
	const gallery = document.createElement('div');
	gallery.className = 'fotogrids-collection fotogrids-gallery';
	gallery.dataset.fgGalleryId = '7';
	document.body.appendChild(gallery);
	return gallery;
}

function renderBar(api, networks, { caption = 'Harbour at dawn' } = {}) {
	const enabled = {};
	networks.forEach((n) => {
		enabled[n] = true;
	});
	const galleryEl = makeGallery();
	const bar = api.renderShareBar(
		{ networks: enabled, button_style: 'icons_only' },
		{
			id: 42,
			fullUrl: 'https://example.com/wp-content/uploads/harbour.jpg',
			caption,
			galleryEl,
			galleryId: '7',
		}
	);
	galleryEl.appendChild(bar);
	return bar;
}

function click(bar, network) {
	bar.querySelector(`[data-network="${network}"]`).click();
}

describe('sharing', () => {
	let api;
	let shares;
	let onShare;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState({}, '', '/');
		delete window.fotogridsSharing;
		jest.spyOn(window, 'open').mockImplementation(() => null);
		shares = [];
		onShare = (e) => shares.push(e.detail);
		document.addEventListener('fotogrids:share', onShare);
		api = loadModule();
	});

	afterEach(() => {
		document.removeEventListener('fotogrids:share', onShare);
		delete window.FotoGridsSharing;
	});

	it('renders a button for every network', () => {
		const bar = renderBar(api, ALL_NETWORKS);
		const rendered = Array.from(
			bar.querySelectorAll('.fotogrids-share-bar__btn')
		).map((b) => b.dataset.network);
		expect(rendered).toEqual(ALL_NETWORKS);
	});

	it.each(ALL_NETWORKS.filter((n) => n !== 'copy_link'))(
		'%s opens a share window and records the share',
		(network) => {
			const bar = renderBar(api, [network]);
			click(bar, network);

			expect(window.open).toHaveBeenCalledTimes(1);
			expect(window.open.mock.calls[0][0]).toContain(
				encodeURIComponent(SHARE_TARGET)
			);
			expect(shares).toEqual([
				{ itemId: '42', network: api.networkKeyFor(network) },
			]);
		}
	);

	it('copy_link writes the link to the clipboard and records the share', async () => {
		const writeText = jest.fn(() => Promise.resolve());
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});

		click(renderBar(api, ['copy_link']), 'copy_link');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(writeText).toHaveBeenCalledWith(SHARE_TARGET);
		expect(window.open).not.toHaveBeenCalled();
		expect(shares).toEqual([{ itemId: '42', network: 'copy' }]);

		delete navigator.clipboard;
	});

	describe('share-intent URLs', () => {
		const target = encodeURIComponent(SHARE_TARGET);
		const caption = encodeURIComponent('Harbour at dawn');

		it.each([
			[
				'linkedin',
				`https://www.linkedin.com/sharing/share-offsite/?url=${target}`,
			],
			[
				'whatsapp',
				`https://wa.me/?text=${encodeURIComponent(
					'Harbour at dawn ' + SHARE_TARGET
				)}`,
			],
			[
				'telegram',
				`https://t.me/share/url?url=${target}&text=${caption}`,
			],
			[
				'reddit',
				`https://www.reddit.com/submit?url=${target}&title=${caption}`,
			],
		])('%s', (network, expected) => {
			click(renderBar(api, [network]), network);
			expect(window.open.mock.calls[0][0]).toBe(expected);
		});

		it('whatsapp sends only the link when the item has no caption', () => {
			click(renderBar(api, ['whatsapp'], { caption: '' }), 'whatsapp');
			expect(window.open.mock.calls[0][0]).toBe(
				`https://wa.me/?text=${target}`
			);
		});
	});

	it('an unknown network does nothing', async () => {
		const proxy = document.createElement('span');
		await expect(api.shareItem(proxy, 'myspace')).resolves.toBe(false);
		expect(window.open).not.toHaveBeenCalled();
		expect(shares).toEqual([]);
	});
});
