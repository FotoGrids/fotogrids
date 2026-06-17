window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderSettingSubTabs = (
	setting,
	isDisabled,
	{
		activeSubTab,
		setActiveSubTab,
		renderIcon,
		renderSetting,
		shouldDisplaySetting,
	}
) => {
	if (!setting.subTabs) return null;

	const { createElement: h } = wp.element;

	const availableSubTabs = Object.values(setting.subTabs).filter((subTab) => {
		if (!subTab.condition || typeof shouldDisplaySetting !== 'function')
			return true;
		return shouldDisplaySetting({ condition: subTab.condition });
	});

	const annotateChild = (child, ctx) => ({
		...child,
		__chromeWhenContext: ctx,
	});

	if (availableSubTabs.length === 1) {
		const singleSubTab = availableSubTabs[0];
		return h(
			'div',
			{
				className:
					'fotogrids-lightbox-subtab-content fotogrids-lightbox-subtab-content--single',
			},
			[
				h(
					'div',
					{
						className: 'fotogrids-lightbox-subtab-content__inner',
					},
					singleSubTab.settings?.map((subSetting) =>
						renderSetting(
							annotateChild(subSetting, 'single_subtab')
						)
					) || []
				),
			]
		);
	}

	return h(
		'div',
		{
			className: 'fotogrids-lightbox-subtabs',
		},
		[
			h(
				'div',
				{
					className: 'fotogrids-lightbox-subtabs__nav',
				},
				availableSubTabs.map((subTab) =>
					h(
						'button',
						{
							key: subTab.id,
							type: 'button',
							className: `fotogrids-lightbox-subtab ${activeSubTab === subTab.id ? 'fg-is-active' : ''}`,
							onClick: (e) => {
								e.preventDefault();
								e.stopPropagation();
								setActiveSubTab(subTab.id);
							},
							disabled: isDisabled,
						},
						[
							h(
								'span',
								{
									className:
										'fotogrids-lightbox-subtab__icon',
								},
								renderIcon(subTab.icon)
							),
							h(
								'span',
								{
									className:
										'fotogrids-lightbox-subtab__label',
								},
								subTab.label
							),
						]
					)
				)
			),

			h(
				'div',
				{
					className: 'fotogrids-lightbox-subtab-content',
				},
				[
					h(
						'div',
						{
							className:
								'fotogrids-lightbox-subtab-content__inner',
						},
						(() => {
							const visibleIds = new Set(
								availableSubTabs.map((t) => t.id)
							);
							const resolvedTab = visibleIds.has(activeSubTab)
								? activeSubTab
								: availableSubTabs[0]?.id;
							return (
								setting.subTabs[resolvedTab]?.settings.map(
									(subSetting) =>
										renderSetting(
											annotateChild(
												subSetting,
												'multi_subtab'
											)
										)
								) || []
							);
						})()
					),
				]
			),
		]
	);
};
