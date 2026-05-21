window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

/**
 * Alignment Grid Component
 * Extends button_group but displays options in a 3x3 grid layout
 */
window.FotoGridsRenderSettings.renderAlignmentGrid = (setting, currentValue, isDisabled, {
    updateSetting,
    renderIcon,
    getFieldState,
    isDefaultsMode,
    getOptionState,
    __
}) => {
    const filteredOptions = isDefaultsMode
        ? (setting.options || []).filter(option => !option.isGlobalDefault)
        : (setting.options || []);

    const gridOrder = [
        'top-left', 'top-center', 'top-right',
        'center-left', 'center', 'center-right',
        'bottom-left', 'bottom-center', 'bottom-right'
    ];

    const optionsMap = {};
    filteredOptions.forEach(option => {
        optionsMap[option.value] = option;
    });

    const orderedOptions = gridOrder.map(value => optionsMap[value] || null);

    const modifiedSetting = {
        ...setting,
        options: orderedOptions
    };

    return window.FotoGridsRenderSettings.renderButtonGroup(
        modifiedSetting,
        currentValue,
        isDisabled,
        {
            updateSetting,
            renderIcon,
            getFieldState,
            isDefaultsMode,
            getOptionState,
            __,
            buttonsClassName: 'fotogrids-alignment-grid'
        }
    );
};
