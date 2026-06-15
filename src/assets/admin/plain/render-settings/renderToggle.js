window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderToggle = (
	setting,
	currentValue,
	isDisabled,
	{ updateSetting, getFieldState, __ },
) => {
	const { createElement: h } = wp.element;

	const isChecked = currentValue === '1' || currentValue === true;
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
			className: 'fotogrids-toggle-control',
		},
		[
			h(
				'div',
				{
					className: 'fotogrids-toggle-wrapper',
				},
				[
					h(
						'button',
						{
							type: 'button',
							className: `fotogrids-toggle ${isChecked ? 'fgt-is-checked' : ''}`,
							onClick: () =>
								!isDisabled &&
								updateSetting(setting.key, !isChecked),
							disabled: isDisabled,
							'aria-checked': isChecked,
							role: 'switch',
						},
						[
							h('span', {
								className: 'fotogrids-toggle__track',
							}),
							h('span', {
								className: 'fotogrids-toggle__thumb',
							}),
						],
					),
				],
			),
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
			setting.description &&
				h('div', {
					className: 'fotogrids-setting__description',
					dangerouslySetInnerHTML: { __html: setting.description },
				}),
		].filter(Boolean),
	);
};
