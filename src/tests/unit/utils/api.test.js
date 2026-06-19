/**
 * Tests for src/assets/admin/src/utils/api.js
 */
import {
	isApiAvailable,
	fetchGalleries,
	fetchAlbums,
	saveGallery,
	deleteGallery,
	saveAlbum,
	deleteAlbum,
	addItemsToGallery,
	fetchDashboardStats,
} from '@/admin/src/utils/api';

describe('utils/api', () => {
	beforeEach(() => {
		global.wp.apiFetch.mockReset();
	});

	describe('isApiAvailable', () => {
		it('returns true when wp.apiFetch exists', () => {
			expect(isApiAvailable()).toBe(true);
		});

		it('returns false when wp is undefined', () => {
			const saved = global.wp;
			// eslint-disable-next-line no-global-assign
			delete global.wp;
			expect(isApiAvailable()).toBe(false);
			global.wp = saved;
		});

		it('returns false when wp.apiFetch is undefined', () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			expect(isApiAvailable()).toBe(false);
			global.wp.apiFetch = saved;
		});
	});

	describe('fetchGalleries', () => {
		it('resolves empty list when API unavailable', async () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			await expect(fetchGalleries()).resolves.toEqual({ galleries: [] });
			global.wp.apiFetch = saved;
		});

		it('calls apiFetch without search param', async () => {
			global.wp.apiFetch.mockResolvedValue({ galleries: [{ id: 1 }] });
			const res = await fetchGalleries();
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/galleries?',
				method: 'GET',
			});
			expect(res.galleries).toHaveLength(1);
		});

		it('appends a search param when provided', async () => {
			global.wp.apiFetch.mockResolvedValue({ galleries: [] });
			await fetchGalleries('cats');
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/galleries?search=cats',
				method: 'GET',
			});
		});

		it('swallows errors and returns empty list', async () => {
			global.wp.apiFetch.mockRejectedValue(new Error('boom'));
			jest.spyOn(console, 'error').mockImplementation(() => {});
			await expect(fetchGalleries('x')).resolves.toEqual({
				galleries: [],
			});
			console.error.mockRestore();
		});
	});

	describe('fetchAlbums', () => {
		it('resolves empty list when API unavailable', async () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			await expect(fetchAlbums()).resolves.toEqual({ albums: [] });
			global.wp.apiFetch = saved;
		});

		it('appends a search param when provided', async () => {
			global.wp.apiFetch.mockResolvedValue({ albums: [] });
			await fetchAlbums('dogs');
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/albums?search=dogs',
				method: 'GET',
			});
		});

		it('swallows errors and returns empty list', async () => {
			global.wp.apiFetch.mockRejectedValue(new Error('boom'));
			jest.spyOn(console, 'error').mockImplementation(() => {});
			await expect(fetchAlbums()).resolves.toEqual({ albums: [] });
			console.error.mockRestore();
		});
	});

	describe('saveGallery', () => {
		it('rejects when API unavailable', async () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			await expect(saveGallery({})).rejects.toThrow('API not available');
			global.wp.apiFetch = saved;
		});

		it('POSTs a new gallery with defaults', async () => {
			global.wp.apiFetch.mockResolvedValue({ id: 9 });
			await saveGallery({ title: 'New' });
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/galleries',
				method: 'POST',
				data: {
					title: 'New',
					status: 'draft',
					layout: 'grid',
					columns: 3,
					lightbox: false,
					captions: false,
					lazy: false,
				},
			});
		});

		it('PUTs an existing gallery and preserves provided values', async () => {
			global.wp.apiFetch.mockResolvedValue({ id: 5 });
			await saveGallery({
				id: 5,
				title: 'Edit',
				status: 'publish',
				layout: 'masonry',
				columns: 4,
				lightbox: true,
				captions: true,
				lazy: true,
			});
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/galleries/5',
				method: 'PUT',
				data: {
					title: 'Edit',
					status: 'publish',
					layout: 'masonry',
					columns: 4,
					lightbox: true,
					captions: true,
					lazy: true,
				},
			});
		});
	});

	describe('deleteGallery', () => {
		it('rejects when API unavailable', async () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			await expect(deleteGallery(1)).rejects.toThrow('API not available');
			global.wp.apiFetch = saved;
		});

		it('issues a DELETE to the gallery path', async () => {
			global.wp.apiFetch.mockResolvedValue({});
			await deleteGallery(7);
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/galleries/7',
				method: 'DELETE',
			});
		});
	});

	describe('saveAlbum', () => {
		it('rejects when API unavailable', async () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			await expect(saveAlbum({})).rejects.toThrow('API not available');
			global.wp.apiFetch = saved;
		});

		it('POSTs a new album with defaults', async () => {
			global.wp.apiFetch.mockResolvedValue({ id: 3 });
			await saveAlbum({ title: 'Album' });
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/albums',
				method: 'POST',
				data: {
					title: 'Album',
					status: 'draft',
					layout: 'grid',
					gallery_ids: [],
				},
			});
		});

		it('PUTs an existing album', async () => {
			global.wp.apiFetch.mockResolvedValue({ id: 2 });
			await saveAlbum({
				id: 2,
				title: 'A',
				status: 'publish',
				layout: 'justified',
				gallery_ids: [1, 2],
			});
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/albums/2',
				method: 'PUT',
				data: {
					title: 'A',
					status: 'publish',
					layout: 'justified',
					gallery_ids: [1, 2],
				},
			});
		});
	});

	describe('deleteAlbum', () => {
		it('rejects when API unavailable', async () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			await expect(deleteAlbum(1)).rejects.toThrow('API not available');
			global.wp.apiFetch = saved;
		});

		it('issues a DELETE to the album path', async () => {
			global.wp.apiFetch.mockResolvedValue({});
			await deleteAlbum(4);
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/albums/4',
				method: 'DELETE',
			});
		});
	});

	describe('addItemsToGallery', () => {
		it('rejects when API unavailable', async () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			await expect(addItemsToGallery(1, [2])).rejects.toThrow(
				'API not available'
			);
			global.wp.apiFetch = saved;
		});

		it('POSTs item ids to the gallery items path', async () => {
			global.wp.apiFetch.mockResolvedValue({});
			await addItemsToGallery(8, [10, 11]);
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/galleries/8/items',
				method: 'POST',
				data: { item_ids: [10, 11] },
			});
		});
	});

	describe('fetchDashboardStats', () => {
		const zero = {
			galleries: 0,
			albums: 0,
			items: 0,
			views: 0,
			shares: 0,
			shortcodes_used: false,
		};

		it('resolves zeros when API unavailable', async () => {
			const saved = global.wp.apiFetch;
			global.wp.apiFetch = undefined;
			await expect(fetchDashboardStats()).resolves.toEqual(zero);
			global.wp.apiFetch = saved;
		});

		it('returns the stats payload', async () => {
			global.wp.apiFetch.mockResolvedValue({ ...zero, galleries: 12 });
			const res = await fetchDashboardStats();
			expect(res.galleries).toBe(12);
			expect(global.wp.apiFetch).toHaveBeenCalledWith({
				path: '/fotogrids/v1/admin/stats/overview',
				method: 'GET',
			});
		});

		it('swallows errors and returns zeros', async () => {
			global.wp.apiFetch.mockRejectedValue(new Error('boom'));
			jest.spyOn(console, 'error').mockImplementation(() => {});
			await expect(fetchDashboardStats()).resolves.toEqual(zero);
			console.error.mockRestore();
		});
	});
});
