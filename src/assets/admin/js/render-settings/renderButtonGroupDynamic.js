window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const ButtonGroupDynamicComponent = ({ setting, currentValue, isDisabled, updateSetting, renderIcon, isProActive, isDefaultsMode, __, renderAdditionalContent }) => {
    const getInitialOptions = () => {
        let initialOptions = setting.fallback_options || [];
        if (setting.append_option && !initialOptions.find(opt => opt.value === setting.append_option.value)) {
            initialOptions = [...initialOptions, setting.append_option];
        }
        return initialOptions;
    };

    const [options, setOptions] = React.useState(getInitialOptions());
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchOptions = async () => {
            try {
                const response = await fetch(setting.api_endpoint, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': window.wpApiSettings?.nonce || ''
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    let fetchedOptions = data[setting.options_key] || [];

                    if (setting.exclude_values && setting.exclude_values.length > 0) {
                        fetchedOptions = fetchedOptions.filter(option =>
                            !setting.exclude_values.includes(option.value)
                        );
                    }

                    fetchedOptions = fetchedOptions.map(option => {
                        if (option.width && option.height) {
                            option.note = `${option.width}x${option.height}`;
                        } else if (option.value === 'full') {
                            option.note = __('Original', 'fotogrids');
                        }
                        return option;
                    });

                    if (setting.append_option && !fetchedOptions.find(opt => opt.value === setting.append_option.value)) {
                        fetchedOptions.push(setting.append_option);
                    }

                    setOptions(fetchedOptions);
                } else {
                    console.warn('FotoGrids: Failed to fetch dynamic options, using fallback');
                    let fallbackOptions = setting.fallback_options || [];

                    if (setting.append_option && !fallbackOptions.find(opt => opt.value === setting.append_option.value)) {
                        fallbackOptions = [...fallbackOptions, setting.append_option];
                    }

                    setOptions(fallbackOptions);
                }
            } catch (error) {
                console.warn('FotoGrids: Error fetching dynamic options:', error);
                let fallbackOptions = setting.fallback_options || [];

                if (setting.append_option && !fallbackOptions.find(opt => opt.value === setting.append_option.value)) {
                    fallbackOptions = [...fallbackOptions, setting.append_option];
                }

                setOptions(fallbackOptions);
            } finally {
                setLoading(false);
            }
        };

        fetchOptions();
    }, [setting.api_endpoint, setting.options_key, setting.exclude_values, __]);

    if (loading) {
        return React.createElement('div', {
            className: 'fotogrids-button-group fotogrids-loading'
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
                key: 'buttons',
                className: 'fotogrids-button-group__buttons'
            }, __('Loading options...', 'fotogrids'))
        ]);
    }

    const selectedOption = options.find(opt => opt.value === currentValue);

    // Create a modified setting with the fetched options to pass to renderButtonGroup
    const modifiedSetting = {
        ...setting,
        options: isDefaultsMode
            ? options.filter(option => !option.isGlobalDefault)
            : options
    };

    const { createElement: h } = wp.element;

    const buttonGroupElement = window.FotoGridsRenderSettings.renderButtonGroup(
        modifiedSetting,
        currentValue,
        isDisabled,
        {
            updateSetting,
            renderIcon,
            isProActive,
            isDefaultsMode,
            __
        }
    );

    // Wrap in a container to allow additional content
    return h('div', {
        className: 'fotogrids-button-group-dynamic-wrapper'
    }, [
        buttonGroupElement,
        // Allow extending with additional content
        renderAdditionalContent && typeof renderAdditionalContent === 'function'
            ? renderAdditionalContent(selectedOption, options, currentValue)
            : null
    ].filter(Boolean));
};

window.FotoGridsRenderSettings.renderButtonGroupDynamic = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon,
    isProActive,
    isDefaultsMode,
    __,
    renderAdditionalContent
}) => {
    return React.createElement(ButtonGroupDynamicComponent, {
        setting,
        currentValue,
        isDisabled,
        updateSetting,
        renderIcon,
        isProActive,
        isDefaultsMode,
        __,
        renderAdditionalContent
    });
};
