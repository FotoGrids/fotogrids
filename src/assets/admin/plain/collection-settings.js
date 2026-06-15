const {
	createElement: h,
	useState,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useCallback,
} = wp.element;
const {
	SelectControl,
	__experimentalNavigatorProvider: NavigatorProvider,
	__experimentalNavigatorScreen: NavigatorScreen,
	__experimentalNavigatorButton: NavigatorButton,
	__experimentalNavigator: Navigator,
} = wp.components;
const { __ } = wp.i18n;

let SETTINGS_GROUPS = {};
const FIELD_STATE = {
	EDITABLE: 'editable',
	LOCKED: 'locked',
	TEASER: 'teaser',
};

const isFreeTier = config => {
	if (!config || typeof config !== 'object') {
		return true;
	}

	if (typeof config.tier_required === 'string') {
		return config.tier_required === 'free';
	}

	if (typeof config.free === 'boolean') {
		return config.free;
	}

	return true;
};

const withLegacyFreeFlag = config => {
	if (!config || typeof config !== 'object') {
		return config;
	}

	if (typeof config.free === 'boolean') {
		return config;
	}

	return {
		...config,
		free: isFreeTier(config),
	};
};

const resolveFieldStateValue = (
	setting,
	currentValue,
	fieldStates,
	fieldStatesByOption,
) => {
	if (!setting || !setting.key) {
		return FIELD_STATE.EDITABLE;
	}

	const optionStateKey = `${setting.key}.${currentValue}`;
	if (
		typeof currentValue === 'string' &&
		fieldStatesByOption &&
		fieldStatesByOption[optionStateKey]
	) {
		return fieldStatesByOption[optionStateKey];
	}

	if (fieldStates && fieldStates[setting.key]) {
		return fieldStates[setting.key];
	}

	return FIELD_STATE.EDITABLE;
};

const useFieldState = (
	setting,
	currentValue,
	fieldStates,
	fieldStatesByOption,
) => {
	return useMemo(
		() =>
			resolveFieldStateValue(
				setting,
				currentValue,
				fieldStates,
				fieldStatesByOption,
			),
		[setting?.key, currentValue, fieldStates, fieldStatesByOption],
	);
};

const TeaserBadge = ({ __ }) => {
	return h(
		'span',
		{ className: 'fotogrids-pro-badge' },
		__('Pro', 'fotogrids'),
	);
};

const LockedBanner = ({ __ }) => {
	return h(
		'div',
		{ className: 'fotogrids-settings-locked-banner' },
		__('Locked: renew your license to edit this setting.', 'fotogrids'),
	);
};

const FieldGate = ({
	setting,
	currentValue,
	fieldStates,
	fieldStatesByOption,
	__,
	children,
}) => {
	const state = useFieldState(
		setting,
		currentValue,
		fieldStates,
		fieldStatesByOption,
	);
	const isTeaser = state === FIELD_STATE.TEASER;
	const isLocked = state === FIELD_STATE.LOCKED;

	return h(
		'div',
		{
			className: `fotogrids-field-gate ${isTeaser ? 'fotogrids-field-gate--teaser' : ''} ${isLocked ? 'fotogrids-field-gate--locked' : ''}`,
		},
		[children, isLocked && h(LockedBanner, { __ })].filter(Boolean),
	);
};

window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};
window.FotoGridsRenderSettings.useFieldState = useFieldState;
window.FotoGridsRenderSettings.TeaserBadge = TeaserBadge;
window.FotoGridsRenderSettings.LockedBanner = LockedBanner;
window.FotoGridsRenderSettings.FieldGate = FieldGate;

// Post-type placeholder helpers live in render-settings/utils/post-type-placeholders.js
// (wrapped in an IIFE) and are enqueued before this script. Pull them off the
// shared global so the renderers (e.g. renderCodeArea for hint strings) and
// the settings translator share a single implementation.
const replacePostTypePlaceholders =
	window.FotoGridsRenderSettings.replacePostTypePlaceholders;
const processSettingPlaceholders =
	window.FotoGridsRenderSettings.processSettingPlaceholders;

const translateSettingsGroup = (group, normalizedPostType = 'gallery') => {
	const translated = withLegacyFreeFlag({ ...group });

	if (translated.label) {
		translated.label = __(translated.label, 'fotogrids');
		translated.label = replacePostTypePlaceholders(
			translated.label,
			normalizedPostType,
		);
	}

	if (translated.settings) {
		translated.settings = translated.settings.map(setting => {
			let translatedSetting = withLegacyFreeFlag({ ...setting });

			if (translatedSetting.label) {
				translatedSetting.label = __(
					translatedSetting.label,
					'fotogrids',
				);
			}

			if (translatedSetting.description) {
				translatedSetting.description = __(
					translatedSetting.description,
					'fotogrids',
				);
			}

			if (translatedSetting.options) {
				translatedSetting.options = translatedSetting.options.map(
					option =>
						withLegacyFreeFlag({
							...option,
							label: option.label
								? __(option.label, 'fotogrids')
								: option.label,
							description: option.description
								? __(option.description, 'fotogrids')
								: option.description,
						}),
				);
			}

			if (translatedSetting.conditionalMessage?.message) {
				translatedSetting.conditionalMessage.message = __(
					translatedSetting.conditionalMessage.message,
					'fotogrids',
				);
			}

			if (translatedSetting.subTabs) {
				Object.keys(translatedSetting.subTabs).forEach(subTabKey => {
					const subTab = translatedSetting.subTabs[subTabKey];
					subTab.label = __(subTab.label, 'fotogrids');
					if (subTab.settings) {
						subTab.settings = subTab.settings.map(subSetting => {
							const translatedSubSetting = translateSettingsGroup(
								{ settings: [subSetting] },
								normalizedPostType,
							).settings[0];
							return processSettingPlaceholders(
								translatedSubSetting,
								normalizedPostType,
							);
						});
					}
				});
			}

			translatedSetting = processSettingPlaceholders(
				translatedSetting,
				normalizedPostType,
			);

			return translatedSetting;
		});
	}

	if (translated.subTabs) {
		const processedSubTabs = {};
		Object.keys(translated.subTabs).forEach(subTabKey => {
			const subTab = { ...translated.subTabs[subTabKey] };

			if (subTab.postTypes && Array.isArray(subTab.postTypes)) {
				if (!subTab.postTypes.includes(normalizedPostType)) {
					return;
				}
			}

			if (subTab.label) {
				subTab.label = __(subTab.label, 'fotogrids');
				subTab.label = replacePostTypePlaceholders(
					subTab.label,
					normalizedPostType,
				);
			}
			if (subTab.settings && Array.isArray(subTab.settings)) {
				subTab.settings = subTab.settings.map(subSetting => {
					const translatedSubSetting = translateSettingsGroup(
						{ settings: [subSetting] },
						normalizedPostType,
					).settings[0];
					return processSettingPlaceholders(
						translatedSubSetting,
						normalizedPostType,
					);
				});
			}
			processedSubTabs[subTabKey] = subTab;
		});
		translated.subTabs = processedSubTabs;
	}

	return translated;
};

const renderIcon = iconName => {
	const icons = window.FotoGridsIcons || {};
	const iconSvg = icons[iconName];

	if (!iconSvg) {
		return iconName;
	}

	return h('span', {
		className: 'fotogrids-icon',
		dangerouslySetInnerHTML: { __html: iconSvg },
	});
};

window.FotoGridsCollectionSettings = window.FotoGridsCollectionSettings || {};

