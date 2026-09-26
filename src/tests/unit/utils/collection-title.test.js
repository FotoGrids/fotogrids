/**
 * Tests for src/assets/admin/src/utils/collection-title.js
 */
import {
	isUntitled,
	collectionPlaceholder,
	collectionTitle,
} from '@/admin/src/utils/collection-title';

describe('collection-title', () => {
	it('treats empty, whitespace and missing titles as untitled', () => {
		expect(isUntitled('')).toBe(true);
		expect(isUntitled('   ')).toBe(true);
		expect(isUntitled(null)).toBe(true);
		expect(isUntitled(undefined)).toBe(true);
		expect(isUntitled('Trips')).toBe(false);
	});

	it('builds the placeholder from the kind or post type and the ID', () => {
		expect(collectionPlaceholder('gallery', 12)).toBe('Gallery #12');
		expect(collectionPlaceholder('fotogrids_gallery', 12)).toBe(
			'Gallery #12'
		);
		expect(collectionPlaceholder('album', 15)).toBe('Album #15');
		expect(collectionPlaceholder('fotogrids_album', 15)).toBe('Album #15');
	});

	it('returns the stored title when there is one', () => {
		expect(collectionTitle('Trips', 'album', 3)).toBe('Trips');
		expect(collectionTitle('', 'album', 3)).toBe('Album #3');
	});
});
