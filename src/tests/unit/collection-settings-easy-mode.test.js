/**
 * Easy / Advanced mode in CollectionSettings: tree filtering, tab fallback,
 * the per-user mode switch, the upgrade tip, the Advanced-settings notice and
 * preset_group writes.
 */
import '@/admin/plain/error-boundary';
import '@/admin/plain/render-settings/utils/post-type-placeholders';
import '@/admin/plain/render-settings/utils/tooltip-utils';
import '@/admin/plain/render-settings/utils/settings-mode';
import '@/admin/plain/render-settings/renderToggle';
import '@/admin/plain/render-settings/renderTextInput';
import '@/admin/plain/render-settings/renderSelect';
import '@/admin/plain/render-settings/renderButtonGroup';
import '@/admin/plain/render-settings/renderPresetGroup';
import '@/admin/plain/render-settings/renderBulkModal';
import '@/admin/plain/render-settings/renderConditionalMessage';
import '@/admin/plain/render-settings/renderGroup';
import '@/admin/plain/render-settings/renderSettingSubTabs';
import '@/admin/src/collection-state-manager';
import '@/admin/src/utils/ui-state-manager';
import '@/admin/plain/collection-settings';
import '../../public/render/fg-tooltip/fg-tooltip';
import { renderElement, click, act } from '@tests/helpers/render-component';

const EASY = ['easy', 'advanced'];

const CATALOG = {
	layout: {
		id: 'layout',
		label: 'Layout',
		icon: 'l',
		free: true,
		settings: [
			{
				key: 'title_text',
				type: 'text_input',
				label: 'Title',
				modes: EASY,
			},
			{
				id: 'easy_shadow',
				type: 'preset_group',
				label: 'Shadow',
				modes: ['easy'],
				options: [
					{
						value: 'none',
						label: 'None',
						icon: 'shadow_none',
						values: { shadow_enabled: false },
					},
					{
						value: 'soft',
						label: 'Soft',
						icon: 'shadow_soft',
						values: { shadow_enabled: true, shadow_blur: 10 },
					},
					{
						value: 'strong',
						label: 'Strong',
						icon: 'shadow_strong',
						values: { shadow_enabled: true, shadow_blur: 20 },
					},
				],
			},
			{ key: 'shadow_enabled', type: 'toggle', label: 'Enable Shadow' },
			{ key: 'shadow_blur', type: 'text_input', label: 'Shadow blur' },
			{
				key: 'advanced_text',
				type: 'text_input',
				label: 'Advanced text',
			},
		],
	},
	styling: {
		id: 'styling',
		label: 'Styling',
		icon: 's',
		free: true,
		settings: [
			{ key: 'advanced_color', type: 'text_input', label: 'Colour' },
		],
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
					{
						key: 'lightbox_loop',
						type: 'toggle',
						label: 'Loop',
						modes: EASY,
					},
				],
			},
			look: {
				id: 'look',
				label: 'Look',
				icon: 'k',
				settings: [
					{ key: 'lightbox_bg', type: 'text_input', label: 'Bg' },
				],
			},
		},
	},
};

const DEFAULTS = {
	title_text: '',
	shadow_enabled: false,
	shadow_blur: 10,
	advanced_text: '',
	advanced_color: '',
	lightbox_loop: true,
	lightbox_bg: '#000',
};

const flush = async () => {
	await act(async () => {
		for (let i = 0; i < 8; i++) {
			await Promise.resolve();
		}
	});
};

const okJson = (data) =>
	Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

const preferenceCalls = () =>
	global.fetch.mock.calls
		.map(([, init]) => init?.body)
		.filter(
			(body) =>
				body instanceof FormData &&
				body.get('action') === 'fotogrids_update_user_preference'
		)
		.map((body) => ({
			nonce: body.get('nonce'),
			preference: body.get('preference'),
			value: body.get('value'),
		}));

const tabLabels = (container) =>
	[...container.querySelectorAll('.fotogrids-settings-tab__label')].map((t) =>
		t.textContent.trim()
	);

const activeTab = (container) =>
	container.querySelector('.fotogrids-settings-tab.fg-is-active')
		?.textContent;

const modeButton = (container, label) =>
	[...container.querySelectorAll('.fotogrids-segmented__option')].find((b) =>
		b.textContent.includes(label)
	);

const clickAsync = async (node) => {
	await act(async () => {
		node.click();
	});
	await flush();
};

const mounted = [];

