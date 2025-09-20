/**
 * Gallery Settings React Component
 * 
 * A tabbed settings interface for gallery configuration with Free/Pro features
 */

const { createElement: h, useState, useEffect } = wp.element;
const { 
    Panel, 
    PanelBody, 
    SelectControl, 
    RangeControl,
    ToggleControl,
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

// Settings configuration based on fotogrids_full_plan.md
const SETTINGS_GROUPS = {
    layout: {
        id: 'layout',
        label: __('Layout & Display', 'fotogrids'),
        icon: 'layout',
        free: true,
        settings: [
            {
                key: 'layout',
                type: 'layout_grid',
                label: __('Layout Type', 'fotogrids'),
                options: [
                    { 
                        label: __('Grid', 'fotogrids'), 
                        value: 'grid', 
                        icon: 'layout_grid',
                        description: __('Evenly spaced grid layout', 'fotogrids'),
                        free: true 
                    },
                    { 
                        label: __('Masonry', 'fotogrids'), 
                        value: 'masonry', 
                        icon: 'layout_masonry',
                        description: __('Pinterest-style masonry layout', 'fotogrids'),
                        free: true 
                    },
                    { 
                        label: __('Justified', 'fotogrids'), 
                        value: 'justified', 
                        icon: 'layout_justified',
                        description: __('Justified rows with equal heights', 'fotogrids'),
                        free: true 
                    },
                    { 
                        label: __('Video', 'fotogrids'), 
                        value: 'video', 
                        icon: 'layout_video',
                        description: __('Large video with thumbnail gallery', 'fotogrids'),
                        free: false 
                    },
                    { 
                        label: __('Carousel', 'fotogrids'), 
                        value: 'carousel', 
                        icon: 'layout_carousel',
                        description: __('Horizontal scrolling carousel', 'fotogrids'),
                        free: false 
                    },
                    { 
                        label: __('Slider', 'fotogrids'), 
                        value: 'slider', 
                        icon: 'layout_slider',
                        description: __('Full-width image slider', 'fotogrids'),
                        free: false 
                    }
                ],
                free: true
            },
            {
                key: 'columns',
                type: 'responsive_range',
                label: __('Columns', 'fotogrids'),
                responsive: {
                    desktop: { min: 1, max: 12, default: 4 },
                    tablet: { min: 1, max: 6, default: 3 },
                    mobile: { min: 1, max: 4, default: 2 }
                },
                free: true
            },
            {
                key: 'image_spacing',
                type: 'responsive_range',
                label: __('Image Spacing (px)', 'fotogrids'),
                responsive: {
                    desktop: { min: 0, max: 50, default: 10 },
                    tablet: { min: 0, max: 40, default: 8 },
                    mobile: { min: 0, max: 30, default: 5 }
                },
                free: true
            }
        ]
    },
    interactions: {
        id: 'interactions',
        label: __('Interactions', 'fotogrids'),
        icon: 'click',
        free: true,
        settings: [
            {
                key: 'image_click_behavior',
                type: 'button_group',
                label: __('Image Click Behavior', 'fotogrids'),
                options: [
                    { 
                        label: __('Do Nothing', 'fotogrids'), 
                        value: 'nothing',
                        icon: 'click_nothing'
                    },
                    { 
                        label: __('Open in Lightbox', 'fotogrids'), 
                        value: 'lightbox',
                        icon: 'click_lightbox'
                    },
                    { 
                        label: __('Direct Link to Image', 'fotogrids'), 
                        value: 'direct',
                        icon: 'click_direct'
                    },
                    { 
                        label: __('External URL', 'fotogrids'), 
                        value: 'external',
                        icon: 'click_external'
                    }
                ],
                free: true,
                conditionalMessage: {
                    condition: { values: ['external'] },
                    message: __('Each image URL should be defined in the image editing modal.', 'fotogrids')
                }
            },
            
            // Lightbox General Settings
            {
                key: 'lightbox_theme',
                type: 'button_group',
                label: __('Lightbox Theme', 'fotogrids'),
                options: [
                    { label: __('Dark', 'fotogrids'), value: 'dark', icon: 'theme_dark' },
                    { label: __('Light', 'fotogrids'), value: 'light', icon: 'theme_light' },
                    { label: __('Custom', 'fotogrids'), value: 'custom', icon: 'theme_custom' }
                ],
                condition: { dependsOn: 'image_click_behavior', values: ['lightbox'] },
                free: true
            },
            {
                key: 'lightbox_custom_color',
                type: 'color',
                label: __('Custom Theme Color', 'fotogrids'),
                condition: { dependsOn: 'lightbox_theme', values: ['custom'] },
                free: true
            },
            {
                key: 'lightbox_transition',
                type: 'button_group',
                label: __('Transition Between Images', 'fotogrids'),
                options: [
                    { label: __('Fade', 'fotogrids'), value: 'fade', icon: 'transition_fade' },
                    { label: __('Horizontal', 'fotogrids'), value: 'horizontal', icon: 'transition_horizontal' },
                    { label: __('Vertical', 'fotogrids'), value: 'vertical', icon: 'transition_vertical' },
                    { label: __('None', 'fotogrids'), value: 'none', icon: 'x' }
                ],
                condition: { dependsOn: 'image_click_behavior', values: ['lightbox'] },
                free: true
            },
            {
                key: 'lightbox_transition_duration',
                type: 'select',
                label: __('Transition Duration', 'fotogrids'),
                options: [
                    { label: __('Fast (150ms)', 'fotogrids'), value: 150 },
                    { label: __('Normal (300ms)', 'fotogrids'), value: 300 },
                    { label: __('Slow (450ms)', 'fotogrids'), value: 450 },
                    { label: __('Custom', 'fotogrids'), value: 'custom' }
                ],
                condition: { dependsOn: 'lightbox_transition', values: ['fade', 'horizontal', 'vertical'] },
                free: true
            },
            {
                key: 'lightbox_transition_duration_custom',
                type: 'range',
                label: __('Custom Duration (ms)', 'fotogrids'),
                min: 0,
                max: 1000,
                condition: { dependsOn: 'lightbox_transition_duration', values: ['custom'] },
                free: true
            },
            {
                key: 'lightbox_auto_progress',
                type: 'toggle',
                label: __('Auto Progress', 'fotogrids'),
                condition: { dependsOn: 'image_click_behavior', values: ['lightbox'] },
                free: true
            },
            {
                key: 'lightbox_auto_progress_delay',
                type: 'range',
                label: __('Auto Progress Delay (seconds)', 'fotogrids'),
                min: 1,
                max: 20,
                condition: { dependsOn: 'lightbox_auto_progress', values: [true, '1'] },
                free: true
            },
            {
                key: 'lightbox_fit_media',
                type: 'toggle',
                label: __('Fit Media to Screen', 'fotogrids'),
                condition: { dependsOn: 'image_click_behavior', values: ['lightbox'] },
                free: true
            },
            {
                key: 'lightbox_mobile_layout',
                type: 'button_group',
                label: __('Mobile Layout', 'fotogrids'),
                options: [
                    { label: __('Mobile Optimized', 'fotogrids'), value: 'mobile_optimized', icon: 'mobile_optimized' },
                    { label: __('Same as Desktop', 'fotogrids'), value: 'same_as_desktop', icon: 'mobile_desktop' }
                ],
                condition: { dependsOn: 'image_click_behavior', values: ['lightbox'] },
                free: true
            },
            
            // Lightbox Controls Settings
            {
                key: 'lightbox_show_arrows',
                type: 'toggle',
                label: __('Show Navigation Arrows', 'fotogrids'),
                condition: { dependsOn: 'image_click_behavior', values: ['lightbox'] },
                free: true
            },
            {
                key: 'lightbox_arrow_icon',
                type: 'button_group',
                label: __('Arrow Icon Style', 'fotogrids'),
                options: [
                    { label: '', value: 'chevron', icon: 'chevron' },
                    { label: '', value: 'arrow', icon: 'arrow' },
                    { label: '', value: 'triangle', icon: 'triangle' }
                ],
                condition: { dependsOn: 'lightbox_show_arrows', values: [true, '1'] },
                free: true
            },
            {
                key: 'lightbox_arrow_size',
                type: 'range',
                label: __('Arrow Size', 'fotogrids'),
                min: 0,
                max: 120,
                condition: { dependsOn: 'lightbox_show_arrows', values: [true, '1'] },
                free: true
            },
            {
                key: 'lightbox_arrow_color',
                type: 'color',
                label: __('Arrow Color', 'fotogrids'),
                condition: { dependsOn: 'lightbox_show_arrows', values: [true, '1'] },
                free: true
            },
            {
                key: 'lightbox_show_dots',
                type: 'toggle',
                label: __('Show Navigation Dots', 'fotogrids'),
                condition: { dependsOn: 'image_click_behavior', values: ['lightbox'] },
                free: true
            },
            {
                key: 'lightbox_dot_style',
                type: 'button_group',
                label: __('Dot Style', 'fotogrids'),
                options: [
                    { label: '', value: 'fill', icon: 'dot_fill' },
                    { label: '', value: 'stroke', icon: 'dot_stroke' },
                    { label: '', value: 'square', icon: 'dot_square' },
                    { label: '', value: 'square_stroke', icon: 'dot_square_stroke' }
                ],
                condition: { dependsOn: 'lightbox_show_dots', values: [true, '1'] },
                free: true
            },
            {
                key: 'lightbox_dot_color',
                type: 'color',
                label: __('Dot Color', 'fotogrids'),
                condition: { dependsOn: 'lightbox_show_dots', values: [true, '1'] },
                free: true
            },
            {
                key: 'lightbox_active_dot_color',
                type: 'color',
                label: __('Active Dot Color', 'fotogrids'),
                condition: { dependsOn: 'lightbox_show_dots', values: [true, '1'] },
                free: true
            },
            {
                key: 'lightbox_dots_spacing',
                type: 'range_with_units',
                label: __('Space Between Dots', 'fotogrids'),
                min: 0,
                max: 30,
                default: 8,
                units: ['px', 'em', 'rem', '%'],
                condition: { dependsOn: 'lightbox_show_dots', values: [true, '1'] },
                free: true
            }
        ]
    },
    styling: {
        id: 'styling',
        label: __('Styling', 'fotogrids'),
        icon: 'styling',
        free: false,
        settings: [
            {
                key: 'hover_effects',
                type: 'select',
                label: __('Hover Effects', 'fotogrids'),
                options: [
                    { label: __('None', 'fotogrids'), value: 'none' },
                    { label: __('Zoom', 'fotogrids'), value: 'zoom' },
                    { label: __('Fade', 'fotogrids'), value: 'fade' },
                    { label: __('Slide Up', 'fotogrids'), value: 'slideup' }
                ],
                free: false
            },
            {
                key: 'border_radius',
                type: 'range',
                label: __('Border Radius (px)', 'fotogrids'),
                min: 0,
                max: 50,
                free: false
            },
            {
                key: 'shadow',
                type: 'range',
                label: __('Shadow Intensity', 'fotogrids'),
                min: 0,
                max: 10,
                free: false
            }
        ]
    },
    effects: {
        id: 'effects',
        label: __('Effects', 'fotogrids'),
        icon: 'effects',
        free: true,
        settings: [],
    },
    behavior: {
        id: 'behavior',
        label: __('Behavior', 'fotogrids'),
        icon: 'behavior',
        free: true,
        settings: [
            {
                key: 'lightbox',
                type: 'toggle',
                label: __('Enable Lightbox', 'fotogrids'),
                free: true
            },
            {
                key: 'captions',
                type: 'toggle',
                label: __('Show Captions', 'fotogrids'),
                free: true
            },
            {
                key: 'lazy',
                type: 'toggle',
                label: __('Lazy Loading', 'fotogrids'),
                free: true
            },
            {
                key: 'animation',
                type: 'select',
                label: __('Load Animation', 'fotogrids'),
                options: [
                    { label: __('None', 'fotogrids'), value: 'none' },
                    { label: __('Fade In', 'fotogrids'), value: 'fadein' },
                    { label: __('Slide In', 'fotogrids'), value: 'slidein' },
                    { label: __('Scale In', 'fotogrids'), value: 'scalein' }
                ],
                free: false
            }
        ]
    },
    advanced: {
        id: 'advanced',
        label: __('Advanced', 'fotogrids'),
        icon: 'advanced',
        free: false,
        settings: [
            // Advanced settings would go here
            // This is a placeholder for future Pro features
        ]
    }
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
    const [settings, setSettings] = useState(window.fotogridsSettings?.settings || {});
    const [saving, setSaving] = useState(false);
    const [activeDevice, setActiveDevice] = useState('desktop');
    
    const isProActive = window.fotogridsSettings?.isProActive || false;
    
    const updateSetting = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
        
        // Auto-save setting
        saveSetting(key, value);
    };
    
    const saveSetting = async (key, value) => {
        setSaving(true);
        
        try {
            // Create hidden input to save with WordPress post
            let input = document.querySelector(`input[name="fotogrids_${key}"]`);
            if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = `fotogrids_${key}`;
                document.getElementById('post').appendChild(input);
            }
            
            // Convert objects to JSON strings for responsive settings
            if (typeof value === 'object' && value !== null) {
                input.value = JSON.stringify(value);
            } else {
                input.value = value;
            }
            
            // Show unsaved changes indicator
            if (window.FotoGridsAjaxSave && typeof window.FotoGridsAjaxSave.showUnsavedChanges === 'function') {
                window.FotoGridsAjaxSave.showUnsavedChanges();
            }
        } catch (error) {
            console.error('Error saving setting:', error);
        } finally {
            setSaving(false);
        }
    };
    
    const renderResponsiveRange = (setting, currentValue, isDisabled) => {
        const defaults = window.fotogridsSettings?.defaults || {};
        const defaultResponsive = defaults[setting.key] || setting.responsive;
        
        const responsiveValue = currentValue && typeof currentValue === 'object' 
            ? currentValue 
            : {
                desktop: defaultResponsive.desktop || setting.responsive.desktop.default,
                tablet: defaultResponsive.tablet || setting.responsive.tablet.default,
                mobile: defaultResponsive.mobile || setting.responsive.mobile.default
            };
        
        const updateResponsiveValue = (device, value) => {
            const newValue = {
                ...responsiveValue,
                [device]: value
            };
            updateSetting(setting.key, newValue);
        };
        
        const devices = [
            { key: 'desktop', label: __('Desktop', 'fotogrids'), icon: 'responsive_desktop' },
            { key: 'tablet', label: __('Tablet', 'fotogrids'), icon: 'responsive_tablet' },
            { key: 'mobile', label: __('Mobile', 'fotogrids'), icon: 'responsive_mobile' }
        ];
        
        const activeDeviceData = devices.find(d => d.key === activeDevice);
        const currentDeviceValue = responsiveValue[activeDevice] || setting.responsive[activeDevice].default;
        
        return h('div', {
            className: 'fotogrids-responsive-setting'
        }, [
            // Header: Name + Device Icon
            h('div', {
                className: 'fotogrids-responsive-setting__header'
            }, [
                h('label', {
                    className: 'fotogrids-responsive-setting__label'
                }, setting.label),
                h('span', {
                    className: 'fotogrids-responsive-setting__device-icon'
                }, renderIcon(activeDeviceData.icon))
            ]),
            
            // Controls: Range Slider + Input Field + Device Button Group
            h('div', {
                className: 'fotogrids-responsive-setting__controls'
            }, [
                // Range slider
                h('div', {
                    className: 'fotogrids-responsive-setting__range'
                }, [
                    h('input', {
                        type: 'range',
                        min: setting.responsive[activeDevice].min,
                        max: setting.responsive[activeDevice].max,
                        value: currentDeviceValue,
                        onChange: (e) => updateResponsiveValue(activeDevice, parseInt(e.target.value)),
                        disabled: isDisabled,
                        className: 'fotogrids-responsive-range-slider'
                    })
                ]),
                
                // Input field
                h('div', {
                    className: 'fotogrids-responsive-setting__input'
                }, [
                    h('input', {
                        type: 'number',
                        min: setting.responsive[activeDevice].min,
                        max: setting.responsive[activeDevice].max,
                        value: currentDeviceValue,
                        onChange: (e) => updateResponsiveValue(activeDevice, parseInt(e.target.value) || setting.responsive[activeDevice].default),
                        disabled: isDisabled,
                        className: 'fotogrids-responsive-number-input'
                    })
                ]),
                
                // Device button group
                h('div', {
                    className: 'fotogrids-responsive-setting__devices'
                }, devices.map(device => 
                    h('button', {
                        key: device.key,
                        type: 'button',
                        className: `fotogrids-responsive-device-btn ${activeDevice === device.key ? 'is-active' : ''}`,
                        onClick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveDevice(device.key);
                        },
                        disabled: isDisabled,
                        title: device.label
                    }, renderIcon(device.icon))
                ))
            ])
        ]);
    };
    
    const renderLayoutGrid = (setting, currentValue, isDisabled) => {
        return h('div', {
            className: 'fotogrids-layout-grid-setting'
        }, [
            // Label
            h('label', {
                className: 'fotogrids-layout-grid-setting__label'
            }, setting.label),
            
            // Grid of layout options
            h('div', {
                className: 'fotogrids-layout-grid'
            }, setting.options.map(option => {
                const isActive = currentValue === option.value;
                const isDisabledOption = isDisabled || (!option.free && !isProActive);
                
                return h('div', {
                    key: option.value,
                    className: `fotogrids-layout-option ${isActive ? 'is-active' : ''} ${isDisabledOption ? 'is-disabled' : ''}`,
                    onClick: () => {
                        if (!isDisabledOption) {
                            updateSetting(setting.key, option.value);
                        }
                    }
                }, [
                    // Layout preview image
                    h('div', {
                        className: 'fotogrids-layout-option__preview'
                    }, [
                        h('div', {
                            className: 'fotogrids-layout-option__icon'
                        }, renderIcon(option.icon)),
                        
                        // Pro badge for non-free options
                        !option.free && h('span', {
                            className: 'fotogrids-layout-option__pro-badge'
                        }, __('Pro', 'fotogrids'))
                    ]),
                    
                    // Layout info
                    h('div', {
                        className: 'fotogrids-layout-option__info'
                    }, [
                        h('h4', {
                            className: 'fotogrids-layout-option__name'
                        }, option.label),
                        h('p', {
                            className: 'fotogrids-layout-option__description'
                        }, option.description)
                    ])
                ]);
            }))
        ]);
    };
    
    // Check if a setting should be displayed based on conditions
    const shouldDisplaySetting = (setting) => {
        if (!setting.condition) return true;
        
        const { dependsOn, values } = setting.condition;
        const dependentValue = settings[dependsOn];
        
        // Check if the dependent setting itself should be displayed
        // This handles nested dependencies (e.g., arrow settings depend on show_arrows, which depends on lightbox)
        const dependentSetting = findSettingByKey(dependsOn);
        if (dependentSetting && !shouldDisplaySetting(dependentSetting)) {
            return false;
        }
        
        return values.includes(dependentValue);
    };
    
    // Helper function to find a setting by key across all groups
    const findSettingByKey = (key) => {
        for (const groupId in SETTINGS_GROUPS) {
            const group = SETTINGS_GROUPS[groupId];
            const setting = group.settings.find(s => s.key === key);
            if (setting) return setting;
        }
        return null;
    };
    
    // Render button group control
    const renderButtonGroup = (setting, currentValue, isDisabled) => {
        return h('div', {
            className: 'fotogrids-button-group'
        }, [
            h('label', {
                className: 'fotogrids-setting__label'
            }, setting.label),
            h('div', {
                className: 'fotogrids-button-group__buttons'
            }, setting.options.map(option => 
                h('button', {
                    key: option.value,
                    type: 'button',
                    className: `fotogrids-button-group__button ${currentValue === option.value ? 'is-active' : ''}`,
                    onClick: () => !isDisabled && updateSetting(setting.key, option.value),
                    disabled: isDisabled,
                    title: option.label
                }, [
                    option.icon && h('span', {
                        className: 'fotogrids-button-icon'
                    }, renderIcon(option.icon)),
                    h('span', {
                        className: 'fotogrids-button-label'
                    }, option.label)
                ])
            ))
        ]);
    };
    
    // Render color picker control
    const renderColorPicker = (setting, currentValue, isDisabled) => {
        return h('div', {
            className: 'fotogrids-color-picker'
        }, [
            h('label', {
                className: 'fotogrids-setting__label'
            }, setting.label),
            h('div', {
                className: 'fotogrids-color-picker__input'
            }, [
                h('input', {
                    type: 'color',
                    value: currentValue || '#000000',
                    onChange: (e) => !isDisabled && updateSetting(setting.key, e.target.value),
                    disabled: isDisabled,
                    className: 'fotogrids-color-input'
                }),
                h('input', {
                    type: 'text',
                    value: currentValue || '#000000',
                    onChange: (e) => !isDisabled && updateSetting(setting.key, e.target.value),
                    disabled: isDisabled,
                    className: 'fotogrids-color-text',
                    pattern: '^#[0-9A-Fa-f]{6}$',
                    placeholder: '#000000'
                })
            ])
        ]);
    };
    
    // Render range with units control
    const renderRangeWithUnits = (setting, currentValue, isDisabled) => {
        const value = currentValue?.value || setting.default || 0;
        const unit = currentValue?.unit || setting.units[0];
        
        return h('div', {
            className: 'fotogrids-range-with-units'
        }, [
            h('label', {
                className: 'fotogrids-setting__label'
            }, setting.label),
            h('div', {
                className: 'fotogrids-range-with-units__controls'
            }, [
                h('input', {
                    type: 'range',
                    min: setting.min,
                    max: setting.max,
                    value: value,
                    onChange: (e) => !isDisabled && updateSetting(setting.key, {
                        value: parseInt(e.target.value),
                        unit: unit
                    }),
                    disabled: isDisabled,
                    className: 'fotogrids-range-slider'
                }),
                h('div', {
                    className: 'fotogrids-range-with-units__value'
                }, [
                    h('input', {
                        type: 'number',
                        min: setting.min,
                        max: setting.max,
                        value: value,
                        onChange: (e) => !isDisabled && updateSetting(setting.key, {
                            value: parseInt(e.target.value) || setting.default,
                            unit: unit
                        }),
                        disabled: isDisabled,
                        className: 'fotogrids-number-input'
                    }),
                    setting.units && h('select', {
                        value: unit,
                        onChange: (e) => !isDisabled && updateSetting(setting.key, {
                            value: value,
                            unit: e.target.value
                        }),
                        disabled: isDisabled,
                        className: 'fotogrids-units-select'
                    }, setting.units.map(unitOption =>
                        h('option', {
                            key: unitOption,
                            value: unitOption
                        }, unitOption)
                    ))
                ])
            ])
        ]);
    };
    
    // Render conditional message
    const renderConditionalMessage = (setting, currentValue) => {
        if (!setting.conditionalMessage) return null;
        
        const { condition, message } = setting.conditionalMessage;
        const shouldShow = condition.values.includes(currentValue);
        
        if (!shouldShow) return null;
        
        return h('div', {
            className: 'fotogrids-conditional-message'
        }, h('p', {
            className: 'description'
        }, message));
    };
    
    const renderSetting = (setting) => {
        // Check if setting should be displayed based on conditions
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
                control = h(RangeControl, {
                    ...settingProps,
                    min: setting.min,
                    max: setting.max
                });
                break;
                
            case 'toggle':
                control = h(ToggleControl, {
                    ...settingProps,
                    checked: currentValue === '1' || currentValue === true
                });
                break;
                
            case 'responsive_range':
                control = renderResponsiveRange(setting, currentValue, isDisabled);
                break;
                
            case 'layout_grid':
                control = renderLayoutGrid(setting, currentValue, isDisabled);
                break;
                
            case 'button_group':
                control = renderButtonGroup(setting, currentValue, isDisabled);
                break;
                
            case 'color':
                control = renderColorPicker(setting, currentValue, isDisabled);
                break;
                
            case 'range_with_units':
                control = renderRangeWithUnits(setting, currentValue, isDisabled);
                break;
                
            default:
                return null;
        }
        
        return h('div', {
            key: setting.key,
            className: `fotogrids-setting ${isDisabled ? 'fotogrids-setting--disabled' : ''}`
        }, [
            control,
            renderConditionalMessage(setting, currentValue),
            !setting.free && !isProActive && h('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge'
            }, __('Pro', 'fotogrids'))
        ].filter(Boolean));
    };
    
    const renderTabContent = (groupId) => {
        const group = SETTINGS_GROUPS[groupId];
        if (!group) return null;
        
        // Show promotional content for Pro tabs when Pro is not active
        if (!group.free && !isProActive) {
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
                        h('ul', {}, group.settings.map(setting => 
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
        
        // Show regular settings for free tabs or when Pro is active
        return h('div', {
            className: 'fotogrids-settings-group'
        }, [
            h('div', {
                className: 'fotogrids-settings-group__content'
            }, group.settings.map(renderSetting))
        ]);
    };
    
    return h('div', {
        className: 'fotogrids-gallery-settings'
    }, [
        // Sidebar with tabs
        h('div', {
            className: 'fotogrids-settings-sidebar',
            key: 'sidebar'
        }, [
            h('div', {
                className: 'fotogrids-settings-tabs'
            }, Object.values(SETTINGS_GROUPS).map(group => 
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
        
        // Content area
        h('div', {
            className: 'fotogrids-settings-content',
            key: 'content'
        }, [
            renderTabContent(activeTab)
        ])
    ]);
}

// Initialize the React component when DOM is ready
function initializeGallerySettings() {
    const container = document.getElementById('fotogrids-gallery-settings-root');
    
    if (container && window.wp && window.wp.element) {
        const { render } = wp.element;
        render(h(GallerySettings), container);
    } else {
        // Try again after a short delay
        setTimeout(initializeGallerySettings, 100);
    }
}

// Try multiple initialization methods
document.addEventListener('DOMContentLoaded', initializeGallerySettings);

// Also try when jQuery is ready (WordPress standard)
if (window.jQuery) {
    jQuery(document).ready(initializeGallerySettings);
}

// Also try immediate execution in case we're already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeGallerySettings, 0);
}
