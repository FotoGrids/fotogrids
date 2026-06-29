window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const HOVER_DEMO_IMAGES = [
	{
		id: 'hover-demo-1',
		title: 'Canyon road',
		description: 'A winding road through red-rock cliffs.',
	},
	{
		id: 'hover-demo-2',
		title: 'Jungle waterfall',
		description: 'A cascade into a misty rainforest pool.',
	},
	{
		id: 'hover-demo-3',
		title: 'Palm leaf',
		description: 'Sunlight through a single palm frond.',
	},
	{
		id: 'hover-demo-4',
		title: 'Night camp',
		description: 'A lit tent under an alpine starfield.',
	},
	{
		id: 'hover-demo-5',
		title: 'Breaking wave',
		description: 'Clear water curling onto a calm shore.',
	},
];

const getTemplateDemoImage = (() => {
	let picked = null;

	return () => {
		if (picked) {
			return picked;
		}

		const index = Math.floor(Math.random() * HOVER_DEMO_IMAGES.length);
		picked = HOVER_DEMO_IMAGES[index];

		return picked;
	};
})();

const CSS_PROPERTY_LABELS = {
	'box-shadow': 'Shadow',
	border: 'Border',
	filter: 'Image Filter',
};

const SETTING_FLAGS_FOR_PROPERTY = {
	'box-shadow': 'shadow_enabled',
	border: 'border_enabled',
	filter: 'thumbnail_filter_enabled',
};

