window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderButtonGroup = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon,
    getFieldState,
    isDefaultsMode,
    getOptionState,
    __,
    buttonsClassName = ''
}) => {
    const { createElement: h } = wp.element;

    const filteredOptions = isDefaultsMode
        ? (setting.options || []).filter(option => !option.isGlobalDefault)
        : (setting.options || []);
    const settingState = typeof getFieldState === 'function'
        ? getFieldState(setting.key, currentValue)
        : 'editable';
    const showSettingBadge = settingState !== 'editable';
    const ProBadge = window.FotoGridsTooltip && window.FotoGridsTooltip.ProBadge;

    const buttonsContainerClass = 'fotogrids-button-group__buttons' + (buttonsClassName ? ' ' + buttonsClassName : '');

    return h('div', {
        className: 'fotogrids-button-group'
    }, [
        setting.label && h('label', {
            className: 'fotogrids-setting__label'
        }, [
            setting.label,
            showSettingBadge && ProBadge && h(ProBadge, {
                key: 'pro-badge',
                tier: setting.tier_required,
                state: settingState,
            })
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
            const optionState = typeof getOptionState === 'function'
                ? getOptionState(setting.key, option.value)
                : 'editable';
            const isPro = optionState !== 'editable';
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
                isPro && ProBadge && h(ProBadge, {
                    key: 'pro-badge',
                    tier: option.tier_required,
                    state: optionState,
                })
            ])
        })),
        setting.description && h('div', {
            className: 'fotogrids-setting__description',
            dangerouslySetInnerHTML: { __html: setting.description }
        })
    ].filter(Boolean));
};
