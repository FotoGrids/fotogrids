window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderRangeWithUnits = (setting, currentValue, isDisabled, {
    updateSetting
}) => {
    const { createElement: h } = wp.element;
    
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