window.FotoGridsRenderSettings.renderHoverEffectsGrid = (
	setting,
	currentValue,
	isDisabled,
	{ updateSetting, getOptionState, renderIcon, __, settings = {} }
) => {
	const { createElement: h } = wp.element;
	const options = Array.isArray(setting.options) ? setting.options : [];

	const demoImage = getTemplateDemoImage();
	const pluginUrl = window.fotogridsAdmin?.pluginUrl || '';

	const templateImage = {
		avif: `${pluginUrl}public/assets/hover-demo/${demoImage.id}.webp`,
		jpg: `${pluginUrl}public/assets/hover-demo/${demoImage.id}.jpg`,
	};

	const captionPlacement = settings.caption_placement || 'overlay';
	const captionAlignment = settings.caption_alignment || 'center';

	const isSettingOn = (key) => {
		const value = settings[key];
		return value === true || value === '1' || value === 1;
	};

	const captionHidden =
		isSettingOn('caption_hide_title') &&
		isSettingOn('caption_hide_description');

	const icon = (name) =>
		typeof renderIcon === 'function' ? renderIcon(name) : null;

	const renderTag = (key, iconName, label, broken) =>
		h(
			'span',
			{
				key,
				className: `fotogrids-hover-effect-option__tag ${broken ? 'fg-is-broken' : ''}`,
				...(broken
					? {
							'data-fg-tooltip': __(
								'This effect reveals the caption. Turn on a caption title or description for it to work.',
								'fotogrids'
							),
							'data-fg-tooltip-dir': 'above',
						}
					: {}),
			},
			[icon(iconName), h('span', { key: 'l' }, label)].filter(Boolean)
		);

	// `isEditable` is false for Pro teaser / locked options; those never show the
	// red "needs a caption" state or its tooltip.
	const animatesTags = (option, isEditable) => {
		const tags = [];
		const animatesImage =
			option.animates === 'media' ||
			option.animates === 'frame' ||
			option.animates === 'both';
		const animatesCaption =
			option.animates === 'caption' || option.animates === 'both';

		if (animatesImage) {
			const isTile = option.animates === 'frame';
			tags.push(
				renderTag(
					'image',
					isTile ? 'layout' : 'image',
					isTile ? __('Tile', 'fotogrids') : __('Image', 'fotogrids'),
					false
				)
			);
		}
		if (animatesCaption) {
			tags.push(
				renderTag(
					'caption',
					'text',
					__('Caption', 'fotogrids'),
					isEditable && option.requires_caption && captionHidden
				)
			);
		}
		return tags;
	};

	const activeConflicts = (option) => {
		if (!Array.isArray(option.conflicts_css)) {
			return [];
		}
		return option.conflicts_css.filter((property) => {
			const flag = SETTING_FLAGS_FOR_PROPERTY[property];
			return flag ? isSettingOn(flag) : false;
		});
	};

	const renderPreviewCaption = () =>
		h('figcaption', { className: 'fg-caption' }, [
			h('span', {
				className: 'fg-caption-bg',
				'aria-hidden': 'true',
				key: 'bg',
			}),
			h('span', { className: 'fg-caption-content', key: 'content' }, [
				h(
					'span',
					{ className: 'fg-caption-title', key: 'title' },
					demoImage.title
				),
				h(
					'span',
					{ className: 'fg-caption-description', key: 'desc' },
					demoImage.description
				),
			]),
		]);

	const renderCard = (option) => {
		const isActive = currentValue === option.value;
		const optionState =
			typeof getOptionState === 'function'
				? getOptionState(setting.key, option.value)
				: 'editable';
		const isDisabledOption = isDisabled || optionState !== 'editable';
		const isProOption = optionState === 'teaser';

		return h(
			'div',
			{
				key: option.value,
				className: `fotogrids-hover-effect-option ${isActive ? 'fg-is-active' : ''} ${isDisabledOption ? 'fg-is-disabled' : ''}`,
				onClick: () => {
					if (!isDisabledOption) {
						updateSetting(setting.key, option.value);
					} else if (isProOption && window.FotoGridsUpgrade) {
						window.FotoGridsUpgrade.launchForFeature.customCSS();
					}
				},
			},
			[
				h(
					'div',
					{
						className: 'fotogrids-hover-effect-option__preview',
						key: 'preview',
					},
					h(
						'div',
						{
							className: 'fotogrids-collection',
							'data-fg-hover': option.value,
							'data-fg-caption': captionPlacement,
						},
						h(
							'figure',
							{
								className: 'fg-item',
								'data-fg-caption-align': captionAlignment,
							},
							[
								h(
									'div',
									{
										className: 'fg-item-media',
										key: 'media',
									},
									h('picture', {}, [
										h('source', {
											srcSet: templateImage.avif,
											type: 'image/webp',
											key: 'webp',
										}),
										h('img', {
											src: templateImage.jpg,
											alt: demoImage.title,
											loading: 'lazy',
											key: 'img',
										}),
									])
								),
								renderPreviewCaption(),
							]
						)
					)
				),
				h(
					'div',
					{
						className: 'fotogrids-hover-effect-option__content',
						key: 'content',
					},
					[
						h(
							'h4',
							{
								className:
									'fotogrids-hover-effect-option__name',
								key: 'name',
							},
							[
								h('span', { key: 'name-text' }, option.label),
								optionState !== 'editable' &&
									h(
										'span',
										{
											className: 'fotogrids-pro-badge',
											key: 'badge',
										},
										optionState === 'locked'
											? __('Locked', 'fotogrids')
											: __('Pro', 'fotogrids')
									),
							].filter(Boolean)
						),
						h(
							'p',
							{
								className:
									'fotogrids-hover-effect-option__description',
								key: 'animates',
							},
							option.value === 'none'
								? __('No hover effect', 'fotogrids')
								: [
										h(
											'span',
											{
												className:
													'fotogrids-hover-effect-option__animates-label',
												key: 'label',
											},
											__('Animates:', 'fotogrids')
										),
										...animatesTags(
											option,
											optionState === 'editable'
										),
									]
						),
					].filter(Boolean)
				),
			]
		);
	};

	const conflictNotice = () => {
		const active = options.find((option) => option.value === currentValue);
		if (!active) {
			return null;
		}
		const conflicts = activeConflicts(active);
		if (conflicts.length === 0) {
			return null;
		}
		const names = conflicts
			.map((property) => CSS_PROPERTY_LABELS[property] || property)
			.join(', ');

		return h(
			'p',
			{
				className: 'fotogrids-hover-effects-grid__conflict',
				key: 'conflict',
			},
			__(
				'This effect controls the same styling on hover as your active setting: ',
				'fotogrids'
			) + names
		);
	};

	// Bind fg-tooltip to any newly rendered tags after React paints. init()
	// skips already-bound elements, so repeated calls are safe.
	if (typeof window.requestAnimationFrame === 'function') {
		window.requestAnimationFrame(() => window.FgTooltip?.init?.());
	}

	return h(
		'div',
		{ className: 'fotogrids-hover-effects-grid-setting' },
		[
			h(
				'label',
				{ className: 'fotogrids-setting__label', key: 'label' },
				h('span', { key: 'label-text' }, setting.label)
			),
			h(
				'div',
				{
					className: 'fotogrids-hover-effects-grid',
					key: 'grid',
					style: {
						'--fg-hover-cursor':
							settings.hover_cursor_icon || 'pointer',
					},
				},
				options.map(renderCard)
			),
			conflictNotice(),
		].filter(Boolean)
	);
};
