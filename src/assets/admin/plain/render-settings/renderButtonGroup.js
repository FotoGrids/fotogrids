window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderButtonGroup = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon,
    getFieldState,
    isDefaultsMode,
    getOptionState,
    isOptionVisible,
    __,
    buttonsClassName = ''
}) => {
    const { createElement: h } = wp.element;

    const baseOptions = isDefaultsMode
        ? (setting.options || []).filter(option => !option.isGlobalDefault)
        : (setting.options || []);

    // Per-option `condition` evaluation. Lets an option opt out of the
    // current settings state (e.g. an aspect-ratio option that only makes
    // sense for a specific layout). Caller passes `isOptionVisible` which
    // wraps the same shouldDisplaySetting() the field-level conditions use.
    const filteredOptions = typeof isOptionVisible === 'function'
        ? baseOptions.filter(option => !option || isOptionVisible(option))
        : baseOptions;
    const settingState = typeof getFieldState === 'function'
        ? getFieldState(setting.key, currentValue)
        : 'editable';
    const showSettingBadge = settingState !== 'editable';
    const ProBadge = window.FotoGridsTooltip && window.FotoGridsTooltip.ProBadge;

    const baseClass = 'fg-button-group';
    const buttonsContainerClass = [
        `${baseClass}__buttons`,
        buttonsClassName,
    ].filter(Boolean).join(' ');

    const wrapperClassName = [
        'fotogrids-button-group',
        setting.bigIcons ? `${baseClass}--big-icons` : '',
        setting.sameWidth ? `${baseClass}--same-width` : '',
        setting.extraBigIcons ? `${baseClass}--extra-big-icons` : ''
    ].filter(Boolean).join(' ');

    return h('div', {
        className: wrapperClassName
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
                    className: `${baseClass}__button--empty`
                });
            }
            const optionState = typeof getOptionState === 'function'
                ? getOptionState(setting.key, option.value)
                : 'editable';
            const isPro = optionState !== 'editable';
            const buttonClassName = [
                `${baseClass}__button`,
                isPro ? `${baseClass}__button__pro` : '',
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
                    className: 'fg-button-icon'
                }, renderIcon(option.icon)),
                option.label && h('span', {
                    className: 'fg-button-label'
                }, [
                    option.label,
                    option.unit && h('span', {
                        className: 'fg-button-unit'
                    }, ` (${option.value}${option.unit})`),
                    option.note && h('span', {
                        className: 'fg-button-note'
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
