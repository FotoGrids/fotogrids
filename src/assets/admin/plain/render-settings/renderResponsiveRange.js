window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderResponsiveRange = (
	setting,
	currentValue,
	isDisabled,
	{
		updateSetting,
		updateSettingStateOnly,
		activeDevice,
		setActiveDevice,
		renderIcon,
		getFieldState,
		siblingValueOf,
		__,
	}
) => {
	const { createElement: h } = wp.element;

	const hasUnits =
		setting.units &&
		Array.isArray(setting.units) &&
		setting.units.length > 0;
	const isMinMaxMode = setting.minMax === true;
	const isFourSided = setting.four_sided === true;
	const isTwoSided = setting.two_sided === true;
	// no_range hides the slider and lets the number input stretch to fill the
	// row - for settings (line height, letter/word spacing) where a slider adds
	// no value but the rest of the responsive_range wiring is still wanted.
	const noRange = setting.no_range === true;
	const settingState =
		typeof getFieldState === 'function'
			? getFieldState(setting.key, currentValue)
			: 'editable';
	const showSettingBadge = settingState !== 'editable';
	const settingBadgeText =
		settingState === 'locked'
			? __('Locked', 'fotogrids')
			: __('Pro', 'fotogrids');

	const defaults = window.fotogridsSettings?.defaults || {};
	const defaultResponsive =
		defaults[setting.key] || (isMinMaxMode ? {} : setting.responsive);

	if (isTwoSided) {
		return renderTwoSided(setting, currentValue, isDisabled, {
			updateSetting,
			updateSettingStateOnly,
			renderIcon,
			getFieldState,
			siblingValueOf,
			__,
		});
	}

	if (isFourSided) {
		const sides = ['top', 'right', 'bottom', 'left'];

		// _linked is a UI-only flag held in React state; it's never persisted.
		// On first render after a reload, currentValue._linked is undefined, so we
		// derive linked-state from the data: if any device has unequal sides,
		// the user must have unlinked at some point - show as unlinked.
		const sideValueFor = (deviceValue, side) => {
			if (!deviceValue || typeof deviceValue !== 'object')
				return undefined;
			const sv = deviceValue[side];
			return sv && typeof sv === 'object' ? sv.value : sv;
		};
		const deviceHasEqualSides = (deviceValue) => {
			if (!deviceValue || typeof deviceValue !== 'object') return true;
			const first = sideValueFor(deviceValue, 'top');
			return sides.every((s) => sideValueFor(deviceValue, s) === first);
		};
		const allDevicesEqual = () => {
			if (!currentValue || typeof currentValue !== 'object') return true;
			return ['desktop', 'tablet', 'mobile'].every((d) =>
				deviceHasEqualSides(currentValue[d])
			);
		};

		const linkedRaw = currentValue?._linked;
		const isLinked =
			linkedRaw === undefined
				? allDevicesEqual()
				: linkedRaw !== false && linkedRaw !== '0' && linkedRaw !== 0;

		const buildDefaultSideValue = (device, singleVal) => {
			if (hasUnits) {
				const v =
					typeof singleVal === 'object' && singleVal !== null
						? {
								value:
									singleVal.value ??
									setting.responsive[device].default,
								unit: singleVal.unit ?? setting.units[0],
							}
						: {
								value:
									singleVal ??
									setting.responsive[device].default,
								unit: setting.units[0],
							};
				return {
					top: { ...v },
					right: { ...v },
					bottom: { ...v },
					left: { ...v },
				};
			}
			const v = singleVal ?? setting.responsive[device].default;
			return { top: v, right: v, bottom: v, left: v };
		};

		let responsiveValue;
		if (
			currentValue &&
			typeof currentValue === 'object' &&
			!Array.isArray(currentValue)
		) {
			// Normalize each device: ensure all four sides exist (ignore _linked and other meta keys)
			responsiveValue = {};
			['desktop', 'tablet', 'mobile'].forEach((device) => {
				const dv = currentValue[device];
				if (
					dv &&
					typeof dv === 'object' &&
					sides.every((s) => s in dv)
				) {
					responsiveValue[device] = dv;
				} else {
					responsiveValue[device] = buildDefaultSideValue(device, dv);
				}
			});
		} else {
			responsiveValue = {};
			['desktop', 'tablet', 'mobile'].forEach((device) => {
				responsiveValue[device] = buildDefaultSideValue(device, null);
			});
		}

		const getSideValue = (device, side) => {
			const dv = responsiveValue[device][side];
			if (hasUnits) {
				return typeof dv === 'object' && dv !== null
					? dv.value
					: (dv ?? setting.responsive[device].default);
			}
			return dv ?? setting.responsive[device].default;
		};

		const getDeviceUnit = (device) => {
			if (!hasUnits) return null;
			const dv = responsiveValue[device].top;
			return (
				(typeof dv === 'object' && dv !== null ? dv.unit : null) ||
				setting.units[0]
			);
		};

		// _linked is UI-only - never included in updateSetting payloads, only in updateSettingStateOnly.
		const withLinked = (val, linked) => ({ ...val, _linked: linked });
		const withoutLinked = (val) => {
			const { _linked, ...rest } = val;
			return rest;
		};
		const stateOnly =
			typeof updateSettingStateOnly === 'function'
				? updateSettingStateOnly
				: updateSetting;

		const updateSide = (device, side, value) => {
			const newDeviceValue = { ...responsiveValue[device] };
			if (hasUnits) {
				newDeviceValue[side] = { value, unit: getDeviceUnit(device) };
			} else {
				newDeviceValue[side] = value;
			}
			const newVal = { ...responsiveValue, [device]: newDeviceValue };
			// Save data without _linked; keep _linked in state separately
			updateSetting(setting.key, withoutLinked(newVal));
			stateOnly(setting.key, withLinked(newVal, isLinked));
		};

		const updateAllSides = (device, value) => {
			const unit = getDeviceUnit(device);
			let newDeviceValue;
			if (hasUnits) {
				newDeviceValue = {
					top: { value, unit },
					right: { value, unit },
					bottom: { value, unit },
					left: { value, unit },
				};
			} else {
				newDeviceValue = {
					top: value,
					right: value,
					bottom: value,
					left: value,
				};
			}
			const newVal = { ...responsiveValue, [device]: newDeviceValue };
			updateSetting(setting.key, withoutLinked(newVal));
			stateOnly(setting.key, withLinked(newVal, isLinked));
		};

		const updateUnit = (device, unit) => {
			if (!hasUnits) return;
			const newDeviceValue = {};
			sides.forEach((side) => {
				newDeviceValue[side] = {
					value: getSideValue(device, side),
					unit,
				};
			});
			const newVal = { ...responsiveValue, [device]: newDeviceValue };
			updateSetting(setting.key, withoutLinked(newVal));
			stateOnly(setting.key, withLinked(newVal, isLinked));
		};

		const handleLinkToggle = () => {
			if (isLinked) {
				// Unlinking - UI only, no save
				stateOnly(
					setting.key,
					withLinked({ ...responsiveValue }, false)
				);
			} else {
				// Linking - collapse all sides to top value (data save), flip flag (state only)
				const topVal = getSideValue(activeDevice, 'top');
				const unit = getDeviceUnit(activeDevice);
				let newDeviceValue;
				if (hasUnits) {
					newDeviceValue = {
						top: { value: topVal, unit },
						right: { value: topVal, unit },
						bottom: { value: topVal, unit },
						left: { value: topVal, unit },
					};
				} else {
					newDeviceValue = {
						top: topVal,
						right: topVal,
						bottom: topVal,
						left: topVal,
					};
				}
				const newVal = {
					...responsiveValue,
					[activeDevice]: newDeviceValue,
				};
				updateSetting(setting.key, withoutLinked(newVal));
				stateOnly(setting.key, withLinked(newVal, true));
			}
		};

		const devices = [
			{
				key: 'desktop',
				label: __('Desktop', 'fotogrids'),
				icon: 'responsive_desktop',
			},
			{
				key: 'tablet',
				label: __('Tablet', 'fotogrids'),
				icon: 'responsive_tablet',
			},
			{
				key: 'mobile',
				label: __('Mobile', 'fotogrids'),
				icon: 'responsive_mobile',
			},
		];
		const activeDeviceData = devices.find((d) => d.key === activeDevice);
		const currentUnit = getDeviceUnit(activeDevice);

		const linkedTopValue = getSideValue(activeDevice, 'top');

		const sideLabels = [
			{ side: 'top', label: __('Top', 'fotogrids') },
			{ side: 'right', label: __('Right', 'fotogrids') },
			{ side: 'bottom', label: __('Bottom', 'fotogrids') },
			{ side: 'left', label: __('Left', 'fotogrids') },
		];

		return h('div', { className: 'fotogrids-responsive-setting' }, [
			h('div', { className: 'fotogrids-responsive-setting__header' }, [
				h(
					'label',
					{ className: 'fotogrids-setting__label' },
					[
						setting.label,
						setting.unit &&
							h(
								'span',
								{
									className: 'fotogrids-setting__unit',
									key: 'unit',
								},
								` (${setting.unit})`
							),
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
					'span',
					{ className: 'fotogrids-responsive-setting__device-icon' },
					renderIcon(activeDeviceData.icon)
				),
			]),

			h(
				'div',
				{
					className:
						'fotogrids-responsive-setting__controls fotogrids-responsive-setting__controls--four-sided',
				},
				[
					h(
						'div',
						{ className: 'fotogrids-responsive-setting__range' },
						[
							h('input', {
								type: 'range',
								min: setting.responsive[activeDevice].min,
								max: setting.responsive[activeDevice].max,
								value: linkedTopValue,
								onChange: (e) =>
									!isDisabled &&
									updateAllSides(
										activeDevice,
										parseInt(e.target.value)
									),
								disabled: isDisabled || !isLinked,
								className: 'fotogrids-range-slider',
							}),
						]
					),

					h(
						'div',
						{ className: 'fotogrids-responsive-setting__input' },
						[
							h(
								'div',
								{
									key: 'four-inputs',
									className: 'fotogrids-fourside-inputs',
								},
								sideLabels.map(({ side, label }) =>
									h(
										'div',
										{
											key: side,
											className:
												'fotogrids-fourside-input-group',
										},
										[
											h('input', {
												type: 'number',
												min: setting.responsive[
													activeDevice
												].min,
												max: setting.responsive[
													activeDevice
												].max,
												value: getSideValue(
													activeDevice,
													side
												),
												onChange: (e) => {
													if (isDisabled) return;
													const _v = parseInt(
														e.target.value
													);
													const val = Number.isFinite(
														_v
													)
														? _v
														: setting.responsive[
																activeDevice
															].default;
													isLinked
														? updateAllSides(
																activeDevice,
																val
															)
														: updateSide(
																activeDevice,
																side,
																val
															);
												},
												disabled: isDisabled,
												className:
													'fotogrids-range-number-input',
											}),
											h(
												'span',
												{
													className:
														'fotogrids-fourside-label',
												},
												label
											),
										]
									)
								)
							),
							hasUnits &&
								renderUnitSelect(
									h,
									currentUnit,
									(unit) =>
										!isDisabled &&
										updateUnit(activeDevice, unit),
									isDisabled,
									setting
								),
						].filter(Boolean)
					),

					h(
						'button',
						{
							type: 'button',
							className: `fotogrids-fourside-link-btn${isLinked ? ' fg-is-active' : ''}`,
							onClick: (e) => {
								e.preventDefault();
								e.stopPropagation();
								!isDisabled && handleLinkToggle();
							},
							disabled: isDisabled,
							title: isLinked
								? __('Unlink values', 'fotogrids')
								: __('Link values', 'fotogrids'),
						},
						renderIcon('link')
					),

					h(
						'div',
						{ className: 'fotogrids-responsive-setting__devices' },
						devices.map((device) =>
							h(
								'button',
								{
									key: device.key,
									type: 'button',
									className: `fotogrids-responsive-device-btn ${activeDevice === device.key ? 'fg-is-active' : ''}`,
									onClick: (e) => {
										e.preventDefault();
										e.stopPropagation();
										setActiveDevice(device.key);
									},
									disabled: isDisabled,
									title: device.label,
								},
								renderIcon(device.icon)
							)
						)
					),
				]
			),

			setting.description &&
				h(
					'p',
					{
						className: 'fotogrids-setting__description',
					},
					setting.description
				),
		]);
	}

	let responsiveValue;
	if (
		currentValue &&
		typeof currentValue === 'object' &&
		!Array.isArray(currentValue)
	) {
		responsiveValue = currentValue;
	} else if (isMinMaxMode) {
		responsiveValue = {
			desktop: defaultResponsive.desktop || {
				min:
					setting.responsive.desktop.defaultMin ||
					setting.responsive.desktop.min,
				max:
					setting.responsive.desktop.defaultMax ||
					setting.responsive.desktop.max,
			},
			tablet: defaultResponsive.tablet || {
				min:
					setting.responsive.tablet.defaultMin ||
					setting.responsive.tablet.min,
				max:
					setting.responsive.tablet.defaultMax ||
					setting.responsive.tablet.max,
			},
			mobile: defaultResponsive.mobile || {
				min:
					setting.responsive.mobile.defaultMin ||
					setting.responsive.mobile.min,
				max:
					setting.responsive.mobile.defaultMax ||
					setting.responsive.mobile.max,
			},
		};
	} else {
		responsiveValue = {
			desktop:
				defaultResponsive.desktop || setting.responsive.desktop.default,
			tablet:
				defaultResponsive.tablet || setting.responsive.tablet.default,
			mobile:
				defaultResponsive.mobile || setting.responsive.mobile.default,
		};
	}

	if (hasUnits) {
		['desktop', 'tablet', 'mobile'].forEach((device) => {
			if (isMinMaxMode) {
				if (
					!responsiveValue[device] ||
					typeof responsiveValue[device] !== 'object'
				) {
					responsiveValue[device] = {
						min: {
							value:
								setting.responsive[device].defaultMin ||
								setting.responsive[device].min,
							unit: setting.units[0],
						},
						max: {
							value:
								setting.responsive[device].defaultMax ||
								setting.responsive[device].max,
							unit: setting.units[0],
						},
					};
				} else {
					if (
						!responsiveValue[device].min ||
						typeof responsiveValue[device].min !== 'object' ||
						responsiveValue[device].min.value === undefined
					) {
						const defaultMin =
							setting.responsive[device].defaultMin ||
							setting.responsive[device].min;
						responsiveValue[device].min = {
							value:
								typeof defaultMin === 'object'
									? defaultMin.value || defaultMin
									: defaultMin,
							unit:
								typeof defaultMin === 'object'
									? defaultMin.unit || setting.units[0]
									: setting.units[0],
						};
					}
					if (
						!responsiveValue[device].max ||
						typeof responsiveValue[device].max !== 'object' ||
						responsiveValue[device].max.value === undefined
					) {
						const defaultMax =
							setting.responsive[device].defaultMax ||
							setting.responsive[device].max;
						responsiveValue[device].max = {
							value:
								typeof defaultMax === 'object'
									? defaultMax.value || defaultMax
									: defaultMax,
							unit:
								typeof defaultMax === 'object'
									? defaultMax.unit || setting.units[0]
									: setting.units[0],
						};
					}
				}
			} else if (
				!responsiveValue[device] ||
				typeof responsiveValue[device] !== 'object' ||
				responsiveValue[device].value === undefined
			) {
				const defaultValue =
					defaultResponsive[device] ??
					setting.responsive[device].default;
				// defaultValue may be a stored {value, unit}, a config object
				// ({min, max, default}) when no saved/seeded default exists, or
				// a plain scalar. Pull the scalar out of each shape so a config
				// object never lands in the input as the value (which renders
				// the field empty).
				let resolvedValue = defaultValue;
				let resolvedUnit = setting.units[0];
				if (defaultValue && typeof defaultValue === 'object') {
					if (defaultValue.value !== undefined) {
						resolvedValue = defaultValue.value;
						resolvedUnit = defaultValue.unit || setting.units[0];
					} else if (defaultValue.default !== undefined) {
						resolvedValue = defaultValue.default;
					} else {
						resolvedValue = setting.responsive[device].default;
					}
				}
				responsiveValue[device] = {
					value: resolvedValue,
					unit: resolvedUnit,
				};
			}
		});
	}

	const updateResponsiveValue = (device, value, type = null) => {
		if (isMinMaxMode && type) {
			if (hasUnits) {
				const newValue = {
					...responsiveValue,
					[device]: {
						...responsiveValue[device],
						[type]: {
							value,
							unit:
								responsiveValue[device][type].unit ||
								setting.units[0],
						},
					},
				};
				updateSetting(setting.key, newValue);
			} else {
				const newValue = {
					...responsiveValue,
					[device]: {
						...responsiveValue[device],
						[type]: value,
					},
				};
				updateSetting(setting.key, newValue);
			}
		} else if (hasUnits) {
			const newValue = {
				...responsiveValue,
				[device]: {
					value,
					unit: responsiveValue[device].unit || setting.units[0],
				},
			};
			updateSetting(setting.key, newValue);
		} else {
			const newValue = {
				...responsiveValue,
				[device]: value,
			};
			updateSetting(setting.key, newValue);
		}
	};

	const updateResponsiveUnit = (device, unit) => {
		if (hasUnits) {
			if (isMinMaxMode) {
				const newValue = {
					...responsiveValue,
					[device]: {
						min: {
							value:
								responsiveValue[device].min.value !==
									undefined &&
								responsiveValue[device].min.value !== null
									? responsiveValue[device].min.value
									: setting.responsive[device].defaultMin,
							unit,
						},
						max: {
							value:
								responsiveValue[device].max.value !==
									undefined &&
								responsiveValue[device].max.value !== null
									? responsiveValue[device].max.value
									: setting.responsive[device].defaultMax,
							unit,
						},
					},
				};
				updateSetting(setting.key, newValue);
			} else {
				const newValue = {
					...responsiveValue,
					[device]: {
						value:
							responsiveValue[device].value !== undefined &&
							responsiveValue[device].value !== null
								? responsiveValue[device].value
								: setting.responsive[device].default,
						unit,
					},
				};
				updateSetting(setting.key, newValue);
			}
		}
	};

	const devices = [
		{
			key: 'desktop',
			label: __('Desktop', 'fotogrids'),
			icon: 'responsive_desktop',
		},
		{
			key: 'tablet',
			label: __('Tablet', 'fotogrids'),
			icon: 'responsive_tablet',
		},
		{
			key: 'mobile',
			label: __('Mobile', 'fotogrids'),
			icon: 'responsive_mobile',
		},
	];

	const activeDeviceData = devices.find((d) => d.key === activeDevice);
	const currentDeviceData = responsiveValue[activeDevice];

	if (isMinMaxMode) {
		const currentMinValue = hasUnits
			? currentDeviceData?.min?.value !== undefined
				? currentDeviceData.min.value
				: setting.responsive[activeDevice].defaultMin ||
					setting.responsive[activeDevice].min
			: currentDeviceData?.min !== undefined
				? currentDeviceData.min
				: setting.responsive[activeDevice].defaultMin ||
					setting.responsive[activeDevice].min;
		const currentMaxValue = hasUnits
			? currentDeviceData?.max?.value !== undefined
				? currentDeviceData.max.value
				: setting.responsive[activeDevice].defaultMax ||
					setting.responsive[activeDevice].max
			: currentDeviceData?.max !== undefined
				? currentDeviceData.max
				: setting.responsive[activeDevice].defaultMax ||
					setting.responsive[activeDevice].max;

		const currentMinUnit = hasUnits
			? currentDeviceData?.min?.unit || setting.units[0]
			: null;
		const currentMaxUnit = hasUnits
			? currentDeviceData?.max?.unit || setting.units[0]
			: null;

		const minRange = setting.responsive[activeDevice].min || 0;
		const maxRange = setting.responsive[activeDevice].max || 1000;
		const minMin = setting.responsive[activeDevice].minMin || minRange;
		const maxMax = setting.responsive[activeDevice].maxMax || maxRange;

		return h(
			'div',
			{
				className:
					'fotogrids-responsive-setting fotogrids-responsive-minmax-range',
			},
			[
				h(
					'div',
					{
						className: 'fotogrids-responsive-setting__header',
					},
					[
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
										settingBadgeText
									),
							].filter(Boolean)
						),
						h(
							'span',
							{
								className:
									'fotogrids-responsive-setting__device-icon',
							},
							renderIcon(activeDeviceData.icon)
						),
					]
				),

				h(
					'div',
					{
						className:
							'fotogrids-responsive-minmax-range__controls',
					},
					[
						(() => {
							const range = maxMax - minMin;
							const minPercent =
								range > 0
									? ((currentMinValue - minMin) / range) * 100
									: 0;
							const maxPercent =
								range > 0
									? ((currentMaxValue - minMin) / range) * 100
									: 100;

							return h(
								'div',
								{
									className: 'fotogrids-dual-range-container',
									style: {
										'--min-percent': `${minPercent}%`,
										'--max-percent': `${maxPercent}%`,
									},
								},
								[
									h(
										'div',
										{
											className:
												'fotogrids-dual-range-wrapper',
										},
										[
											// Min range input (lower z-index, shows left track)
											h('input', {
												type: 'range',
												min: minMin,
												max: maxMax,
												value: currentMinValue,
												onChange: (e) => {
													const newMin = parseInt(
														e.target.value
													);
													if (
														newMin <=
														currentMaxValue
													) {
														!isDisabled &&
															updateResponsiveValue(
																activeDevice,
																newMin,
																'min'
															);
													}
												},
												disabled: isDisabled,
												className:
													'fotogrids-range-slider fotogrids-range-slider-min',
											}),
											h('input', {
												type: 'range',
												min: minMin,
												max: maxMax,
												value: currentMaxValue,
												onChange: (e) => {
													const newMax = parseInt(
														e.target.value
													);
													if (
														newMax >=
														currentMinValue
													) {
														!isDisabled &&
															updateResponsiveValue(
																activeDevice,
																newMax,
																'max'
															);
													}
												},
												disabled: isDisabled,
												className:
													'fotogrids-range-slider fotogrids-range-slider-max',
											}),
										]
									),
								]
							);
						})(),

						h(
							'div',
							{
								className:
									'fotogrids-responsive-minmax-range__inputs',
							},
							[
								h(
									'div',
									{
										className:
											'fotogrids-responsive-minmax-range__input-group',
									},
									[
										h(
											'label',
											{
												className:
													'fotogrids-responsive-minmax-range__label',
											},
											__('Min', 'fotogrids')
										),
										h(
											'div',
											{
												className:
													'fotogrids-responsive-setting__input',
											},
											[
												h('input', {
													type: 'number',
													min: minMin,
													max: currentMaxValue,
													value: currentMinValue,
													onChange: (e) => {
														const _vm = parseInt(
															e.target.value
														);
														const newMin =
															Number.isFinite(_vm)
																? _vm
																: minMin;
														if (
															newMin <=
															currentMaxValue
														) {
															!isDisabled &&
																updateResponsiveValue(
																	activeDevice,
																	newMin,
																	'min'
																);
														}
													},
													disabled: isDisabled,
													className:
														'fotogrids-range-number-input',
												}),
											]
										),
									]
								),
								h(
									'div',
									{
										className:
											'fotogrids-responsive-minmax-range__input-group',
									},
									[
										h(
											'label',
											{
												className:
													'fotogrids-responsive-minmax-range__label',
											},
											__('Max', 'fotogrids')
										),
										h(
											'div',
											{
												className:
													'fotogrids-responsive-setting__input',
											},
											[
												h('input', {
													type: 'number',
													min: currentMinValue,
													max: maxMax,
													value: currentMaxValue,
													onChange: (e) => {
														const _vx = parseInt(
															e.target.value
														);
														const newMax =
															Number.isFinite(_vx)
																? _vx
																: maxMax;
														if (
															newMax >=
															currentMinValue
														) {
															!isDisabled &&
																updateResponsiveValue(
																	activeDevice,
																	newMax,
																	'max'
																);
														}
													},
													disabled: isDisabled,
													className:
														'fotogrids-range-number-input',
												}),
											]
										),
									]
								),
								hasUnits &&
									h(
										'div',
										{
											className:
												'fotogrids-responsive-minmax-range__unit-selector',
										},
										[
											window.FotoGridsRenderSettings
												?.CustomUnitSelect &&
											typeof React !== 'undefined'
												? React.createElement(
														window
															.FotoGridsRenderSettings
															.CustomUnitSelect,
														{
															value:
																currentMinUnit ||
																currentMaxUnit ||
																setting
																	.units[0],
															onChange: (e) =>
																!isDisabled &&
																updateResponsiveUnit(
																	activeDevice,
																	e.target
																		.value
																),
															disabled:
																isDisabled,
															className:
																'fotogrids-units-select',
															options:
																setting.units.map(
																	(
																		unitOption
																	) => ({
																		value: unitOption,
																		label: unitOption,
																	})
																),
														}
													)
												: h(
														'select',
														{
															value:
																currentMinUnit ||
																currentMaxUnit ||
																setting
																	.units[0],
															onChange: (e) =>
																!isDisabled &&
																updateResponsiveUnit(
																	activeDevice,
																	e.target
																		.value
																),
															disabled:
																isDisabled,
															className:
																'fotogrids-units-select',
														},
														setting.units.map(
															(unitOption) =>
																h(
																	'option',
																	{
																		key: unitOption,
																		value: unitOption,
																	},
																	unitOption
																)
														)
													),
										]
									),
							].filter(Boolean)
						),
						h(
							'div',
							{
								className:
									'fotogrids-responsive-setting__devices',
							},
							devices.map((device) =>
								h(
									'button',
									{
										key: device.key,
										type: 'button',
										className: `fotogrids-responsive-device-btn ${activeDevice === device.key ? 'fg-is-active' : ''}`,
										onClick: (e) => {
											e.preventDefault();
											e.stopPropagation();
											setActiveDevice(device.key);
										},
										disabled: isDisabled,
										title: device.label,
									},
									renderIcon(device.icon)
								)
							)
						),
					].filter(Boolean)
				),

				setting.description &&
					h(
						'p',
						{
							className: 'fotogrids-setting__description',
						},
						setting.description
					),
			]
		);
	}

	const currentDeviceValue = hasUnits
		? currentDeviceData?.value !== undefined
			? currentDeviceData.value
			: setting.responsive[activeDevice].default
		: currentDeviceData !== undefined
			? currentDeviceData
			: setting.responsive[activeDevice].default;
	const currentDeviceUnit = hasUnits
		? currentDeviceData?.unit || setting.units[0]
		: null;

	// Per-device step (defaults to 1). A fractional step - or an explicit
	// allow_decimals flag - switches parsing to parseFloat so values like
	// 1.2em are preserved instead of being truncated to 1.
	const activeStep =
		setting.responsive[activeDevice].step ?? setting.step ?? 1;
	const allowDecimals =
		setting.allow_decimals === true || Number(activeStep) % 1 !== 0;
	const parseValue = (raw) =>
		allowDecimals ? parseFloat(raw) : parseInt(raw, 10);

	return h(
		'div',
		{
			className: 'fotogrids-responsive-setting',
		},
		[
			h(
				'div',
				{
					className: 'fotogrids-responsive-setting__header',
				},
				[
					h(
						'label',
						{
							className: 'fotogrids-setting__label',
						},
						[
							setting.label,
							setting.unit &&
								h(
									'span',
									{
										className: 'fotogrids-setting__unit',
									},
									` (${setting.unit})`
								),
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
						'span',
						{
							className:
								'fotogrids-responsive-setting__device-icon',
						},
						renderIcon(activeDeviceData.icon)
					),
				]
			),

			h(
				'div',
				{
					className: `fotogrids-responsive-setting__controls${noRange ? ' fotogrids-responsive-setting__controls--no-range' : ''}`,
				},
				[
					!noRange &&
						h(
							'div',
							{
								className:
									'fotogrids-responsive-setting__range',
							},
							[
								h('input', {
									type: 'range',
									min: setting.responsive[activeDevice].min,
									max: setting.responsive[activeDevice].max,
									step: activeStep,
									value: currentDeviceValue,
									onChange: (e) =>
										!isDisabled &&
										updateResponsiveValue(
											activeDevice,
											parseValue(e.target.value)
										),
									disabled: isDisabled,
									className: 'fotogrids-range-slider',
								}),
							]
						),

					h(
						'div',
						{
							className: 'fotogrids-responsive-setting__input',
						},
						[
							h('input', {
								type: 'number',
								min: setting.responsive[activeDevice].min,
								max: setting.responsive[activeDevice].max,
								step: activeStep,
								value: currentDeviceValue,
								onChange: (e) => {
									const v = parseValue(e.target.value);
									!isDisabled &&
										updateResponsiveValue(
											activeDevice,
											Number.isFinite(v)
												? v
												: setting.responsive[
														activeDevice
													].default
										);
								},
								disabled: isDisabled,
								className: 'fotogrids-range-number-input',
							}),
							hasUnits &&
								(window.FotoGridsRenderSettings
									?.CustomUnitSelect &&
								typeof React !== 'undefined'
									? React.createElement(
											window.FotoGridsRenderSettings
												.CustomUnitSelect,
											{
												value: currentDeviceUnit,
												onChange: (e) =>
													!isDisabled &&
													updateResponsiveUnit(
														activeDevice,
														e.target.value
													),
												disabled: isDisabled,
												className:
													'fotogrids-units-select',
												options: setting.units.map(
													(unitOption) => ({
														value: unitOption,
														label: unitOption,
													})
												),
											}
										)
									: h(
											'select',
											{
												value: currentDeviceUnit,
												onChange: (e) =>
													!isDisabled &&
													updateResponsiveUnit(
														activeDevice,
														e.target.value
													),
												disabled: isDisabled,
												className:
													'fotogrids-units-select',
											},
											setting.units.map((unitOption) =>
												h(
													'option',
													{
														key: unitOption,
														value: unitOption,
													},
													unitOption
												)
											)
										)),
						].filter(Boolean)
					),

					h(
						'div',
						{
							className: 'fotogrids-responsive-setting__devices',
						},
						devices.map((device) =>
							h(
								'button',
								{
									key: device.key,
									type: 'button',
									className: `fotogrids-responsive-device-btn ${activeDevice === device.key ? 'fg-is-active' : ''}`,
									onClick: (e) => {
										e.preventDefault();
										e.stopPropagation();
										setActiveDevice(device.key);
									},
									disabled: isDisabled,
									title: device.label,
								},
								renderIcon(device.icon)
							)
						)
					),
				]
			),

			setting.description &&
				h(
					'p',
					{
						className: 'fotogrids-setting__description',
					},
					setting.description
				),
		]
	);
};

