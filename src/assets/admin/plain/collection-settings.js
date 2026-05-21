const { createElement: h, useState, useEffect, useLayoutEffect, useMemo } = wp.element;
const {
    Panel,
    PanelBody,
    SelectControl,
    TextControl,
    RangeControl,
    Button,
    ButtonGroup,
    Card,
    CardBody,
    __experimentalNavigatorProvider: NavigatorProvider,
    __experimentalNavigatorScreen: NavigatorScreen,
    __experimentalNavigatorButton: NavigatorButton,
    __experimentalNavigator: Navigator
} = wp.components;
const { __ } = wp.i18n;

let SETTINGS_GROUPS = {};
const FIELD_STATE = {
    EDITABLE: 'editable',
    LOCKED: 'locked',
    TEASER: 'teaser'
};

const isFreeTier = (config) => {
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

const withLegacyFreeFlag = (config) => {
    if (!config || typeof config !== 'object') {
        return config;
    }

    if (typeof config.free === 'boolean') {
        return config;
    }

    return {
        ...config,
        free: isFreeTier(config)
    };
};

const resolveFieldStateValue = (setting, currentValue, fieldStates, fieldStatesByOption) => {
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

const useFieldState = (setting, currentValue, fieldStates, fieldStatesByOption) => {
    return useMemo(
        () => resolveFieldStateValue(setting, currentValue, fieldStates, fieldStatesByOption),
        [setting?.key, currentValue, fieldStates, fieldStatesByOption]
    );
};

const TeaserBadge = ({ __ }) => {
    return h('span', { className: 'fotogrids-pro-badge' }, __('Pro', 'fotogrids'));
};

const LockedBanner = ({ __ }) => {
    return h('div', { className: 'fotogrids-settings-locked-banner' }, __('Locked: renew your license to edit this setting.', 'fotogrids'));
};

const FieldGate = ({
    setting,
    currentValue,
    fieldStates,
    fieldStatesByOption,
    __,
    children
}) => {
    const state = useFieldState(setting, currentValue, fieldStates, fieldStatesByOption);
    const isTeaser = state === FIELD_STATE.TEASER;
    const isLocked = state === FIELD_STATE.LOCKED;

    return h('div', {
        className: `fotogrids-field-gate ${isTeaser ? 'fotogrids-field-gate--teaser' : ''} ${isLocked ? 'fotogrids-field-gate--locked' : ''}`
    }, [
        children,
        isLocked && h(LockedBanner, { __ }),
        // isTeaser && h(TeaserBadge, { __ })
    ].filter(Boolean));
};

window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};
window.FotoGridsRenderSettings.useFieldState = useFieldState;
window.FotoGridsRenderSettings.TeaserBadge = TeaserBadge;
window.FotoGridsRenderSettings.LockedBanner = LockedBanner;
window.FotoGridsRenderSettings.FieldGate = FieldGate;

/**
 * Get post type value based on property path
 *
 * Supports nested properties like:
 * - postType → "Gallery" or "Album"
 * - postType.lower → "gallery" or "album"
 * - postType.plural → "Galleries" or "Albums"
 * - postType.plural.lower → "galleries" or "albums"
 *
 * @param {string} normalizedPostType - Normalized post type ('gallery' or 'album')
 * @param {string} propertyPath - Property path (e.g., 'lower', 'plural', 'lower.plural')
 * @returns {string} The resolved value
 */
const getPostTypeValue = (normalizedPostType, propertyPath = '') => {
    const isAlbum = normalizedPostType === 'album';

    // Base values
    const base = {
        '': isAlbum ? 'Album' : 'Gallery',
        'lower': isAlbum ? 'album' : 'gallery',
        'plural': isAlbum ? 'Albums' : 'Galleries',
        'plural.lower': isAlbum ? 'albums' : 'galleries'
    };

    // If no property path, return base value
    if (!propertyPath) {
        return base[''];
    }

    // Return the value for the property path, or fallback to base
    return base[propertyPath] !== undefined ? base[propertyPath] : base[''];
};

/**
 * Replace post type placeholders in text
 *
 * Replaces placeholders like:
 * - {postType} → "Gallery" or "Album"
 * - {postType.lower} → "gallery" or "album"
 * - {postType.plural} → "Galleries" or "Albums"
 * - {postType.plural.lower} → "galleries" or "albums"
 *
 * @param {string} text - Text that may contain placeholders
 * @param {string} normalizedPostType - Normalized post type ('gallery' or 'album')
 * @returns {string} Text with placeholders replaced
 */
const replacePostTypePlaceholders = (text, normalizedPostType) => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    // Match {postType} or {postType.property} or {postType.property.nested}
    return text.replace(/\{postType(?:\.([^}]+))?\}/g, (match, propertyPath) => {
        return getPostTypeValue(normalizedPostType, propertyPath || '');
    });
};

/**
 * Process a setting object to replace post type placeholders
 *
 * @param {Object} setting - Setting object
 * @param {string} normalizedPostType - Normalized post type ('gallery' or 'album')
 * @returns {Object} Setting object with placeholders replaced
 */
