window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderLayoutGrid = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon,
    getFieldState,
    getOptionState,
    __
}) => {
    const { createElement: h } = wp.element;
    const settingState = typeof getFieldState === 'function'
        ? getFieldState(setting.key, currentValue)
        : 'editable';
    const showSettingBadge = settingState !== 'editable';
    const settingBadgeText = settingState === 'locked' ? __('Locked', 'fotogrids') : __('Pro', 'fotogrids');

    return h('div', {
        className: 'fotogrids-layout-grid-setting'
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
            className: 'fotogrids-layout-grid'
        }, setting.options.map(option => {
            const isActive = currentValue === option.value;
            const optionState = typeof getOptionState === 'function'
                ? getOptionState(setting.key, option.value)
                : 'editable';
            const isDisabledOption = isDisabled || optionState !== 'editable';
            const isProOption = optionState === 'teaser';
            const isLockedOption = optionState === 'locked';

            return h('div', {
                key: option.value,
                className: `fotogrids-layout-option ${isActive ? 'fg-is-active' : ''} ${isDisabledOption ? 'fg-is-disabled' : ''}`,
                onClick: () => {
                    if (!isDisabledOption) {
                        updateSetting(setting.key, option.value);
                    } else if (isProOption) {
                        if (window.FotoGridsUpgrade) {
                            window.FotoGridsUpgrade.launchForFeature.advancedLayouts();
                        }
                    }
                }
            }, [
                h('div', {
                    className: 'fotogrids-layout-option__preview'
                }, [
                    h('div', {
                        className: 'fotogrids-layout-option__icon'
                    }, renderIcon(option.icon)),
                ]),

                h('div', {
                    className: 'fotogrids-layout-option__info'
                }, [
                    h('h4', {
                        className: 'fotogrids-layout-option__name'
                    }, option.label),
                    h('p', {
                        className: 'fotogrids-layout-option__description'
                    }, option.description)
                ]),

                (isProOption || isLockedOption) && h('span', {
                    className: 'fotogrids-pro-badge fotogrids-pro-badge__absolute'
                }, isLockedOption ? __('Locked', 'fotogrids') : __('Pro', 'fotogrids'))
            ]);
        }))
    ]);
};
