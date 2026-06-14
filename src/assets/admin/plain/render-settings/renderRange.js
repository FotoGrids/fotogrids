window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderRange = (setting, currentValue, isDisabled, {
    updateSetting,
    getFieldState,
    __
}) => {
    const { createElement: h } = wp.element;

    const hasUnits = setting.units && Array.isArray(setting.units) && setting.units.length > 0;
    const settingState = typeof getFieldState === 'function'
        ? getFieldState(setting.key, currentValue)
        : 'editable';
    const showSettingBadge = settingState !== 'editable';
    const settingBadgeText = settingState === 'locked' ? __('Locked', 'fotogrids') : __('Pro', 'fotogrids');

    let value, unit;

    if (hasUnits) {
        value = (currentValue?.value !== undefined && currentValue?.value !== null) ? currentValue.value : (setting.default ?? 0);
        unit = currentValue?.unit || setting.units[0];
    } else {
        value = (currentValue !== undefined && currentValue !== null) ? currentValue : (setting.default ?? 0);
    }

    const updateValue = (newValue) => {
        if (hasUnits) {
            updateSetting(setting.key, {
                value: newValue,
                unit: unit
            });
        } else {
            updateSetting(setting.key, newValue);
        }
    };

    const updateUnit = (newUnit) => {
        if (hasUnits) {
            updateSetting(setting.key, {
                value: value,
                unit: newUnit
            });
        }
    };

    return h('div', {
        className: 'fotogrids-range-control'
    }, [
        h('label', {
            className: 'fotogrids-setting__label'
        }, [
            setting.label,
            setting.unit && h('span', {
                className: 'fotogrids-setting__unit'
            }, ` (${setting.unit})`),
            showSettingBadge && h('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge'
            }, settingBadgeText)
        ].filter(Boolean)),

        h('div', {
            className: 'fotogrids-range-control__controls'
        }, [
            h('input', {
                type: 'range',
                min: setting.min,
                max: setting.max,
                value: value,
                onChange: (e) => !isDisabled && updateValue(parseInt(e.target.value)),
                disabled: isDisabled,
                className: 'fotogrids-range-slider'
            }),
            h('div', {
                className: 'fotogrids-range-control__value'
            }, [
                h('input', {
                    type: 'number',
                    min: setting.min,
                    max: setting.max,
                    value: value,
                    onChange: (e) => { const v = parseInt(e.target.value); !isDisabled && updateValue(Number.isFinite(v) ? v : (setting.default ?? 0)); },
                    disabled: isDisabled,
                    className: 'fotogrids-range-number-input'
                }),
                hasUnits && (window.FotoGridsRenderSettings?.CustomUnitSelect && typeof React !== 'undefined'
                    ? React.createElement(window.FotoGridsRenderSettings.CustomUnitSelect, {
                        value: unit,
                        onChange: (e) => !isDisabled && updateUnit(e.target.value),
                        disabled: isDisabled,
                        className: 'fotogrids-units-select',
                        options: setting.units.map(unitOption => ({
                            value: unitOption,
                            label: unitOption
                        }))
                    })
                    : h('select', {
                        value: unit,
                        onChange: (e) => !isDisabled && updateUnit(e.target.value),
                        disabled: isDisabled,
                        className: 'fotogrids-units-select'
                    }, setting.units.map(unitOption =>
                        h('option', {
                            key: unitOption,
                            value: unitOption
                        }, unitOption)
                    ))
                )
            ].filter(Boolean))
        ]),

        setting.description && h('p', {
            className: 'fotogrids-setting__description'
        }, setting.description),
    ]);
};
