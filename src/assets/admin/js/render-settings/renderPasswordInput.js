const PasswordInputComponent = ({ setting, value, onChange, isDisabled, isProActive, renderIcon, __ }) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const displayValue = value || setting.default || '';
    const iconName = showPassword ? 'eye_off' : 'eye';
    const iconElement = renderIcon ? renderIcon(iconName) : null;

    return React.createElement('div', {
        className: 'fotogrids-password-input'
    }, [
        React.createElement('label', {
            key: 'label',
            className: 'fotogrids-setting__label'
        }, [
            setting.label,
            !setting.free && !isProActive && React.createElement('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge'
            }, __('Pro', 'fotogrids'))
        ].filter(Boolean)),
        React.createElement('div', {
            key: 'wrapper',
            className: 'fotogrids-password-input__wrapper'
        }, [
            React.createElement('input', {
                key: 'input',
                type: showPassword ? 'text' : 'password',
                value: displayValue,
                onChange: (e) => !isDisabled && onChange(e.target.value),
                disabled: isDisabled,
                className: 'fotogrids-input',
                placeholder: setting.placeholder || ''
            }),
            React.createElement('button', {
                key: 'toggle',
                type: 'button',
                className: 'fotogrids-password-input__toggle',
                onClick: () => setShowPassword(!showPassword),
                disabled: isDisabled,
                title: showPassword ? __('Hide password', 'fotogrids') : __('Show password', 'fotogrids')
            }, iconElement)
        ])
    ]);
};

window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderPasswordInput = (setting, currentValue, isDisabled, {
    updateSetting,
    isProActive,
    renderIcon,
    __
}) => {
    return React.createElement(PasswordInputComponent, {
        setting: setting,
        value: currentValue,
        onChange: (value) => updateSetting(setting.key, value),
        isDisabled: isDisabled,
        isProActive: isProActive,
        renderIcon: renderIcon,
        __: __
    });
};










