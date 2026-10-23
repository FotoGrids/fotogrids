window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

/**
 * Alignment Grid Component
 * Extends button_group but displays options in a 3x3 grid layout
 */
window.FotoGridsRenderSettings.renderAlignmentGrid = (
	setting,
	currentValue,
	isDisabled,
	{
		updateSetting,
		renderIcon,
		getFieldState,
		isDefaultsMode,
		getOptionState,
		__,
	}
) => {
	const filteredOptions = isDefaultsMode
		? (setting.options || []).filter((option) => !option.isGlobalDefault)
		: setting.options || [];

	const gridLabels = {
		'top-left': __('Top left', 'fotogrids'),
		'top-center': __('Top centre', 'fotogrids'),
		'top-right': __('Top right', 'fotogrids'),
		'center-left': __('Centre left', 'fotogrids'),
		center: __('Centre', 'fotogrids'),
		'center-right': __('Centre right', 'fotogrids'),
		'bottom-left': __('Bottom left', 'fotogrids'),
		'bottom-center': __('Bottom centre', 'fotogrids'),
		'bottom-right': __('Bottom right', 'fotogrids'),
	};

	const optionsMap = {};
	filteredOptions.forEach((option) => {
		optionsMap[option.value] = option;
	});

	const orderedOptions = Object.keys(gridLabels).map((value) =>
		optionsMap[value]
			? {
					...optionsMap[value],
					ariaLabel: optionsMap[value].label || gridLabels[value],
				}
			: null
	);

	const modifiedSetting = {
		...setting,
		options: orderedOptions,
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
			buttonsClassName: 'fotogrids-alignment-grid',
		}
	);
};
