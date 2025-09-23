window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderToggle = (setting, currentValue, isDisabled, {
    updateSetting
}) => {
    const { createElement: h } = wp.element;
    
    const isChecked = currentValue === '1' || currentValue === true;
    
    return h('div', {
        className: 'fotogrids-toggle-control'
    }, [
        h('div', {
            className: 'fotogrids-toggle-wrapper'
        },
		[
            h('button', {
                type: 'button',
                className: `fotogrids-toggle ${isChecked ? 'is-checked' : ''}`,
                onClick: () => !isDisabled && updateSetting(setting.key, !isChecked),
                disabled: isDisabled,
                'aria-checked': isChecked,
                role: 'switch'
            }, [
                h('span', {
                    className: 'fotogrids-toggle-track'
                }),
                h('span', {
                    className: 'fotogrids-toggle-thumb'
                })
            ])
        ]),
		h('label', {
            className: 'fotogrids-setting__label'
        }, setting.label), 
    ]);
};
