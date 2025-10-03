window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderLayoutGrid = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon,
    isProActive,
    __
}) => {
    const { createElement: h } = wp.element;
    
    return h('div', {
        className: 'fotogrids-layout-grid-setting'
    }, [

        h('label', {
            className: 'fotogrids-layout-grid-setting__label'
        }, setting.label),
        

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
                    } else if (!option.free && !isProActive) {
                        // Launch upgrade modal for pro layouts
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

                !option.free && h('span', {
                    className: 'fotogrids-pro-badge fotogrids-pro-badge__absolute'
                }, __('Pro', 'fotogrids'))
            ]);
        }))
    ]);
};
