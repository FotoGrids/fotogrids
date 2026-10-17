/**
 * Captions in the Grid and Mini lightboxes go through the browser formatter:
 * links work where the caption is not a click target, titles stay plain,
 * and stored markup is never inserted as HTML.
 */

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

const MINI_LABELS = {
	dialog: 'Image viewer',
	previous: 'Previous',
	next: 'Next',
	close: 'Close',
	go_to_image: 'Go to image %d',
};

const CONFIG = JSON.stringify({
	mode: 'basic',
	policy: { newTab: false, rel: [] },
	labels: { newTab: '(opens in a new tab)' },
});

const ITEM = {
	id: 42,
	full: 'https://example.com/a.jpg',
	title: 'Harbour &quot;north&quot; <b>pier</b>',
	caption: 'Boats <em>leaving</em> the <a href="https://example.com/pier">pier</a><img src=x onerror="window.__pwned=1">',
	alt: 'Boats',
};

function makeGallery(attributes) {
	const el = document.createElement('div');
	el.className = 'fotogrids-collection fotogrids-gallery';
	for (const [name, value] of Object.entries(attributes)) {
		el.setAttribute(name, value);
	}
	document.body.appendChild(el);
	return el;
}

beforeAll(() => {
	window.FotoGrids = { modules: {}, scopeCss: () => '' };
	window.matchMedia =
		window.matchMedia ||
		(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
	jest.isolateModules(() => {
		require('../../../public/render/formatted-text/formatted-text');
		require('../../../public/render/lightbox/grid/lightbox-grid');
		require('../../../public/render/lightbox/mini-viewer/lightbox-mini-viewer');
	});
});

afterEach(() => {
	window.FotoGrids.modules.lightboxGrid.close();
	window.FotoGrids.modules.lightboxMiniViewer.close();
	document.body.innerHTML = '';
});

describe('Grid lightbox captions', () => {
	function openGrid() {
		const galleryEl = makeGallery({ 'data-fg-text-lightbox-grid': CONFIG });
		window.FotoGrids.modules.lightboxGrid.open({
			items: [ITEM],
			galleryEl,
			labels: GRID_LABELS,
			captions: true,
			fullCaptions: true,
			captionSource: 'caption',
		});
	}

	it('shows tile captions with links as text and a plain aria-label', () => {
		openGrid();
		const tile = document.querySelector('.fg-lb-grid-tile');
		expect(tile.getAttribute('aria-label')).toBe('Harbour "north" pier');
		const caption = tile.querySelector('.fg-lb-grid-tile-caption');
		expect(caption.innerHTML).toBe('Boats <em>leaving</em> the pier');
		expect(window.__pwned).toBeUndefined();
	});

	it('keeps links in the zoomed caption', () => {
		openGrid();
		const rect = jest
			.spyOn(Element.prototype, 'getBoundingClientRect')
			.mockReturnValue({ left: 0, top: 0, width: 120, height: 80, right: 120, bottom: 80 });
		document.querySelector('.fg-lb-grid-tile').click();
		rect.mockRestore();
		const caption = document.querySelector('.fg-lb-grid-zoom-caption');
		expect(caption.querySelector('a').getAttribute('href')).toBe('https://example.com/pier');
		expect(caption.querySelector('img')).toBeNull();
	});
});

describe('Mini lightbox captions', () => {
	function openMini(source) {
		const galleryEl = makeGallery({ 'data-fg-text-lightbox-mini': CONFIG });
		window.FotoGrids.modules.lightboxMiniViewer.open({
			items: [ITEM],
			index: 0,
			galleryEl,
			labels: MINI_LABELS,
			captions: true,
			captionSource: source,
		});
		return document.querySelector('.fg-lb-mv-caption');
	}

	it('formats the caption with working links', () => {
		const caption = openMini('caption');
		expect(caption.querySelector('em').textContent).toBe('leaving');
		expect(caption.querySelector('a').getAttribute('href')).toBe('https://example.com/pier');
		expect(caption.querySelector('img')).toBeNull();
		expect(window.__pwned).toBeUndefined();
	});

	it('shows the title as one plain line', () => {
		const caption = openMini('title');
		expect(caption.innerHTML).toBe('Harbour "north" pier');
	});
});
