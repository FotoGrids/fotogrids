window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const FOTOGRIDS_FONT_WEIGHT_OPTIONS = [
    { label: 'Thin (100)',        value: '100', fontWeight: '100' },
    { label: 'Extra Light (200)', value: '200', fontWeight: '200' },
    { label: 'Light (300)',       value: '300', fontWeight: '300' },
    { label: 'Regular (400)',     value: '400', fontWeight: '400' },
    { label: 'Medium (500)',      value: '500', fontWeight: '500' },
    { label: 'Semi Bold (600)',   value: '600', fontWeight: '600' },
    { label: 'Bold (700)',        value: '700', fontWeight: '700' },
    { label: 'Extra Bold (800)',  value: '800', fontWeight: '800' },
    { label: 'Black (900)',       value: '900', fontWeight: '900' },
];

const FontWeightComponent = ({ setting, currentValue, isDisabled, updateSetting, getFieldState, renderIcon, __ }) => {
    const { useMemo } = wp.element;

    const defaultOptionValue = Object.prototype.hasOwnProperty.call(setting || {}, 'default_option_value')
        ? setting.default_option_value
        : 'default';
    const resolvedValue = currentValue === undefined || currentValue === null || currentValue === ''
        ? defaultOptionValue
        : currentValue;

    const defaultOption = {
        label: __('Default', 'fotogrids'),
        value: defaultOptionValue,
        fontWeight: ''
    };

    const selectedOption = useMemo(() => {
        if (resolvedValue === defaultOptionValue) {
            return defaultOption;
        }

        const match = FOTOGRIDS_FONT_WEIGHT_OPTIONS.find((opt) => opt.value === resolvedValue);
        if (match) {
            return match;
        }

        return {
            label: String(resolvedValue),
            value: resolvedValue,
            fontWeight: resolvedValue
        };
    }, [resolvedValue]);

    return window.FotoGridsRenderSettings.renderSelect({
        setting,
        selectedOption,
        topOptions: [defaultOption, ...FOTOGRIDS_FONT_WEIGHT_OPTIONS],
        groups: [],
        isDisabled,
        getFieldState,
        renderIcon,
        __,
        searchEnabled: false,
        onSelect: (nextValue) => updateSetting(setting.key, nextValue),
        getOptionStyle: (option) => option?.fontWeight ? { fontWeight: option.fontWeight } : undefined,
        rootClassName: 'fotogrids-font-weight'
    });
};

window.FotoGridsRenderSettings.renderFontWeight = (setting, currentValue, isDisabled, {
    updateSetting,
    getFieldState,
    renderIcon,
    __
}) => {
    return wp.element.createElement(FontWeightComponent, {
        setting,
        currentValue,
        isDisabled,
        updateSetting,
        getFieldState,
        renderIcon,
        __
    });
};
