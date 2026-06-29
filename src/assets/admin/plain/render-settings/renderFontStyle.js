window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const FOTOGRIDS_FONT_STYLE_OPTIONS = [
	{ label: 'Normal', value: 'normal', fontStyle: 'normal' },
	{ label: 'Italic', value: 'italic', fontStyle: 'italic' },
];

const FontStyleComponent = ({
	setting,
	currentValue,
	isDisabled,
	updateSetting,
	getFieldState,
	renderIcon,
	__,
}) => {
	const { useMemo } = wp.element;

	const defaultOptionValue = Object.prototype.hasOwnProperty.call(
		setting || {},
		'default_option_value'
	)
		? setting.default_option_value
		: 'default';
	const resolvedValue =
		currentValue === undefined ||
		currentValue === null ||
		currentValue === ''
			? defaultOptionValue
			: currentValue;

	const defaultOption = {
		label: __('Theme Default', 'fotogrids'),
		value: 'default',
		fontStyle: '',
	};

	const selectedOption = useMemo(() => {
		const match = FOTOGRIDS_FONT_STYLE_OPTIONS.find(
			(opt) => opt.value === resolvedValue
		);
		if (match) {
			return match;
		}

		if (resolvedValue === defaultOption.value) {
			return defaultOption;
		}

		return {
			label: String(resolvedValue),
			value: resolvedValue,
			fontStyle: resolvedValue,
		};
	}, [resolvedValue]);

	return window.FotoGridsRenderSettings.renderSelect({
		setting,
		selectedOption,
		topOptions: [...FOTOGRIDS_FONT_STYLE_OPTIONS, defaultOption],
		groups: [],
		isDisabled,
		getFieldState,
		renderIcon,
		__,
		searchEnabled: false,
		onSelect: (nextValue) => updateSetting(setting.key, nextValue),
		getOptionStyle: (option) =>
			option?.fontStyle ? { fontStyle: option.fontStyle } : undefined,
		rootClassName: 'fotogrids-font-style',
	});
};

window.FotoGridsRenderSettings.renderFontStyle = (
	setting,
	currentValue,
	isDisabled,
	{ updateSetting, getFieldState, renderIcon, __ }
) => {
	return wp.element.createElement(FontStyleComponent, {
		setting,
		currentValue,
		isDisabled,
		updateSetting,
		getFieldState,
		renderIcon,
		__,
	});
};
