window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderToggle = (
	setting,
	currentValue,
	isDisabled,
	{ updateSetting, getFieldState, __ }
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
					key: 'toggle-wrapper',
					className: 'fotogrids-toggle-wrapper',
				},
				[
					h(
						'button',
						{
							key: 'fotogrids-toggle',
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
								key: 'track',
								className: 'fotogrids-toggle__track',
							}),
							h('span', {
								key: 'thumb',
								className: 'fotogrids-toggle__thumb',
							}),
						]
					),
				]
			),
			h(
				'label',
				{ key: 'label', className: 'fotogrids-setting__label' },
				[
					setting.label,
					showSettingBadge &&
						h(
							'span',
							{
								className: 'fotogrids-pro-badge',
								key: 'pro-badge',
							},
							settingBadgeText
						),
				].filter(Boolean)
			),
			setting.description &&
				h('div', {
					key: 'description',
					className: 'fotogrids-setting__description',
					dangerouslySetInnerHTML: { __html: setting.description },
				}),
		].filter(Boolean)
	);
};