function mount() {
	const Comp = window.FotoGridsCollectionSettings.CollectionSettings;
	const handle = renderElement(wp.element.createElement(Comp));
	mounted.push(handle);
	return handle;
}

describe('CollectionSettings Easy mode', () => {
	let fetchResponse;

	beforeEach(() => {
		window.sessionStorage.clear();
		window.history.replaceState({}, '', '/');
		document.body.innerHTML = '<form id="post"></form>';
		window.FotoGridsAjaxSave = { showUnsavedChanges: jest.fn() };
		window.fotogridsSettings = {
			postType: 'gallery',
			postId: 9,
			collectionKind: 'gallery',
			isProActive: true,
			settings: { ...DEFAULTS },
			defaults: { ...DEFAULTS },
		};
		window.fotogridsCatalog = {
			field_states: {},
			field_states_by_option: {},
		};
		window.fotogridsAdmin = {
			ajaxUrl: 'https://x/admin-ajax.php',
			nonce: 'nonce-1',
			settingsMode: 'easy',
			showSettingsModeTip: '',
		};
		window.fotogridsToast = { error: jest.fn(), success: jest.fn() };
		window.FotoGridsIcons = {};
		window.FotoGridsSettings = {
			loadSettingsGroups: jest.fn(() => Promise.resolve(CATALOG)),
		};
		fetchResponse = { success: true, data: { value: 'x' } };
		global.fetch = jest.fn(() => okJson(fetchResponse));
		wp.i18n.sprintf.mockImplementation((format, ...args) =>
			format.replace('%d', String(args[0]))
		);
	});

	afterEach(() => {
		mounted.splice(0).forEach((handle) => handle.unmount());
		wp.i18n.sprintf.mockImplementation((format) => format);
		delete window.fotogridsSettings;
		delete window.FotoGridsSettings;
		delete window.fotogridsCatalog;
		delete window.fotogridsAdmin;
		delete window.fotogridsToast;
		delete window.FotoGridsAjaxSave;
	});

	describe('tree filtering', () => {
		it('shows only Easy settings, tabs and subtabs in Easy', async () => {
			const { container } = mount();
			await flush();

			expect(tabLabels(container)).toEqual(['Layout', 'Lightbox']);
			expect(container.textContent).toContain('Title');
			expect(container.textContent).toContain('Shadow');
			expect(container.textContent).not.toContain('Advanced text');
			expect(container.textContent).not.toContain('Enable Shadow');
			expect(
				container.querySelector('[data-fg-setting="easy_shadow"]')
			).not.toBeNull();

			click(
				[...container.querySelectorAll('.fotogrids-settings-tab')].find(
					(t) => t.textContent.includes('Lightbox')
				)
			);
			// One Easy subtab left: rendered without a subtab nav.
			expect(
				container.querySelector('.fotogrids-subtabs-nav')
			).toBeNull();
			expect(container.textContent).toContain('Loop');
			expect(container.textContent).not.toContain('Bg');
		});

		it('shows every untagged setting and hides Easy presets in Advanced', async () => {
			window.fotogridsAdmin.settingsMode = 'advanced';
			const { container } = mount();
			await flush();

			expect(tabLabels(container)).toEqual([
				'Layout',
				'Styling',
				'Lightbox',
			]);
			expect(container.textContent).toContain('Advanced text');
			expect(container.textContent).toContain('Enable Shadow');
			expect(
				container.querySelector('[data-fg-setting="easy_shadow"]')
			).toBeNull();
		});

		it('renders unfiltered when the mode helpers are missing', async () => {
			const helpers = window.FotoGridsSettingsMode;
			delete window.FotoGridsSettingsMode;
			try {
				const { container } = mount();
				await flush();
				expect(tabLabels(container)).toEqual([
					'Layout',
					'Styling',
					'Lightbox',
				]);
				const preset = container.querySelector(
					'[data-fg-setting="easy_shadow"]'
				);
				expect(preset).not.toBeNull();
				expect(preset.querySelector('.fg-is-active')).toBeNull();
			} finally {
				window.FotoGridsSettingsMode = helpers;
			}
		});
	});

	describe('active tab fallback', () => {
		it('lands on the first visible tab when the deep-linked tab is empty in Easy', async () => {
			window.history.replaceState({}, '', '/?fg-settings-tab=styling');
			const { container } = mount();
			await flush();
			expect(activeTab(container)).toContain('Layout');
			expect(container.textContent).toContain('Title');
		});

		it('moves off a tab that empties when switching to Easy', async () => {
			window.fotogridsAdmin.settingsMode = 'advanced';
			window.history.replaceState({}, '', '/?fg-settings-tab=styling');
			const { container } = mount();
			await flush();
			expect(activeTab(container)).toContain('Styling');
			// Styling has no docs strip of its own; switch from Layout.
			click(
				[...container.querySelectorAll('.fotogrids-settings-tab')].find(
					(t) => t.textContent.includes('Layout')
				)
			);
			click(
				[...container.querySelectorAll('.fotogrids-settings-tab')].find(
					(t) => t.textContent.includes('Styling')
				)
			);
			await act(async () => {
				window.FotoGridsCollectionSettings.switchTab('layout');
			});
			await clickAsync(modeButton(container, 'Easy'));
			expect(activeTab(container)).toContain('Layout');
		});

		it('ignores switchTab to a tab hidden in the current mode', async () => {
			const { container } = mount();
			await flush();
			await act(async () => {
				window.FotoGridsCollectionSettings.switchTab('styling');
			});
			expect(activeTab(container)).toContain('Layout');
		});
	});

	describe('mode switch', () => {
		it('saves the per-user preference and updates the localized mode', async () => {
			const { container } = mount();
			await flush();
			await clickAsync(modeButton(container, 'Advanced'));

			expect(preferenceCalls()).toEqual([
				{
					nonce: 'nonce-1',
					preference: 'settings_mode',
					value: 'advanced',
				},
			]);
			expect(window.fotogridsAdmin.settingsMode).toBe('advanced');
			expect(modeButton(container, 'Advanced').className).toContain(
				'fg-is-active'
			);
			expect(container.textContent).toContain('Advanced text');
		});

		it('rolls back and toasts the server message on failure', async () => {
			fetchResponse = { success: false, data: { message: 'Nope' } };
			const { container } = mount();
			await flush();
			await clickAsync(modeButton(container, 'Advanced'));

			expect(window.fotogridsAdmin.settingsMode).toBe('easy');
			expect(modeButton(container, 'Easy').className).toContain(
				'fg-is-active'
			);
			expect(window.fotogridsToast.error).toHaveBeenCalledWith('Nope');
			expect(container.textContent).not.toContain('Advanced text');
		});

		it('rolls back with the default message when the request fails', async () => {
			const err = jest
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const { container } = mount();
			await flush();
			global.fetch = jest.fn(() =>
				Promise.resolve({ ok: false, status: 500 })
			);
			await clickAsync(modeButton(container, 'Advanced'));

			expect(modeButton(container, 'Easy').className).toContain(
				'fg-is-active'
			);
			expect(window.fotogridsToast.error).toHaveBeenCalledWith(
				'Failed to update setup mode'
			);
			expect(err).toHaveBeenCalled();
		});

		it('puts the switch tooltip on the inactive option only', async () => {
			const { container } = mount();
			await flush();
			expect(
				modeButton(container, 'Easy').getAttribute('data-fg-tooltip')
			).toBeNull();
			expect(
				modeButton(container, 'Advanced').getAttribute('data-fg-tooltip')
			).toBe('Switch to Advanced editing mode for fine-grained controls');
			await clickAsync(modeButton(container, 'Advanced'));
			expect(
				modeButton(container, 'Easy').getAttribute('data-fg-tooltip')
			).toBe(
				'Switch to Easy editing mode to show only the essential controls'
			);
			expect(
				modeButton(container, 'Advanced').getAttribute('data-fg-tooltip')
			).toBeNull();
		});

		it('does nothing when the active mode is clicked', async () => {
			const { container } = mount();
			await flush();
			await clickAsync(modeButton(container, 'Easy'));
			expect(preferenceCalls()).toEqual([]);
		});
	});

	describe('upgrade tip', () => {
		const tooltipEl = () => document.getElementById('fg-tooltip');
		const tip = () =>
			document.querySelector('#fg-tooltip .fotogrids-settings-mode-tip');
		const gotIt = () => tip().querySelector('.fotogrids-settings-mode-tip__ok');
		const settleListeners = async () => {
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});
		};
		const pressEscape = async () => {
			await act(async () => {
				document.body.dispatchEvent(
					new window.KeyboardEvent('keydown', {
						key: 'Escape',
						bubbles: true,
						cancelable: true,
					})
				);
			});
			await flush();
		};

		it('is absent unless the localized flag is set', async () => {
			const spy = jest.spyOn(window.FgTooltip, 'showInteractive');
			mount();
			await flush();
			expect(spy).not.toHaveBeenCalled();
			expect(tip()).toBeNull();
		});

		it('opens above the switch when there is no room below it', async () => {
			window.fotogridsAdmin.showSettingsModeTip = '1';
			const spy = jest.spyOn(window.FgTooltip, 'showInteractive');
			const rectSpy = jest
				.spyOn(Element.prototype, 'getBoundingClientRect')
				.mockReturnValue({
					top: window.innerHeight - 40,
					bottom: window.innerHeight - 10,
					left: 0,
					right: 100,
					width: 100,
					height: 30,
				});
			mount();
			await flush();
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy.mock.calls[0][2]).toEqual({ dir: 'above' });
			rectSpy.mockRestore();
		});

		it('opens an interactive fg-tooltip on the mode switch', async () => {
			window.fotogridsAdmin.showSettingsModeTip = '1';
			const spy = jest.spyOn(window.FgTooltip, 'showInteractive');
			const { container } = mount();
			await flush();

			const host = container.querySelector(
				'.fotogrids-settings-docs-strip__mode .fotogrids-segmented'
			);
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy.mock.calls[0][0]).toBe(host);
			expect(spy.mock.calls[0][2]).toEqual({ dir: 'below' });
			expect(host.getAttribute('aria-expanded')).toBe('true');
			expect(tooltipEl().className).toContain('fg-f-tooltip--interactive');

			const dialog = tip();
			expect(dialog.getAttribute('role')).toBe('dialog');
			const titleId = dialog.getAttribute('aria-labelledby');
			expect(document.getElementById(titleId).textContent).toBe(
				'Settings are simpler now'
			);
			expect(
				document.getElementById(dialog.getAttribute('aria-describedby'))
					.textContent
			).toBe(
				'Easy editing mode shows only the essential controls. Switch to Advanced editing mode any time to see every setting.'
			);
			expect(gotIt().textContent).toBe('Got it');
			expect(preferenceCalls()).toEqual([]);
		});

		it('dismisses with Got it and saves the dismissal once', async () => {
			window.fotogridsAdmin.showSettingsModeTip = '1';
			mount();
			await flush();
			await clickAsync(gotIt());

			expect(tip()).toBeNull();
			expect(tooltipEl().hidden).toBe(true);
			expect(window.fotogridsAdmin.showSettingsModeTip).toBe('');
			expect(preferenceCalls()).toEqual([
				{
					nonce: 'nonce-1',
					preference: 'settings_mode_tip_dismissed',
					value: '1',
				},
			]);
		});

		it('dismisses when fg-tooltip closes it with Escape', async () => {
			window.fotogridsAdmin.showSettingsModeTip = '1';
			mount();
			await flush();
			await settleListeners();
			await pressEscape();

			expect(tip()).toBeNull();
			expect(tooltipEl().hidden).toBe(true);
			expect(preferenceCalls()).toEqual([
				expect.objectContaining({
					preference: 'settings_mode_tip_dismissed',
					value: '1',
				}),
			]);
		});

		it('dismisses when fg-tooltip closes it on an outside click', async () => {
			window.fotogridsAdmin.showSettingsModeTip = '1';
			const { container } = mount();
			await flush();
			await settleListeners();
			await clickAsync(container.querySelector('.fotogrids-settings-tab'));

			expect(tip()).toBeNull();
			expect(preferenceCalls()).toHaveLength(1);
		});

		it('is dismissed by switching mode', async () => {
			window.fotogridsAdmin.showSettingsModeTip = '1';
			const { container } = mount();
			await flush();
			await settleListeners();
			await clickAsync(modeButton(container, 'Advanced'));

			expect(tip()).toBeNull();
			expect(preferenceCalls().map((c) => c.preference)).toEqual([
				'settings_mode_tip_dismissed',
				'settings_mode',
			]);
		});

		it('stays hidden when saving the dismissal fails', async () => {
			const warn = jest
				.spyOn(console, 'warn')
				.mockImplementation(() => {});
			window.fotogridsAdmin.showSettingsModeTip = '1';
			mount();
			await flush();
			global.fetch = jest.fn(() => Promise.reject(new Error('down')));
			await clickAsync(gotIt());
			expect(tip()).toBeNull();
			expect(warn).toHaveBeenCalled();
		});

		it('closes without saving a dismissal on unmount', async () => {
			window.fotogridsAdmin.showSettingsModeTip = '1';
			const handle = mount();
			await flush();
			expect(tip()).not.toBeNull();
			act(() => {
				mounted.splice(mounted.indexOf(handle), 1);
				handle.unmount();
			});
			expect(tip()).toBeNull();
			expect(preferenceCalls()).toEqual([]);
		});

		it('still dismisses with Got it without MutationObserver', async () => {
			const Observer = global.MutationObserver;
			delete global.MutationObserver;
			try {
				window.fotogridsAdmin.showSettingsModeTip = '1';
				mount();
				await flush();
				await clickAsync(gotIt());
				expect(tip()).toBeNull();
				expect(preferenceCalls()).toHaveLength(1);
			} finally {
				global.MutationObserver = Observer;
			}
		});

		it('hides a popover that has not opened yet on unmount', async () => {
			const real = window.FgTooltip;
			const stub = {
				init: jest.fn(),
				showInteractive: jest.fn(() => true),
				hideInteractive: jest.fn(),
			};
			window.FgTooltip = stub;
			try {
				window.fotogridsAdmin.showSettingsModeTip = '1';
				const handle = mount();
				await flush();
				act(() => {
					mounted.splice(mounted.indexOf(handle), 1);
					handle.unmount();
				});
				expect(stub.hideInteractive).toHaveBeenCalledTimes(1);
			} finally {
				window.FgTooltip = real;
			}
		});

		it('does nothing when fg-tooltip is missing or declines to open', async () => {
			const real = window.FgTooltip;
			window.fotogridsAdmin.showSettingsModeTip = '1';
			try {
				window.FgTooltip = undefined;
				mount();
				await flush();
				window.FgTooltip = {
					init: jest.fn(),
					showInteractive: jest.fn(() => false),
				};
				mount();
				await flush();
				expect(window.FgTooltip.showInteractive).toHaveBeenCalled();
				expect(preferenceCalls()).toEqual([]);
			} finally {
				window.FgTooltip = real;
			}
		});
	});

	describe('Advanced changes', () => {
		it('shows no notice in Easy when Advanced-only values changed', async () => {
			window.fotogridsSettings.settings.advanced_text = 'changed';
			window.fotogridsSettings.settings.lightbox_bg = '#fff';
			const { container } = mount();
			await flush();
			expect(
				container.querySelector('.fotogrids-settings-mode-notice')
			).toBeNull();
			expect(container.textContent).not.toContain(
				'changed in Advanced editing mode'
			);
		});
	});

	describe('preset_group', () => {
		const radio = (container, label) =>
			[
				...container.querySelectorAll(
					'[data-fg-setting="easy_shadow"] .fg-button-group__button'
				),
			].find(
				(r) => r.querySelector('.fg-button-label')?.textContent === label
			);
		const isActive = (node) => node.classList.contains('fg-is-active');

		it('selects the option matching the saved values, falling back to defaults', async () => {
			delete window.fotogridsSettings.settings.shadow_blur;
			window.fotogridsSettings.settings.shadow_enabled = '1';
			const { container } = mount();
			await flush();
			expect(isActive(radio(container, 'Soft'))).toBe(true);
		});

		it('writes every key once through the form and autosave path', async () => {
			const changed = [];
			const listener = (e) => changed.push(e.detail.key);
			document.addEventListener('fotogrids:setting_changed', listener);
			const { container } = mount();
			await flush();
			expect(isActive(radio(container, 'None'))).toBe(true);

			click(radio(container, 'Strong'));
			document.removeEventListener('fotogrids:setting_changed', listener);

			expect(changed).toEqual(['shadow_enabled', 'shadow_blur']);
			expect(
				document.querySelector('input[name="fotogrids_shadow_enabled"]')
					.value
			).toBe('true');
			expect(
				document.querySelector('input[name="fotogrids_shadow_blur"]')
					.value
			).toBe('20');
			expect(
				window.FotoGridsAjaxSave.showUnsavedChanges
			).toHaveBeenCalledTimes(2);
			expect(isActive(radio(container, 'Strong'))).toBe(true);
			expect(
				container.querySelector(
					'[data-fg-setting="easy_shadow"] .fotogrids-button-group.fg-button-group--big-icons'
				)
			).not.toBeNull();
		});

		it('announces each key to the Defaults screen in defaults mode', async () => {
			window.fotogridsSettings.isDefaultsMode = true;
			const events = [];
			const listener = (e) => events.push(e.detail);
			document.addEventListener('fotogrids:setting_changed', listener);
			const { container } = mount();
			await flush();
			click(radio(container, 'Soft'));
			document.removeEventListener('fotogrids:setting_changed', listener);

			expect(events).toEqual([
				{ key: 'shadow_enabled', value: true, scope: 'defaults' },
				{ key: 'shadow_blur', value: 10, scope: 'defaults' },
			]);
		});

		it('selects nothing and adds no text when no option matches', async () => {
			window.fotogridsSettings.settings.shadow_enabled = true;
			window.fotogridsSettings.settings.shadow_blur = 15;
			const { container } = mount();
			await flush();
			const preset = container.querySelector(
				'[data-fg-setting="easy_shadow"]'
			);
			expect(preset.getAttribute('data-fg-setting-type')).toBe(
				'preset_group'
			);
			expect(preset.querySelector('.fg-is-active')).toBeNull();
			expect(preset.textContent).not.toContain('Custom');
			expect(preset.textContent).not.toContain('Show in Advanced');
		});
	});
	describe('preset_group visibility and copy', () => {
		const SHARING_CATALOG = {
			sharing: {
				id: 'sharing',
				label: 'Sharing',
				icon: 'sh',
				free: true,
				settings: [
					{
						key: 'sharing_title',
						type: 'text_input',
						label: 'Share title',
						modes: EASY,
					},
					{
						id: 'easy_sharing',
						type: 'preset_group',
						label: 'Sharing buttons',
						modes: ['easy'],
						condition_global: {
							dependsOn: 'enable_social_sharing',
							values: [true],
						},
						options: [
							{
								value: 'on',
								label: 'On',
								values: {
									sharing_disabled_for_collection: false,
								},
							},
							{
								value: 'off',
								label: 'Off for this {postType}',
								values: {
									sharing_disabled_for_collection: true,
								},
							},
						],
					},
				],
			},
		};

		beforeEach(() => {
			window.FotoGridsSettings.loadSettingsGroups = jest.fn(() =>
				Promise.resolve(SHARING_CATALOG)
			);
			window.fotogridsSettings.settings = {
				sharing_disabled_for_collection: false,
			};
		});

		it('hides a condition_global-gated preset when the global is off', async () => {
			window.fotogridsSettings.globalSharing = {
				enable_social_sharing: false,
			};
			const { container } = mount();
			await flush();
			expect(container.textContent).toContain('Share title');
			expect(
				container.querySelector('[data-fg-setting="easy_sharing"]')
			).toBeNull();
		});

		it('shows the preset with placeholder labels and text-only options', async () => {
			window.fotogridsSettings.globalSharing = {
				enable_social_sharing: true,
			};
			window.fotogridsSettings.collectionKind = 'album';
			const { container } = mount();
			await flush();
			const preset = container.querySelector(
				'[data-fg-setting="easy_sharing"]'
			);
			expect(preset).not.toBeNull();
			const labels = [
				...preset.querySelectorAll('.fg-button-group__button'),
			].map((r) => r.textContent);
			expect(labels).toEqual(['On', 'Off for this Album']);
			expect(preset.querySelector('svg')).toBeNull();
			expect(
				preset.querySelector('.fg-button-group__button.fg-is-active')
					.textContent
			).toBe('On');
		});
	});

	describe('walkthrough hooks', () => {
		it('marks each settings tab with its group id', async () => {
			const { container } = mount();
			await flush();
			expect(
				container.querySelector('[data-fg-settings-tab="layout"]')
			).not.toBeNull();
		});

		it('starts the screen tour from the Tour button', async () => {
			const listener = jest.fn();
			document.addEventListener('fotogrids:walkthrough:start', listener);
			const { container } = mount();
			await flush();
			const tour = container.querySelector(
				'.fotogrids-settings-docs-strip__tour'
			);
			expect(tour.getAttribute('aria-label')).toBe(
				'Take a tour of this screen'
			);
			click(tour);
			document.removeEventListener(
				'fotogrids:walkthrough:start',
				listener
			);
			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('has no Tour button on Settings > Defaults', async () => {
			window.fotogridsSettings.isDefaultsMode = true;
			const { container } = mount();
			await flush();
			expect(
				container.querySelector('.fotogrids-settings-docs-strip__tour')
			).toBeNull();
		});
	});
});