const processSettingPlaceholders = (setting, normalizedPostType) => {
    if (!setting || typeof setting !== 'object') {
        return setting;
    }

    const processed = { ...setting };

    // Process label
    if (processed.label) {
        processed.label = replacePostTypePlaceholders(processed.label, normalizedPostType);
    }

    // Process description
    if (processed.description) {
        processed.description = replacePostTypePlaceholders(processed.description, normalizedPostType);
    }

    // Process options (filter by postTypes and process placeholders)
    if (processed.options && Array.isArray(processed.options)) {
        processed.options = processed.options
            .filter(option => {
                if (option.postTypes && Array.isArray(option.postTypes)) {
                    return option.postTypes.includes(normalizedPostType);
                }
                return true;
            })
            .map(option => {
                const processedOption = { ...option };
                if (processedOption.label) {
                    processedOption.label = replacePostTypePlaceholders(processedOption.label, normalizedPostType);
                }
                if (processedOption.description) {
                    processedOption.description = replacePostTypePlaceholders(processedOption.description, normalizedPostType);
                }
                return processedOption;
            });
    }

    // Process conditional message
    if (processed.conditionalMessage?.message) {
        processed.conditionalMessage = {
            ...processed.conditionalMessage,
            message: replacePostTypePlaceholders(processed.conditionalMessage.message, normalizedPostType)
        };
    }

    // Process promo messages (for promo type settings)
    if (processed.messages && Array.isArray(processed.messages)) {
        processed.messages = processed.messages.map(msg => {
            const processedMsg = { ...msg };
            if (processedMsg.subtitle) {
                processedMsg.subtitle = replacePostTypePlaceholders(processedMsg.subtitle, normalizedPostType);
            }
            if (processedMsg.message) {
                processedMsg.message = replacePostTypePlaceholders(processedMsg.message, normalizedPostType);
            }
            return processedMsg;
        });
    }

    // Process nested settings (for setting_group)
    if (processed.settings && Array.isArray(processed.settings)) {
        processed.settings = processed.settings.map(subSetting =>
            processSettingPlaceholders(subSetting, normalizedPostType)
        );
    }

    // Process subTabs (filter by postTypes and process placeholders)
    if (processed.subTabs) {
        const processedSubTabs = {};
        Object.keys(processed.subTabs).forEach(subTabKey => {
            const subTab = { ...processed.subTabs[subTabKey] };

            // Filter by postTypes if specified
            if (subTab.postTypes && Array.isArray(subTab.postTypes)) {
                if (!subTab.postTypes.includes(normalizedPostType)) {
                    return; // Skip this sub-tab
                }
            }

            if (subTab.label) {
                subTab.label = replacePostTypePlaceholders(subTab.label, normalizedPostType);
            }
            if (subTab.settings && Array.isArray(subTab.settings)) {
                subTab.settings = subTab.settings.map(subSetting =>
                    processSettingPlaceholders(subSetting, normalizedPostType)
                );
            }
            processedSubTabs[subTabKey] = subTab;
        });
        processed.subTabs = processedSubTabs;
    }

    return processed;
};

const translateSettingsGroup = (group, normalizedPostType = 'gallery') => {
    const translated = withLegacyFreeFlag({ ...group });

    if (translated.label) {
        translated.label = __(translated.label, 'fotogrids');
        translated.label = replacePostTypePlaceholders(translated.label, normalizedPostType);
    }

    if (translated.settings) {
        translated.settings = translated.settings.map(setting => {
            let translatedSetting = withLegacyFreeFlag({ ...setting });

            if (translatedSetting.label) {
                translatedSetting.label = __(translatedSetting.label, 'fotogrids');
            }

            if (translatedSetting.description) {
                translatedSetting.description = __(translatedSetting.description, 'fotogrids');
            }

            if (translatedSetting.options) {
                translatedSetting.options = translatedSetting.options.map(option => withLegacyFreeFlag({
                    ...option,
                    label: option.label ? __(option.label, 'fotogrids') : option.label,
                    description: option.description ? __(option.description, 'fotogrids') : option.description
                }));
            }

            if (translatedSetting.conditionalMessage?.message) {
                translatedSetting.conditionalMessage.message = __(translatedSetting.conditionalMessage.message, 'fotogrids');
            }

            if (translatedSetting.subTabs) {
                Object.keys(translatedSetting.subTabs).forEach(subTabKey => {
                    const subTab = translatedSetting.subTabs[subTabKey];
                    subTab.label = __(subTab.label, 'fotogrids');
                    if (subTab.settings) {
                        subTab.settings = subTab.settings.map(subSetting => {
                            const translatedSubSetting = translateSettingsGroup({ settings: [subSetting] }, normalizedPostType).settings[0];
                            return processSettingPlaceholders(translatedSubSetting, normalizedPostType);
                        });
                    }
                });
            }

            // Process placeholders after translation
            translatedSetting = processSettingPlaceholders(translatedSetting, normalizedPostType);

            return translatedSetting;
        });
    }

    // Process group-level subTabs (filter by postTypes and process placeholders)
    if (translated.subTabs) {
        const processedSubTabs = {};
        Object.keys(translated.subTabs).forEach(subTabKey => {
            const subTab = { ...translated.subTabs[subTabKey] };

            // Filter by postTypes if specified
            if (subTab.postTypes && Array.isArray(subTab.postTypes)) {
                if (!subTab.postTypes.includes(normalizedPostType)) {
                    return; // Skip this sub-tab
                }
            }

            if (subTab.label) {
                subTab.label = __(subTab.label, 'fotogrids');
                subTab.label = replacePostTypePlaceholders(subTab.label, normalizedPostType);
            }
            if (subTab.settings && Array.isArray(subTab.settings)) {
                subTab.settings = subTab.settings.map(subSetting => {
                    const translatedSubSetting = translateSettingsGroup({ settings: [subSetting] }, normalizedPostType).settings[0];
                    return processSettingPlaceholders(translatedSubSetting, normalizedPostType);
                });
            }
            processedSubTabs[subTabKey] = subTab;
        });
        translated.subTabs = processedSubTabs;
    }

    return translated;
};

const renderIcon = (iconName) => {
    const icons = window.FotoGridsIcons || {};
    const iconSvg = icons[iconName];

    if (!iconSvg) {
        return iconName;
    }

    return h('span', {
        className: 'fotogrids-icon',
        dangerouslySetInnerHTML: { __html: iconSvg }
    });
};

window.FotoGridsCollectionSettings = window.FotoGridsCollectionSettings || {};

