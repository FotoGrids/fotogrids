window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderRange = (setting, currentValue, isDisabled, {
    updateSetting
}) => {
    const { createElement: h } = wp.element;
    
    return h('div', {
        className: 'fotogrids-range-control'
    }, [
        h('label', {
            className: 'fotogrids-setting__label'
        }, setting.label),
        h('input', {
            type: 'range',
            min: setting.min,
            max: setting.max,
            value: currentValue || setting.default || 0,
            onChange: (e) => updateSetting(setting.key, parseInt(e.target.value)),
            disabled: isDisabled,
            className: 'fotogrids-range-slider'
        })
    ]);
};
