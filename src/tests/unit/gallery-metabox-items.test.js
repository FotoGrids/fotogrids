/**
 * Tests for components/gallery-metabox/hooks/useGalleryItems.js
 *
 * The hook owns the item list and keeps three things in step: React state, the
 * shared collection-state manager, and the `fotogrids:setting_changed` event
 * the save pipeline listens for. A tiny host exposes the API to drive each
 * operation.
 */
import useGalleryItems from '@/admin/src/components/gallery-metabox/hooks/useGalleryItems';
import { renderElement, act } from '@tests/helpers/render-component';

const h = wp.element.createElement;

let api;

function Host({ galleryItems, strings }) {
	api = useGalleryItems({ galleryItems, strings });
	return h('div', null, 'host');
}

const mount = (galleryItems = [], strings = {}) =>
	renderElement(h(Host, { galleryItems, strings }));

const image = (id, extra = {}) => ({
	id,
	title: `Item ${id}`,
	featured: false,
	...extra,
});

let stateManager;
let changeEvents;
let onChange;

describe('useGalleryItems', () => {
	beforeEach(() => {
		changeEvents = [];
		onChange = (e) => changeEvents.push(e.detail.source);
		document.addEventListener('fotogrids:setting_changed', onChange);

		stateManager = {
			items: {
				initItems: jest.fn(),
				setItems: jest.fn(),
				removeItem: jest.fn(),
				reorderItems: jest.fn(),
			},
		};
		window.FotoGridsCollectionState = stateManager;
		window.fotogridsMetaBoxes = { postId: 12 };
		window.fotogridsToast = { error: jest.fn(), success: jest.fn() };
		wp.apiFetch.mockReset();
		wp.apiFetch.mockResolvedValue({});
		global.fetch.mockReset();
		global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		document.removeEventListener('fotogrids:setting_changed', onChange);
		delete window.FotoGridsCollectionState;
		console.error.mockRestore();
		console.warn.mockRestore();
	});

	describe('seeding', () => {
		it('defaults a missing featured flag and seeds the state manager', () => {
			mount([{ id: 1, title: 'a' }, image(2, { featured: true })]);

			expect(api.items).toEqual([
				{ id: 1, title: 'a', featured: false },
				{ id: 2, title: 'Item 2', featured: true },
			]);
			expect(stateManager.items.initItems).toHaveBeenCalledWith(['1', '2']);
		});

		it('starts empty when the payload is not an array', () => {
			renderElement(h(Host, { galleryItems: null, strings: {} }));

			expect(api.items).toEqual([]);
			expect(stateManager.items.initItems).not.toHaveBeenCalled();
		});

		it('works with no collection-state manager present', () => {
			delete window.FotoGridsCollectionState;

			expect(() => mount([image(1)])).not.toThrow();
			expect(api.items).toHaveLength(1);
		});
	});

	describe('appendItems', () => {
		it('adds new items, skips ids already present and marks the gallery dirty', () => {
			mount([image(1)]);

			act(() => api.appendItems([image(1), image(2)]));

			expect(api.items.map((i) => i.id)).toEqual([1, 2]);
			expect(stateManager.items.setItems).toHaveBeenCalledWith(['1', '2']);
			expect(changeEvents).toContain('items-add');
		});

		it('ignores an empty list and a non-array', () => {
			mount([image(1)]);
			changeEvents.length = 0;

			act(() => api.appendItems([]));
			act(() => api.appendItems(null));

			expect(api.items).toHaveLength(1);
			expect(changeEvents).toEqual([]);
		});
	});

	describe('handleUploadComplete', () => {
		it('turns attachment ids into items', async () => {
			mount([]);
			wp.apiFetch.mockResolvedValue({
				id: 5,
				title: { rendered: 'Shot' },
				source_url: 'https://example.com/a.jpg',
				media_details: {
					sizes: { thumbnail: { source_url: 'https://example.com/t.jpg' } },
				},
				alt_text: 'alt',
			});

			await act(async () => {
				await api.handleUploadComplete([5]);
			});

			expect(api.items).toEqual([
				{
					id: 5,
					title: 'Shot',
					url: 'https://example.com/a.jpg',
					thumbnail: 'https://example.com/t.jpg',
					alt: 'alt',
					featured: false,
				},
			]);
		});

		it('skips an attachment it cannot read', async () => {
			mount([]);
			wp.apiFetch.mockRejectedValue(new Error('gone'));

			await act(async () => {
				await api.handleUploadComplete([5]);
			});

			expect(api.items).toEqual([]);
		});

		it('does nothing without ids', async () => {
			mount([]);

			await act(async () => {
				await api.handleUploadComplete([]);
			});

			expect(wp.apiFetch).not.toHaveBeenCalled();
		});
	});

	describe('setFeatured', () => {
		it('marks the clicked item and saves it', async () => {
			mount([image(1), image(2)]);

			await act(async () => {
				await api.setFeatured(2);
			});

			expect(api.items.map((i) => i.featured)).toEqual([false, true]);
			expect(wp.apiFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					path: '/fotogrids/v1/gallery/12/featured-item',
					method: 'POST',
				})
			);
		});

		it('clears the choice when the featured item is clicked again', async () => {
			mount([image(1, { featured: true })]);

			await act(async () => {
				await api.setFeatured(1);
			});

			expect(api.items[0].featured).toBe(false);
			expect(wp.apiFetch).toHaveBeenCalledWith(
				expect.objectContaining({ data: { item_id: null } })
			);
		});


		it('does not call the endpoint without a gallery id', async () => {
			window.fotogridsMetaBoxes = {};
			mount([image(1)]);

			await act(async () => {
				await api.setFeatured(1);
			});

			expect(wp.apiFetch).not.toHaveBeenCalled();
		});

		it('toasts when the save fails', async () => {
			mount([image(1)]);
			wp.apiFetch.mockRejectedValue(new Error('boom'));

			await act(async () => {
				await api.setFeatured(1);
			});

			expect(window.fotogridsToast.error).toHaveBeenCalledWith('boom');
		});
	});

	describe('removeItem', () => {
		it('drops the item from state and from the manager', () => {
			mount([image(1), image(2)]);

			act(() => api.removeItem(1));

			expect(api.items.map((i) => i.id)).toEqual([2]);
			expect(stateManager.items.removeItem).toHaveBeenCalledWith('1');
			expect(changeEvents).toContain('items-remove');
		});

		it('deletes an embed over REST and leaves the manager alone', async () => {
			mount([image(1, { item_type: 'video_youtube' })]);

			await act(async () => {
				api.removeItem(1);
			});

			expect(api.items).toEqual([]);
			expect(stateManager.items.removeItem).not.toHaveBeenCalled();
		});

	});

	describe('clearAllItems', () => {
		it('empties the grid, the manager and the featured choice', async () => {
			mount([image(1), image(2)]);

			await act(async () => {
				api.clearAllItems();
			});

			expect(api.items).toEqual([]);
			expect(stateManager.items.setItems).toHaveBeenCalledWith([]);
			expect(changeEvents).toContain('items-remove-all');
		});
	});

	describe('reorderItems', () => {
		it('reorders by the given id list', () => {
			mount([image(1), image(2), image(3)]);

			act(() => api.reorderItems(['3', '1', '2']));

			expect(api.items.map((i) => i.id)).toEqual([3, 1, 2]);
			expect(stateManager.items.reorderItems).toHaveBeenCalledWith([
				'3',
				'1',
				'2',
			]);
			expect(changeEvents).toContain('items-reorder');
		});

		it('drops ids that are no longer in the grid', () => {
			mount([image(1), image(2)]);

			act(() => api.reorderItems(['2', '99', '1']));

			expect(api.items.map((i) => i.id)).toEqual([2, 1]);
		});
	});
});
