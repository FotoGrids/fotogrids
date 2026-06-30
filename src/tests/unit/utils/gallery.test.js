/**
 * Tests for src/assets/admin/src/utils/gallery.js
 */
import { createGalleryFromImages } from '@/admin/src/utils/gallery';

describe('utils/gallery', () => {
	let originalHref;

	beforeEach(() => {
		global.wp.apiFetch.mockReset();
		originalHref = window.location.href;
		delete window.location;
		window.location = { href: '' };
	});

	afterEach(() => {
		window.location = { href: originalHref };
	});

	it('returns null for empty input', async () => {
		await expect(createGalleryFromImages([])).resolves.toBeNull();
		await expect(createGalleryFromImages(null)).resolves.toBeNull();
		await expect(createGalleryFromImages(undefined)).resolves.toBeNull();
	});

	it('creates a gallery, adds items, and redirects', async () => {
		global.wp.apiFetch
			.mockResolvedValueOnce({ id: 42 }) // create gallery
			.mockResolvedValueOnce({}); // add items

		const result = await createGalleryFromImages([1, 2, 3]);

		expect(result).toEqual({ id: 42 });
		// first call creates the gallery
		expect(global.wp.apiFetch.mock.calls[0][0]).toMatchObject({
			path: '/wp/v2/fotogrids-galleries',
			method: 'POST',
		});
		// second call adds the items
		expect(global.wp.apiFetch.mock.calls[1][0]).toMatchObject({
			path: '/fotogrids/v1/admin/galleries/42/items',
			method: 'POST',
			data: { item_ids: [1, 2, 3] },
		});
		expect(window.location.href).toBe('post.php?post=42&action=edit');
	});

	it('throws a friendly error when gallery creation returns no id', async () => {
		global.wp.apiFetch.mockResolvedValueOnce({});
		jest.spyOn(console, 'error').mockImplementation(() => {});
		await expect(createGalleryFromImages([1])).rejects.toThrow(
			/failed to create gallery/i
		);
		console.error.mockRestore();
	});

	it('wraps lower-level failures in a friendly error', async () => {
		global.wp.apiFetch.mockRejectedValueOnce(new Error('network down'));
		jest.spyOn(console, 'error').mockImplementation(() => {});
		await expect(createGalleryFromImages([1])).rejects.toThrow(
			/Images uploaded but failed to create gallery/i
		);
		console.error.mockRestore();
	});
});
