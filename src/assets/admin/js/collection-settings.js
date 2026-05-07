const { createElement: h, useState, useEffect, useLayoutEffect } = wp.element;
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
    const translated = { ...group };

    if (translated.label) {
        translated.label = __(translated.label, 'fotogrids');
        translated.label = replacePostTypePlaceholders(translated.label, normalizedPostType);
    }

    if (translated.settings) {
        translated.settings = translated.settings.map(setting => {
            let translatedSetting = { ...setting };

            if (translatedSetting.label) {
                translatedSetting.label = __(translatedSetting.label, 'fotogrids');
            }

            if (translatedSetting.description) {
                translatedSetting.description = __(translatedSetting.description, 'fotogrids');
            }

            if (translatedSetting.options) {
                translatedSetting.options = translatedSetting.options.map(option => ({
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
    const [activeTab, setActiveTab] = useState('layout');
    const [activeSubTabs, setActiveSubTabs] = useState({});
    const [settings, setSettings] = useState(window.fotogridsSettings?.settings || {});
    const [saving, setSaving] = useState(false);
    const [activeDevice, setActiveDevice] = useState('desktop');
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

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
        setActiveSubTabs(prev => ({
            ...prev,
            [contextKey]: subTabId
        }));
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

    const shouldDisplaySetting = (setting) => {
        // Filter by postType if specified
        if (setting.postTypes && Array.isArray(setting.postTypes)) {
            if (!setting.postTypes.includes(normalizedPostType)) {
                return false;
            }
        }

        if (!setting.condition) return true;

        const { dependsOn, values } = setting.condition;

        if (Array.isArray(dependsOn)) {
            return dependsOn.every((dep, index) => {
                const currentValue = settings[dep];
                const expectedValues = values[index];

                const dependentSetting = findSettingByKey(dep);
                if (dependentSetting && !shouldDisplaySetting(dependentSetting)) {
                    return false;
                }

                return Array.isArray(expectedValues)
                    ? expectedValues.includes(currentValue)
                    : expectedValues === currentValue;
            });
        } else {
            const dependentValue = settings[dependsOn];

            const dependentSetting = findSettingByKey(dependsOn);
            if (dependentSetting && !shouldDisplaySetting(dependentSetting)) {
                return false;
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

    const shouldDisplayTab = (group) => {
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
        if (!shouldDisplaySetting(setting)) {
            return null;
        }

        const isDisabled = !setting.free && !isProActive && setting.type !== 'promo';
        const currentValue = settings[setting.key];

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
                const selectOptions = isDefaultsMode
                    ? (setting.options || []).filter(option => !option.isGlobalDefault)
                    : (setting.options || []);
                control = h(SelectControl, {
                    ...settingProps,
                    options: selectOptions
                });
                break;

            case 'text_input':
                control = window.FotoGridsRenderSettings?.renderTextInput(setting, currentValue, isDisabled, {
                    updateSetting,
                    isProActive,
                    __
                });
                break;

            case 'range':
                control = window.FotoGridsRenderSettings?.renderRange(setting, currentValue, isDisabled, {
                    updateSetting,
                    isProActive,
                    __
                });
                break;

            case 'toggle':
                control = window.FotoGridsRenderSettings?.renderToggle(setting, currentValue, isDisabled, {
                    updateSetting,
                    isProActive,
                    __
                });
                break;

            case 'responsive_range':
                control = window.FotoGridsRenderSettings?.renderResponsiveRange(setting, currentValue, isDisabled, {
                    updateSetting,
                    activeDevice,
                    setActiveDevice,
                    renderIcon,
                    isProActive,
                    __
                });
                break;

            case 'layout_grid':
                control = window.FotoGridsRenderSettings?.renderLayoutGrid(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    isProActive,
                    __
                });
                break;

            case 'hover_effects_grid':
                control = window.FotoGridsRenderSettings?.renderHoverEffectsGrid(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    isProActive,
                    __,
                    settings
                });
                break;

            case 'button_group':
                control = window.FotoGridsRenderSettings?.renderButtonGroup(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    isProActive,
                    isDefaultsMode,
                    __
                });
                break;

            case 'alignment_grid':
                control = window.FotoGridsRenderSettings?.renderAlignmentGrid(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    isProActive,
                    isDefaultsMode,
                    __
                });
                break;

            case 'button_group_dynamic':
                control = window.FotoGridsRenderSettings?.renderButtonGroupDynamic(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    isProActive,
                    isDefaultsMode,
                    __
                });
                break;

            case 'image_size':
                control = window.FotoGridsRenderSettings?.renderImageSize(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    isProActive,
                    isDefaultsMode,
                    __
                });
                break;

            case 'color':
                control = window.FotoGridsRenderSettings?.renderColorPicker(setting, currentValue, isDisabled, {
                    updateSetting,
                    isProActive,
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
                    isProActive,
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
                    isProActive,
                    __
                });
                break;

            case 'setting_group':
                control = window.FotoGridsRenderSettings?.renderGroup(setting, currentValue, isDisabled, {
                    renderSetting,
                    isProActive,
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
                }, [], isDisabled, isProActive, __);
                break;

            case 'password_input':
                control = window.FotoGridsRenderSettings?.renderPasswordInput(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon,
                    isProActive,
                    __
                });
                break;

            case 'promo':
                control = window.FotoGridsRenderSettings?.renderPromo(setting, currentValue, isDisabled, {
                    isProActive,
                    __
                });
                break;

            default:
                return null;
        }

        return h('div', {
            key: setting.key,
            className: `fotogrids-setting ${isDisabled ? 'fotogrids-setting--disabled' : ''}`
        }, [
            control,
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

        if (!group.free && !isProActive) {
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
            const availableSubTabs = Object.values(group.subTabs);

            // If only one sub-tab is available, render its content directly without wrapper
            if (availableSubTabs.length === 1) {
                const singleSubTab = availableSubTabs[0];
                return h('div', {
                    className: 'fotogrids-settings-group'
                }, [
                    h('div', {
                        className: 'fotogrids-settings-group__content'
                    }, singleSubTab.settings?.map(renderSetting) || [])
                ]);
            }

            const currentActiveSubTab = getActiveSubTab(
                groupContextKey,
                Object.keys(group.subTabs)[0]
            );

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
                    }, group.subTabs[currentActiveSubTab]?.settings.map(renderSetting) || [])
                ])
            ]);
        }

        return [
            renderDocumentationStrip(),
            h('div', {
                className: 'fotogrids-settings-group'
            }, [
                h('div', {
                    className: 'fotogrids-settings-group__content'
                }, (group.settings || []).map(renderSetting))
            ])
        ].filter(Boolean);
    };

    if (!settingsLoaded) {
        return h('div', {
            className: 'fotogrids-gallery-settings fotogrids-gallery-settings--loading'
        }, [
            h('div', {
                className: 'fotogrids-loading-message'
            }, 'Loading settings...')
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
                    className: `fotogrids-settings-tab ${activeTab === group.id ? 'fg-is-active' : ''} ${!group.free && !isProActive ? 'is-pro' : ''}`,
                    onClick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTab(group.id);
                    }
                }, [
                    h('span', {
                        className: 'fotogrids-settings-tab__icon'
                    }, renderIcon(group.icon)),
                    h('span', {
                        className: 'fotogrids-settings-tab__label'
                    }, group.label),
                    !group.free && !isProActive && h('span', {
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
