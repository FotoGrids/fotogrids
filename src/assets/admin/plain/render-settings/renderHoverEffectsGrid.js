window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const getTemplateImageId = (() => {
    let imageId = null;

    return () => {
        if (imageId) {
            return imageId;
        }

        const totalImages = 35;
        const randomImageNumber = Math.floor(Math.random() * totalImages) + 1;
        const paddedNumber = String(randomImageNumber).padStart(2, '0');
        imageId = `fotogrids-tp-${paddedNumber}`;

        return imageId;
    };
})();

window.FotoGridsRenderSettings.renderHoverEffectsGrid = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon,
    getFieldState,
    getOptionState,
    __,
    settings = {}
}) => {
    const { createElement: h } = wp.element;
    const settingState = typeof getFieldState === 'function'
        ? getFieldState(setting.key, currentValue)
        : 'editable';
    const showSettingBadge = settingState !== 'editable';
    const settingBadgeText = settingState === 'locked' ? __('Locked', 'fotogrids') : __('Pro', 'fotogrids');

    const imageId = getTemplateImageId();
    const pluginUrl = window.fotogridsAdmin?.pluginUrl || '';

    const templateImage = {
        avif: `${pluginUrl}public/assets/template-demo/avif/${imageId}.avif`,
        jpg: `${pluginUrl}public/assets/template-demo/jpg/${imageId}.jpg`
    };

    const getCapabilityText = (option) => {
        const capabilities = [];
        if (option.capabilities?.title) capabilities.push(__('Title', 'fotogrids'));
        if (option.capabilities?.description) capabilities.push(__('Description', 'fotogrids'));
        if (capabilities.length === 0) return __('Compatible with all elements', 'fotogrids');
        return __('Compatible with: ', 'fotogrids') + capabilities.join(', ');
    };

    const getHoverEffectClass = (index) => {
        const effects = [
            'hover-effect-slide-up',      // Title always, description slides up on hover
            'hover-effect-fade-both',     // Both fade in on hover
            'hover-effect-slide-left',    // Description slides from left
            'hover-effect-scale',         // Title scales, description fades
            'hover-effect-rotate',        // Title rotates slightly, description appears
            'hover-effect-slide-right',   // Description slides from right
            'hover-effect-bounce',        // Title bounces, description fades
            'hover-effect-slide-down',    // Description slides down
            'hover-effect-opacity',       // Both change opacity
            'hover-effect-blur',          // Title blurs slightly, description appears
            'hover-effect-slide-diagonal', // Description slides diagonally
            'hover-effect-pulse',         // Title pulses, description fades

            'hover-effect-zoom',          // Title zooms, description appears
            'hover-effect-flip',          // Card flips to show description
            'hover-effect-3d',            // 3D transform effect
            'hover-effect-gradient',      // Gradient overlay appears
            'hover-effect-shine',         // Shine effect across
            'hover-effect-morph',         // Shapes morph
            'hover-effect-glitch',        // Subtle glitch effect
            'hover-effect-ripple',        // Ripple from center
            'hover-effect-shadow',        // Shadow expands
            'hover-effect-border',        // Border animates
            'hover-effect-glow',          // Glow effect
            'hover-effect-split',         // Split reveal
            'hover-effect-reveal',        // Reveal from center
            'hover-effect-slide-rotate',  // Slide and rotate
            'hover-effect-elastic',       // Elastic bounce
            'hover-effect-wobble',        // Wobble effect
            'hover-effect-shake',         // Shake effect
            'hover-effect-spin',          // Spin effect
            'hover-effect-flash',         // Flash effect
            'hover-effect-wave',          // Wave effect
            'hover-effect-spiral',        // Spiral effect
            'hover-effect-matrix',        // Matrix effect
            'hover-effect-neon',          // Neon glow
            'hover-effect-hologram'       // Hologram effect
        ];
        return effects[index % effects.length];
    };

    return h('div', {
        className: 'fotogrids-hover-effects-grid-setting'
    }, [
        h('label', {
            className: 'fotogrids-setting__label'
        }, [
            setting.label,
            showSettingBadge && h('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge'
            }, settingBadgeText)
        ].filter(Boolean)),

        h('div', {
            className: 'fotogrids-hover-effects-grid'
        }, setting.options.map((option, index) => {
            const isActive = currentValue === option.value;
            const optionState = typeof getOptionState === 'function'
                ? getOptionState(setting.key, option.value)
                : 'editable';
            const isDisabledOption = isDisabled || optionState !== 'editable';
            const isProOption = optionState === 'teaser';
            const isLockedOption = optionState === 'locked';
            const hoverEffectClass = getHoverEffectClass(index);

            const cursorValue = settings.hover_cursor_icon || 'pointer';

            return h('div', {
                key: option.value,
                className: `fotogrids-hover-effect-option ${isActive ? 'fg-is-active' : ''} ${isDisabledOption ? 'fg-is-disabled' : ''} ${hoverEffectClass}`,
                style: { cursor: cursorValue },
                onClick: () => {
                    if (!isDisabledOption) {
                        updateSetting(setting.key, option.value);
                    } else if (isProOption) {
                        if (window.FotoGridsUpgrade) {
                            window.FotoGridsUpgrade.launchForFeature.customCSS();
                        }
                    }
                }
            }, [
                h('div', {
                    className: `fotogrids-hover-effect-option__preview ${
                        settings.caption_placement === 'top' ? 'fotogrids-caption-placement-top' :
                        settings.caption_placement === 'bottom' ? 'fotogrids-caption-placement-bottom' :
                        'fotogrids-caption-placement-overlay'
                    } ${
                        settings.caption_alignment === 'left' ? 'fotogrids-caption-alignment-left' :
                        settings.caption_alignment === 'center' ? 'fotogrids-caption-alignment-center' :
                        settings.caption_alignment === 'right' ? 'fotogrids-caption-alignment-right' :
                        settings.caption_alignment === 'justify' ? 'fotogrids-caption-alignment-justify' :
                        'fotogrids-caption-alignment-center'
                    }`
                }, [
                    h('div', {
                        className: 'fotogrids-hover-effect-option__preview-bg'
                    }, [
                        h('picture', {}, [
                            h('source', {
                                srcSet: templateImage.avif,
                                type: 'image/avif'
                            }),
                            h('img', {
                                src: templateImage.jpg,
                                alt: '',
                                loading: 'lazy'
                            })
                        ])
                    ]),
                    h('div', {
                        className: 'fotogrids-hover-effect-option__preview-content'
                    }, [
                        option.capabilities?.title && h('h4', {
                            className: 'fotogrids-hover-effect-option__preview-title'
                        }, 'Item Title'),
                        option.capabilities?.description && h('p', {
                            className: 'fotogrids-hover-effect-option__preview-description'
                        }, 'Item description with a few lines of text to see how it looks.')
                    ].filter(Boolean))
                ]),

                h('div', {
                    className: 'fotogrids-hover-effect-option__content'
                }, [
                    h('div', {
                        className: 'fotogrids-hover-effect-option__info'
                    }, [
                        h('h4', {
                            className: 'fotogrids-hover-effect-option__name'
                        }, option.label),
                        h('p', {
                            className: 'fotogrids-hover-effect-option__description'
                        }, [
                            getCapabilityText(option),
                            h('div', {
                                className: 'fotogrids-hover-effect-option__capability-icons'
                            }, [
                                option.capabilities?.title && h('span', {
                                    className: 'fotogrids-capability-icon',
                                    title: __('Title', 'fotogrids')
                                }, 'Title'),
                                option.capabilities?.description && h('span', {
                                    className: 'fotogrids-capability-icon',
                                    title: __('Description', 'fotogrids')
                                }, 'Description'),
                                option.capabilities?.social && h('span', {
                                    className: 'fotogrids-capability-icon fotogrids-capability-icon--social',
                                    title: __('Social Icons', 'fotogrids')
                                }, 'S'),
                                option.capabilities?.button && h('span', {
                                    className: 'fotogrids-capability-icon',
                                    title: __('Action Button', 'fotogrids')
                                }, 'B')
                            ]),
                        ])
                    ])
                ]),

                (isProOption || isLockedOption) && h('span', {
                    className: 'fotogrids-pro-badge fotogrids-pro-badge__absolute'
                }, isLockedOption ? __('Locked', 'fotogrids') : __('Pro', 'fotogrids'))
            ]);
        }))
    ]);
};
