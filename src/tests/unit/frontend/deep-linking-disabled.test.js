/**
 * Tests for frontend/src/deep-linking.js with deep linking disabled.
 *
 * Kept in its own file so no listener from an enabled instance is attached
 * to the document.
 */

describe('deep-linking (disabled)', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		document.head.innerHTML = '';
		window.history.replaceState({}, '', '/');
	});

	it('leaves the URL alone when the lightbox opens', () => {
		window.fotogrids = { deep_linking_enabled: '' };
		const gallery = document.createElement('div');
		gallery.className = 'fotogrids-collection fotogrids-gallery';
		gallery.dataset.fgGalleryId = '5';
		document.body.appendChild(gallery);

		jest.isolateModules(() => {
			require('@/frontend/src/deep-linking');
		});

		document.dispatchEvent(
			new window.CustomEvent('fotogrids:lightbox:open', {
				detail: { galleryEl: gallery, item: { id: 88 } },
			})
		);
		expect(window.location.hash).toBe('');
		expect(document.getElementById('fg-deep-link-style')).toBeNull();
	});
});
