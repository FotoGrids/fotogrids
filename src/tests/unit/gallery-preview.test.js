/**
 * Tests for components/GalleryPreview.jsx
 */
import GalleryPreview from '@/admin/src/components/GalleryPreview';
import { renderElement, act } from '@tests/helpers/render-component';

const h = wp.element.createElement;

describe('GalleryPreview', () => {
	let view;

	beforeEach(() => {
		window.fotogridsMetaBoxes = {
			postId: 7,
			restNonce: 'nonce',
			strings: {
				previewEmptyTitle: 'Nothing to preview yet',
				previewEmptyText: 'Add some items to this gallery and its preview will appear here.',
				previewEmptyButton: 'Add items',
			},
		};
		global.fetch.mockReset();
		global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ html: '' }) });
	});

	afterEach(() => {
		view?.unmount();
		view = null;
	});

	it('shows the empty state and sends no preview request when the gallery has no items', () => {
		const onAddItems = jest.fn();
		view = renderElement(h(GalleryPreview, { galleryId: 7, hasItems: false, onAddItems }));

		expect(view.container.querySelector('.fotogrids-preview-empty__title').textContent)
			.toBe('Nothing to preview yet');
		expect(view.container.querySelector('.fotogrids-preview-empty__text').textContent)
			.toBe('Add some items to this gallery and its preview will appear here.');
		expect(view.container.querySelectorAll('.fotogrids-preview-empty__art span')).toHaveLength(6);
		expect(view.container.querySelector('.fotogrids-preview-container')).toBeNull();
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('calls onAddItems from the Add items button', () => {
		const onAddItems = jest.fn();
		view = renderElement(h(GalleryPreview, { galleryId: 7, hasItems: false, onAddItems }));

		const button = view.container.querySelector('button');
		expect(button.querySelector('.fg-button__label').textContent).toBe('Add items');
		expect(button.querySelector('.fg-button__icon.fotogrids-icon--plus')).not.toBeNull();
		act(() => {
			button.click();
		});
		expect(onAddItems).toHaveBeenCalledTimes(1);
	});

	it('requests the preview once the gallery has items', async () => {
		view = renderElement(h(GalleryPreview, { galleryId: 7, hasItems: false }));
		expect(global.fetch).not.toHaveBeenCalled();

		await act(async () => {
			view.rerender(h(GalleryPreview, { galleryId: 7, hasItems: true }));
		});

		expect(view.container.querySelector('.fotogrids-preview-empty')).toBeNull();
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('preview/gallery/7'),
			expect.objectContaining({ method: 'POST' })
		);
	});
});
