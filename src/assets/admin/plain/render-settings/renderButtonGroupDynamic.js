window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const ButtonGroupDynamicComponent = ({
	setting,
	currentValue,
	isDisabled,
	updateSetting,
	renderIcon,
	getFieldState,
	isDefaultsMode,
	getOptionState,
	__,
	renderAdditionalContent,
}) => {
	const { options, loading } =
		window.FotoGridsDynamicOptions.useDynamicOptions(setting, {
			decorate: (option) => {
				if (option.width && option.height) {
					option.note = `${option.width}x${option.height}`;
				} else if (option.value === 'full') {
					option.note = __('Original', 'fotogrids');
				}
				return option;
			},
		});

	if (loading) {
		const settingState =
			typeof getFieldState === 'function'
				? getFieldState(setting.key, currentValue)
				: 'editable';
		const showSettingBadge = settingState !== 'editable';
		const ProBadge =
			window.FotoGridsTooltip && window.FotoGridsTooltip.ProBadge;

		return React.createElement(
			'div',
			{
				className: 'fg-button-group fotogrids-loading',
			},
			[
				React.createElement(
					'label',
					{
						key: 'label',
						className: 'fotogrids-setting__label',
					},
					[
						setting.label,
						showSettingBadge &&
							ProBadge &&
							React.createElement(ProBadge, {
								key: 'pro-badge',
								tier: setting.tier_required,
								state: settingState,
							}),
					].filter(Boolean)
				),
				React.createElement(
					'div',
					{
						key: 'buttons',
						className: 'fg-button-group__buttons',
					},
					__('Loading options…', 'fotogrids')
				),
			]
		);
	}

	const selectedOption = options.find((opt) => opt.value === currentValue);

	const modifiedSetting = {
		...setting,
		options: isDefaultsMode
			? options.filter((option) => !option.isGlobalDefault)
			: options,
	};

	const { createElement: h } = wp.element;

	const buttonGroupElement = window.FotoGridsRenderSettings.renderButtonGroup(
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
		}
	);

	return h(
		'div',
		{
			className: 'fg-button-group-dynamic-wrapper',
		},
		[
			buttonGroupElement,
			renderAdditionalContent &&
			typeof renderAdditionalContent === 'function'
				? renderAdditionalContent(selectedOption, options, currentValue)
				: null,
		].filter(Boolean)
	);
};

window.FotoGridsRenderSettings.renderButtonGroupDynamic = (
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
		renderAdditionalContent,
	}
) => {
	return React.createElement(ButtonGroupDynamicComponent, {
		setting,
		currentValue,
		isDisabled,
		updateSetting,
		renderIcon,
		getFieldState,
		isDefaultsMode,
		getOptionState,
		__,
		renderAdditionalContent,
	});
};
