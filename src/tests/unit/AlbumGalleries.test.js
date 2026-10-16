/**
 * Tests for src/assets/admin/src/components/AlbumGalleries.jsx
 */
import AlbumGalleries from '@/admin/src/components/AlbumGalleries';
import { renderElement, act } from '@tests/helpers/render-component';

const strings = new Proxy({}, { get: (_t, p) => String(p) });

const config = (assignedGalleries, featuredGalleryId = null) => ({
	postId: 7,
	restUrl: '/r/',
	nonce: 'n',
	assignedGalleries,
	allGalleries: [],
	featuredGalleryId,
	strings,
});

const render = async () => {
	const handle = renderElement(wp.element.createElement(AlbumGalleries));
	await act(async () => {
		await Promise.resolve();
	});
	return handle.container.querySelector('.fotogrids-gallery-item--assigned');
};

describe('AlbumGalleries', () => {
	afterEach(() => {
		delete window.fotogridsAlbumGalleries;
	});

	it('offers remove and edit controls for an assigned gallery the user can edit', async () => {
		window.fotogridsAlbumGalleries = config([
			{ ID: 1, post_title: 'Mine', item_count: 3, editable: true },
		]);
		const row = await render();
		expect(row.querySelector('.fg-action-button--remove')).not.toBeNull();
		expect(row.querySelector('.fg-action-button--edit')).not.toBeNull();
	});

	it('offers no remove or edit control for an assigned gallery the user cannot edit', async () => {
		window.fotogridsAlbumGalleries = config([
			{ ID: 2, post_title: 'Theirs', item_count: 3, editable: false },
		]);
		const row = await render();
		expect(row).not.toBeNull();
		expect(row.querySelector('.fg-action-button--remove')).toBeNull();
		expect(row.querySelector('.fg-action-button--edit')).toBeNull();
	});

	it('marks the featured gallery when its localized id arrives as a string', async () => {
		window.fotogridsAlbumGalleries = config(
			[
				{
					ID: 158,
					post_title: 'Featured',
					item_count: 3,
					editable: true,
				},
			],
			'158'
		);
		const row = await render();
		expect(
			row
				.querySelector('.fotogrids-featured-button')
				.getAttribute('aria-pressed')
		).toBe('true');
	});
});
