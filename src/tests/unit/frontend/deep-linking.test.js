/**
 * Tests for frontend/src/deep-linking.js (IIFE; runs init() on import).
 *
 * Each test re-imports the module in isolation against a freshly prepared DOM
 * + URL so the module's init() picks up that state.
 */

function setHash(hash) {
	window.history.replaceState({}, '', '/' + (hash || ''));
}

function loadModule() {
	jest.isolateModules(() => {
		require('@/frontend/src/deep-linking');
	});
}

function makeGallery(galleryId, itemId, { withTrigger = false } = {}) {
	const gallery = document.createElement('div');
	gallery.className = 'fotogrids-collection fotogrids-gallery';
	gallery.dataset.fgGalleryId = String(galleryId);

	const figure = document.createElement('figure');
	figure.className = 'fg-item';
	figure.dataset.fgItemId = String(itemId);

	if (withTrigger) {
		const a = document.createElement('a');
		a.setAttribute('data-fg-lightbox-trigger', '');
		figure.appendChild(a);
	}
	gallery.appendChild(figure);
	document.body.appendChild(gallery);
	return { gallery, figure };
}

describe('deep-linking', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		document.head.innerHTML = '';
		document.body.className = '';
		window.fotogrids = {};
		delete window.FotoGridsLightbox;
		setHash('');
	});

	it('injects the highlight style once on init', () => {
		loadModule();
		expect(document.getElementById('fg-deep-link-style')).not.toBeNull();
		// re-init does not duplicate
		loadModule();
		expect(
			document.querySelectorAll('#fg-deep-link-style')
		).toHaveLength(1);
	});

	it('highlights an item with no lightbox from an embedded hash', () => {
		const { figure } = makeGallery(7, 42);
		figure.scrollIntoView = jest.fn();
		setHash('#fg-7-42');
		loadModule();
		expect(figure.classList.contains('fg-deep-link-highlight')).toBe(true);
		expect(figure.scrollIntoView).toHaveBeenCalled();
	});

	it('opens the lightbox when a trigger and lightbox manager exist', () => {
		const { gallery } = makeGallery(3, 9, { withTrigger: true });
		const open = jest.fn();
		window.FotoGridsLightbox = function () {};
		window.FotoGridsLightbox.instance = { open };
		setHash('#fg-3-9');
		loadModule();
		expect(open).toHaveBeenCalledWith(gallery, 0);
	});

	it('does nothing when the URL has no deep link', () => {
		const { figure } = makeGallery(1, 1);
		figure.scrollIntoView = jest.fn();
		setHash('');
		loadModule();
		expect(figure.classList.contains('fg-deep-link-highlight')).toBe(false);
	});

	it('syncs the URL to the open lightbox item', () => {
		const { gallery } = makeGallery(5, 88);
		setHash('');
		loadModule();
		document.dispatchEvent(
			new window.CustomEvent('fotogrids:lightbox:open', {
				detail: { galleryEl: gallery, item: { id: 88 } },
			})
		);
		expect(window.location.hash).toBe('#fg-5-88');
	});

	it('clears the deep link from the URL on lightbox close', () => {
		makeGallery(5, 88);
		setHash('#fg-5-88');
		loadModule();
		document.dispatchEvent(
			new window.CustomEvent('fotogrids:lightbox:close', { detail: {} })
		);
		expect(window.location.hash).toBe('');
	});

	it('reads ?fg-item on a View Page (body.fotogrids-view)', () => {
		document.body.classList.add('fotogrids-view');
		const { figure } = makeGallery(0, 99);
		figure.scrollIntoView = jest.fn();
		window.history.replaceState({}, '', '/?fg-item=99');
		loadModule();
		expect(figure.classList.contains('fg-deep-link-highlight')).toBe(true);
	});

	it('respects deep_linking_enabled=false (no auto-open)', () => {
		window.fotogrids = { deep_linking_enabled: false };
		const { figure } = makeGallery(7, 42);
		figure.scrollIntoView = jest.fn();
		setHash('#fg-7-42');
		loadModule();
		expect(figure.classList.contains('fg-deep-link-highlight')).toBe(false);
	});
});