function CollectionSettings() {
	const postType = window.fotogridsSettings?.postType || 'gallery';
	const isDefaultsMode = window.fotogridsSettings?.isDefaultsMode || false;
	const normalizedPostType =
		postType === 'fotogrids_gallery'
			? 'gallery'
			: postType === 'fotogrids_album'
				? 'album'
				: postType;

	const uiState = window.FotoGridsUiState?.createNamespace({
		area: 'collection-settings',
		postId: window.fotogridsSettings?.postId || 0,
	});

	const [activeTab, setActiveTab] = useState(() => {
		if (!uiState) return 'layout';
		return uiState.getValue({
			key: 'main-tab',
			fallback: 'layout',
			urlParam: 'fg-settings-tab',
		});
	});
	const [activeSubTabs, setActiveSubTabs] = useState(() => {
		if (!uiState) return {};
		return uiState.getValue({ key: 'subtabs', fallback: {} });
	});
	const [settings, setSettings] = useState(
		window.fotogridsSettings?.settings || {},
	);
	const [saving, setSaving] = useState(false);
	const [activeDevice, setActiveDevice] = useState('desktop');
	const [settingsLoaded, setSettingsLoaded] = useState(false);
	const [validationErrors, setValidationErrors] = useState({});
	const [fieldStates, setFieldStates] = useState(
		window.fotogridsCatalog?.field_states || {},
	);
	const [fieldStatesByOption, setFieldStatesByOption] = useState(
		window.fotogridsCatalog?.field_states_by_option || {},
	);

	const [itemData, setItemData] = useState({});
	const [loadingItems, setLoadingItems] = useState(false);
	const [itemError, setItemError] = useState(null);
	const [savingItems, setSavingItems] = useState({});
	const [showBulkModal, setShowBulkModal] = useState(false);
	const [bulkAction, setBulkAction] = useState('');
	const [bulkUrl, setBulkUrl] = useState('');
	const [bulkTarget, setBulkTarget] = useState('global');
	const [autosaveValue, setAutosaveValue] = useState(
		window.fotogridsAdmin?.autosave || false,
	);
	// The wizard's step 3 writes the same fotogrids_settings_mode option this
	// Segmented control mirrors, so users can flip modes without reopening it.
	const [settingsMode, setSettingsMode] = useState(
		window.fotogridsAdmin?.settingsMode === 'advanced'
			? 'advanced'
			: 'easy',
	);
	const State = window.FotoGridsCollectionState;

	const isProActive = window.fotogridsSettings?.isProActive || false;
	const galleryItems = window.fotogridsSettings?.galleryItems || [];
	const canEditPosts = window.fotogridsSettings?.canEditPosts !== false;

	const getActiveSubTab = (contextKey, defaultSubTabId) => {
		return activeSubTabs[contextKey] !== undefined
			? activeSubTabs[contextKey]
			: defaultSubTabId;
	};

	const setActiveSubTabForContext = (contextKey, subTabId) => {
		setActiveSubTabs(prev => {
			const updated = { ...prev, [contextKey]: subTabId };
			if (uiState) {
				uiState.setValue({ key: 'subtabs', value: updated });
			}
			return updated;
		});
	};

	// rootRef:       scroll target so tab change lands at the metabox top, not
	//                above the WP title bar.
	// isFirstRender: skip the initial scroll on mount/deep-link, otherwise every
	//                page load would yank the user to the metabox.
	// switchTab:     exposed on window.FotoGridsCollectionSettings.switchTab for
	//                non-React callers and the option.on_change.switch_tab hook.
	const rootRef = useRef(null);
	const isFirstRender = useRef(true);

	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		if (
			rootRef.current &&
			typeof rootRef.current.scrollIntoView === 'function'
		) {
			rootRef.current.scrollIntoView({
				block: 'start',
				behavior: 'smooth',
			});
		}
	}, [activeTab]);

	const switchTab = useCallback(
		tabId => {
			if (typeof tabId !== 'string' || tabId === '') return;
			if (!SETTINGS_GROUPS[tabId]) return;
			setActiveTab(tabId);
			if (uiState) {
				uiState.setValue({
					key: 'main-tab',
					value: tabId,
					urlParam: 'fg-settings-tab',
				});
			}
		},
		[uiState],
	);

	useEffect(() => {
		window.FotoGridsCollectionSettings =
			window.FotoGridsCollectionSettings || {};
		window.FotoGridsCollectionSettings.switchTab = switchTab;
		return () => {
			if (
				window.FotoGridsCollectionSettings &&
				window.FotoGridsCollectionSettings.switchTab === switchTab
			) {
				delete window.FotoGridsCollectionSettings.switchTab;
			}
		};
	}, [switchTab]);

	const loadAndTranslateSettings = async () => {
		if (window.FotoGridsSettings?.loadSettingsGroups) {
			const postType = window.fotogridsSettings?.postType || 'gallery';
			const rawSettings =
				await window.FotoGridsSettings.loadSettingsGroups(
					postType,
					isDefaultsMode,
				);
			SETTINGS_GROUPS = {};

			Object.keys(rawSettings).forEach(key => {
				SETTINGS_GROUPS[key] = translateSettingsGroup(
					rawSettings[key],
					normalizedPostType,
				);
			});
		} else {
			console.warn(
				'FotoGrids: Settings loader not available, SETTINGS_GROUPS will be empty',
			);
		}
		setSettingsLoaded(true);
	};

	useEffect(() => {
		loadAndTranslateSettings();
	}, []);

	// Bind fg-tooltip to any [data-fg-tooltip] element rendered by this
	// component (docs strip "Defaults" link, etc). fg-tooltip auto-inits on
	// DOMContentLoaded but the React tree mounts later, so we re-run init
	// after render. init() skips already-bound nodes so it's safe to spam.
	useEffect(() => {
		if (window.FgTooltip?.init) {
			window.FgTooltip.init();
		}
	});

	useEffect(() => {
		const fetchFieldStates = async () => {
			try {
				let endpoint = '';
				const restBase =
					window.fotogridsSettings?.restUrl ||
					window.wpApiSettings?.root ||
					'';

				if (!restBase) {
					return;
				}

				if (restBase.includes('/fotogrids/v1/')) {
					endpoint = `${restBase.replace(/\/$/, '')}/admin/catalog/field-states`;
				} else {
					endpoint = `${restBase.replace(/\/$/, '')}/fotogrids/v1/admin/catalog/field-states`;
				}

				const simulateState =
					window.fotogridsSettings?.catalogSimulateState || '';
				if (simulateState) {
					endpoint += `${endpoint.includes('?') ? '&' : '?'}simulate_state=${encodeURIComponent(simulateState)}`;
				}

				const response = await fetch(endpoint, {
					headers: {
						'X-WP-Nonce': window.wpApiSettings?.nonce || '',
					},
				});

				if (!response.ok) {
					return;
				}

				const payload = await response.json();
				const resolvedFieldStates = payload?.field_states || {};
				const resolvedOptionStates =
					payload?.field_states_by_option || {};

				setFieldStates(resolvedFieldStates);
				setFieldStatesByOption(resolvedOptionStates);

				window.fotogridsCatalog = window.fotogridsCatalog || {};
				window.fotogridsCatalog.field_states = resolvedFieldStates;
				window.fotogridsCatalog.field_states_by_option =
					resolvedOptionStates;
			} catch (error) {
				console.warn(
					'FotoGrids: failed to refresh catalog field states.',
					error,
				);
			}
		};

		fetchFieldStates();
		const refreshHandler = () => fetchFieldStates();
		window.addEventListener('fotogrids:license_changed', refreshHandler);

		return () =>
			window.removeEventListener(
				'fotogrids:license_changed',
				refreshHandler,
			);
	}, []);

	useEffect(() => {
		if (!settingsLoaded) return;

		setActiveSubTabs(prev => {
			const updated = { ...prev };
			let hasChanges = false;

			Object.values(SETTINGS_GROUPS).forEach(group => {
				if (group.subTabs && Object.keys(group.subTabs).length > 0) {
					const firstSubTabId = Object.keys(group.subTabs)[0];

					if (
						updated[group.id] === undefined ||
						updated[group.id] === null ||
						updated[group.id] === ''
					) {
						updated[group.id] = firstSubTabId;
						hasChanges = true;
					}
				}
			});

			Object.values(SETTINGS_GROUPS).forEach(group => {
				if (group.settings) {
					group.settings.forEach(setting => {
						if (
							setting.type === 'setting_subtabs' &&
							setting.subTabs &&
							Object.keys(setting.subTabs).length > 0
						) {
							const firstSubTabId = Object.keys(
								setting.subTabs,
							)[0];

							if (
								updated[setting.key] === undefined ||
								updated[setting.key] === null ||
								updated[setting.key] === ''
							) {
								updated[setting.key] = firstSubTabId;
								hasChanges = true;
							}
						}
					});
				}
			});

			return hasChanges ? updated : prev;
		});
	}, [settingsLoaded, activeTab]);

	useLayoutEffect(() => {
		if (!settingsLoaded) return;

		setActiveSubTabs(prev => {
			const updated = { ...prev };
			let hasChanges = false;

			const activeGroup = SETTINGS_GROUPS[activeTab];
			if (activeGroup) {
				if (
					activeGroup.subTabs &&
					Object.keys(activeGroup.subTabs).length > 0
				) {
					const firstSubTabId = Object.keys(activeGroup.subTabs)[0];
					if (
						updated[activeGroup.id] === undefined ||
						updated[activeGroup.id] === null ||
						updated[activeGroup.id] === ''
					) {
						updated[activeGroup.id] = firstSubTabId;
						hasChanges = true;
					}
				}

				if (activeGroup.settings) {
					activeGroup.settings.forEach(setting => {
						if (
							setting.type === 'setting_subtabs' &&
							setting.subTabs &&
							Object.keys(setting.subTabs).length > 0
						) {
							const firstSubTabId = Object.keys(
								setting.subTabs,
							)[0];
							if (
								updated[setting.key] === undefined ||
								updated[setting.key] === null ||
								updated[setting.key] === ''
							) {
								updated[setting.key] = firstSubTabId;
								hasChanges = true;
							}
						}
					});
				}
			}

			return hasChanges ? updated : prev;
		});
	}, [settingsLoaded, activeTab]);

	useEffect(() => {
		if (
			!isDefaultsMode &&
			settings.item_click_behavior === 'external' &&
			canEditPosts &&
			galleryItems.length > 0
		) {
			loadItemData();
		}
	}, [
		settings.item_click_behavior,
		galleryItems.length,
		canEditPosts,
		isDefaultsMode,
	]);

	useEffect(() => {
		const currentValue = window.fotogridsAdmin?.autosave || false;
		setAutosaveValue(currentValue);

		if (State) {
			State.autosave.set(currentValue);
		}

		const handleAutosaveChange = e => {
			if (e.target.name === 'fotogrids_autosave') {
				const newValue = e.target.checked;
				setAutosaveValue(newValue);
				if (State) {
					State.autosave.set(newValue);
				}
			}
		};

		const autosaveInput = document.querySelector(
			'input[name="fotogrids_autosave"]',
		);
		if (autosaveInput) {
			autosaveInput.addEventListener('change', handleAutosaveChange);
			return () => {
				autosaveInput.removeEventListener(
					'change',
					handleAutosaveChange,
				);
			};
		}
	}, []);

	const loadItemData = async () => {
		try {
			setLoadingItems(true);
			setItemError(null);

			const formData = new FormData();
			formData.append('action', 'fotogrids_get_item_urls');
			formData.append('nonce', window.fotogridsSettings?.nonce || '');
			galleryItems.forEach(id => formData.append('item_ids[]', id));

			const response = await fetch(
				window.fotogridsSettings?.ajaxUrl || window.ajaxurl,
				{
					method: 'POST',
					body: formData,
				},
			);

			const result = await response.json();

			if (result.success) {
				setItemData(result.data);
			} else {
				throw new Error(
					result.data || __('Failed to load item data', 'fotogrids'),
				);
			}
		} catch (err) {
			setItemError(err.message);
		} finally {
			setLoadingItems(false);
		}
	};

	const updateItemUrl = async (itemId, url, target = null) => {
		try {
			setSavingItems(prev => ({ ...prev, [itemId]: true }));

			const formData = new FormData();
			formData.append('action', 'fotogrids_update_item_url');
			formData.append('nonce', window.fotogridsSettings?.nonce || '');
			formData.append('item_id', itemId);
			formData.append('url', url);
			if (target !== null) {
				formData.append('target', target);
			}

			const response = await fetch(
				window.fotogridsSettings?.ajaxUrl || window.ajaxurl,
				{
					method: 'POST',
					body: formData,
				},
			);

			const result = await response.json();

			if (result.success) {
				setItemData(prev => ({
					...prev,
					[itemId]: {
						...prev[itemId],
						url: url,
						target:
							target !== null
								? target
								: prev[itemId]?.target || 'global',
					},
				}));
			} else {
				throw new Error(
					result.data || __('Failed to save URL', 'fotogrids'),
				);
			}
		} catch (err) {
			console.error('FotoGrids: Error updating item URL:', err);
		} finally {
			setSavingItems(prev => ({ ...prev, [itemId]: false }));
		}
	};

	const bulkItemAction = async (action, url = '', target = 'global') => {
		try {
			setLoadingItems(true);

			const formData = new FormData();
			formData.append('action', 'fotogrids_bulk_update_item_urls');
			formData.append('nonce', window.fotogridsSettings?.nonce || '');
			formData.append('bulk_action', action);
			galleryItems.forEach(id => formData.append('item_ids[]', id));
			formData.append('url', url);
			formData.append('target', target);

			const response = await fetch(
				window.fotogridsSettings?.ajaxUrl || window.ajaxurl,
				{
					method: 'POST',
					body: formData,
				},
			);

			const result = await response.json();

			if (result.success) {
				await loadItemData();
			} else {
				throw new Error(
					result.data || __('Bulk action failed', 'fotogrids'),
				);
			}
		} catch (err) {
			setItemError(err.message);
		}
	};

	const validateUrl = url => {
		if (!url.trim()) return { valid: true, message: '' };

		try {
			const urlObj = new URL(url);
			const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

			if (!allowedProtocols.includes(urlObj.protocol)) {
				return {
					valid: false,
					message: __(
						'Invalid protocol. Use http, https, mailto, or tel.',
						'fotogrids',
					),
				};
			}

			return { valid: true, message: __('Valid URL', 'fotogrids') };
		} catch {
			return {
				valid: false,
				message: __('Invalid URL format', 'fotogrids'),
			};
		}
	};

	const openBulkModal = action => {
		setBulkAction(action);
		setBulkUrl('');
		setBulkTarget('global');
		setShowBulkModal(true);
	};

	const closeBulkModal = () => {
		setShowBulkModal(false);
		setBulkAction('');
		setBulkUrl('');
		setBulkTarget('global');
	};

	const executeBulkAction = async () => {
		if (bulkAction === 'apply_to_all') {
			const validation = validateUrl(bulkUrl);
			if (!validation.valid) {
				return;
			}
			await bulkItemAction('apply_to_all', bulkUrl, bulkTarget);
		} else if (bulkAction === 'clear_all') {
			await bulkItemAction('clear_all');
		}

		closeBulkModal();
	};

	const updateSetting = (key, value) => {
		setSettings(prev => ({
			...prev,
			[key]: value,
		}));

		saveSetting(key, value);

		// Declarative tab switch: when the selected option declares
		//   "on_change": { "switch_tab": "<tab-id>" }
		// jump to that tab. Lets JSON wire flows like "picking Open in
		// Lightbox should jump to the Lightbox tab" without renderer changes.
		// The scroll-on-tab-change effect above handles the scroll for free.
		try {
			const settingDef = findSettingByKey(key);
			const selectedOption = Array.isArray(settingDef?.options)
				? settingDef.options.find(o => o && o.value === value)
				: null;
			const targetTab = selectedOption?.on_change?.switch_tab;
			if (typeof targetTab === 'string' && targetTab !== '') {
				switchTab(targetTab);
			}
		} catch (_e) {
			// findSettingByKey is best-effort; never block a save on this.
		}
	};

	// Updates React state only - does not persist to the form or trigger autosave.
	// Use for UI-only state that lives inside a value object (e.g. _linked flag).
	const updateSettingStateOnly = (key, value) => {
		setSettings(prev => ({
			...prev,
			[key]: value,
		}));
	};

	const saveSetting = async (key, value) => {
		setSaving(true);

		try {
			if (isDefaultsMode) {
				// In defaults mode, save to form inputs for WordPress Settings API
				const form = document.querySelector(
					'form[action="options.php"]',
				);
				if (!form) {
					console.warn('FotoGrids: Settings form not found');
					return;
				}

				let input = form.querySelector(
					`input[name="fotogrids_gallery_defaults[${key}]"]`,
				);

				if (!input) {
					input = document.createElement('input');
					input.type = 'hidden';
					input.name = `fotogrids_gallery_defaults[${key}]`;
					form.appendChild(input);
				}

				if (typeof value === 'object' && value !== null) {
					input.value = JSON.stringify(value);
				} else {
					input.value = value;
				}

				const customEvent = new CustomEvent(
					'fotogrids:setting_changed',
					{
						bubbles: true,
						detail: { key, value, input },
					},
				);
				input.dispatchEvent(customEvent);
			} else {
				// In gallery mode, save to post meta inputs
				let input = document.querySelector(
					`input[name="fotogrids_${key}"]`,
				);

				if (!input) {
					const postForm = document.getElementById('post');
					if (!postForm) {
						console.warn('FotoGrids: Post form not found');
						return;
					}
					input = document.createElement('input');
					input.type = 'hidden';
					input.name = `fotogrids_${key}`;
					postForm.appendChild(input);
				}

				if (typeof value === 'object' && value !== null) {
					input.value = JSON.stringify(value);
				} else {
					input.value = value;
				}

				const customEvent = new CustomEvent(
					'fotogrids:setting_changed',
					{
						bubbles: true,
						detail: { key, value, input },
					},
				);
				input.dispatchEvent(customEvent);

				if (
					window.FotoGridsAjaxSave &&
					typeof window.FotoGridsAjaxSave.showUnsavedChanges ===
						'function'
				) {
					window.FotoGridsAjaxSave.showUnsavedChanges();
				}
			}
		} catch (error) {
			console.error('FotoGrids: Error saving setting:', error);
		} finally {
			setSaving(false);
		}
	};

	/**
	 * Decide whether to render a single setting field.
	 *
	 * Supports three visibility mechanisms:
	 *
	 *  1. `setting.postTypes` - array of post types this setting is valid for.
	 *  2. `setting.depends_on` (+ optional `setting.depends_on_value`) -
	 *     snake_case predicate used by Pro and the new placement schema. When
	 *     `depends_on_value` is omitted, the parent value is checked for
	 *     truthiness. When given, equality is required.
	 *  3. `setting.condition.dependsOn` + `values` - legacy camelCase predicate
	 *     used by Free's existing JSON files. `values` is either a single value
	 *     or an array of accepted values; `dependsOn` may be a single key or an
	 *     array of keys (all must match).
	 *
	 * @param {Object} setting
	 * @returns {boolean}
	 */
	const shouldDisplaySetting = setting => {
		// Filter by postType if specified
		if (setting.postTypes && Array.isArray(setting.postTypes)) {
			if (!setting.postTypes.includes(normalizedPostType)) {
				return false;
			}
		}

		// condition_global: predicate resolved against a global settings
		// store (sharing, seo or watermark) rather than sibling fields. Same
		// shape as condition (dependsOn + values); dependsOn may be a dotted
		// key (e.g. "networks.facebook"). The optional `source` field selects
		// which global store to read - defaults to 'sharing' for back-compat.
		// Absent condition_global always passes.
		if (setting.condition_global) {
			const GLOBAL_SOURCES = {
				sharing: 'globalSharing',
				seo: 'globalSeo',
				watermark: 'globalWatermark',
			};
			const source =
				GLOBAL_SOURCES[setting.condition_global.source] ||
				'globalSharing';
			const globalState = window.fotogridsSettings?.[source] || {};
			const { dependsOn, values } = setting.condition_global;

			const readGlobal = path =>
				String(path)
					.split('.')
					.reduce(
						(acc, part) =>
							acc && typeof acc === 'object'
								? acc[part]
								: undefined,
						globalState,
					);

			const matches = (actual, expected) => {
				const list = Array.isArray(expected) ? expected : [expected];
				return list.some(
					v =>
						v === actual ||
						(v === true &&
							(actual === true ||
								actual === '1' ||
								actual === 1)) ||
						(v === false &&
							(actual === false ||
								actual === '0' ||
								actual === 0 ||
								actual === undefined)),
				);
			};

			if (Array.isArray(dependsOn)) {
				const ok = dependsOn.every((dep, i) =>
					matches(readGlobal(dep), values[i]),
				);
				if (!ok) return false;
			} else if (dependsOn) {
				if (!matches(readGlobal(dependsOn), values)) return false;
			}
		}

		// depends_on / depends_on_value (snake_case, new placement schema)
		if (
			typeof setting.depends_on === 'string' &&
			setting.depends_on !== ''
		) {
			const parentKey = setting.depends_on;
			const parentValue = settings[parentKey];

			const parentSetting = findSettingByKey(parentKey);
			if (parentSetting && !shouldDisplaySetting(parentSetting)) {
				return false;
			}

			if (
				Object.prototype.hasOwnProperty.call(
					setting,
					'depends_on_value',
				)
			) {
				return parentValue === setting.depends_on_value;
			}

			return Boolean(parentValue);
		}

		// condition.dependsOn / values (legacy camelCase predicate)
		if (!setting.condition) return true;

		// any / all composite predicates. Allow nesting so we can express OR/AND
		// trees on top of the leaf dependsOn predicate. Each child is itself a
		// condition node (any | all | dependsOn+values).
		const evaluateCondition = condition => {
			if (!condition || typeof condition !== 'object') return true;
			if (Array.isArray(condition.any)) {
				return condition.any.some(child => evaluateCondition(child));
			}
			if (Array.isArray(condition.all)) {
				return condition.all.every(child => evaluateCondition(child));
			}
			// Leaf predicate: reuse shouldDisplaySetting via a synthetic setting.
			return shouldDisplaySetting({ condition });
		};

		if (
			Array.isArray(setting.condition.any) ||
			Array.isArray(setting.condition.all)
		) {
			return evaluateCondition(setting.condition);
		}

		const { dependsOn, values } = setting.condition;

		if (Array.isArray(dependsOn)) {
			const operators = setting.condition?.condition_operators || [];
			return dependsOn.every((dep, index) => {
				const currentValue = settings[dep];
				const expectedValues = values[index];
				const op = operators[index] || null;

				const dependentSetting = findSettingByKey(dep);
				if (
					dependentSetting &&
					!shouldDisplaySetting(dependentSetting)
				) {
					return false;
				}

				// array_not_empty: passes when the stored JSON array has at least one element.
				if (op === 'array_not_empty') {
					let storedArray = currentValue;
					if (typeof storedArray === 'string') {
						try {
							storedArray = JSON.parse(storedArray);
						} catch {
							storedArray = [];
						}
					}
					return Array.isArray(storedArray) && storedArray.length > 0;
				}

				// array_includes: passes when the stored JSON array contains any of the expected values.
				if (op === 'array_includes') {
					let storedArray = currentValue;
					if (typeof storedArray === 'string') {
						try {
							storedArray = JSON.parse(storedArray);
						} catch {
							storedArray = [];
						}
					}
					if (!Array.isArray(storedArray)) return false;
					return Array.isArray(expectedValues)
						? expectedValues.some(v => storedArray.includes(v))
						: storedArray.includes(expectedValues);
				}

				// not_in: passes when the dependent value is NOT in the expected list.
				if (op === 'not_in') {
					return Array.isArray(expectedValues)
						? !expectedValues.includes(currentValue)
						: expectedValues !== currentValue;
				}

				// numeric_gt: passes when the dependent value (number) is strictly greater than the expected number.
				if (op === 'numeric_gt') {
					const num = Number(currentValue);
					const threshold = Number(
						Array.isArray(expectedValues)
							? expectedValues[0]
							: expectedValues,
					);
					return (
						!Number.isNaN(num) &&
						!Number.isNaN(threshold) &&
						num > threshold
					);
				}

				return Array.isArray(expectedValues)
					? expectedValues.includes(currentValue)
					: expectedValues === currentValue;
			});
		} else {
			const dependentValue = settings[dependsOn];
			const conditionOperator =
				setting.condition?.condition_operator || null;

			const dependentSetting = findSettingByKey(dependsOn);
			if (dependentSetting && !shouldDisplaySetting(dependentSetting)) {
				return false;
			}

			// array_includes: the stored value is a JSON array; check that it
			// contains at least one of the listed values. Used by token_select
			// fields where multiple options can be active simultaneously.
			if (conditionOperator === 'array_includes') {
				let storedArray = dependentValue;
				if (typeof storedArray === 'string') {
					try {
						storedArray = JSON.parse(storedArray);
					} catch {
						storedArray = [];
					}
				}
				if (!Array.isArray(storedArray)) return false;
				return Array.isArray(values)
					? values.some(v => storedArray.includes(v))
					: storedArray.includes(values);
			}

			// not_in: passes when the dependent value is NOT in the listed values.
			// Useful for hiding settings on a specific layout (or any other discrete
			// value) without enumerating every other layout explicitly.
			if (conditionOperator === 'not_in') {
				return Array.isArray(values)
					? !values.includes(dependentValue)
					: values !== dependentValue;
			}

			// numeric_gt: passes when the dependent value (number) is strictly
			// greater than the expected number. Lets a setting depend on another
			// setting's magnitude (e.g. show only when max_rotation > 0).
			if (conditionOperator === 'numeric_gt') {
				const num = Number(dependentValue);
				const threshold = Number(
					Array.isArray(values) ? values[0] : values,
				);
				return (
					!Number.isNaN(num) &&
					!Number.isNaN(threshold) &&
					num > threshold
				);
			}

			if (
				(dependentValue === undefined || dependentValue === null) &&
				Array.isArray(values)
			) {
				if (
					values.includes(false) ||
					values.includes('0') ||
					values.includes(0)
				) {
					return true;
				}
			}

			return Array.isArray(values)
				? values.includes(dependentValue)
				: values === dependentValue;
		}
	};

	/**
	 * Evaluate a group-level `visible_when` predicate produced by the
	 * Catalog Assembler. Lives on tabs, subtabs, and sections that were inserted
	 * conditionally (e.g. the Carousel subtab that only shows when
	 * `layout === 'carousel'`).
	 *
	 * Predicate shape:
	 *   { "setting": "<key>", "equals": <value> }
	 *   { "setting": "<key>", "in": [<value>, ...] }
	 *   { "setting": "<key>", "truthy": true }   // any truthy value
	 *
	 * Sections without a `visible_when` are always shown.
	 *
	 * @param {Object|undefined} predicate
	 * @returns {boolean}
	 */
	const evaluateVisibleWhen = predicate => {
		if (!predicate || typeof predicate !== 'object') return true;

		const watchedKey = predicate.setting;
		if (typeof watchedKey !== 'string' || watchedKey === '') return true;

		const watchedValue = settings[watchedKey];

		if (Object.prototype.hasOwnProperty.call(predicate, 'equals')) {
			return watchedValue === predicate.equals;
		}

		if (Array.isArray(predicate.in)) {
			return predicate.in.includes(watchedValue);
		}

		if (predicate.truthy === true) {
			return Boolean(watchedValue);
		}

		return true;
	};

	/**
	 * Decide whether a top-level tab is visible.
	 *
	 *  - `group.hidden` (set by a `hide` placement) wins immediately.
	 *  - `group.visible_when` (from a placement) is evaluated against settings.
	 *  - Legacy `group.condition.dependsOn` + `values` is still honored.
	 */
	const shouldDisplayTab = group => {
		if (group?.hidden) return false;

		if (group?.visible_when && !evaluateVisibleWhen(group.visible_when)) {
			return false;
		}

		// condition_global on a tab: hide the whole tab when a global
		// settings predicate matches. Used by the SEO tab to disappear when
		// the site owner has chosen to defer to a third-party SEO plugin.
		// Same shape as the setting-level predicate (source, dependsOn,
		// values). source defaults to 'sharing' for back-compat.
		if (group?.condition_global) {
			const source =
				group.condition_global.source === 'seo'
					? 'globalSeo'
					: 'globalSharing';
			const globalState = window.fotogridsSettings?.[source] || {};
			const { dependsOn, values } = group.condition_global;
			const readGlobal = path =>
				String(path)
					.split('.')
					.reduce(
						(acc, part) =>
							acc && typeof acc === 'object'
								? acc[part]
								: undefined,
						globalState,
					);
			const matches = (actual, expected) => {
				const list = Array.isArray(expected) ? expected : [expected];
				return list.some(
					v =>
						v === actual ||
						(v === true &&
							(actual === true ||
								actual === '1' ||
								actual === 1)) ||
						(v === false &&
							(actual === false ||
								actual === '0' ||
								actual === 0 ||
								actual === undefined)),
				);
			};
			if (typeof dependsOn === 'string' && dependsOn !== '') {
				if (!matches(readGlobal(dependsOn), values)) return false;
			}
		}

		if (!group.condition) return true;

		// Delegate to shouldDisplaySetting so tabs honour the full predicate
		// surface (any / all trees, condition_operator including not_in /
		// numeric_gt / array_includes / array_not_empty).
		return shouldDisplaySetting({ condition: group.condition });
	};

	const findSettingByKey = key => {
		for (const groupId in SETTINGS_GROUPS) {
			const group = SETTINGS_GROUPS[groupId];

			if (group.settings) {
				for (const setting of group.settings) {
					if (setting.key === key) return setting;

					if (setting.subTabs) {
						for (const subTabId in setting.subTabs) {
							const subTab = setting.subTabs[subTabId];
							const subSetting = subTab.settings.find(
								s => s.key === key,
							);
							if (subSetting) return subSetting;
						}
					}
				}
			}

			if (group.subTabs) {
				for (const subTabId in group.subTabs) {
					const subTab = group.subTabs[subTabId];
					const setting = subTab.settings.find(s => s.key === key);
					if (setting) return setting;
				}
			}
		}
		return null;
	};

	const renderSetting = setting => {
		// Drop hidden nodes (set by a `hide` placement) and sections whose
		// group-level `visible_when` predicate evaluates false.
		if (setting?.hidden) {
			return null;
		}

		if (
			setting?.visible_when &&
			!evaluateVisibleWhen(setting.visible_when)
		) {
			return null;
		}

		if (!shouldDisplaySetting(setting)) {
			return null;
		}

		let currentValue = settings[setting.key];
		const fieldState = resolveFieldStateValue(
			setting,
			currentValue,
			fieldStates,
			fieldStatesByOption,
		);
		const isDisabledByGate = fieldState !== FIELD_STATE.EDITABLE;

		// disabled_unless: a sibling toggle key that must be truthy for this
		// field to be editable. Used by the per-collection override pattern -
		// override fields stay visible but disabled until the override toggle
		// is turned on.
		let isDisabledByUnless = false;
		if (
			typeof setting.disabled_unless === 'string' &&
			setting.disabled_unless !== ''
		) {
			const gateValue = settings[setting.disabled_unless];
			isDisabledByUnless = !(
				gateValue === true ||
				gateValue === '1' ||
				gateValue === 1 ||
				gateValue === 'true'
			);
		}

		// inherit_from: while a field is disabled by disabled_unless (inheriting,
		// not overriding), display the global value it inherits instead of the
		// collection's own stored value, so the preview reflects what visitors
		// will actually see. dependsOn may be a dotted key (e.g. networks).
		if (
			isDisabledByUnless &&
			typeof setting.inherit_from === 'string' &&
			setting.inherit_from !== ''
		) {
			const globalState = window.fotogridsSettings?.globalSharing || {};
			let inherited = String(setting.inherit_from)
				.split('.')
				.reduce(
					(acc, part) =>
						acc && typeof acc === 'object' ? acc[part] : undefined,
					globalState,
				);
			// token_select expects an array of active values; the global networks
			// map is an object keyed by network. Convert truthy keys to an array.
			if (
				setting.type === 'token_select' &&
				inherited &&
				!Array.isArray(inherited) &&
				typeof inherited === 'object'
			) {
				inherited = Object.keys(inherited).filter(
					k =>
						inherited[k] === true ||
						inherited[k] === '1' ||
						inherited[k] === 1,
				);
			}
			if (inherited !== undefined) {
				currentValue = inherited;
			}
		}

		const isDisabled =
			isDisabledByGate ||
			isDisabledByUnless ||
			(!isFreeTier(setting) && !isProActive && setting.type !== 'promo');
		const getFieldState = (fieldKey, fieldValue = currentValue) => {
			const pseudoSetting = { key: fieldKey };
			return resolveFieldStateValue(
				pseudoSetting,
				fieldValue,
				fieldStates,
				fieldStatesByOption,
			);
		};

		const settingProps = {
			label: setting.label,
			value: currentValue,
			onChange: value => updateSetting(setting.key, value),
			disabled: isDisabled,
		};

		let control;

		switch (setting.type) {
			case 'select':
				// Filter out options with isGlobalDefault: true when in defaults mode
				const selectOptionsRaw = isDefaultsMode
					? (setting.options || []).filter(
							option => !option.isGlobalDefault,
						)
					: setting.options || [];
				const selectOptions = selectOptionsRaw.map(option => {
					const optionValue = option?.value;
					if (typeof optionValue !== 'string') {
						return option;
					}

					const optionState = resolveFieldStateValue(
						{ key: setting.key },
						optionValue,
						fieldStates,
						fieldStatesByOption,
					);

					if (optionState === FIELD_STATE.EDITABLE) {
						return option;
					}

					const badgeText =
						optionState === FIELD_STATE.LOCKED
							? __('(Locked)', 'fotogrids')
							: __('(Pro)', 'fotogrids');
					return {
						...option,
						label: `${option.label} ${badgeText}`,
						disabled: true,
					};
				});
				control = h(SelectControl, {
					...settingProps,
					options: selectOptions,
				});
				break;

			case 'text_input':
				control = window.FotoGridsRenderSettings?.renderTextInput(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						getFieldState,
						__,
					},
				);
				break;

			case 'font_family':
				control = window.FotoGridsRenderSettings?.renderFontFamily(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						getFieldState,
						renderIcon,
						__,
					},
				);
				break;

			case 'font_weight':
				control = window.FotoGridsRenderSettings?.renderFontWeight(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						getFieldState,
						renderIcon,
						__,
					},
				);
				break;

			case 'range':
				control = window.FotoGridsRenderSettings?.renderRange(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						getFieldState,
						__,
					},
				);
				break;

			case 'toggle':
				control = window.FotoGridsRenderSettings?.renderToggle(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						getFieldState,
						__,
					},
				);
				break;

			case 'responsive_range':
				control = window.FotoGridsRenderSettings?.renderResponsiveRange(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						updateSettingStateOnly,
						activeDevice,
						setActiveDevice,
						renderIcon,
						getFieldState,
						__,
					},
				);
				break;

			case 'layout_grid':
				control = window.FotoGridsRenderSettings?.renderLayoutGrid(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						renderIcon,
						getFieldState,
						getOptionState: getFieldState,
						__,
					},
				);
				break;

			case 'hover_effects_grid':
				control =
					window.FotoGridsRenderSettings?.renderHoverEffectsGrid(
						setting,
						currentValue,
						isDisabled,
						{
							updateSetting,
							renderIcon,
							getFieldState,
							getOptionState: getFieldState,
							__,
							settings,
						},
					);
				break;

			case 'button_group':
				control = window.FotoGridsRenderSettings?.renderButtonGroup(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						renderIcon,
						getFieldState,
						isDefaultsMode,
						getOptionState: getFieldState,
						isOptionVisible: option => shouldDisplaySetting(option),
						__,
					},
				);
				break;

			case 'token_select':
				control = window.FotoGridsRenderSettings?.renderTokenSelect(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						renderIcon,
						getFieldState,
						getOptionState: getFieldState,
						isDefaultsMode,
						// Per-option `condition` evaluation. The token_select renderer
						// uses this to hide dropdown options whose own `condition`
						// (relative to the current settings map) does not pass.
						isOptionVisible: option => shouldDisplaySetting(option),
						__,
					},
				);
				break;

			case 'alignment_grid':
				control = window.FotoGridsRenderSettings?.renderAlignmentGrid(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						renderIcon,
						getFieldState,
						isDefaultsMode,
						getOptionState: getFieldState,
						__,
					},
				);
				break;

			case 'button_group_dynamic':
				control =
					window.FotoGridsRenderSettings?.renderButtonGroupDynamic(
						setting,
						currentValue,
						isDisabled,
						{
							updateSetting,
							renderIcon,
							getFieldState,
							isDefaultsMode,
							getOptionState: getFieldState,
							__,
						},
					);
				break;

			case 'image_size':
				control = window.FotoGridsRenderSettings?.renderImageSize(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						renderIcon,
						getFieldState,
						isDefaultsMode,
						getOptionState: getFieldState,
						__,
					},
				);
				break;

			case 'color':
				control = window.FotoGridsRenderSettings?.renderColorPicker(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						getFieldState,
						__,
					},
				);
				break;

			case 'image_picker':
				control = window.FotoGridsRenderSettings?.renderImagePicker(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						getFieldState,
						__,
					},
				);
				break;

			case 'setting_subtabs':
				const settingContextKey = setting.key;
				const currentActiveSubTab = getActiveSubTab(
					settingContextKey,
					setting.subTabs ? Object.keys(setting.subTabs)[0] : null,
				);
				control = window.FotoGridsRenderSettings?.renderSettingSubTabs(
					setting,
					isDisabled,
					{
						activeSubTab: currentActiveSubTab,
						setActiveSubTab: subTabId =>
							setActiveSubTabForContext(
								settingContextKey,
								subTabId,
							),
						renderIcon,
						renderSetting,
						shouldDisplaySetting,
						__,
					},
				);
				break;

			case 'external_url_manager':
				if (isDefaultsMode) {
					return null;
				}
				control =
					window.FotoGridsRenderSettings?.renderExternalUrlManager(
						setting,
						isDisabled,
						{
							settings,
							canEditPosts,
							loadingItems,
							itemError,
							loadItemData,
							galleryItems,
							itemData,
							savingItems,
							openBulkModal,
							updateItemUrl,
							validateUrl,
							renderIcon,
							updateSetting,
							__,
						},
					);
				break;

			case 'setting_group':
				control = window.FotoGridsRenderSettings?.renderGroup(
					setting,
					currentValue,
					isDisabled,
					{
						renderSetting,
						getFieldState,
						__,
					},
				);
				break;

			case 'side_by_side':
				control = window.FotoGridsRenderSettings?.renderSideBySide(
					setting,
					currentValue,
					isDisabled,
					{
						renderSetting,
						__,
					},
				);
				break;

			case 'codearea':
				control = window.FotoGridsRenderSettings?.renderCodeArea(
					setting,
					currentValue,
					(value, errorInfo) => {
						updateSetting(setting.key, value);

						if (errorInfo && typeof errorInfo === 'object') {
							setValidationErrors(prev => {
								const newErrors = {
									...prev,
									[setting.key]: errorInfo,
								};

								window.FotoGridsValidationErrors = newErrors;

								return newErrors;
							});
						} else {
							setValidationErrors(prev => {
								const newErrors = { ...prev };
								delete newErrors[setting.key];

								window.FotoGridsValidationErrors = newErrors;

								return newErrors;
							});
						}
					},
					[],
					isDisabled,
					getFieldState,
					__,
				);
				break;

			case 'password_input':
				control = window.FotoGridsRenderSettings?.renderPasswordInput(
					setting,
					currentValue,
					isDisabled,
					{
						updateSetting,
						getFieldState,
						renderIcon,
						__,
						postId: window.fotogridsSettings?.postId || 0,
						restUrl:
							window.fotogridsSettings?.restUrl ||
							window.wpApiSettings?.root ||
							'',
						restNonce:
							window.fotogridsSettings?.restNonce ||
							window.wpApiSettings?.nonce ||
							'',
						passwordIsSet:
							!!window.fotogridsSettings?.passwordIsSet,
					},
				);
				break;

			case 'cache_status':
				control = window.FotoGridsRenderSettings?.renderCacheStatus(
					setting,
					currentValue,
					isDisabled,
					{
						__,
						postId: window.fotogridsSettings?.postId || 0,
						restUrl:
							window.fotogridsSettings?.restUrl ||
							window.wpApiSettings?.root ||
							'',
						restNonce:
							window.fotogridsSettings?.restNonce ||
							window.wpApiSettings?.nonce ||
							'',
					},
				);
				break;

			case 'watermark_status':
				control = window.FotoGridsRenderSettings?.renderWatermarkStatus(
					setting,
					currentValue,
					isDisabled,
					{
						__,
						postId: window.fotogridsSettings?.postId || 0,
						restUrl:
							window.fotogridsSettings?.restUrl ||
							window.wpApiSettings?.root ||
							'',
						restNonce:
							window.fotogridsSettings?.restNonce ||
							window.wpApiSettings?.nonce ||
							'',
					},
				);
				break;

			case 'promo':
				control = window.FotoGridsRenderSettings?.renderPromo(
					setting,
					currentValue,
					isDisabled,
					{
						__,
					},
				);
				break;

			case 'info_block':
				control = window.FotoGridsRenderSettings?.renderInfoBlock(
					setting,
					currentValue,
					isDisabled,
					{
						__,
					},
				);
				break;

			default:
				return null;
		}

		// A null control means the renderer chose to show nothing (e.g. a
		// status field with no pending state). Render no wrapper at all so an
		// empty .fotogrids-setting row is not left in the DOM.
		if (!control) {
			return null;
		}

		const gatedControl = h(
			FieldGate,
			{
				setting,
				currentValue,
				fieldStates,
				fieldStatesByOption,
				__,
			},
			control,
		);

		return h(
			'div',
			{
				key: setting.key,
				className: `fotogrids-setting ${isDisabled ? 'fotogrids-setting--disabled' : ''}`,
			},
			[
				gatedControl,
				window.FotoGridsRenderSettings?.renderConditionalMessage(
					setting,
					currentValue,
				),
			].filter(Boolean),
		);
	};

	const renderDocumentationStrip = () => {
		const defaultsUrl = window.fotogridsSettings?.defaultsUrl || '';
		const documentationUrl =
			window.fotogridsSettings?.documentationUrl || '';

		const helpTextTemplate = __(
			'Need help? Check out our <a>documentation</a>',
			'fotogrids',
		);
		const helpText = helpTextTemplate.replace(
			'<a>',
			`<a href="${documentationUrl}" target="_blank" class="fotogrids-settings-docs-strip__link">`,
		);

		// Save the new "Easy" / "Advanced" mode to the
		// fotogrids_settings_mode option via the shared AJAX endpoint
		// and mirror it into the localized globals so other components
		// that re-render later see the new value.
		const handleModeChange = nextMode => {
			if (nextMode !== 'easy' && nextMode !== 'advanced') return;
			if (nextMode === settingsMode) return;

			const previousMode = settingsMode;
			setSettingsMode(nextMode);

			const formData = new FormData();
			formData.append('action', 'fotogrids_update_plugin_setting');
			formData.append('nonce', window.fotogridsAdmin?.nonce || '');
			formData.append('setting', 'fotogrids_settings_mode');
			formData.append('value', nextMode);

			fetch(window.fotogridsAdmin?.ajaxUrl || window.ajaxurl, {
				method: 'POST',
				body: formData,
			})
				.then(response => {
					if (!response.ok) {
						throw new Error(
							`HTTP error! status: ${response.status}`,
						);
					}
					return response.json();
				})
				.then(data => {
					if (data.success) {
						if (window.fotogridsAdmin) {
							window.fotogridsAdmin.settingsMode = nextMode;
						}
					} else {
						setSettingsMode(previousMode);
						if (window.fotogridsToast) {
							window.fotogridsToast.error(
								data.data?.message ||
									__(
										'Failed to update setup mode',
										'fotogrids',
									),
							);
						}
					}
				})
				.catch(error => {
					setSettingsMode(previousMode);
					console.error(
						'FotoGrids: Error updating settings_mode:',
						error,
					);
					if (window.fotogridsToast) {
						window.fotogridsToast.error(
							__('Failed to update setup mode', 'fotogrids'),
						);
					}
				});
		};

		const handleAutosaveToggle = e => {
			e.preventDefault();
			const newValue = !autosaveValue;
			setAutosaveValue(newValue);

			const formData = new FormData();
			formData.append('action', 'fotogrids_update_plugin_setting');
			formData.append('nonce', window.fotogridsAdmin?.nonce || '');
			formData.append('setting', 'fotogrids_autosave');
			formData.append('value', newValue ? '1' : '0');

			fetch(window.fotogridsAdmin?.ajaxUrl || window.ajaxurl, {
				method: 'POST',
				body: formData,
			})
				.then(response => {
					if (!response.ok) {
						throw new Error(
							`HTTP error! status: ${response.status}`,
						);
					}
					return response.json();
				})
				.then(data => {
					if (data.success) {
						const savedValue =
							data.data?.value !== undefined
								? data.data.value
								: newValue;
						if (savedValue !== newValue) {
							setAutosaveValue(!newValue);
							const errorMessage = __(
								'Failed to save autosave setting - value mismatch',
								'fotogrids',
							);
							if (window.fotogridsToast) {
								window.fotogridsToast.error(errorMessage);
							}
							return;
						}
						if (window.fotogridsAdmin) {
							window.fotogridsAdmin.autosave = savedValue;
						}
						if (State) {
							State.autosave.set(savedValue);
						}
						setAutosaveValue(savedValue);
						if (window.fotogridsToast) {
							window.fotogridsToast.success(
								savedValue
									? __('Autosave enabled', 'fotogrids')
									: __('Autosave disabled', 'fotogrids'),
							);
						}
					} else {
						setAutosaveValue(!newValue);
						const errorMessage =
							data.data?.message ||
							__(
								'Failed to update autosave setting',
								'fotogrids',
							);
						if (window.fotogridsToast) {
							window.fotogridsToast.error(errorMessage);
						}
					}
				})
				.catch(error => {
					setAutosaveValue(!newValue);
					const errorMessage = __(
						'Failed to update autosave setting',
						'fotogrids',
					);
					console.error(
						'FotoGrids: Error updating autosave setting:',
						error,
					);
					if (window.fotogridsToast) {
						window.fotogridsToast.error(errorMessage);
					}
				});
		};

		return h(
			'div',
			{
				className: 'fotogrids-settings-docs-strip',
			},
			[
				h('div', {
					dangerouslySetInnerHTML: { __html: helpText },
					className: 'fotogrids-settings-docs-strip__help',
				}),
				h(
					'div',
					{
						className: 'fotogrids-settings-docs-strip__buttons',
					},
					[
						!isDefaultsMode &&
							h(
								'a',
								{
									href: defaultsUrl,
									className:
										'fotogrids-settings-docs-strip__link',
									target: '_blank',
									'aria-label':
										normalizedPostType === 'album'
											? __(
													'Configure Album defaults',
													'fotogrids',
												)
											: __(
													'Configure Gallery defaults',
													'fotogrids',
												),
									'data-fg-tooltip':
										normalizedPostType === 'album'
											? __(
													'Configure Album defaults',
													'fotogrids',
												)
											: __(
													'Configure Gallery defaults',
													'fotogrids',
												),
									'data-fg-tooltip-dir': 'below',
								},
								__('Defaults', 'fotogrids'),
							),
						// Per-button tooltips, bottom-anchored. The *selected*
						// option gets no tooltip (hovering it has nothing to
						// suggest); the unselected option gets the persuasive
						// copy describing what flipping the control will do.
						// No need to dynamically refresh the tooltip text on
						// mode change — the active button is unmounted by
						// React and the newly-inactive one is freshly bound on
						// the next FgTooltip.init() pass.
						h(
							'div',
							{
								className:
									'fotogrids-settings-docs-strip__mode',
							},
							[
								h(
									'div',
									{
										className:
											'fotogrids-segmented fotogrids-segmented--size-small fotogrids-segmented--variant-rounded',
										role: 'radiogroup',
										'aria-label': __(
											'Setup mode',
											'fotogrids',
										),
									},
									['easy', 'advanced'].map(m => {
										const isActive = settingsMode === m;
										const tooltip = isActive
											? null
											: m === 'advanced'
												? __(
														'Switch to Advanced for fine-grained controls',
														'fotogrids',
													)
												: __(
														'Switch to Easy to show only the essential controls',
														'fotogrids',
													);

										// The key embeds the active state so React
										// remounts the <button> when the mode flips.
										// FgTooltip's `bind()` captures both the label
										// text and the direction in a closure at bind
										// time, and there's no public `unbind()`.
										// Without a remount the previously-bound (now-
										// active) button keeps showing its old tooltip
										// — even after we strip the data-attributes,
										// because the listeners and the captured
										// closure still reference the original copy.
										// Forcing a remount drops the old listeners
										// along with the DOM node.
										const attrs = {
											key: `${m}-${isActive ? 'active' : 'inactive'}`,
											type: 'button',
											role: 'radio',
											'aria-checked': isActive,
											className:
												'fotogrids-segmented__option' +
												(isActive
													? ' fg-is-active'
													: ''),
											onClick: () => handleModeChange(m),
										};
										if (tooltip) {
											attrs['data-fg-tooltip'] = tooltip;
											attrs['data-fg-tooltip-dir'] =
												'below';
											attrs['aria-label'] = tooltip;
										}

										return h(
											'button',
											attrs,
											h(
												'span',
												{
													className:
														'fotogrids-segmented__label',
												},
												m === 'easy'
													? __('Easy', 'fotogrids')
													: __(
															'Advanced',
															'fotogrids',
														),
											),
										);
									}),
								),
							],
						),
						h(
							'div',
							{
								className:
									'fotogrids-settings-docs-strip__autosave',
							},
							[
								h(
									'span',
									{
										className:
											'fotogrids-settings-docs-strip__autosave-label',
									},
									__('Autosave', 'fotogrids'),
								),
								h(
									'button',
									{
										type: 'button',
										className: `fotogrids-toggle fotogrids-toggle--small fotogrids-toggle--green ${autosaveValue ? 'fgt-is-checked' : ''}`,
										onClick: handleAutosaveToggle,
										title: __(
											'Toggle autosave',
											'fotogrids',
										),
										'aria-checked': autosaveValue,
										role: 'switch',
									},
									[
										h('span', {
											className:
												'fotogrids-toggle__track',
										}),
										h('span', {
											className:
												'fotogrids-toggle__thumb',
										}),
									],
								),
							],
						),
					],
				),
			],
		);
	};

	const renderTabContent = groupId => {
		const group = SETTINGS_GROUPS[groupId];
		if (!group) return null;

		if (!shouldDisplayTab(group)) return null;

		if (!isFreeTier(group) && !isProActive) {
			const allSettings = group.settings || [];

			if (group.subTabs) {
				Object.values(group.subTabs).forEach(subTab => {
					allSettings.push(...subTab.settings);
				});
			}

			return h(
				'div',
				{
					className: 'fotogrids-settings-group',
				},
				[
					h(
						'div',
						{
							className: 'fotogrids-pro-tab--content',
						},
						[
							h(
								'div',
								{
									className: 'fotogrids-pro-tab--header',
								},
								[
									h(
										'span',
										{
											className:
												'fotogrids-pro-tab--header--icon',
										},
										renderIcon(group.icon),
									),
									h('h3', {}, group.label),
									h(
										'div',
										{
											className:
												'fotogrids-pro-badge fotogrids-pro-badge-large',
										},
										[
											h('div', {
												className:
													'fotogrids-fireworks',
											}),
											h(
												'span',
												{},
												__('Pro', 'fotogrids'),
											),
										],
									),
								],
							),
							h(
								'div',
								{
									className: 'fotogrids-pro-tab--features',
								},
								[
									h(
										'h4',
										{
											className:
												'fotogrids-pro-tab--description',
										},
										group.description ||
											__(
												'Unlock these powerful features:',
												'fotogrids',
											),
									),
									h(
										'ul',
										{},
										allSettings.map(setting =>
											h(
												'li',
												{
													key: setting.key,
													className:
														'fotogrids-pro-tab--feature',
												},
												[
													h(
														'span',
														{
															className:
																'fotogrids-pro-tab--feature--icon',
														},
														renderIcon(
															'check_circle',
														),
													),
													h(
														'div',
														{
															className:
																'fotogrids-pro-tab--feature--content',
														},
														[
															setting.title &&
																h(
																	'h5',
																	{
																		className:
																			'fotogrids-pro-tab--feature--title',
																	},
																	setting.title,
																),
															h(
																'p',
																{
																	className:
																		'fotogrids-pro-tab--feature--description',
																},
																setting.description ||
																	setting.label,
															),
														],
													),
												],
											),
										),
									),
								],
							),
							h(
								'div',
								{
									className: 'fotogrids-pro-tab--cta',
								},
								[
									h(
										'button',
										{
											type: 'button',
											className:
												'fg-button fg-button--variant-primary',
											onClick: () => {
												const upgradeUrl =
													window.fotogridsUpgradeModal
														?.urls?.upgrade;
												if (upgradeUrl) {
													window.open(
														upgradeUrl,
														'_blank',
													);
												}
											},
										},
										__('Upgrade to Pro', 'fotogrids'),
									),
									h(
										'button',
										{
											type: 'button',
											className:
												'fg-button fg-button--variant-secondary',
											onClick: () => {
												window.open(
													`https://go.fotogrids.com/feature-${group.id}`,
													'_blank',
												);
											},
										},
										__('Learn more', 'fotogrids'),
									),
								],
							),
						],
					),
				],
			);
		}

		if (group.subTabs) {
			const groupContextKey = group.id;

			// Subtabs may carry a placement-time `visible_when` predicate (e.g.
			// the Carousel subtab only appears when layout === 'carousel'). The
			// assembler tags the subtab; the runtime evaluates it here against
			// the live settings map so it disappears/reappears as the user
			// changes related fields.
			const availableSubTabs = Object.values(group.subTabs)
				.filter(subTab => !subTab?.hidden)
				.filter(subTab => evaluateVisibleWhen(subTab?.visible_when));

			if (availableSubTabs.length === 0) {
				return h(
					'div',
					{
						className: 'fotogrids-settings-group',
					},
					[
						h(
							'div',
							{
								className: 'fotogrids-settings-group__content',
							},
							(group.settings || [])
								.filter(s => !s?.hidden)
								.map(renderSetting),
						),
					],
				);
			}

			if (availableSubTabs.length === 1) {
				const singleSubTab = availableSubTabs[0];
				return h(
					'div',
					{
						className: 'fotogrids-settings-group',
					},
					[
						h(
							'div',
							{
								className: 'fotogrids-settings-group__content',
							},
							(singleSubTab.settings || [])
								.filter(s => !s?.hidden)
								.map(s =>
									renderSetting({
										...s,
										__chromeWhenContext: 'single_subtab',
									}),
								),
						),
					],
				);
			}

			// Prefer the previously-selected subtab if it's still visible;
			// otherwise fall back to the first available one.
			const previouslyActive = getActiveSubTab(groupContextKey, null);
			const previouslyActiveStillVisible = availableSubTabs.some(
				s => s.id === previouslyActive,
			);
			const currentActiveSubTab = previouslyActiveStillVisible
				? previouslyActive
				: availableSubTabs[0].id;

			return h(
				'div',
				{
					className:
						'fotogrids-settings-group fotogrids-settings-group--with-subtabs',
				},
				[
					h(
						'div',
						{
							className: 'fotogrids-subtabs-nav',
						},
						availableSubTabs.map(subTab =>
							h(
								'button',
								{
									key: subTab.id,
									type: 'button',
									className: `fotogrids-subtab ${currentActiveSubTab === subTab.id ? 'fg-is-active' : ''}`,
									onClick: e => {
										e.preventDefault();
										e.stopPropagation();
										setActiveSubTabForContext(
											groupContextKey,
											subTab.id,
										);
									},
								},
								[
									h(
										'span',
										{
											className: 'fotogrids-subtab__icon',
										},
										renderIcon(subTab.icon),
									),
									h(
										'span',
										{
											className:
												'fotogrids-subtab__label',
										},
										subTab.label,
									),
								],
							),
						),
					),

					h(
						'div',
						{
							className: 'fotogrids-subtab-content',
						},
						[
							h(
								'div',
								{
									className:
										'fotogrids-settings-group__content',
								},
								(
									group.subTabs[currentActiveSubTab]
										?.settings || []
								)
									.filter(s => !s?.hidden)
									.map(s =>
										renderSetting({
											...s,
											__chromeWhenContext: 'multi_subtab',
										}),
									) || [],
							),
						],
					),
				],
			);
		}

		const visibleSettings = (group.settings || [])
			.filter(s => !s?.hidden)
			.filter(s => evaluateVisibleWhen(s?.visible_when));

		return [
			renderDocumentationStrip(),
			h(
				'div',
				{
					className: 'fotogrids-settings-group',
				},
				[
					h(
						'div',
						{
							className: 'fotogrids-settings-group__content',
						},
						visibleSettings.map(renderSetting),
					),
				],
			),
		].filter(Boolean);
	};

	if (!settingsLoaded) {
		const _fgId = 'cs' + Math.random().toString(36).slice(2, 8);
		return h(
			'div',
			{
				className:
					'fotogrids-gallery-settings fotogrids-gallery-settings--loading',
			},
			[
				h('div', { className: 'fotogrids-loading-screen' }, [
					h('span', {
						className: 'fotogrids-loading-screen__icon',
						'aria-hidden': 'true',
						dangerouslySetInnerHTML: {
							__html:
								'<svg width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><rect x="0" y="0" width="0" height="6"><animate id="fg_ia_fotogrids_1___' +
								_fgId +
								'__" begin="0;fg_ia_fotogrids_10___' +
								_fgId +
								'__.end-0.3s" attributeName="width" dur="0.4s" values="0;24" fill="freeze"/><animate begin="fg_ia_fotogrids_6___' +
								_fgId +
								'__.end-0.2s" attributeName="width" dur="0.4s" values="24;0" fill="freeze"/><animate id="fg_ia_fotogrids_2___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_6___' +
								_fgId +
								'__.end-0.2s" attributeName="x" dur="0.4s" values="0;24"/></rect><rect x="0" y="9" width="0" height="6"><animate id="fg_ia_fotogrids_3___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_1___' +
								_fgId +
								'__.end-0.2s" attributeName="width" dur="0.4s" values="0;15" fill="freeze"/><animate begin="fg_ia_fotogrids_2___' +
								_fgId +
								'__.end-0.2s" attributeName="width" dur="0.4s" values="15;0" fill="freeze"/><animate id="fg_ia_fotogrids_7___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_2___' +
								_fgId +
								'__.end-0.2s" attributeName="x" dur="0.4s" values="0;15"/></rect><rect x="0" y="18" width="0" height="6"><animate id="fg_ia_fotogrids_4___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_3___' +
								_fgId +
								'__.end-0.2s" attributeName="width" dur="0.2s" values="0;6" fill="freeze"/><animate begin="fg_ia_fotogrids_7___' +
								_fgId +
								'__.end-0.1s" attributeName="width" dur="0.2s" values="6;0" fill="freeze"/><animate id="fg_ia_fotogrids_8___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_7___' +
								_fgId +
								'__.end-0.1s" attributeName="x" dur="0.2s" values="0;6"/></rect><rect x="9" y="18" width="6" height="0"><animate id="fg_ia_fotogrids_5___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_4___' +
								_fgId +
								'__.end+0.1s" attributeName="height" dur="0.2s" values="0;6" fill="freeze"/><animate begin="fg_ia_fotogrids_4___' +
								_fgId +
								'__.end+0.1s" attributeName="y" dur="0.2s" values="24;18" fill="freeze"/><animate id="fg_ia_fotogrids_9___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_8___' +
								_fgId +
								'__.end+0.1s" attributeName="height" dur="0.2s" values="6;0" fill="freeze"/><animate begin="fg_ia_fotogrids_9___' +
								_fgId +
								'__.end+0.1s" attributeName="y" dur="0" values="18;24"/></rect><rect x="18" y="9" width="6" height="0"><animate begin="fg_ia_fotogrids_5___' +
								_fgId +
								'__.end+0.1s" attributeName="height" dur="0.4s" values="0;15" fill="freeze"/><animate id="fg_ia_fotogrids_6___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_5___' +
								_fgId +
								'__.end+0.1s" attributeName="y" dur="0.4s" values="24;9" fill="freeze"/><animate id="fg_ia_fotogrids_10___' +
								_fgId +
								'__" begin="fg_ia_fotogrids_9___' +
								_fgId +
								'__.end-0.1s" attributeName="height" dur="0.4s" values="15;0" fill="freeze"/><animate begin="fg_ia_fotogrids_10___' +
								_fgId +
								'__.end" attributeName="y" dur="0" values="9;24"/></rect></svg>',
						},
					}),
					h(
						'span',
						{ className: 'fotogrids-loading-screen__label' },
						'Loading settings...',
					),
				]),
			],
		);
	}

	return h(
		'div',
		{
			className: 'fotogrids-gallery-settings',
			ref: rootRef,
		},
		[
			h(
				'div',
				{
					className: 'fotogrids-settings-sidebar',
					key: 'sidebar',
				},
				[
					h(
						'div',
						{
							className: 'fotogrids-settings-tabs',
						},
						Object.values(SETTINGS_GROUPS)
							.filter(group => shouldDisplayTab(group))
							.map(group =>
								h(
									'button',
									{
										key: group.id,
										type: 'button',
										className: `fotogrids-settings-tab ${activeTab === group.id ? 'fg-is-active' : ''} ${!isFreeTier(group) && !isProActive ? 'is-pro' : ''}`,
										onClick: e => {
											e.preventDefault();
											e.stopPropagation();
											setActiveTab(group.id);
											if (uiState) {
												uiState.setValue({
													key: 'main-tab',
													value: group.id,
													urlParam: 'fg-settings-tab',
												});
											}
										},
									},
									[
										h(
											'span',
											{
												className:
													'fotogrids-settings-tab__icon',
											},
											renderIcon(group.icon),
										),
										h(
											'span',
											{
												className:
													'fotogrids-settings-tab__label',
											},
											group.label,
										),
										!isFreeTier(group) &&
											!isProActive &&
											h(
												'span',
												{
													className:
														'fotogrids-pro-badge',
												},
												h(
													'svg',
													{
														className:
															'fg-pro-badge__lock-icon',
														xmlns: 'http://www.w3.org/2000/svg',
														viewBox: '0 0 16 16',
														width: '10',
														height: '10',
														'aria-hidden': 'true',
														focusable: 'false',
													},
													h('path', {
														fill: 'currentColor',
														d: 'M11 7V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1ZM6 5a2 2 0 1 1 4 0v2H6V5Z',
													}),
												),
											),
									],
								),
							),
					),
				],
			),

			h(
				'div',
				{
					className: 'fotogrids-settings-content',
					key: 'content',
				},
				(() => {
					const tabContent = renderTabContent(activeTab);
					return Array.isArray(tabContent)
						? tabContent
						: [tabContent];
				})(),
			),

			window.FotoGridsRenderSettings?.renderBulkModal({
				showBulkModal,
				bulkAction,
				bulkUrl,
				setBulkUrl,
				bulkTarget,
				setBulkTarget,
				validateUrl,
				closeBulkModal,
				executeBulkAction,
				__,
			}),
		],
	);
}

