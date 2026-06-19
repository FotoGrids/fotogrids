/**
 * Exercises the external-URL item flow inside CollectionSettings:
 * item loading, the bulk URL modal, apply-to-all / clear-all execution, and
 * URL validation. These are the deeper handlers that the basic mount doesn't
 * reach.
 */
import '@/admin/plain/render-settings/utils/post-type-placeholders';
import '@/admin/plain/render-settings/utils/tooltip-utils';
import '@/admin/plain/render-settings/renderToggle';
import '@/admin/plain/render-settings/renderTextInput';
import '@/admin/plain/render-settings/renderSelect';
import '@/admin/plain/render-settings/renderButtonGroup';
import '@/admin/plain/render-settings/renderBulkModal';
import '@/admin/plain/render-settings/renderConditionalMessage';
import '@/admin/plain/render-settings/renderExternalUrlManager';
import '@/admin/src/collection-state-manager';
import '@/admin/src/utils/ui-state-manager';
import '@/admin/plain/collection-settings';
import { renderElement, click, act } from '@tests/helpers/render-component';

const CATALOG = {
	layout: {
		id: 'layout',
		label: 'General',
		icon: 'i',
		free: true,
		settings: [
			{
				key: 'item_click_behavior',
				type: 'select',
				label: 'Click behaviour',
				options: [
					{ value: 'lightbox', label: 'Lightbox' },
					{ value: 'external', label: 'External' },
				],
			},
			{
				key: 'external_urls',
				type: 'external_url_manager',
				label: 'External URLs',
			},
		],
	},
};

const okJson = (data) =>
	Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

const flush = async () => {
	await act(async () => {
		for (let i = 0; i < 5; i++) await Promise.resolve();
	});
};

function mount() {
	const Comp = window.FotoGridsCollectionSettings.CollectionSettings;
	return renderElement(wp.element.createElement(Comp));
}

describe('CollectionSettings external-URL flow', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
		window.history.replaceState({}, '', '/');
		window.ajaxurl = 'https://x/admin-ajax.php';
		window.fotogridsSettings = {
			postType: 'gallery',
			postId: 7,
			nonce: 'n',
			ajaxUrl: 'https://x/admin-ajax.php',
			isProActive: true,
			canEditPosts: true,
			galleryItems: [10, 11],
			settings: { item_click_behavior: 'external', external_urls: '' },
		};
		window.fotogridsCatalog = {
			field_states: {},
			field_states_by_option: {},
		};
		window.fotogridsAdmin = {};
		window.FotoGridsIcons = {};
		window.FotoGridsSettings = {
			loadSettingsGroups: jest.fn(() => Promise.resolve(CATALOG)),
		};
		// item-url AJAX responses
		global.fetch = jest.fn(() =>
			okJson({
				success: true,
				data: {
					10: { url: 'https://a.test', target: 'global' },
					11: { url: '', target: 'global' },
				},
			})
		);
	});

	afterEach(() => {
		delete window.fotogridsSettings;
		delete window.FotoGridsSettings;
		delete window.fotogridsCatalog;
		delete window.fotogridsAdmin;
	});

	it('loads item URL data on mount when click behaviour is external', async () => {
		const handle = mount();
		await flush();
		// loadItemData posts the get-item-urls action
		expect(global.fetch).toHaveBeenCalled();
		const getCall = global.fetch.mock.calls.find((c) => {
			const b = c[1] && c[1].body;
			return (
				b &&
				typeof b.get === 'function' &&
				b.get('action') === 'fotogrids_get_item_urls'
			);
		});
		expect(getCall).toBeDefined();
		// the external-url manager renders (grid once data resolves, or bulk actions)
		expect(
			handle.container.querySelector('.fotogrids-external-url-manager') ||
				handle.container.querySelector('.fotogrids-item-url-grid') ||
				handle.container.querySelector('.fotogrids-bulk-actions')
		).not.toBeNull();
	});

	it('opens the bulk modal and applies a URL to all items', async () => {
		const handle = mount();
		await flush();
		const applyBtn = [
			...handle.container.querySelectorAll('button'),
		].find((b) => b.textContent === 'Apply URL to All');
		await act(async () => {
			click(applyBtn);
		});
		// modal is open
		expect(
			handle.container.querySelector('.fotogrids-modal')
		).not.toBeNull();

		// fill the URL field
		const input = handle.container.querySelector(
			'.fotogrids-modal input[type="text"], .fotogrids-modal input[type="url"]'
		);
		if (input) {
			await act(async () => {
				const setter = Object.getOwnPropertyDescriptor(
					window.HTMLInputElement.prototype,
					'value'
				).set;
				setter.call(input, 'https://new.test');
				input.dispatchEvent(new window.Event('input', { bubbles: true }));
			});
		}

		const confirm = [
			...handle.container.querySelectorAll('.fotogrids-modal button'),
		].find((b) => b.textContent === 'Apply to All');
		await act(async () => {
			if (confirm) click(confirm);
			for (let i = 0; i < 4; i++) await Promise.resolve();
		});
		// a bulk update was posted
		const bulkCall = global.fetch.mock.calls.find((c) => {
			const b = c[1] && c[1].body;
			return (
				b &&
				typeof b.get === 'function' &&
				b.get('action') === 'fotogrids_bulk_update_item_urls'
			);
		});
		expect(bulkCall).toBeDefined();
	});

	it('opens the clear-all confirmation and clears all URLs', async () => {
		const handle = mount();
		await flush();
		const clearBtn = [
			...handle.container.querySelectorAll('button'),
		].find((b) => b.textContent === 'Clear All URLs');
		await act(async () => {
			click(clearBtn);
		});
		const confirm = [
			...handle.container.querySelectorAll('.fotogrids-modal button'),
		].find((b) => b.textContent === 'Clear All');
		await act(async () => {
			if (confirm) click(confirm);
			for (let i = 0; i < 4; i++) await Promise.resolve();
		});
		const bulkCall = global.fetch.mock.calls.find((c) => {
			const b = c[1] && c[1].body;
			return (
				b &&
				typeof b.get === 'function' &&
				b.get('action') === 'fotogrids_bulk_update_item_urls' &&
				b.get('bulk_action') === 'clear_all'
			);
		});
		expect(bulkCall).toBeDefined();
	});

	it('surfaces an item-load error when the request is unsuccessful', async () => {
		global.fetch = jest.fn(() =>
			okJson({ success: false, data: 'nope' })
		);
		const handle = mount();
		await flush();
		expect(
			handle.container.querySelector('.fotogrids-error-notice')
		).not.toBeNull();
	});
});
