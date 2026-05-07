window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderButtonGroup = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon,
    isProActive,
    isDefaultsMode,
    __,
    buttonsClassName = ''
}) => {
    const { createElement: h } = wp.element;

    const filteredOptions = isDefaultsMode
        ? (setting.options || []).filter(option => !option.isGlobalDefault)
        : (setting.options || []);

    const buttonsContainerClass = 'fotogrids-button-group__buttons' + (buttonsClassName ? ' ' + buttonsClassName : '');

    return h('div', {
        className: 'fotogrids-button-group'
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
        h('div', {
            className: buttonsContainerClass
        }, filteredOptions.map((option, index) => {
            if (!option) {
                return h('div', {
                    key: `empty-${index}`,
                    className: 'fotogrids-button-group__button--empty'
                });
            }
            const isPro = typeof option.free !== 'undefined' && !option.free && !isProActive;
            const buttonClass = (setting.buttonClass || '').trim();
            const buttonClassName = [
                'fotogrids-button-group__button',
                buttonClass,
                isPro ? 'fotogrids-button-group__button__pro' : '',
                currentValue === option.value ? 'fg-is-active' : ''
            ].filter(Boolean).join(' ');

            return h('button', {
                key: option.value,
                type: 'button',
                className: buttonClassName,
                onClick: () => !isDisabled && updateSetting(setting.key, option.value),
                disabled: isDisabled || isPro,
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
                    }, ` (${option.value}${option.unit})`),
                    option.note && h('span', {
                        className: 'fotogrids-button-note'
                    }, ` (${option.note})`)
                ].filter(Boolean)),
                isPro && h('span', {
                    className: 'fotogrids-pro-badge',
                    key: 'pro-badge'
                }, __('Pro', 'fotogrids'))
            ])
        })),
        setting.description && h('div', {
            className: 'fotogrids-setting__description',
            dangerouslySetInnerHTML: { __html: setting.description }
        })
    ].filter(Boolean));
};
