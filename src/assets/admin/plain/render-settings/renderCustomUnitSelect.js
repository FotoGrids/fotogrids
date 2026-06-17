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

	const { createElement, useState, useEffect, useRef } = React;

	const { value, onChange, options, disabled, className = '' } = props;

	/*
	 * React availability is constant for the lifetime of the page, so the
	 * early fallback above never changes the hook call order between renders.
	 * The rule cannot prove this, so it is disabled for this hook block only.
	 */
	/* eslint-disable react-hooks/rules-of-hooks */
	const [isOpen, setIsOpen] = useState(false);
	const [openDirection, setOpenDirection] = useState('down');
	const containerRef = useRef(null);
	const selectRef = useRef(null);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);

			if (containerRef.current) {
				const rect = containerRef.current.getBoundingClientRect();
				const spaceBelow = window.innerHeight - rect.bottom;
				const spaceAbove = rect.top;
				const dropdownHeight = options.length * 40 + 8;

				if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
					setOpenDirection('up');
				} else {
					setOpenDirection('down');
				}
			}
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen, options.length]);
	/* eslint-enable react-hooks/rules-of-hooks */

	const handleSelect = (optionValue) => {
		if (onChange && !disabled) {
			onChange({ target: { value: optionValue } });
			setIsOpen(false);
		}
	};

	const selectedOption =
		options.find((opt) => opt.value === value) || options[0];

	return createElement(
		'div',
		{
			ref: containerRef,
			className: `fotogrids-unit-select ${className} ${isOpen ? 'fg-is-open' : ''} ${openDirection === 'up' ? 'fg-opens-up' : 'fg-opens-down'}`,
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
			isOpen &&
				createElement(
					'div',
					{
						key: 'dropdown',
						className: `fotogrids-unit-select__dropdown fotogrids-unit-select__dropdown--${openDirection}`,
						role: 'listbox',
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
		]
	);
};
