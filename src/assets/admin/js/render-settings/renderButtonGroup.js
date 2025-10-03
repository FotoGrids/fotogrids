window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderButtonGroup = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon
}) => {
    const { createElement: h } = wp.element;
    
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
                title: option.label || ''
            }, [
                option.icon && h('span', {
                    className: 'fotogrids-button-icon'
                }, renderIcon(option.icon)),
                option.label && h('span', {
                    className: 'fotogrids-button-label'
                }, [
                    option.label,
                    option.unit && h('span', {
                        className: 'fotogrids-button-unit'
                    }, ` (${option.value}${option.unit})`)
                ].filter(Boolean))
            ])
        ))
    ]);
};
