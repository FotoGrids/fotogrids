window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderTextInput = (setting, currentValue, isDisabled, {
    updateSetting,
    isProActive,
    __
}) => {
    const { createElement: h } = wp.element;

    return h('div', {
        className: 'fotogrids-text-input'
    }, [
        setting.label && h('label', {
            className: 'fotogrids-setting__label'
        }, [
            setting.label,
            !setting.free && !isProActive && h('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge'
            }, __('Pro', 'fotogrids'))
        ].filter(Boolean)),
        h('input', {
            type: 'text',
            className: 'fotogrids-input',
            value: currentValue || setting.default || '',
            placeholder: setting.placeholder || '',
            onChange: (e) => !isDisabled && updateSetting(setting.key, e.target.value),
            disabled: isDisabled
        }),
        setting.description && h('div', {
            className: 'fotogrids-setting__description'
        }, setting.description)
    ].filter(Boolean));
};
