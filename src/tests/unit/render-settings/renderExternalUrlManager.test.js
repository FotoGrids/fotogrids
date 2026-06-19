/**
 * Tests for renderExternalUrlManager.js
 */
import '@/admin/plain/render-settings/renderExternalUrlManager';
import { renderElement, click, act } from '@tests/helpers/render-component';

// React 18 delegates onBlur off the native focusout event (which bubbles).
const fireBlur = (node, value) => {
	if (value !== undefined) node.value = value;
	act(() => {
		node.dispatchEvent(
			new window.FocusEvent('focusout', { bubbles: true })
		);
	});
};

const __ = (t) => t;
const renderIcon = (n) => n;

const baseCtx = (over = {}) => ({
	settings: {},
	canEditPosts: true,
	loadingItems: false,
	itemError: null,
	loadItemData: jest.fn(),
	galleryItems: [],
	itemData: {},
	savingItems: {},
	openBulkModal: jest.fn(),
	updateItemUrl: jest.fn(),
	validateUrl: () => ({ valid: true }),
	renderIcon,
	updateSetting: jest.fn(),
	__,
	...over,
});

const build = (ctx) =>
	window.FotoGridsRenderSettings.renderExternalUrlManager(
		{ key: 'ext', label: 'External URLs' },
		false,
		ctx
	);

describe('renderExternalUrlManager', () => {
	it('shows a permission notice without edit_posts', () => {
		const { container } = renderElement(
			build(baseCtx({ canEditPosts: false }))
		);
		expect(
			container.querySelector('.fotogrids-permission-notice')
		).not.toBeNull();
		expect(container.textContent).toMatch(/permission/i);
	});

	it('shows a loading skeleton while items load', () => {
		const { container } = renderElement(
			build(baseCtx({ loadingItems: true, galleryItems: [1, 2] }))
		);
		expect(
			container.querySelector('.fotogrids-external-url-manager--loading')
		).not.toBeNull();
	});

	it('shows an error notice with a retry button', () => {
		const loadItemData = jest.fn();
		const { container } = renderElement(
			build(baseCtx({ itemError: 'Boom', loadItemData }))
		);
		expect(container.querySelector('.fotogrids-error-notice')).not.toBeNull();
		expect(container.textContent).toContain('Boom');
		const retry = container.querySelector('.fotogrids-error-notice button');
		click(retry);
		expect(loadItemData).toHaveBeenCalled();
	});

	it('renders a per-item URL grid when items are loaded', () => {
		const { container } = renderElement(
			build(
				baseCtx({
					galleryItems: [10, 11],
					itemData: {
						10: { url: 'https://a.test', title: 'A' },
						11: { url: '', title: 'B' },
					},
				})
			)
		);
		expect(
			container.querySelector('.fotogrids-item-url-grid')
		).not.toBeNull();
		expect(
			container.querySelectorAll('.fotogrids-item-url-item').length
		).toBeGreaterThanOrEqual(2);
	});

	const gridCtx = (over = {}) =>
		baseCtx({
			galleryItems: [10, 11],
			itemData: {
				10: {
					url: 'https://a.test',
					title: 'A',
					thumbnail: 'https://a.test/t.jpg',
					target: 'global',
				},
				11: { url: '', title: 'B', target: '_blank' },
			},
			...over,
		});

	it('renders a thumbnail image when one is present, placeholder otherwise', () => {
		const { container } = renderElement(build(gridCtx()));
		expect(
			container.querySelector('.fotogrids-item-url-item__thumbnail img')
		).not.toBeNull();
		expect(
			container.querySelector(
				'.fotogrids-item-url-item__thumbnail-placeholder'
			)
		).not.toBeNull();
	});

	it('saves a valid URL on blur', () => {
		const updateItemUrl = jest.fn();
		const { container } = renderElement(
			build(gridCtx({ updateItemUrl }))
		);
		const input = container.querySelector('input[type="url"]');
		fireBlur(input, 'https://new.test');
		expect(updateItemUrl).toHaveBeenCalledWith(10, 'https://new.test');
	});

	it('does not save an invalid URL on blur', () => {
		const updateItemUrl = jest.fn();
		const { container } = renderElement(
			build(
				gridCtx({
					updateItemUrl,
					validateUrl: () => ({ valid: false }),
				})
			)
		);
		const input = container.querySelector('input[type="url"]');
		fireBlur(input, 'not a url');
		expect(updateItemUrl).not.toHaveBeenCalled();
	});

	it('changes the link target via the target buttons', () => {
		const updateItemUrl = jest.fn();
		const { container } = renderElement(
			build(gridCtx({ updateItemUrl }))
		);
		const targetBtns = container.querySelectorAll(
			'.fotogrids-item-url-item .fotogrids-target-button'
		);
		expect(targetBtns.length).toBeGreaterThanOrEqual(3);
		click(targetBtns[2]); // _blank button on the first item
		expect(updateItemUrl).toHaveBeenCalled();
	});

	it('marks the active target button per item', () => {
		const { container } = renderElement(build(gridCtx()));
		expect(
			container.querySelector('.fotogrids-target-button.fg-is-active')
		).not.toBeNull();
	});

	it('shows a saving indicator while an item is saving', () => {
		const { container } = renderElement(
			build(gridCtx({ savingItems: { 10: true } }))
		);
		expect(
			container.querySelector('.fotogrids-saving-indicator')
		).not.toBeNull();
	});
});
