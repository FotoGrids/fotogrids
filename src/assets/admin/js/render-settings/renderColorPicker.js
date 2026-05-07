window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderColorPicker = (setting, currentValue, isDisabled, {
    updateSetting,
    isProActive,
    __
}) => {
    const { createElement: h } = wp.element;
    
    return h('div', {
        className: 'fotogrids-color-picker'
    }, [
        h('label', {
            className: 'fotogrids-setting__label'
        }, [
            setting.label,
            !setting.free && !isProActive && h('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge'
            }, __('Pro', 'fotogrids'))
        ].filter(Boolean)),
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