// Two-sided (width / height) range. Non-responsive; values persist as
// { width: { value, unit }, height: { value, unit } }. `_linked` is a UI-only
// flag held in React state and never persisted - mirrors the four-sided field.
function renderTwoSided(setting, currentValue, isDisabled, ctx) {
	const { createElement: h } = wp.element;
	const {
		updateSetting,
		updateSettingStateOnly,
		renderIcon,
		getFieldState,
		siblingValueOf,
		__,
	} = ctx;

	const sides = ['width', 'height'];
	const unit = Array.isArray(setting.units) ? setting.units[0] : 'px';
	const range = setting.responsive?.desktop || {
		min: 0,
		max: 100,
		default: 10,
	};
	const sideLabels = setting.side_labels || {
		width: __('Width', 'fotogrids'),
		height: __('Height', 'fotogrids'),
	};

	const stateOnly =
		typeof updateSettingStateOnly === 'function'
			? updateSettingStateOnly
			: updateSetting;

	const settingState =
		typeof getFieldState === 'function'
			? getFieldState(setting.key, currentValue)
			: 'editable';
	const showSettingBadge = settingState !== 'editable';
	const settingBadgeText =
		settingState === 'locked'
			? __('Locked', 'fotogrids')
			: __('Pro', 'fotogrids');

	const sideValue = (val, side) => {
		const sv = val && typeof val === 'object' ? val[side] : undefined;
		if (sv && typeof sv === 'object') {
			return sv.value ?? range.default;
		}
		return sv ?? range.default;
	};

	const normalized = {
		width:
			currentValue && typeof currentValue === 'object'
				? sideValue(currentValue, 'width')
				: range.default,
		height:
			currentValue && typeof currentValue === 'object'
				? sideValue(currentValue, 'height')
				: range.default,
	};

	const linkedRaw = currentValue?._linked;
	const isLinked =
		linkedRaw === undefined
			? normalized.width === normalized.height
			: linkedRaw !== false && linkedRaw !== '0' && linkedRaw !== 0;

	const widthDisabledByStretch = (() => {
		const gate = setting.disable_width_when;
		if (!gate || !gate.dependsOn) {
			return false;
		}
		const depVal =
			typeof siblingValueOf === 'function'
				? siblingValueOf(gate.dependsOn)
				: undefined;
		const wanted = Array.isArray(gate.values) ? gate.values : [gate.values];
		return wanted.some((v) => String(v) === String(depVal));
	})();

	const buildValue = (width, height) => ({
		width: { value: width, unit },
		height: { value: height, unit },
	});
	const withLinked = (val, linked) => ({ ...val, _linked: linked });
	const withoutLinked = (val) => {
		const { _linked, ...rest } = val;
		return rest;
	};

	const commit = (width, height, linked) => {
		const val = buildValue(width, height);
		updateSetting(setting.key, withoutLinked(val));
		stateOnly(setting.key, withLinked(val, linked));
	};

	const updateSide = (side, value) => {
		if (isLinked) {
			commit(value, value, true);
			return;
		}
		const next = { ...normalized, [side]: value };
		commit(next.width, next.height, false);
	};

	const updateLinkedSlider = (value) => commit(value, value, true);

	const handleLinkToggle = () => {
		if (isLinked) {
			stateOnly(
				setting.key,
				withLinked(
					buildValue(normalized.width, normalized.height),
					false
				)
			);
		} else {
			commit(normalized.width, normalized.width, true);
		}
	};

	const sliderValue = isLinked ? normalized.width : normalized.width;

	return h(
		'div',
		{ className: 'fotogrids-responsive-setting' },
		[
			h('div', { className: 'fotogrids-responsive-setting__header' }, [
				h(
					'label',
					{ className: 'fotogrids-setting__label' },
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
			]),

			h(
				'div',
				{
					className:
						'fotogrids-responsive-setting__controls fotogrids-responsive-setting__controls--two-sided',
				},
				[
					h(
						'div',
						{ className: 'fotogrids-responsive-setting__range' },
						[
							h('input', {
								type: 'range',
								min: range.min,
								max: range.max,
								value: sliderValue,
								onChange: (e) =>
									!isDisabled &&
									updateLinkedSlider(
										parseInt(e.target.value, 10)
									),
								disabled: isDisabled || !isLinked,
								className: 'fotogrids-range-slider',
							}),
						]
					),

					h(
						'div',
						{ className: 'fotogrids-responsive-setting__input' },
						[
							h(
								'div',
								{
									key: 'two-inputs',
									className: 'fotogrids-fourside-inputs',
								},
								sides.map((side) =>
									h(
										'div',
										{
											key: side,
											className:
												'fotogrids-fourside-input-group',
										},
										[
											h('input', {
												type: 'number',
												min: range.min,
												max: range.max,
												value: normalized[side],
												onChange: (e) => {
													if (isDisabled) return;
													const parsed = parseInt(
														e.target.value,
														10
													);
													updateSide(
														side,
														Number.isFinite(parsed)
															? parsed
															: range.default
													);
												},
												disabled:
													isDisabled ||
													(side === 'width' &&
														widthDisabledByStretch),
												className:
													'fotogrids-range-number-input',
											}),
											h(
												'span',
												{
													className:
														'fotogrids-fourside-label',
												},
												sideLabels[side]
											),
										]
									)
								)
							),
						]
					),

					h(
						'button',
						{
							type: 'button',
							className: `fotogrids-fourside-link-btn${isLinked ? ' fg-is-active' : ''}`,
							onClick: (e) => {
								e.preventDefault();
								e.stopPropagation();
								!isDisabled && handleLinkToggle();
							},
							disabled: isDisabled,
							title: isLinked
								? __('Unlink values', 'fotogrids')
								: __('Link values', 'fotogrids'),
						},
						renderIcon('link')
					),
				]
			),

			widthDisabledByStretch &&
				h(
					'p',
					{ className: 'fotogrids-setting__description' },
					__(
						'Width follows the track while alignment is Stretch.',
						'fotogrids'
					)
				),

			setting.description &&
				h(
					'p',
					{ className: 'fotogrids-setting__description' },
					setting.description
				),
		].filter(Boolean)
	);
}

// Unit selector shared between linked and unlinked four-sided UI.
function renderUnitSelect(h, currentUnit, onChange, isDisabled, setting) {
	return window.FotoGridsRenderSettings?.CustomUnitSelect &&
		typeof React !== 'undefined'
		? React.createElement(window.FotoGridsRenderSettings.CustomUnitSelect, {
				value: currentUnit,
				onChange: (e) => onChange(e.target.value),
				disabled: isDisabled,
				className: 'fotogrids-units-select',
				options: setting.units.map((u) => ({ value: u, label: u })),
			})
		: h(
				'select',
				{
					value: currentUnit,
					onChange: (e) => onChange(e.target.value),
					disabled: isDisabled,
					className: 'fotogrids-units-select',
				},
				setting.units.map((u) => h('option', { key: u, value: u }, u))
			);
}
