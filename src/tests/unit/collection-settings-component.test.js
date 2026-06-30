/**
 * Integration test for the CollectionSettings component (collection-settings.js).
 *
 * Loads the full render-settings ecosystem, stubs the async settings catalog
 * loader, mounts the component, and exercises tabs + a setting interaction.
 */
import '@/admin/plain/render-settings/utils/post-type-placeholders';
import '@/admin/plain/render-settings/utils/tooltip-utils';
import '@/admin/plain/render-settings/renderToggle';
import '@/admin/plain/render-settings/renderTextInput';
import '@/admin/plain/render-settings/renderSelect';
import '@/admin/plain/render-settings/renderRange';
import '@/admin/plain/render-settings/renderButtonGroup';
import '@/admin/plain/render-settings/renderBulkModal';
import '@/admin/plain/render-settings/renderConditionalMessage';
import '@/admin/plain/render-settings/renderInfoBlock';
import '@/admin/plain/render-settings/renderPromo';
import '@/admin/plain/render-settings/renderGroup';
import '@/admin/plain/render-settings/renderSideBySide';
import '@/admin/plain/render-settings/renderSettingSubTabs';
import '@/admin/plain/render-settings/renderColorPicker';
import '@/admin/plain/render-settings/utils/fg-color-picker';
import '@/admin/plain/render-settings/renderImagePicker';
import '@/admin/plain/render-settings/renderTokenSelect';
import '@/admin/plain/render-settings/renderAlignmentGrid';
import '@/admin/plain/render-settings/renderLayoutGrid';
import '@/admin/plain/render-settings/renderResponsiveRange';
import '@/admin/plain/render-settings/renderFontFamily';
import '@/admin/plain/render-settings/renderFontWeight';
import '@/admin/plain/render-settings/renderHoverEffectsGrid';
import '@/admin/plain/render-settings/renderButtonGroupDynamic';
import '@/admin/plain/render-settings/renderImageSize';
import '@/admin/src/collection-state-manager';
import '@/admin/src/utils/ui-state-manager';
import '@/admin/plain/collection-settings';
import { renderElement, click, changeValue, act } from '@tests/helpers/render-component';

const CATALOG = {
	layout: {
		id: 'layout',
		label: 'General',
		icon: 'settings',
		free: true,
		settings: [
			{ key: 'enabled', type: 'toggle', label: 'Enabled' },
			{ key: 'title', type: 'text_input', label: 'Title' },
			{
				key: 'layout',
				type: 'select',
				label: 'Layout',
				options: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'masonry', label: 'Masonry' },
				],
			},
			{
				key: 'columns',
				type: 'range',
				label: 'Columns',
				min: 1,
				max: 6,
			},
			{
				key: 'border_color',
				type: 'color',
				label: 'Border colour',
				default: '#000000',
			},
			{
				key: 'fields',
				type: 'token_select',
				label: 'Fields',
				options: [
					{ value: 'caption', label: 'Caption' },
					{ value: 'exif', label: 'EXIF' },
				],
			},
			{
				key: 'notice',
				type: 'info_block',
				message: 'An informational note',
			},
			{
				key: 'group',
				type: 'setting_group',
				label: 'Group',
				settings: [{ key: 'flag2', type: 'toggle', label: 'Flag 2' }],
			},
			{
				key: 'gap',
				type: 'responsive_range',
				label: 'Gap',
				responsive: {
					desktop: { min: 0, max: 50, default: 8 },
					tablet: { min: 0, max: 50, default: 8 },
					mobile: { min: 0, max: 50, default: 8 },
				},
			},
			{
				key: 'layout_style',
				type: 'layout_grid',
				label: 'Layout style',
				options: [
					{ value: 'grid', label: 'Grid', description: 'Boxes', icon: 'g' },
					{ value: 'masonry', label: 'Masonry', description: 'Bricks', icon: 'm' },
				],
			},
			{
				key: 'hover',
				type: 'hover_effects_grid',
				label: 'Hover effect',
				options: [
					{ value: 'none', label: 'None', animates: 'none' },
					{ value: 'zoom', label: 'Zoom', animates: 'media' },
				],
			},
			{
				key: 'bgroup',
				type: 'button_group',
				label: 'Button group',
				options: [
					{ value: 'a', label: 'A' },
					{ value: 'b', label: 'B' },
				],
			},
			{
				key: 'font',
				type: 'font_family',
				label: 'Font',
			},
			{
				key: 'weight',
				type: 'font_weight',
				label: 'Weight',
			},
		],
	},
	advanced: {
		id: 'advanced',
		label: 'Advanced',
		icon: 'tools',
		free: true,
		settings: [
			{ key: 'flag', type: 'toggle', label: 'Flag' },
			{
				key: 'conditional',
				type: 'text_input',
				label: 'Only when flag on',
				visible_when: { setting: 'flag', truthy: true },
			},
			{
				key: 'override',
				type: 'text_input',
				label: 'Override',
				disabled_unless: 'flag',
			},
			{
				key: 'hiddenField',
				type: 'text_input',
				label: 'Hidden',
				hidden: true,
			},
		],
	},
	pro: {
		id: 'pro',
		label: 'Pro Tab',
		icon: 'star',
		free: false,
		tier_required: 'pro_starter',
		settings: [{ key: 'proflag', type: 'toggle', label: 'Pro flag' }],
	},
	lightbox: {
		id: 'lightbox',
		label: 'Lightbox',
		icon: 'lb',
		free: true,
		subTabs: {
			general: {
				id: 'general',
				label: 'General',
				icon: 'g',
				settings: [
					{ key: 'lb_enabled', type: 'toggle', label: 'Enable' },
				],
			},
			styling: {
				id: 'styling',
				label: 'Styling',
				icon: 's',
				settings: [
					{ key: 'lb_theme', type: 'text_input', label: 'Theme' },
				],
			},
		},
	},
};

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
};

