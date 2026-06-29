window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.CustomUnitSelect = function CustomUnitSelect(
	props
) {
	if (typeof React === 'undefined') {
		const { createElement: h } = wp.element;
		return h(
			'select',
			{
				value: props.value,
				onChange: props.onChange,
				disabled: props.disabled,
				className: props.className || 'fotogrids-units-select',
			},
			(props.options || []).map((option) =>
				h(
					'option',
					{
						key: option.value,
						value: option.value,
					},
					option.label || option.value
				)
			)
		);
	}

	const { createElement, useState, useEffect, useRef, useCallback } = React;
	const createPortal =
		(wp.element && wp.element.createPortal) ||
		(window.ReactDOM && window.ReactDOM.createPortal);

	const { value, onChange, options, disabled, className = '' } = props;

	// Estimated dropdown height for the up/down decision: each option is 40px
	// tall plus the container's 8px of border/padding.
	const dropdownHeight = options.length * 40 + 8;

	/*
	 * React availability is constant for the lifetime of the page, so the
	 * early fallback above never changes the hook call order between renders.
	 * The rule cannot prove this, so it is disabled for this hook block only.
	 */
	/* eslint-disable react-hooks/rules-of-hooks */
	const [isOpen, setIsOpen] = useState(false);
	// Viewport-relative placement for the portalled dropdown. The dropdown is
	// rendered into document.body with position:fixed, so it escapes any
	// overflow:hidden ancestor (e.g. the settings sub-tab panel) that would
	// otherwise clip it. Coordinates are derived from the trigger button's
	// bounding rect and refreshed while open.
	const [placement, setPlacement] = useState({
		top: 0,
		left: 0,
		width: 0,
		direction: 'down',
	});
	const containerRef = useRef(null);
	const selectRef = useRef(null);
	const dropdownRef = useRef(null);

	const computePlacement = useCallback(() => {
		const button = selectRef.current;
		if (!button) return;

		const rect = button.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const spaceAbove = rect.top;
		const direction =
			spaceBelow < dropdownHeight && spaceAbove > spaceBelow
				? 'up'
				: 'down';

		setPlacement({
			top: direction === 'up' ? rect.top : rect.bottom,
			left: rect.left,
			width: rect.width,
			direction,
		});
	}, [dropdownHeight]);

	useEffect(() => {
		if (!isOpen) return undefined;

		// A click inside either the trigger or the (portalled) dropdown is
		// "inside"; the dropdown is no longer a DOM descendant of the trigger
		// once portalled, so it must be checked explicitly.
		const handleClickOutside = (event) => {
			const inTrigger =
				containerRef.current &&
				containerRef.current.contains(event.target);
			const inDropdown =
				dropdownRef.current &&
				dropdownRef.current.contains(event.target);
			if (!inTrigger && !inDropdown) {
				setIsOpen(false);
			}
		};

		// Fixed coordinates are computed once per open, so any scroll (capture:
		// true catches the inner settings-panel scroll, not just window) or
		// resize must refresh both the position and the up/down direction.
		const handleReposition = () => computePlacement();

		computePlacement();
		document.addEventListener('mousedown', handleClickOutside);
		window.addEventListener('scroll', handleReposition, true);
		window.addEventListener('resize', handleReposition);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			window.removeEventListener('scroll', handleReposition, true);
			window.removeEventListener('resize', handleReposition);
		};
	}, [isOpen, computePlacement]);
	/* eslint-enable react-hooks/rules-of-hooks */

	const handleSelect = (optionValue) => {
		if (onChange && !disabled) {
			onChange({ target: { value: optionValue } });
			setIsOpen(false);
		}
	};

	const selectedOption =
		options.find((opt) => opt.value === value) || options[0];

	const dropdownStyle = {
		position: 'fixed',
		left: `${placement.left}px`,
		width: `${placement.width}px`,
	};
	if (placement.direction === 'up') {
		// Anchor the bottom edge above the trigger so the list grows upward.
		dropdownStyle.bottom = `${window.innerHeight - placement.top + 4}px`;
	} else {
		dropdownStyle.top = `${placement.top + 4}px`;
	}

	const dropdown =
		isOpen &&
		createPortal(
			createElement(
				'div',
				{
					ref: dropdownRef,
					className: `fotogrids-unit-select__dropdown fotogrids-unit-select__dropdown--${placement.direction}`,
					role: 'listbox',
					style: dropdownStyle,
				},
				options.map((option, index) =>
					createElement(
						'button',
						{
							key: option.value || index,
							type: 'button',
							className: `fotogrids-unit-select__option ${option.value === value ? 'fg-is-selected' : ''}`,
							onClick: () => handleSelect(option.value),
							role: 'option',
							'aria-selected': option.value === value,
						},
						option.label || option.value
					)
				)
			),
			document.body
		);

	return createElement(
		'div',
		{
			ref: containerRef,
			className: `fotogrids-unit-select ${className} ${isOpen ? 'fg-is-open' : ''} ${placement.direction === 'up' ? 'fg-opens-up' : 'fg-opens-down'}`,
			style: { position: 'relative' },
		},
		[
			createElement(
				'button',
				{
					ref: selectRef,
					key: 'button',
					type: 'button',
					className: 'fotogrids-unit-select__button',
					onClick: () => !disabled && setIsOpen(!isOpen),
					disabled,
					'aria-expanded': isOpen,
					'aria-haspopup': 'listbox',
				},
				[
					createElement(
						'span',
						{
							key: 'value',
							className: 'fotogrids-unit-select__value',
						},
						selectedOption.label || selectedOption.value
					),
					createElement('span', {
						key: 'arrow',
						className: 'fotogrids-unit-select__arrow',
						dangerouslySetInnerHTML: {
							__html: window.FotoGridsIcons?.chevron_down || '▼',
						},
					}),
				]
			),
			dropdown,
		]
	);
};