function ReadonlyNotice() {
	const notice =
		window.fotogridsSettings?.unauthorisedNotice ||
		'You are viewing these settings in read-only mode.';
	return h(
		'div',
		{ className: 'fotogrids-readonly-notice', role: 'note' },
		h('strong', null, 'Read-only'),
		h('span', null, ' — ' + notice),
	);
}

function ReadonlyWrapper(props) {
	// Render the existing tree inside a disabled fieldset and a notice.
	// This is the metabox-level gate; granular per-control locking is the
	// job of <SettingsLock> in newer code.
	return h(
		'div',
		{ className: 'fotogrids-collection-settings--readonly' },
		h(ReadonlyNotice),
		h(
			'fieldset',
			{
				className: 'fotogrids-collection-settings__fieldset',
				disabled: true,
				'aria-disabled': 'true',
			},
			props.children,
		),
	);
}

function initializeCollectionSettings() {
	const container = document.getElementById(
		'fotogrids-collection-settings-root',
	);

	if (container && window.wp && window.wp.element) {
		const { createRoot } = wp.element;
		const editable = window.fotogridsSettings?.editable !== false;
		const tree = editable
			? h(CollectionSettings)
			: h(ReadonlyWrapper, null, h(CollectionSettings));
		createRoot(container).render(tree);
	} else {
		setTimeout(initializeCollectionSettings, 100);
	}
}

window.FotoGridsCollectionSettings.CollectionSettings = CollectionSettings;

document.addEventListener('DOMContentLoaded', () => {
	initializeCollectionSettings();
});

if (
	document.readyState === 'complete' ||
	document.readyState === 'interactive'
) {
	setTimeout(() => {
		initializeCollectionSettings();
	}, 0);
}
