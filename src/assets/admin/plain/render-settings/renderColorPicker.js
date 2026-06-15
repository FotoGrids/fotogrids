window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderColorPicker = (
	setting,
	currentValue,
	isDisabled,
	{ updateSetting, getFieldState, __ },
) => {
	const {
		createElement: h,
		createPortal,
		useState,
		useEffect,
		useRef,
		useCallback,
	} = wp.element;

	const settingState =
		typeof getFieldState === 'function'
			? getFieldState(setting.key, currentValue)
			: 'editable';
	const showSettingBadge = settingState !== 'editable';
	const settingBadgeText =
		settingState === 'locked'
			? __('Locked', 'fotogrids')
			: __('Pro', 'fotogrids');

	return h(AlphaColorPicker, {
		key: setting.key,
		setting,
		currentValue,
		isDisabled,
		updateSetting,
		showSettingBadge,
		settingBadgeText,
		h,
		useState,
		useEffect,
		useRef,
		useCallback,
		createPortal,
		__,
	});
};

/**
 * Alpha-aware color picker field.
 *
 * Renders a swatch + text display. Clicking the swatch opens the custom
 * FGColorPicker widget in a popover. The popover closes on outside click
 * or Escape.
 */
function AlphaColorPicker({
	setting,
	currentValue,
	isDisabled,
	updateSetting,
	showSettingBadge,
	settingBadgeText,
	h,
	useState,
	useEffect,
	useRef,
	useCallback,
	createPortal,
	__,
}) {
	const defaultValue = setting.default || '#000000';
	const value = currentValue || defaultValue;

	const [open, setOpen] = useState(false);
	const [popoverPosition, setPopoverPosition] = useState(null);
	const wrapRef = useRef(null);
	const triggerRef = useRef(null);
	const pickerRef = useRef(null);
	const popoverRef = useRef(null);
	const internalChange = useRef(false);

	const updatePopoverPosition = useCallback(() => {
		if (!triggerRef.current) {
			return;
		}

		const triggerRect = triggerRef.current.getBoundingClientRect();
		const viewportHeight =
			window.innerHeight || document.documentElement.clientHeight || 0;
		const viewportWidth =
			window.innerWidth || document.documentElement.clientWidth || 0;
		const scrollX =
			window.pageXOffset || document.documentElement.scrollLeft || 0;
		const scrollY =
			window.pageYOffset || document.documentElement.scrollTop || 0;
		const sidePadding = 8;
		const desiredMargin = 8;
		const fallbackWidth = 280;
		const fallbackHeight = 360;

		const measuredWidth = popoverRef.current
			? popoverRef.current.getBoundingClientRect().width
			: fallbackWidth;
		// Only used to decide above-vs-below placement. The actual vertical
		// anchor below does NOT depend on this — we anchor at the trigger top
		// and use transform: translateY(-100%) so the gap is always exactly
		// desiredMargin regardless of the popover's rendered height.
		const measuredHeight = popoverRef.current
			? popoverRef.current.getBoundingClientRect().height
			: fallbackHeight;

		const width = Math.min(
			Math.max(measuredWidth, triggerRect.width),
			Math.max(0, viewportWidth - sidePadding * 2),
		);
		const left = Math.min(
			Math.max(sidePadding, triggerRect.left),
			Math.max(sidePadding, viewportWidth - width - sidePadding),
		);

		const spaceBelow =
			viewportHeight - triggerRect.bottom - desiredMargin - sidePadding;
		const spaceAbove = triggerRect.top - desiredMargin - sidePadding;
		const showBelow =
			spaceBelow >= measuredHeight || spaceBelow >= spaceAbove;
		const placement = showBelow ? 'bottom' : 'top';
		const top = showBelow
			? triggerRect.bottom + desiredMargin
			: triggerRect.top - desiredMargin;

		const nextPosition = {
			top: top + scrollY,
			left: left + scrollX,
			placement,
		};

		setPopoverPosition(previousPosition => {
			if (
				previousPosition &&
				previousPosition.top === nextPosition.top &&
				previousPosition.left === nextPosition.left &&
				previousPosition.placement === nextPosition.placement
			) {
				return previousPosition;
			}

			return nextPosition;
		});
	}, []);

	useEffect(() => {
		if (!open || !popoverPosition || !popoverRef.current) return;
		if (pickerRef.current) return;

		const instance = window.FGColorPicker.create({
			value,
			disabled: isDisabled,
			onChange: cssStr => {
				internalChange.current = true;
				updateSetting(setting.key, cssStr);
				internalChange.current = false;
			},
		});

		popoverRef.current.appendChild(instance.element);
		pickerRef.current = instance;
	}, [open, popoverPosition, value, isDisabled, updateSetting, setting.key]);

	useEffect(() => {
		if (open) return;
		if (!pickerRef.current) return;

		pickerRef.current.destroy();
		pickerRef.current = null;
	}, [open]);

	useEffect(
		() => () => {
			if (!pickerRef.current) return;
			pickerRef.current.destroy();
			pickerRef.current = null;
		},
		[],
	);

	// Sync picker value when the upstream value changes - but NOT when the
	// change originated from the picker itself (that would cause a feedback
	// loop: drag → onChange → setValue → parseCssColor → rgbToHsv → hue lost).
	useEffect(() => {
		if (open && pickerRef.current && !internalChange.current) {
			pickerRef.current.setValue(value);
		}
	}, [open, value]);

	useEffect(() => {
		if (!open) return;

		const handleClick = e => {
			const clickedInsideTrigger =
				wrapRef.current && wrapRef.current.contains(e.target);
			const clickedInsidePopover =
				popoverRef.current && popoverRef.current.contains(e.target);

			if (!clickedInsideTrigger && !clickedInsidePopover) {
				setOpen(false);
			}
		};
		const handleKey = e => {
			if (e.key === 'Escape') setOpen(false);
		};
		const handleLayoutShift = () => {
			updatePopoverPosition();
		};

		document.addEventListener('mousedown', handleClick);
		document.addEventListener('keydown', handleKey);
		window.addEventListener('resize', handleLayoutShift);

		updatePopoverPosition();
		requestAnimationFrame(updatePopoverPosition);

		return () => {
			document.removeEventListener('mousedown', handleClick);
			document.removeEventListener('keydown', handleKey);
			window.removeEventListener('resize', handleLayoutShift);
			setPopoverPosition(null);
		};
	}, [open, updatePopoverPosition]);

	const [focused, setFocused] = useState(false);

	const toggleOpen = useCallback(() => {
		if (!isDisabled) setOpen(o => !o);
	}, [isDisabled]);

	const inputClassName = [
		'fotogrids-color-picker__input',
		open || focused ? 'fotogrids-color-picker__input--active' : '',
	]
		.filter(Boolean)
		.join(' ');

	return h(
		'div',
		{
			className: 'fotogrids-color-picker',
			ref: wrapRef,
		},
		[
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
							settingBadgeText,
						),
				].filter(Boolean),
			),
			h('div', { className: inputClassName, ref: triggerRef }, [
				h(
					'button',
					{
						type: 'button',
						className:
							'fotogrids-color-swatch' +
							(isDisabled
								? ' fotogrids-color-swatch--disabled'
								: ''),
						onClick: toggleOpen,
						onFocus: () => setFocused(true),
						onBlur: () => setFocused(false),
						disabled: isDisabled,
						'aria-label': __('Pick color', 'fotogrids'),
						'aria-expanded': open ? 'true' : 'false',
					},
					[
						h('span', {
							className: 'fotogrids-color-swatch__fill',
							style: { background: value },
						}),
					],
				),

				h('input', {
					type: 'text',
					className: 'fotogrids-color-text',
					value,
					readOnly: true,
					disabled: isDisabled,
					placeholder: setting.default || '#000000',
					onClick: toggleOpen,
					onFocus: () => {
						setFocused(true);
						toggleOpen();
					},
					onBlur: () => setFocused(false),
					style: { cursor: isDisabled ? 'not-allowed' : 'pointer' },
				}),
			]),

			open &&
				popoverPosition &&
				(typeof createPortal === 'function'
					? createPortal(
							h('div', {
								className:
									'fotogrids-color-popover fotogrids-color-popover--open',
								ref: popoverRef,
								style: {
									position: 'absolute',
									top: `${popoverPosition.top}px`,
									left: `${popoverPosition.left}px`,
									transform:
										popoverPosition.placement === 'top'
											? 'translateY(-100%)'
											: undefined,
								},
							}),
							document.body,
						)
					: h('div', {
							className:
								'fotogrids-color-popover fotogrids-color-popover--open',
							ref: popoverRef,
							style: {
								position: 'absolute',
								top: `${popoverPosition.top}px`,
								left: `${popoverPosition.left}px`,
								transform:
									popoverPosition.placement === 'top'
										? 'translateY(-100%)'
										: undefined,
							},
						})),
		],
	);
}

function isCompleteColor(str) {
	if (!str || typeof str !== 'string') return false;
	const s = str.trim();
	if (
		/^#[0-9A-Fa-f]{3}$/.test(s) ||
		/^#[0-9A-Fa-f]{6}$/.test(s) ||
		/^#[0-9A-Fa-f]{8}$/.test(s)
	)
		return true;
	if (/^rgba?\([^)]+\)$/.test(s)) return true;
	if (/^hsla?\([^)]+\)$/.test(s)) return true;
	if (/^[a-zA-Z]+$/.test(s)) return true;
	return false;
}