function CollectionSettings() {
    const postType = window.fotogridsSettings?.postType || 'gallery';
    const isDefaultsMode = window.fotogridsSettings?.isDefaultsMode || false;
    const normalizedPostType = postType === 'fotogrids_gallery' ? 'gallery' :
                               postType === 'fotogrids_album' ? 'album' :
                               postType;

    const uiState = window.FotoGridsUiState?.createNamespace({
        area: 'collection-settings',
        postId: window.fotogridsSettings?.postId || 0,
    });

    const [activeTab, setActiveTab] = useState(() => {
        if (!uiState) return 'layout';
        return uiState.getValue({ key: 'main-tab', fallback: 'layout', urlParam: 'fg-settings-tab' });
    });
    const [activeSubTabs, setActiveSubTabs] = useState(() => {
        if (!uiState) return {};
        return uiState.getValue({ key: 'subtabs', fallback: {} });
    });
    const [settings, setSettings] = useState(window.fotogridsSettings?.settings || {});
    const [saving, setSaving] = useState(false);
    const [activeDevice, setActiveDevice] = useState('desktop');
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [fieldStates, setFieldStates] = useState(window.fotogridsCatalog?.field_states || {});
    const [fieldStatesByOption, setFieldStatesByOption] = useState(window.fotogridsCatalog?.field_states_by_option || {});

    const [itemData, setItemData] = useState({});
    const [loadingItems, setLoadingItems] = useState(false);
    const [itemError, setItemError] = useState(null);
    const [savingItems, setSavingItems] = useState({});
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkAction, setBulkAction] = useState('');
    const [bulkUrl, setBulkUrl] = useState('');
    const [bulkTarget, setBulkTarget] = useState('global');
    const [autosaveValue, setAutosaveValue] = useState(window.fotogridsAdmin?.autosave || false);
    const State = window.FotoGridsCollectionState;

    const isProActive = window.fotogridsSettings?.isProActive || false;
    const galleryItems = window.fotogridsSettings?.galleryItems || [];
    const canEditPosts = window.fotogridsSettings?.canEditPosts !== false;

    const getActiveSubTab = (contextKey, defaultSubTabId) => {
        return activeSubTabs[contextKey] !== undefined ? activeSubTabs[contextKey] : defaultSubTabId;
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

    const loadAndTranslateSettings = async () => {
        if (window.FotoGridsSettings?.loadSettingsGroups) {
            const postType = window.fotogridsSettings?.postType || 'gallery';
            const rawSettings = await window.FotoGridsSettings.loadSettingsGroups(postType, isDefaultsMode);
            SETTINGS_GROUPS = {};

            Object.keys(rawSettings).forEach(key => {
                SETTINGS_GROUPS[key] = translateSettingsGroup(rawSettings[key], normalizedPostType);
            });
        } else {
            console.warn('FotoGrids: Settings loader not available, SETTINGS_GROUPS will be empty');
        }
        setSettingsLoaded(true);
    };

    useEffect(() => {
        loadAndTranslateSettings();
    }, []);


    useEffect(() => {
        const fetchFieldStates = async () => {
            try {
                let endpoint = '';
                const restBase = window.fotogridsSettings?.restUrl || window.wpApiSettings?.root || '';

                if (!restBase) {
                    return;
                }

                if (restBase.includes('/fotogrids/v1/')) {
                    endpoint = `${restBase.replace(/\/$/, '')}/admin/catalog/field-states`;
                } else {
                    endpoint = `${restBase.replace(/\/$/, '')}/fotogrids/v1/admin/catalog/field-states`;
                }

                const simulateState = window.fotogridsSettings?.catalogSimulateState || '';
                if (simulateState) {
                    endpoint += `${endpoint.includes('?') ? '&' : '?'}simulate_state=${encodeURIComponent(simulateState)}`;
                }

                const response = await fetch(endpoint, {
                    headers: {
                        'X-WP-Nonce': window.wpApiSettings?.nonce || ''
                    }
                });

                if (!response.ok) {
                    return;
                }

                const payload = await response.json();
                const resolvedFieldStates = payload?.field_states || {};
                const resolvedOptionStates = payload?.field_states_by_option || {};

                setFieldStates(resolvedFieldStates);
                setFieldStatesByOption(resolvedOptionStates);

                window.fotogridsCatalog = window.fotogridsCatalog || {};
                window.fotogridsCatalog.field_states = resolvedFieldStates;
                window.fotogridsCatalog.field_states_by_option = resolvedOptionStates;
            } catch (error) {
                console.warn('FotoGrids: failed to refresh catalog field states.', error);
            }
        };

        fetchFieldStates();
        const refreshHandler = () => fetchFieldStates();
        window.addEventListener('fotogrids:license_changed', refreshHandler);

        return () => window.removeEventListener('fotogrids:license_changed', refreshHandler);
    }, []);

    useEffect(() => {
        if (!settingsLoaded) return;

        setActiveSubTabs(prev => {
            const updated = { ...prev };
            let hasChanges = false;

            Object.values(SETTINGS_GROUPS).forEach(group => {
                if (group.subTabs && Object.keys(group.subTabs).length > 0) {
                    const firstSubTabId = Object.keys(group.subTabs)[0];

                    if (updated[group.id] === undefined || updated[group.id] === null || updated[group.id] === '') {
                        updated[group.id] = firstSubTabId;
                        hasChanges = true;
                    }
                }
            });

            Object.values(SETTINGS_GROUPS).forEach(group => {
                if (group.settings) {
                    group.settings.forEach(setting => {
                        if (setting.type === 'setting_subtabs' && setting.subTabs && Object.keys(setting.subTabs).length > 0) {
                            const firstSubTabId = Object.keys(setting.subTabs)[0];

                            if (updated[setting.key] === undefined || updated[setting.key] === null || updated[setting.key] === '') {
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
                if (activeGroup.subTabs && Object.keys(activeGroup.subTabs).length > 0) {
                    const firstSubTabId = Object.keys(activeGroup.subTabs)[0];
                    if (updated[activeGroup.id] === undefined || updated[activeGroup.id] === null || updated[activeGroup.id] === '') {
                        updated[activeGroup.id] = firstSubTabId;
                        hasChanges = true;
                    }
                }

                if (activeGroup.settings) {
                    activeGroup.settings.forEach(setting => {
                        if (setting.type === 'setting_subtabs' && setting.subTabs && Object.keys(setting.subTabs).length > 0) {
                            const firstSubTabId = Object.keys(setting.subTabs)[0];
                            if (updated[setting.key] === undefined || updated[setting.key] === null || updated[setting.key] === '') {
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
        if (!isDefaultsMode && settings.item_click_behavior === 'external' && canEditPosts && galleryItems.length > 0) {
            loadItemData();
        }
    }, [settings.item_click_behavior, galleryItems.length, canEditPosts, isDefaultsMode]);

    useEffect(() => {
        const currentValue = window.fotogridsAdmin?.autosave || false;
        setAutosaveValue(currentValue);

        if (State) {
            State.autosave.set(currentValue);
        }

        const handleAutosaveChange = (e) => {
            if (e.target.name === 'fotogrids_autosave') {
                const newValue = e.target.checked;
                setAutosaveValue(newValue);
                if (State) {
                    State.autosave.set(newValue);
                }
            }
        };

        const autosaveInput = document.querySelector('input[name="fotogrids_autosave"]');
        if (autosaveInput) {
            autosaveInput.addEventListener('change', handleAutosaveChange);
            return () => {
                autosaveInput.removeEventListener('change', handleAutosaveChange);
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

            const response = await fetch(window.fotogridsSettings?.ajaxUrl || window.ajaxurl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                setItemData(result.data);
            } else {
                throw new Error(result.data || __('Failed to load item data', 'fotogrids'));
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

            const response = await fetch(window.fotogridsSettings?.ajaxUrl || window.ajaxurl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                setItemData(prev => ({
                    ...prev,
                    [itemId]: {
                        ...prev[itemId],
                        url: url,
                        target: target !== null ? target : prev[itemId]?.target || 'global'
                    }
                }));
            } else {
                throw new Error(result.data || __('Failed to save URL', 'fotogrids'));
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

            const response = await fetch(window.fotogridsSettings?.ajaxUrl || window.ajaxurl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                await loadItemData();
            } else {
                throw new Error(result.data || __('Bulk action failed', 'fotogrids'));
            }
        } catch (err) {
            setItemError(err.message);
        }
    };

    const validateUrl = (url) => {
        if (!url.trim()) return { valid: true, message: '' };

        try {
            const urlObj = new URL(url);
            const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

            if (!allowedProtocols.includes(urlObj.protocol)) {
                return { valid: false, message: __('Invalid protocol. Use http, https, mailto, or tel.', 'fotogrids') };
            }

            return { valid: true, message: __('Valid URL', 'fotogrids') };
        } catch {
            return { valid: false, message: __('Invalid URL format', 'fotogrids') };
        }
    };

    const openBulkModal = (action) => {
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
            [key]: value
        }));

        saveSetting(key, value);
    };

    // Updates React state only — does not persist to the form or trigger autosave.
    // Use for UI-only state that lives inside a value object (e.g. _linked flag).
    const updateSettingStateOnly = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const saveSetting = async (key, value) => {
        setSaving(true);

        try {
            if (isDefaultsMode) {
                // In defaults mode, save to form inputs for WordPress Settings API
                const form = document.querySelector('form[action="options.php"]');
                if (!form) {
                    console.warn('FotoGrids: Settings form not found');
                    return;
                }

                let input = form.querySelector(`input[name="fotogrids_gallery_defaults[${key}]"]`);

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

                const customEvent = new CustomEvent('fotogrids:setting_changed', {
                    bubbles: true,
                    detail: { key, value, input }
                });
                input.dispatchEvent(customEvent);
            } else {
                // In gallery mode, save to post meta inputs
                let input = document.querySelector(`input[name="fotogrids_${key}"]`);

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

                const customEvent = new CustomEvent('fotogrids:setting_changed', {
                    bubbles: true,
                    detail: { key, value, input }
                });
                input.dispatchEvent(customEvent);

                if (window.FotoGridsAjaxSave && typeof window.FotoGridsAjaxSave.showUnsavedChanges === 'function') {
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
     *  1. `setting.postTypes` — array of post types this setting is valid for.
     *  2. `setting.depends_on` (+ optional `setting.depends_on_value`) —
     *     snake_case predicate used by Pro and the new placement schema. When
     *     `depends_on_value` is omitted, the parent value is checked for
     *     truthiness. When given, equality is required.
     *  3. `setting.condition.dependsOn` + `values` — legacy camelCase predicate
     *     used by Free's existing JSON files. `values` is either a single value
     *     or an array of accepted values; `dependsOn` may be a single key or an
     *     array of keys (all must match).
     *
     * @param {Object} setting
     * @returns {boolean}
     */
    const shouldDisplaySetting = (setting) => {
        // Filter by postType if specified
        if (setting.postTypes && Array.isArray(setting.postTypes)) {
            if (!setting.postTypes.includes(normalizedPostType)) {
                return false;
            }
        }

        // depends_on / depends_on_value (snake_case, new placement schema)
        if (typeof setting.depends_on === 'string' && setting.depends_on !== '') {
            const parentKey = setting.depends_on;
            const parentValue = settings[parentKey];

            const parentSetting = findSettingByKey(parentKey);
            if (parentSetting && !shouldDisplaySetting(parentSetting)) {
                return false;
            }

            if (Object.prototype.hasOwnProperty.call(setting, 'depends_on_value')) {
                return parentValue === setting.depends_on_value;
            }

            return Boolean(parentValue);
        }

        // condition.dependsOn / values (legacy camelCase predicate)
        if (!setting.condition) return true;

        const { dependsOn, values } = setting.condition;

        if (Array.isArray(dependsOn)) {
            const operators = setting.condition?.condition_operators || [];
            return dependsOn.every((dep, index) => {
                const currentValue = settings[dep];
                const expectedValues = values[index];
                const op = operators[index] || null;

                const dependentSetting = findSettingByKey(dep);
                if (dependentSetting && !shouldDisplaySetting(dependentSetting)) {
                    return false;
                }

                // array_not_empty: passes when the stored JSON array has at least one element.
                if (op === 'array_not_empty') {
                    let storedArray = currentValue;
                    if (typeof storedArray === 'string') {
                        try { storedArray = JSON.parse(storedArray); } catch { storedArray = []; }
                    }
                    return Array.isArray(storedArray) && storedArray.length > 0;
                }

                // array_includes: passes when the stored JSON array contains any of the expected values.
                if (op === 'array_includes') {
                    let storedArray = currentValue;
                    if (typeof storedArray === 'string') {
                        try { storedArray = JSON.parse(storedArray); } catch { storedArray = []; }
                    }
                    if (!Array.isArray(storedArray)) return false;
                    return Array.isArray(expectedValues)
                        ? expectedValues.some(v => storedArray.includes(v))
                        : storedArray.includes(expectedValues);
                }

                return Array.isArray(expectedValues)
                    ? expectedValues.includes(currentValue)
                    : expectedValues === currentValue;
            });
        } else {
            const dependentValue = settings[dependsOn];
            const conditionOperator = setting.condition?.condition_operator || null;

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
                    try { storedArray = JSON.parse(storedArray); } catch { storedArray = []; }
                }
                if (!Array.isArray(storedArray)) return false;
                return Array.isArray(values)
                    ? values.some(v => storedArray.includes(v))
                    : storedArray.includes(values);
            }

            if ((dependentValue === undefined || dependentValue === null) && Array.isArray(values)) {
                if (values.includes(false) || values.includes("0") || values.includes(0)) {
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
    const evaluateVisibleWhen = (predicate) => {
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
    const shouldDisplayTab = (group) => {
        if (group?.hidden) return false;

        if (group?.visible_when && !evaluateVisibleWhen(group.visible_when)) {
            return false;
        }

        if (!group.condition) return true;

        const { dependsOn, values } = group.condition;
        const dependentValue = settings[dependsOn];

        return values.includes(dependentValue);
    };

    const findSettingByKey = (key) => {
        for (const groupId in SETTINGS_GROUPS) {
            const group = SETTINGS_GROUPS[groupId];

            if (group.settings) {
                for (const setting of group.settings) {
                    if (setting.key === key) return setting;

                    if (setting.subTabs) {
                        for (const subTabId in setting.subTabs) {
                            const subTab = setting.subTabs[subTabId];
                            const subSetting = subTab.settings.find(s => s.key === key);
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

    const renderSetting = (setting) => {
        // Drop hidden nodes (set by a `hide` placement) and sections whose
        // group-level `visible_when` predicate evaluates false.
        if (setting?.hidden) {
            return null;
        }

        if (setting?.visible_when && !evaluateVisibleWhen(setting.visible_when)) {
            return null;
        }

        if (!shouldDisplaySetting(setting)) {
            return null;
        }

        const currentValue = settings[setting.key];
        const fieldState = resolveFieldStateValue(setting, currentValue, fieldStates, fieldStatesByOption);
        const isDisabledByGate = fieldState !== FIELD_STATE.EDITABLE;
        const isDisabled = isDisabledByGate || (!isFreeTier(setting) && !isProActive && setting.type !== 'promo');
        const getFieldState = (fieldKey, fieldValue = currentValue) => {
            const pseudoSetting = { key: fieldKey };
            return resolveFieldStateValue(pseudoSetting, fieldValue, fieldStates, fieldStatesByOption);
        };

        const settingProps = {
            label: setting.label,
            value: currentValue,
            onChange: (value) => updateSetting(setting.key, value),
            disabled: isDisabled
        };

        let control;

        switch (setting.type) {
            case 'select':
                // Filter out options with isGlobalDefault: true when in defaults mode
                const selectOptionsRaw = isDefaultsMode
                    ? (setting.options || []).filter(option => !option.isGlobalDefault)
                    : (setting.options || []);
                const selectOptions = selectOptionsRaw.map((option) => {
                    const optionValue = option?.value;
                    if (typeof optionValue !== 'string') {
                        return option;
                    }

                    const optionState = resolveFieldStateValue(
                        { key: setting.key },
                        optionValue,
                        fieldStates,
                        fieldStatesByOption
                    );

                    if (optionState === FIELD_STATE.EDITABLE) {
                        return option;
                    }

                    const badgeText = optionState === FIELD_STATE.LOCKED ? __('(Locked)', 'fotogrids') : __('(Pro)', 'fotogrids');
                    return {
                        ...option,
                        label: `${option.label} ${badgeText}`,
                        disabled: true
                    };
                });
                control = h(SelectControl, {
                    ...settingProps,
                    options: selectOptions
                });
                break;

            case 'text_input':
                control = window.FotoGridsRenderSettings?.renderTextInput(setting, currentValue, isDisabled, {
                    updateSetting,
                    getFieldState,
                    __
                });
                break;

            case 'font_family':
                control = window.FotoGridsRenderSettings?.renderFontFamily(setting, currentValue, isDisabled, {
                    updateSetting,
                    getFieldState,
                    renderIcon,
                    __
                });
                break;

            case 'range':
                control = window.FotoGridsRenderSettings?.renderRange(setting, currentValue, isDisabled, {
                    updateSetting,
                    getFieldState,
                    __
                });
                break;

            case 'toggle':
                control = window.FotoGridsRenderSettings?.renderToggle(setting, currentValue, isDisabled, {
                    updateSetting,
                    getFieldState,
                    __
                });
                break;

            case 'responsive_range':
                control = window.FotoGridsRenderSettings?.renderResponsiveRange(setting, currentValue, isDisabled, {
                    updateSetting,
                    updateSettingStateOnly,
                    activeDevice,
                    setActiveDevice,
                    renderIcon,
                    getFieldState,
                    __
                });
                break;

            case 'layout_grid':
                control = window.FotoGridsRenderSettings?.renderLayoutGrid(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    getFieldState,
                    getOptionState: getFieldState,
                    __
                });
                break;

            case 'hover_effects_grid':
                control = window.FotoGridsRenderSettings?.renderHoverEffectsGrid(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    getFieldState,
                    getOptionState: getFieldState,
                    __,
                    settings
                });
                break;

            case 'button_group':
                control = window.FotoGridsRenderSettings?.renderButtonGroup(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    getFieldState,
                    isDefaultsMode,
                    getOptionState: getFieldState,
                    __
                });
                break;

            case 'token_select':
                control = window.FotoGridsRenderSettings?.renderTokenSelect(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    getFieldState,
                    getOptionState: getFieldState,
                    isDefaultsMode,
                    __
                });
                break;

            case 'alignment_grid':
                control = window.FotoGridsRenderSettings?.renderAlignmentGrid(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    getFieldState,
                    isDefaultsMode,
                    getOptionState: getFieldState,
                    __
                });
                break;

            case 'button_group_dynamic':
                control = window.FotoGridsRenderSettings?.renderButtonGroupDynamic(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    getFieldState,
                    isDefaultsMode,
                    getOptionState: getFieldState,
                    __
                });
                break;

            case 'image_size':
                control = window.FotoGridsRenderSettings?.renderImageSize(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    getFieldState,
                    isDefaultsMode,
                    getOptionState: getFieldState,
                    __
                });
                break;

            case 'color':
                control = window.FotoGridsRenderSettings?.renderColorPicker(setting, currentValue, isDisabled, {
                    updateSetting,
                    getFieldState,
                    __
                });
                break;

            case 'setting_subtabs':
                const settingContextKey = setting.key;
                const currentActiveSubTab = getActiveSubTab(
                    settingContextKey,
                    setting.subTabs ? Object.keys(setting.subTabs)[0] : null
                );
                control = window.FotoGridsRenderSettings?.renderSettingSubTabs(setting, isDisabled, {
                    activeSubTab: currentActiveSubTab,
                    setActiveSubTab: (subTabId) => setActiveSubTabForContext(settingContextKey, subTabId),
                    renderIcon,
                    renderSetting,
                    shouldDisplaySetting,
                    __
                });
                break;

            case 'external_url_manager':
                if (isDefaultsMode) {
                    return null;
                }
                control = window.FotoGridsRenderSettings?.renderExternalUrlManager(setting, isDisabled, {
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
                    __
                });
                break;

            case 'setting_group':
                control = window.FotoGridsRenderSettings?.renderGroup(setting, currentValue, isDisabled, {
                    renderSetting,
                    getFieldState,
                    __
                });
                break;

            case 'codearea':
                control = window.FotoGridsRenderSettings?.renderCodeArea(setting, currentValue, (value, errorInfo) => {
                    updateSetting(setting.key, value);

                    if (errorInfo && typeof errorInfo === 'object') {
                        setValidationErrors(prev => {
                            const newErrors = {
                                ...prev,
                                [setting.key]: errorInfo
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
                }, [], isDisabled, getFieldState, __);
                break;

            case 'password_input':
                control = window.FotoGridsRenderSettings?.renderPasswordInput(setting, currentValue, isDisabled, {
                    updateSetting,
                    getFieldState,
                    renderIcon,
                    __,
                    postId: window.fotogridsSettings?.postId || 0,
                    restUrl: window.fotogridsSettings?.restUrl || window.wpApiSettings?.root || '',
                    restNonce: window.fotogridsSettings?.restNonce || window.wpApiSettings?.nonce || '',
                    passwordIsSet: !!(window.fotogridsSettings?.passwordIsSet),
                });
                break;

            case 'promo':
                control = window.FotoGridsRenderSettings?.renderPromo(setting, currentValue, isDisabled, {
                    __
                });
                break;

            case 'info_block':
                control = window.FotoGridsRenderSettings?.renderInfoBlock(setting, currentValue, isDisabled, {
                    __
                });
                break;

            default:
                return null;
        }

        const gatedControl = h(FieldGate, {
            setting,
            currentValue,
            fieldStates,
            fieldStatesByOption,
            __
        }, control);

        return h('div', {
            key: setting.key,
            className: `fotogrids-setting ${isDisabled ? 'fotogrids-setting--disabled' : ''}`
        }, [
            gatedControl,
            window.FotoGridsRenderSettings?.renderConditionalMessage(setting, currentValue)
        ].filter(Boolean));
    };

    const renderDocumentationStrip = () => {
        const defaultsUrl = window.fotogridsSettings?.defaultsUrl || '';
        const documentationUrl = window.fotogridsSettings?.documentationUrl || '';

        const helpTextTemplate = __('Need help? Check out our <a>documentation</a>', 'fotogrids');
        const helpText = helpTextTemplate.replace(
            '<a>',
            `<a href="${documentationUrl}" target="_blank" class="fotogrids-settings-docs-strip__link">`
        );

        const handleAutosaveToggle = (e) => {
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
                body: formData
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
              .then(data => {
                  if (data.success) {
                      const savedValue = data.data?.value !== undefined ? data.data.value : newValue;
                      if (savedValue !== newValue) {
                          setAutosaveValue(!newValue);
                          const errorMessage = __('Failed to save autosave setting - value mismatch', 'fotogrids');
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
                                  : __('Autosave disabled', 'fotogrids')
                          );
                      }
                  } else {
                      setAutosaveValue(!newValue);
                      const errorMessage = data.data?.message || __('Failed to update autosave setting', 'fotogrids');
                      if (window.fotogridsToast) {
                          window.fotogridsToast.error(errorMessage);
                      }
                  }
              })
              .catch(error => {
                  setAutosaveValue(!newValue);
                  const errorMessage = __('Failed to update autosave setting', 'fotogrids');
                  console.error('FotoGrids: Error updating autosave setting:', error);
                  if (window.fotogridsToast) {
                      window.fotogridsToast.error(errorMessage);
                  }
              });
        };

        return h('div', {
            className: 'fotogrids-settings-docs-strip'
        }, [
            h('span', {
                dangerouslySetInnerHTML: { __html: helpText }
            }),
            h('div', {
                className: 'fotogrids-settings-docs-strip__buttons'
            }, [
                ! isDefaultsMode && h('a', {
                    href: defaultsUrl,
                    className: 'fotogrids-settings-docs-strip__link',
                    target: '_blank',
                    alt: __('Configure defaults', 'fotogrids')
                }, __('Defaults', 'fotogrids')),
                h('div', {
                    className: 'fotogrids-settings-docs-strip__autosave'
                }, [
                    h('span', {
                        className: 'fotogrids-settings-docs-strip__autosave-label'
                    }, __('Autosave', 'fotogrids')),
                    h('button', {
                        type: 'button',
                        className: `fotogrids-toggle fotogrids-toggle--small fotogrids-toggle--green ${autosaveValue ? 'fgt-is-checked' : ''}`,
                        onClick: handleAutosaveToggle,
                        title: __('Toggle autosave', 'fotogrids'),
                        'aria-checked': autosaveValue,
                        role: 'switch'
                    }, [
                        h('span', {
                            className: 'fotogrids-toggle__track'
                        }),
                        h('span', {
                            className: 'fotogrids-toggle__thumb'
                        })
                    ])
                ])
            ])
        ]);
    };

    const renderTabContent = (groupId) => {
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

            return h('div', {
                className: 'fotogrids-settings-group'
            }, [
                h('div', {
                    className: 'fotogrids-pro-tab--content'
                }, [
                    h('div', {
                        className: 'fotogrids-pro-tab--header'
                    }, [
                        h('span', {
                            className: 'fotogrids-pro-tab--header--icon'
                        }, renderIcon(group.icon)),
                        h('h3', {}, group.label),
                        h('div', {
                            className: 'fotogrids-pro-badge fotogrids-pro-badge-large'
                        }, [
                            h('div', {
                                className: 'fotogrids-fireworks'
                            }),
                            h('span', {}, __('Pro', 'fotogrids'))
                        ])
                    ]),
                    h('div', {
                        className: 'fotogrids-pro-tab--features'
                    }, [
                        h('h4', { className: 'fotogrids-pro-tab--description' }, group.description || __('Unlock these powerful features:', 'fotogrids')),
                        h('ul', {}, allSettings.map(setting =>
                            h('li', {
                                key: setting.key,
                                className: 'fotogrids-pro-tab--feature'
                            }, [
                                h('span', {
                                    className: 'fotogrids-pro-tab--feature--icon'
                                }, renderIcon('check_circle')),
                                h('div', {
                                    className: 'fotogrids-pro-tab--feature--content'
                                }, [
                                    setting.title && h('h5', {
                                        className: 'fotogrids-pro-tab--feature--title'
                                    }, setting.title),
                                    h('p', {
                                        className: 'fotogrids-pro-tab--feature--description'
                                    }, setting.description || setting.label)
                                ])
                            ])
                        ))
                    ]),
                    h('div', {
                        className: 'fotogrids-pro-tab--cta'
                    }, [
                        h('button', {
                            type: 'button',
                            className: 'fotogrids-button fotogrids-button--primary',
                            onClick: () => {
                                const upgradeUrl = window.fotogridsUpgradeModal?.urls?.upgrade;
                                if (upgradeUrl) {
                                    window.open(upgradeUrl, '_blank');
                                }
                            }
                        }, __('Upgrade to Pro', 'fotogrids')),
                        h('button', {
                            type: 'button',
                            className: 'fotogrids-button fotogrids-button--secondary',
                            onClick: () => {
                                window.open(`https://go.fotogrids.com/feature-${group.id}`, '_blank');
                            }
                        }, __('Learn more', 'fotogrids'))
                    ])
                ])
            ]);
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
                return h('div', {
                    className: 'fotogrids-settings-group'
                }, [
                    h('div', {
                        className: 'fotogrids-settings-group__content'
                    }, (group.settings || []).filter(s => !s?.hidden).map(renderSetting))
                ]);
            }

            // If only one sub-tab is available, render its content directly without wrapper
            if (availableSubTabs.length === 1) {
                const singleSubTab = availableSubTabs[0];
                return h('div', {
                    className: 'fotogrids-settings-group'
                }, [
                    h('div', {
                        className: 'fotogrids-settings-group__content'
                    }, (singleSubTab.settings || []).filter(s => !s?.hidden).map(renderSetting))
                ]);
            }

            // Prefer the previously-selected subtab if it's still visible;
            // otherwise fall back to the first available one.
            const previouslyActive = getActiveSubTab(groupContextKey, null);
            const previouslyActiveStillVisible = availableSubTabs.some(s => s.id === previouslyActive);
            const currentActiveSubTab = previouslyActiveStillVisible
                ? previouslyActive
                : availableSubTabs[0].id;

            return h('div', {
                className: 'fotogrids-settings-group fotogrids-settings-group--with-subtabs'
            }, [

                h('div', {
                    className: 'fotogrids-subtabs-nav'
                }, availableSubTabs.map(subTab =>
                    h('button', {
                        key: subTab.id,
                        type: 'button',
                        className: `fotogrids-subtab ${currentActiveSubTab === subTab.id ? 'fg-is-active' : ''}`,
                        onClick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveSubTabForContext(groupContextKey, subTab.id);
                        }
                    }, [
                        h('span', {
                            className: 'fotogrids-subtab__icon'
                        }, renderIcon(subTab.icon)),
                        h('span', {
                            className: 'fotogrids-subtab__label'
                        }, subTab.label)
                    ])
                )),

                h('div', {
                    className: 'fotogrids-subtab-content'
                }, [
                    h('div', {
                        className: 'fotogrids-settings-group__content'
                    }, (group.subTabs[currentActiveSubTab]?.settings || []).filter(s => !s?.hidden).map(renderSetting) || [])
                ])
            ]);
        }

        // Plain tab — flat settings list with section-level visible_when filtering.
        const visibleSettings = (group.settings || [])
            .filter(s => !s?.hidden)
            .filter(s => evaluateVisibleWhen(s?.visible_when));

        return [
            renderDocumentationStrip(),
            h('div', {
                className: 'fotogrids-settings-group'
            }, [
                h('div', {
                    className: 'fotogrids-settings-group__content'
                }, visibleSettings.map(renderSetting))
            ])
        ].filter(Boolean);
    };

    if (!settingsLoaded) {
        const _fgId = 'cs' + Math.random().toString(36).slice(2, 8);
        return h('div', {
            className: 'fotogrids-gallery-settings fotogrids-gallery-settings--loading'
        }, [
            h('div', { className: 'fotogrids-loading-screen' }, [
                h('span', {
                    className: 'fotogrids-loading-screen__icon',
                    'aria-hidden': 'true',
                    dangerouslySetInnerHTML: { __html: '<svg width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><rect x="0" y="0" width="0" height="6"><animate id="fg_ia_fotogrids_1___' + _fgId + '__" begin="0;fg_ia_fotogrids_10___' + _fgId + '__.end-0.3s" attributeName="width" dur="0.4s" values="0;24" fill="freeze"/><animate begin="fg_ia_fotogrids_6___' + _fgId + '__.end-0.2s" attributeName="width" dur="0.4s" values="24;0" fill="freeze"/><animate id="fg_ia_fotogrids_2___' + _fgId + '__" begin="fg_ia_fotogrids_6___' + _fgId + '__.end-0.2s" attributeName="x" dur="0.4s" values="0;24"/></rect><rect x="0" y="9" width="0" height="6"><animate id="fg_ia_fotogrids_3___' + _fgId + '__" begin="fg_ia_fotogrids_1___' + _fgId + '__.end-0.2s" attributeName="width" dur="0.4s" values="0;15" fill="freeze"/><animate begin="fg_ia_fotogrids_2___' + _fgId + '__.end-0.2s" attributeName="width" dur="0.4s" values="15;0" fill="freeze"/><animate id="fg_ia_fotogrids_7___' + _fgId + '__" begin="fg_ia_fotogrids_2___' + _fgId + '__.end-0.2s" attributeName="x" dur="0.4s" values="0;15"/></rect><rect x="0" y="18" width="0" height="6"><animate id="fg_ia_fotogrids_4___' + _fgId + '__" begin="fg_ia_fotogrids_3___' + _fgId + '__.end-0.2s" attributeName="width" dur="0.2s" values="0;6" fill="freeze"/><animate begin="fg_ia_fotogrids_7___' + _fgId + '__.end-0.1s" attributeName="width" dur="0.2s" values="6;0" fill="freeze"/><animate id="fg_ia_fotogrids_8___' + _fgId + '__" begin="fg_ia_fotogrids_7___' + _fgId + '__.end-0.1s" attributeName="x" dur="0.2s" values="0;6"/></rect><rect x="9" y="18" width="6" height="0"><animate id="fg_ia_fotogrids_5___' + _fgId + '__" begin="fg_ia_fotogrids_4___' + _fgId + '__.end+0.1s" attributeName="height" dur="0.2s" values="0;6" fill="freeze"/><animate begin="fg_ia_fotogrids_4___' + _fgId + '__.end+0.1s" attributeName="y" dur="0.2s" values="24;18" fill="freeze"/><animate id="fg_ia_fotogrids_9___' + _fgId + '__" begin="fg_ia_fotogrids_8___' + _fgId + '__.end+0.1s" attributeName="height" dur="0.2s" values="6;0" fill="freeze"/><animate begin="fg_ia_fotogrids_9___' + _fgId + '__.end+0.1s" attributeName="y" dur="0" values="18;24"/></rect><rect x="18" y="9" width="6" height="0"><animate begin="fg_ia_fotogrids_5___' + _fgId + '__.end+0.1s" attributeName="height" dur="0.4s" values="0;15" fill="freeze"/><animate id="fg_ia_fotogrids_6___' + _fgId + '__" begin="fg_ia_fotogrids_5___' + _fgId + '__.end+0.1s" attributeName="y" dur="0.4s" values="24;9" fill="freeze"/><animate id="fg_ia_fotogrids_10___' + _fgId + '__" begin="fg_ia_fotogrids_9___' + _fgId + '__.end-0.1s" attributeName="height" dur="0.4s" values="15;0" fill="freeze"/><animate begin="fg_ia_fotogrids_10___' + _fgId + '__.end" attributeName="y" dur="0" values="9;24"/></rect></svg>' }
                }),
                h('span', { className: 'fotogrids-loading-screen__label' }, 'Loading settings...')
            ])
        ]);
    }

    return h('div', {
        className: 'fotogrids-gallery-settings'
    }, [

        h('div', {
            className: 'fotogrids-settings-sidebar',
            key: 'sidebar'
        }, [
            h('div', {
                className: 'fotogrids-settings-tabs'
            }, Object.values(SETTINGS_GROUPS).filter(group => shouldDisplayTab(group)).map(group =>
                h('button', {
                    key: group.id,
                    type: 'button',
                    className: `fotogrids-settings-tab ${activeTab === group.id ? 'fg-is-active' : ''} ${!isFreeTier(group) && !isProActive ? 'is-pro' : ''}`,
                    onClick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTab(group.id);
                        if (uiState) {
                            uiState.setValue({ key: 'main-tab', value: group.id, urlParam: 'fg-settings-tab' });
                        }
                    }
                }, [
                    h('span', {
                        className: 'fotogrids-settings-tab__icon'
                    }, renderIcon(group.icon)),
                    h('span', {
                        className: 'fotogrids-settings-tab__label'
                    }, group.label),
                    !isFreeTier(group) && !isProActive && h('span', {
                        className: 'fotogrids-pro-badge'
                    }, __('Pro', 'fotogrids'))
                ])
            ))
        ]),

        h('div', {
            className: 'fotogrids-settings-content',
            key: 'content'
        }, (() => {
            const tabContent = renderTabContent(activeTab);
            return Array.isArray(tabContent) ? tabContent : [tabContent];
        })()),

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
            __
        })
    ]);
}

function initializeCollectionSettings() {
    const container = document.getElementById('fotogrids-collection-settings-root');

    if (container && window.wp && window.wp.element) {
        const { render } = wp.element;
        render(h(CollectionSettings), container);
    } else {
        setTimeout(initializeCollectionSettings, 100);
    }
}

window.FotoGridsCollectionSettings.CollectionSettings = CollectionSettings;

document.addEventListener('DOMContentLoaded', () => {
    initializeCollectionSettings();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        initializeCollectionSettings();
    }, 0);
}
