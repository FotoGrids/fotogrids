/**
 * Tests for components/gallery-metabox/components/ItemCard.jsx
 *
 * Covers which tiles offer the featured toggle.
 */
import ItemCard from '@/admin/src/components/gallery-metabox/components/ItemCard';
import { renderElement } from '@tests/helpers/render-component';

const h = wp.element.createElement;

const render = (item) =>
	renderElement(
		h(ItemCard, {
			item: { title: 'Item', thumbnail: '', alt: '', ...item },
			strings: {},
			onOpen: jest.fn(),
			onToggleFeatured: jest.fn(),
			onRemove: jest.fn(),
		})
	);

const hasFeaturedToggle = (container) =>
	container.querySelector('.fotogrids-item-featured-button') !== null;

describe('ItemCard', () => {
	it('offers the featured toggle on an image', () => {
		const { container, unmount } = render({ id: 1 });
		expect(hasFeaturedToggle(container)).toBe(true);
		unmount();
	});

	it('offers the featured toggle on a self-hosted video', () => {
		const { container, unmount } = render({ id: 2, item_type: 'video_file' });
		expect(hasFeaturedToggle(container)).toBe(true);
		unmount();
	});

	it.each(['video_youtube', 'video_vimeo'])(
		'hides the featured toggle on a %s embed',
		(itemType) => {
			const { container, unmount } = render({ id: 3, item_type: itemType });
			expect(hasFeaturedToggle(container)).toBe(false);
			expect(
				container.querySelector('.fotogrids-remove-item')
			).not.toBeNull();
			unmount();
		}
	);
});