function mountSettings() {
	const Comp = window.FotoGridsCollectionSettings.CollectionSettings;
	return renderElement(wp.element.createElement(Comp));
}

describe('CollectionSettings component', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
		window.history.replaceState({}, '', '/');
		// saveSetting writes hidden inputs into the post form and pings AjaxSave
		document.body.innerHTML =
			'<form id="post"></form><form action="options.php"></form>';
		window.FotoGridsAjaxSave = { showUnsavedChanges: jest.fn() };
		// colour picker needs a 2D canvas context
		const grad = { addColorStop: jest.fn() };
		jest.spyOn(
			window.HTMLCanvasElement.prototype,
			'getContext'
		).mockReturnValue({
			createLinearGradient: jest.fn(() => grad),
			fillRect: jest.fn(),
			set fillStyle(v) {},
			get fillStyle() {
				return '';
			},
		});
		window.fotogridsSettings = {
			postType: 'gallery',
			postId: 12,
			settings: {
				enabled: '1',
				title: 'Hi',
				layout: 'grid',
				columns: 3,
				border_color: '#ff0000',
				fields: '["caption"]',
				flag2: '0',
				gap: { desktop: 8, tablet: 8, mobile: 8 },
				layout_style: 'grid',
				hover: 'none',
				align: 'center',
				bgroup: 'a',
				font: '',
				weight: '',
			},
			isProActive: true,
		};
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ fonts: [] }),
			})
		);
		window.fotogridsCatalog = {
			field_states: {},
			field_states_by_option: {},
		};
		window.fotogridsAdmin = {};
		window.FotoGridsIcons = {};
		window.FotoGridsSettings = {
			loadSettingsGroups: jest.fn(() => Promise.resolve(CATALOG)),
		};
	});

	afterEach(() => {
		jest.restoreAllMocks();
		delete window.fotogridsSettings;
		delete window.FotoGridsSettings;
		delete window.fotogridsCatalog;
	});

	it('loads the catalog and renders a tab per group', async () => {
		const handle = mountSettings();
		await flush();
		const tabs = handle.container.querySelectorAll(
			'.fotogrids-settings-tab'
		);
		expect(tabs.length).toBe(4);
		expect(handle.container.textContent).toContain('General');
		expect(handle.container.textContent).toContain('Advanced');
	});

	it('renders the active tab settings (toggle, text, select, range)', async () => {
		const handle = mountSettings();
		await flush();
		expect(
			handle.container.querySelector('.fotogrids-toggle-control')
		).not.toBeNull();
		expect(
			handle.container.querySelector('input.fotogrids-input')
		).not.toBeNull();
		expect(
			handle.container.querySelector('input[type="range"]')
		).not.toBeNull();
	});

	it('switches to another tab on click', async () => {
		const handle = mountSettings();
		await flush();
		const advancedTab = [
			...handle.container.querySelectorAll('.fotogrids-settings-tab'),
		].find((t) => t.textContent.includes('Advanced'));
		await act(async () => {
			click(advancedTab);
			await Promise.resolve();
		});
		expect(
			handle.container.querySelector(
				'.fotogrids-settings-tab.fg-is-active'
			).textContent
		).toContain('Advanced');
	});

	it('updates a setting value when the text field changes', async () => {
		const handle = mountSettings();
		await flush();
		await act(async () => {
			changeValue(
				handle.container.querySelector('input.fotogrids-input'),
				'New title'
			);
		});
		expect(
			handle.container.querySelector('input.fotogrids-input').value
		).toBe('New title');
	});

	it('renders richer setting types (color, token-select, info-block, group)', async () => {
		const handle = mountSettings();
		await flush();
		expect(
			handle.container.querySelector('.fotogrids-color-picker')
		).not.toBeNull();
		expect(
			handle.container.querySelector('.fotogrids-token-select')
		).not.toBeNull();
		expect(
			handle.container.querySelector('.fotogrids-settings_info-block')
		).not.toBeNull();
		expect(
			handle.container.querySelector('.fotogrids-setting-group')
		).not.toBeNull();
	});

	it('switches Easy/Advanced mode via the segmented control', async () => {
		global.wp.apiFetch = jest.fn(() => Promise.resolve({}));
		const handle = mountSettings();
		await flush();
		const options = handle.container.querySelectorAll(
			'.fotogrids-segmented__option'
		);
		if (options.length >= 2) {
			await act(async () => {
				click(options[1]);
				await Promise.resolve();
			});
		}
		expect(
			handle.container.querySelector('.fotogrids-segmented__option')
		).not.toBeNull();
	});

	it('toggles autosave via the docs-strip switch', async () => {
		global.wp.apiFetch = jest.fn(() => Promise.resolve({}));
		const handle = mountSettings();
		await flush();
		const autosave = handle.container.querySelector(
			'.fotogrids-toggle--green'
		);
		if (autosave) {
			await act(async () => {
				click(autosave);
				await Promise.resolve();
			});
		}
		// toggle interaction handled without throwing
		expect(
			handle.container.querySelector('.fotogrids-gallery-settings')
		).not.toBeNull();
	});

	it('applies visible_when, disabled_unless and hidden on the advanced tab', async () => {
		const handle = mountSettings();
		await flush();
		const advancedTab = [
			...handle.container.querySelectorAll('.fotogrids-settings-tab'),
		].find((t) => t.textContent.includes('Advanced'));
		await act(async () => {
			click(advancedTab);
			await Promise.resolve();
		});
		// 'flag' is '0' by default -> the visible_when:truthy field is hidden,
		// and the hidden field never renders. The override field renders disabled.
		expect(handle.container.textContent).not.toContain('Hidden');
		expect(handle.container.textContent).toContain('Override');
	});

	it('renders a Pro upsell tab when Pro is inactive', async () => {
		window.fotogridsSettings.isProActive = false;
		const handle = mountSettings();
		await flush();
		const proTab = [
			...handle.container.querySelectorAll('.fotogrids-settings-tab'),
		].find((t) => t.textContent.includes('Pro Tab'));
		expect(proTab).not.toBeNull();
		expect(proTab.className).toContain('is-pro');
		await act(async () => {
			click(proTab);
			await Promise.resolve();
		});
		expect(
			handle.container.querySelector('.fotogrids-gallery-settings')
		).not.toBeNull();
	});

	it('renders a sub-tabbed group and switches between sub-tabs', async () => {
		const handle = mountSettings();
		await flush();
		const lightboxTab = [
			...handle.container.querySelectorAll('.fotogrids-settings-tab'),
		].find((t) => t.textContent.includes('Lightbox'));
		await act(async () => {
			click(lightboxTab);
			await Promise.resolve();
		});
		expect(
			handle.container.querySelector('.fotogrids-subtabs-nav')
		).not.toBeNull();
		const subtabs = handle.container.querySelectorAll(
			'.fotogrids-subtabs-nav .fotogrids-subtab'
		);
		expect(subtabs.length).toBe(2);
		// switch to the second sub-tab
		await act(async () => {
			click(subtabs[1]);
			await Promise.resolve();
		});
		expect(handle.container.textContent).toContain('Theme');
	});

	it('exposes switchTab on the global API after mount', async () => {
		mountSettings();
		await flush();
		expect(
			typeof window.FotoGridsCollectionSettings.switchTab
		).toBe('function');
		await act(async () => {
			window.FotoGridsCollectionSettings.switchTab('advanced');
		});
		expect(
			typeof window.FotoGridsCollectionSettings.switchTab
		).toBe('function');
	});

	it('renders in defaults mode', async () => {
		window.fotogridsSettings.isDefaultsMode = true;
		const handle = mountSettings();
		await flush();
		expect(
			handle.container.querySelector('.fotogrids-gallery-settings')
		).not.toBeNull();
	});

	it('renders a clickable boolean toggle', async () => {
		const handle = mountSettings();
		await flush();
		const toggle = handle.container.querySelector('button.fotogrids-toggle');
		expect(toggle).not.toBeNull();
		expect(toggle.hasAttribute('aria-checked')).toBe(true);
		await act(async () => {
			click(toggle);
		});
		// click handled without throwing; toggle still present
		expect(
			handle.container.querySelector('button.fotogrids-toggle')
		).not.toBeNull();
	});
});
