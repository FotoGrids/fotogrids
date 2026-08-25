/**
 * Tests for the Item Edit modal's Interactions and Media tabs.
 */
import React from 'react';
import TabInteractions from '@/admin/src/components/item-edit-modal/tabs/TabInteractions';
import TabMedia from '@/admin/src/components/item-edit-modal/tabs/TabMedia';
import { renderElement, act } from '@tests/helpers/render-component';

const h = React.createElement;

const STRINGS = {
	externalUrlIgnoredTitle: 'External URLs are not in use',
	externalUrlIgnoredBody: 'Set Item Click Behavior to External URL.',
	mediaSizesSummary: '%1$s of %2$s sizes available',
	mediaSizeNotGenerated: 'Not generated',
	mediaSizeSourceTooSmall: 'Source too small',
	regenerateThumbnails: 'Regenerate thumbnails',
	mediaSizesEmpty: 'Size variants are only generated for images.',
};

const setBehavior = (value) => {
	window.fotogridsSettings = { settings: { item_click_behavior: value } };
};

describe('TabInteractions', () => {
	beforeEach(() => {
		delete window.fotogridsSettings;
		document.body.innerHTML = '';
	});

	it('warns when the collection does not open items via external URLs', () => {
		setBehavior('lightbox');

		const { container, unmount } = renderElement(
			h(TabInteractions, {
				formData: {},
				handleInputChange: () => {},
				strings: STRINGS,
			})
		);

		const notice = container.querySelector('.fotogrids-edit-item-notice');
		expect(notice).not.toBeNull();
		expect(notice.textContent).toContain(
			'Set Item Click Behavior to External URL.'
		);
		unmount();
	});

	it('hides the warning when the behavior is external', () => {
		setBehavior('external');

		const { container, unmount } = renderElement(
			h(TabInteractions, {
				formData: {},
				handleInputChange: () => {},
				strings: STRINGS,
			})
		);

		expect(
			container.querySelector('.fotogrids-edit-item-notice')
		).toBeNull();
		unmount();
	});

	it('follows a live setting change', () => {
		setBehavior('external');

		const { container, unmount } = renderElement(
			h(TabInteractions, {
				formData: {},
				handleInputChange: () => {},
				strings: STRINGS,
			})
		);

		act(() => {
			document.dispatchEvent(
				new window.CustomEvent('fotogrids:setting_changed', {
					detail: { key: 'item_click_behavior', value: 'lightbox' },
				})
			);
		});

		expect(
			container.querySelector('.fotogrids-edit-item-notice')
		).not.toBeNull();
		unmount();
	});
});

describe('TabMedia', () => {
	const itemData = {
		medium_url: 'https://example.com/medium.jpg',
		media_sizes: [
			{
				name: 'full',
				label: 'Full',
				width: 2000,
				height: 1500,
				crop: false,
				url: 'https://example.com/full.jpg',
				filename: 'full.jpg',
				filesize: '2 MB',
				status: 'generated',
				source: 'core',
			},
			{
				name: 'thumbnail',
				label: 'Thumbnail',
				width: 150,
				height: 150,
				crop: true,
				url: 'https://example.com/thumb.jpg',
				filename: 'thumb.jpg',
				filesize: '8 KB',
				status: 'generated',
				source: 'core',
			},
			{
				name: 'fotogrids_masonry',
				label: 'Masonry',
				width: 4000,
				height: 0,
				crop: false,
				url: '',
				filename: '',
				filesize: '',
				status: 'source_too_small',
				source: 'fotogrids',
			},
		],
	};

	it('lists every size smallest first and counts the available ones', () => {
		const { container, unmount } = renderElement(
			h(TabMedia, { itemData, loading: false, strings: STRINGS })
		);

		const cards = container.querySelectorAll(
			'.fotogrids-edit-item-media-size'
		);
		expect(cards).toHaveLength(3);
		expect(cards[0].textContent).toContain('thumbnail');
		expect(
			container.querySelector('.fotogrids-edit-item-media-sizes__summary')
				.textContent
		).toBe('2 of 3 sizes available');
		unmount();
	});

	it('flags a size the source image is too small for', () => {
		const { container, unmount } = renderElement(
			h(TabMedia, { itemData, loading: false, strings: STRINGS })
		);

		const missing = container.querySelector(
			'.fotogrids-edit-item-media-size--unavailable'
		);
		expect(missing).not.toBeNull();
		expect(missing.textContent).toContain('Source too small');
		expect(
			missing.querySelector('.fotogrids-edit-item-media-size__actions')
		).toBeNull();
		unmount();
	});

	it('offers the regenerate tool only for sizes that can be rebuilt', () => {
		const withMissing = {
			...itemData,
			media_sizes: [
				...itemData.media_sizes,
				{
					name: 'large',
					label: 'Large',
					width: 1024,
					height: 768,
					crop: false,
					url: '',
					filename: '',
					filesize: '',
					status: 'not_generated',
					source: 'core',
				},
			],
		};

		const { container, unmount } = renderElement(
			h(TabMedia, {
				itemData: withMissing,
				loading: false,
				strings: STRINGS,
			})
		);

		const links = container.querySelectorAll(
			'a[href*="tool=regenerate-thumbnails"]'
		);
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute('aria-label')).toBe(
			'Regenerate thumbnails'
		);
		expect(
			links[0].closest('.fotogrids-edit-item-media-size').textContent
		).toContain('large');
		unmount();
	});

	it('falls back to an empty state for items with no sizes', () => {
		const { container, unmount } = renderElement(
			h(TabMedia, {
				itemData: { media_sizes: [] },
				loading: false,
				strings: STRINGS,
			})
		);

		expect(
			container.querySelector('.fotogrids-edit-item-media-sizes__empty')
				.textContent
		).toBe('Size variants are only generated for images.');
		unmount();
	});
});
