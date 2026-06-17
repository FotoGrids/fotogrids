window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const TEMPLATE_DEMO_TOTAL = 35;

const TEMPLATE_DEMO_CAPTIONS = [
	['Machu Picchu at dawn', 'Sunrise over the lost city of the Incas.'],
	['Moraine Lake', 'Turquoise water below the Rockies.'],
	['Mesa Arch sunrise', 'First light bursts beneath the arch.'],
	['Hidden jungle falls', 'A cascade into an emerald pool.'],
	['Mount Fuji in autumn', 'Red maples frame the sacred peak.'],
	['Aurora over the fjord', 'Green light dancing above the snow.'],
	['Lady Liberty at sunset', 'Standing tall over New York Harbor.'],
	['Reynisfjara black sand', 'Waves break against basalt columns.'],
	['Salar de Uyuni', 'The sky mirrored on the salt flats.'],
	['Inside the ice cave', 'A meltwater stream beneath blue ice.'],
	['Sunburst on the lake', 'Light spills through the alpine pines.'],
	['Milky Way over Everest', 'Stars above the high Himalaya.'],
	['Angkor Wat at sunrise', 'Lotus blooms before the ancient towers.'],
	['Lofoten under the lights', 'Aurora over a snowbound village.'],
	['Taj Mahal at dusk', 'Marble glowing in the evening calm.'],
	['Horseshoe Bend', 'The river carves a perfect curve.'],
	['Monastery in the mist', 'Perched on the cliffs of Meteora.'],
	['Eiffel Tower at sunset', 'Spring blooms along the gardens.'],
	['Fuji winter morning', 'A still reflection over frosted reeds.'],
	['Patagonia at first light', 'Wildflowers below the granite peaks.'],
	['Great Wall at sunrise', 'The wall winds into misty hills.'],
	['The Colosseum aglow', 'Roman arches lit by the setting sun.'],
	['Santorini blue domes', 'Whitewashed Oia above the Aegean.'],
	['Dunes at golden hour', 'Wind-carved ridges in the desert.'],
	['Glacier lagoon', 'Icebergs drift under a moody sky.'],
	['Amalfi Coast sunset', 'Cliffside houses above the sea.'],
	['Kirkjufell in winter', 'Falls and frost beneath the peak.'],
	['Tre Cime at sunset', 'Alpine blooms below the Dolomites.'],
	['Neuschwanstein Castle', 'A fairytale castle in the Bavarian Alps.'],
	['Pyramids of Giza', 'A camel rests as the sun sets.'],
	['Milford Sound', 'Waterfalls into a mirrored fjord.'],
	['The Matterhorn at dawn', 'First light reflected in the tarn.'],
	['Petra through the Siq', 'The Treasury revealed by lantern light.'],
	['Chichén Itzá', 'El Castillo under a bright Yucatán sky.'],
	['Golden Gate in the fog', 'The bridge rises above a sea of cloud.'],
];

const getTemplateDemoImage = (() => {
	let picked = null;

	return () => {
		if (picked) {
			return picked;
		}

		const index = Math.floor(Math.random() * TEMPLATE_DEMO_TOTAL);
		const paddedNumber = String(index + 1).padStart(2, '0');
		const [title, description] = TEMPLATE_DEMO_CAPTIONS[index];

		picked = {
			id: `fotogrids-tp-${paddedNumber}`,
			title,
			description,
		};

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
	{ updateSetting, getOptionState, renderIcon, __, settings = {} },
) => {
	const { createElement: h } = wp.element;
	const options = Array.isArray(setting.options) ? setting.options : [];

	const demoImage = getTemplateDemoImage();
	const pluginUrl = window.fotogridsAdmin?.pluginUrl || '';

	const templateImage = {
		avif: `${pluginUrl}public/assets/template-demo/avif/${demoImage.id}.avif`,
		jpg: `${pluginUrl}public/assets/template-demo/jpg/${demoImage.id}.jpg`,
	};

	const captionPlacement = settings.caption_placement || 'overlay';
	const captionAlignment = settings.caption_alignment || 'center';

	const isSettingOn = key => {
		const value = settings[key];
		return value === true || value === '1' || value === 1;
	};

	const captionHidden =
		isSettingOn('caption_hide_title') &&
		isSettingOn('caption_hide_description');

	const icon = name =>
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
								'fotogrids',
							),
							'data-fg-tooltip-dir': 'above',
						}
					: {}),
			},
			[icon(iconName), h('span', { key: 'l' }, label)].filter(Boolean),
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
					false,
				),
			);
		}
		if (animatesCaption) {
			tags.push(
				renderTag(
					'caption',
					'text',
					__('Caption', 'fotogrids'),
					isEditable && option.requires_caption && captionHidden,
				),
			);
		}
		return tags;
	};

	const activeConflicts = option => {
		if (!Array.isArray(option.conflicts_css)) {
			return [];
		}
		return option.conflicts_css.filter(property => {
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
					demoImage.title,
				),
				h(
					'span',
					{ className: 'fg-caption-description', key: 'desc' },
					demoImage.description,
				),
			]),
		]);

	const renderCard = option => {
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
											type: 'image/avif',
											key: 'avif',
										}),
										h('img', {
											src: templateImage.jpg,
											alt: demoImage.title,
											loading: 'lazy',
											key: 'img',
										}),
									]),
								),
								renderPreviewCaption(),
							],
						),
					),
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
											: __('Pro', 'fotogrids'),
									),
							].filter(Boolean),
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
											__('Animates:', 'fotogrids'),
										),
										...animatesTags(
											option,
											optionState === 'editable',
										),
									],
						),
					].filter(Boolean),
				),
			],
		);
	};

	const conflictNotice = () => {
		const active = options.find(option => option.value === currentValue);
		if (!active) {
			return null;
		}
		const conflicts = activeConflicts(active);
		if (conflicts.length === 0) {
			return null;
		}
		const names = conflicts
			.map(property => CSS_PROPERTY_LABELS[property] || property)
			.join(', ');

		return h(
			'p',
			{
				className: 'fotogrids-hover-effects-grid__conflict',
				key: 'conflict',
			},
			__(
				'This effect controls the same styling on hover as your active setting: ',
				'fotogrids',
			) + names,
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
				h('span', { key: 'label-text' }, setting.label),
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
				options.map(renderCard),
			),
			conflictNotice(),
		].filter(Boolean),
	);
};
