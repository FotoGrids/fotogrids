const { createElement: h, useState, useEffect } = wp.element;
const { 
    Panel, 
    PanelBody, 
    SelectControl, 
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

const translateSettingsGroup = (group) => {
    const translated = { ...group };

    if (translated.label) {
        translated.label = __(translated.label, 'fotogrids');
    }

    if (translated.settings) {
        translated.settings = translated.settings.map(setting => {
            const translatedSetting = { ...setting };

            if (translatedSetting.label) {
                translatedSetting.label = __(translatedSetting.label, 'fotogrids');
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
                        subTab.settings = subTab.settings.map(subSetting => translateSettingsGroup({ settings: [subSetting] }).settings[0]);
                    }
                });
            }

            return translatedSetting;
        });
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

function GallerySettings() {
    const [activeTab, setActiveTab] = useState('layout');
    const [activeSubTab, setActiveSubTab] = useState('layout_styling');
    const [settings, setSettings] = useState(window.fotogridsSettings?.settings || {});
    const [saving, setSaving] = useState(false);
    const [activeDevice, setActiveDevice] = useState('desktop');
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    const [imageData, setImageData] = useState({});
    const [loadingImages, setLoadingImages] = useState(false);
    const [imageError, setImageError] = useState(null);
    const [savingImages, setSavingImages] = useState({});
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkAction, setBulkAction] = useState('');
    const [bulkUrl, setBulkUrl] = useState('');
    const [bulkTarget, setBulkTarget] = useState('global');

    const isProActive = window.fotogridsSettings?.isProActive || false;
    const galleryImages = window.fotogridsSettings?.galleryImages || [];
    const canEditPosts = window.fotogridsSettings?.canEditPosts !== false;

    const loadAndTranslateSettings = async () => {
        console.log('loadAndTranslateSettings called');
        console.log('FotoGridsSettings available:', !!window.FotoGridsSettings);
        console.log('loadSettingsGroups available:', !!window.FotoGridsSettings?.loadSettingsGroups);

        if (window.FotoGridsSettings?.loadSettingsGroups) {
            try {
                console.log('Starting to load settings...');
                const rawSettings = await window.FotoGridsSettings.loadSettingsGroups();
                console.log('Raw settings loaded:', rawSettings);
                SETTINGS_GROUPS = {};
                
                Object.keys(rawSettings).forEach(key => {
                    SETTINGS_GROUPS[key] = translateSettingsGroup(rawSettings[key]);
                });
                console.log('Translated SETTINGS_GROUPS:', SETTINGS_GROUPS);
            } catch (error) {
                console.warn('Failed to load settings from JSON files, using fallback:', error);
            }
        } else {
            console.warn('Settings loader not available, SETTINGS_GROUPS will be empty');
        }
        setSettingsLoaded(true);
    };

    useEffect(() => {
        loadAndTranslateSettings();
    }, []);

    useEffect(() => {
        if (settings.image_click_behavior === 'external' && canEditPosts && galleryImages.length > 0) {
            loadImageData();
        }
    }, [settings.image_click_behavior, galleryImages.length, canEditPosts]);

    const loadImageData = async () => {
        try {
            setLoadingImages(true);
            setImageError(null);

            const params = new URLSearchParams();
            galleryImages.forEach(id => params.append('image_ids[]', id));

            const response = await fetch(`${window.wpApiSettings.root}fotogrids/v1/image-urls?${params.toString()}`, {
                headers: {
                    'X-WP-Nonce': window.wpApiSettings.nonce
                }
            });

            if (!response.ok) {
                throw new Error(__('Failed to load image data', 'fotogrids'));
            }

            const data = await response.json();
            setImageData(data);
        } catch (err) {
            setImageError(err.message);
        } finally {
            setLoadingImages(false);
        }
    };

    const updateImageUrl = async (imageId, url, target = null) => {
        try {
            setSavingImages(prev => ({ ...prev, [imageId]: true }));

            const updateData = { url };
            if (target !== null) {
                updateData.target = target;
            }

            const response = await fetch(`${window.wpApiSettings.root}fotogrids/v1/image-urls`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': window.wpApiSettings.nonce
                },
                body: JSON.stringify({
                    urls: {
                        [imageId]: updateData
                    }
                })
            });

            if (!response.ok) {
                throw new Error(__('Failed to save URL', 'fotogrids'));
            }

            setImageData(prev => ({
                ...prev,
                [imageId]: {
                    ...prev[imageId],
                    url: url,
                    target: target !== null ? target : prev[imageId]?.target || 'global'
                }
            }));
        } catch (err) {
            console.error('Error updating image URL:', err);
        } finally {
            setSavingImages(prev => ({ ...prev, [imageId]: false }));
        }
    };

    const bulkImageAction = async (action, url = '', target = 'global') => {
        try {
            setLoadingImages(true);

            const response = await fetch(`${window.wpApiSettings.root}fotogrids/v1/image-urls/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': window.wpApiSettings.nonce
                },
                body: JSON.stringify({
                    action: action,
                    image_ids: galleryImages,
                    url: url,
                    target: target
                })
            });

            if (!response.ok) {
                throw new Error(__('Bulk action failed', 'fotogrids'));
            }

            await loadImageData();
        } catch (err) {
            setImageError(err.message);
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
                return; // Don't proceed if URL is invalid
            }
            await bulkImageAction('apply_to_all', bulkUrl, bulkTarget);
        } else if (bulkAction === 'clear_all') {
            await bulkImageAction('clear_all');
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
            let input = document.querySelector(`input[name="fotogrids_${key}"]`);

            if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = `fotogrids_${key}`;
                document.getElementById('post').appendChild(input);
            } 

            if (typeof value === 'object' && value !== null) {
                input.value = JSON.stringify(value);
            } else {
                input.value = value;
            }

            if (window.FotoGridsAjaxSave && typeof window.FotoGridsAjaxSave.showUnsavedChanges === 'function') {
                window.FotoGridsAjaxSave.showUnsavedChanges();
            }
        } catch (error) {
            console.error('Error saving setting:', error);
        } finally {
            setSaving(false);
        }
    };

    const shouldDisplaySetting = (setting) => {
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

        const isDisabled = !setting.free && !isProActive;
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
                control = h(SelectControl, {
                    ...settingProps,
                    options: setting.options
                });
                break;

            case 'range':
                control = window.FotoGridsRenderSettings?.renderRange(setting, currentValue, isDisabled, {
                    updateSetting
                });
                break;

            case 'toggle':
                control = window.FotoGridsRenderSettings?.renderToggle(setting, currentValue, isDisabled, {
                    updateSetting
                });
                break;

            case 'responsive_range':
                control = window.FotoGridsRenderSettings?.renderResponsiveRange(setting, currentValue, isDisabled, {
                    updateSetting,
                    activeDevice,
                    setActiveDevice,
                    renderIcon,
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

            case 'button_group':
                control = window.FotoGridsRenderSettings?.renderButtonGroup(setting, currentValue, isDisabled, {
                    updateSetting,
                    renderIcon
                });
                break;

            case 'color':
                control = window.FotoGridsRenderSettings?.renderColorPicker(setting, currentValue, isDisabled, {
                    updateSetting
                });
                break;

            case 'section_header':
                return h('div', {
                    className: 'fotogrids-section-header'
                }, [
                    h('h4', {
                        className: 'fotogrids-section-header__title'
                    }, setting.label)
                ]);

            case 'range_with_units':
                control = window.FotoGridsRenderSettings?.renderRangeWithUnits(setting, currentValue, isDisabled, {
                    updateSetting
                });
                break;

            case 'lightbox_subtabs':
                control = window.FotoGridsRenderSettings?.renderLightboxSubTabs(setting, isDisabled, {
                    activeSubTab,
                    setActiveSubTab,
                    renderIcon,
                    renderSetting
                });
                break;

            case 'external_url_manager':
                control = window.FotoGridsRenderSettings?.renderExternalUrlManager(setting, isDisabled, {
                    settings,
                    canEditPosts,
                    loadingImages,
                    imageError,
                    loadImageData,
                    galleryImages,
                    imageData,
                    savingImages,
                    openBulkModal,
                    updateImageUrl,
                    validateUrl,
                    renderIcon,
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
            window.FotoGridsRenderSettings?.renderConditionalMessage(setting, currentValue),
            !setting.free && !isProActive && h('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge'
            }, __('Pro', 'fotogrids'))
        ].filter(Boolean));
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
                    className: 'fotogrids-pro-tab-content'
                }, [
                    h('div', {
                        className: 'fotogrids-pro-tab-header'
                    }, [
                        h('span', {
                            className: 'fotogrids-pro-tab-icon'
                        }, renderIcon(group.icon)),
                        h('h3', {}, group.label),
                        h('span', {
                            className: 'fotogrids-pro-badge-large'
                        }, __('Pro', 'fotogrids'))
                    ]),
                    h('div', {
                        className: 'fotogrids-pro-features-list'
                    }, [
                        h('h4', {}, __('Unlock these powerful features:', 'fotogrids')),
                        h('ul', {}, allSettings.map(setting => 
                            h('li', {
                                key: setting.key,
                                className: 'fotogrids-pro-feature'
                            }, [
                                h('span', {
                                    className: 'fotogrids-pro-feature-icon'
                                }, '✨'),
                                h('span', {}, setting.label)
                            ])
                        ))
                    ]),
                    h('div', {
                        className: 'fotogrids-pro-cta'
                    }, [
                        h('p', {}, __('Get access to advanced gallery features and take your galleries to the next level.', 'fotogrids')),
                        h(Button, {
                            variant: 'primary',
                            className: 'fotogrids-upgrade-button',
                            href: '#', // TODO: Add upgrade URL
                        }, __('Upgrade to FotoGrids Pro', 'fotogrids'))
                    ])
                ])
            ]);
        }

        if (group.subTabs) {
            return h('div', {
                className: 'fotogrids-settings-group fotogrids-settings-group--with-subtabs'
            }, [

                h('div', {
                    className: 'fotogrids-subtabs-nav'
                }, Object.values(group.subTabs).map(subTab => 
                    h('button', {
                        key: subTab.id,
                        type: 'button',
                        className: `fotogrids-subtab ${activeSubTab === subTab.id ? 'is-active' : ''}`,
                        onClick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveSubTab(subTab.id);
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
                    }, group.subTabs[activeSubTab]?.settings.map(renderSetting) || [])
                ])
            ]);
        }

        return h('div', {
            className: 'fotogrids-settings-group'
        }, [
            h('div', {
                className: 'fotogrids-settings-group__content'
            }, (group.settings || []).map(renderSetting))
        ]);
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
                    type: 'button', // Prevent form submission
                    className: `fotogrids-settings-tab ${activeTab === group.id ? 'is-active' : ''} ${!group.free && !isProActive ? 'is-pro' : ''}`,
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
                        className: 'fotogrids-settings-tab__pro'
                    }, __('Pro', 'fotogrids'))
                ])
            ))
        ]),

        h('div', {
            className: 'fotogrids-settings-content',
            key: 'content'
        }, [
            renderTabContent(activeTab)
        ]),        

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

function initializeGallerySettings() {
    const container = document.getElementById('fotogrids-gallery-settings-root');

    if (container && window.wp && window.wp.element) {
        const { render } = wp.element;
        render(h(GallerySettings), container);
    } else {
        setTimeout(initializeGallerySettings, 100);
    }
}

document.addEventListener('DOMContentLoaded', initializeGallerySettings);

if (window.jQuery) {
    jQuery(document).ready(initializeGallerySettings);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeGallerySettings, 0);
}
