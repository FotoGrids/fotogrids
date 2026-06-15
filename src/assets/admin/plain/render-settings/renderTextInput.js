window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderTextInput = (
	setting,
	currentValue,
	isDisabled,
	{ updateSetting, getFieldState, __ },
) => {
	const { createElement: h } = wp.element;
	const settingState =
		typeof getFieldState === 'function'
			? getFieldState(setting.key, currentValue)
			: 'editable';
	const showSettingBadge = settingState !== 'editable';
	const settingBadgeText =
		settingState === 'locked'
			? __('Locked', 'fotogrids')
			: __('Pro', 'fotogrids');

	return h(
		'div',
		{
			className: 'fotogrids-text-input',
		},
		[
			setting.label &&
				h(
					'label',
					{
						className: 'fotogrids-setting__label',
					},
					[
						setting.label,
						showSettingBadge &&
							h(
								'span',
								{
									className: 'fotogrids-pro-badge',
									key: 'pro-badge',
								},
								settingBadgeText,
							),
					].filter(Boolean),
				),
			setting.multiline
				? h('textarea', {
						className: 'fotogrids-input fotogrids-input--multiline',
						value: currentValue || setting.default || '',
						placeholder: setting.placeholder || '',
						rows: setting.rows || 3,
						onChange: e =>
							!isDisabled &&
							updateSetting(setting.key, e.target.value),
						disabled: isDisabled,
					})
				: h('input', {
						type: 'text',
						className: 'fotogrids-input',
						value: currentValue || setting.default || '',
						placeholder: setting.placeholder || '',
						onChange: e =>
							!isDisabled &&
							updateSetting(setting.key, e.target.value),
						disabled: isDisabled,
					}),
			setting.description &&
				h(
					'div',
					{
						className: 'fotogrids-setting__description',
					},
					setting.description,
				),
		].filter(Boolean),
	);
};
