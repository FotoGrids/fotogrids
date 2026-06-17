window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderGroup = (
	setting,
	currentValue,
	isDisabled,
	context
) => {
	const { createElement: h } = wp.element;
	const { renderSetting, getFieldState, __ } = context;
	const settingState =
		typeof getFieldState === 'function'
			? getFieldState(setting.key, currentValue)
			: 'editable';
	const showSettingBadge = settingState !== 'editable';
	const settingBadgeText =
		settingState === 'locked'
			? __('Locked', 'fotogrids')
			: __('Pro', 'fotogrids');

	if (!setting.settings || !Array.isArray(setting.settings)) {
		return h(
			'div',
			{
				className:
					'fotogrids-setting-group fotogrids-setting-group--error',
			},
			'Invalid group settings'
		);
	}

	const chromeWhen = setting.chrome_when || 'always';
	const chromeWhenContext = setting.__chromeWhenContext || null;
	const shouldRenderChrome =
		chromeWhen === 'always' ||
		(chromeWhen === 'single_subtab' &&
			chromeWhenContext === 'single_subtab');

	const childSettings = setting.settings.map((subSetting) => {
		const annotated = chromeWhenContext
			? { ...subSetting, __chromeWhenContext: chromeWhenContext }
			: subSetting;
		return renderSetting(annotated, isDisabled);
	});

	if (!shouldRenderChrome) {
		return h(
			'div',
			{
				className: `fotogrids-setting-group fotogrids-setting-group--chromeless ${isDisabled ? 'fotogrids-setting-group--disabled' : ''}`,
			},
			[
				h(
					'div',
					{
						className: 'fotogrids-setting-group__content',
					},
					childSettings
				),
			]
		);
	}

	return h(
		'fieldset',
		{
			className: `fotogrids-setting-group ${isDisabled ? 'fotogrids-setting-group--disabled' : ''}`,
		},
		[
			h(
				'legend',
				{
					className: 'fotogrids-setting-group__label',
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
							settingBadgeText
						),
				].filter(Boolean)
			),

			h(
				'div',
				{
					className: 'fotogrids-setting-group__content',
				},
				childSettings
			),
		]
	);
};
