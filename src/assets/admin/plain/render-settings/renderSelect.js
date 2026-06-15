window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const RenderSelectComponent = ({
	setting,
	selectedOption,
	topOptions = [],
	groups = [],
	isDisabled = false,
	getFieldState,
	renderIcon,
	__,
	searchEnabled = false,
	searchTerm = '',
	onSearchTermChange,
	searchPlaceholder,
	onSelect,
	onOpen,
	onClose,
	onDropdownScroll,
	getOptionStyle,
	getOptionClassName,
	renderOptionLabel,
	rootClassName = '',
	triggerClassName = '',
	dropdownClassName = '',
	optionsClassName = '',
	maxDropdownHeight = null,
}) => {
	const {
		createElement: h,
		createPortal,
		useCallback,
		useEffect,
		useRef,
		useState,
	} = wp.element;

	const triggerRef = useRef(null);
	const dropdownRef = useRef(null);
	const searchInputRef = useRef(null);
	const onOpenRef = useRef(onOpen);
	const [isOpen, setIsOpen] = useState(false);
	useEffect(() => {
		onOpenRef.current = onOpen;
	}, [onOpen]);

	const [dropdownPosition, setDropdownPosition] = useState(null);
	const listboxIdRef = useRef(
		`fotogrids-select-${Math.random().toString(36).slice(2, 10)}`,
	);
	const listboxId = listboxIdRef.current;

	const settingState =
		typeof getFieldState === 'function'
			? getFieldState(setting.key, selectedOption?.value)
			: 'editable';
	const showSettingBadge = settingState !== 'editable';
	const settingBadgeText =
		settingState === 'locked'
			? __('Locked', 'fotogrids')
			: __('Pro', 'fotogrids');

	const closeDropdown = useCallback(() => {
		setIsOpen(false);
		if (typeof onClose === 'function') {
			onClose();
		}
	}, [onClose]);

	const updateDropdownPosition = useCallback(() => {
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
		const desiredMargin = 4;
		const minPanelHeight = 180;
		const availableBelow =
			viewportHeight - triggerRect.bottom - desiredMargin - sidePadding;
		const availableAbove = triggerRect.top - desiredMargin - sidePadding;

		const placement =
			availableBelow >= minPanelHeight || availableBelow >= availableAbove
				? 'bottom'
				: 'top';
		const maxHeight = Math.max(
			120,
			placement === 'bottom' ? availableBelow : availableAbove,
		);
		const resolvedMaxHeight =
			typeof maxDropdownHeight === 'number' && maxDropdownHeight > 0
				? Math.min(maxHeight, maxDropdownHeight)
				: maxHeight;

		const width = Math.min(
			Math.max(triggerRect.width, 180),
			viewportWidth - sidePadding * 2,
		);

		const left = Math.min(
			Math.max(sidePadding, triggerRect.left),
			Math.max(sidePadding, viewportWidth - width - sidePadding),
		);

		// For top placement we anchor at the trigger's top edge and use
		// transform: translateY(-100%) in the dropdown style so the gap
		// above the trigger is exactly `desiredMargin` regardless of the
		// dropdown's actual rendered height. Matches Select.jsx.
		const top =
			placement === 'bottom'
				? triggerRect.bottom + desiredMargin
				: triggerRect.top - desiredMargin;

		setDropdownPosition({
			top: top + scrollY,
			left: left + scrollX,
			width,
			maxHeight: resolvedMaxHeight,
			placement,
		});
	}, [maxDropdownHeight]);

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}

		updateDropdownPosition();

		const handleLayoutShift = () => {
			updateDropdownPosition();
		};

		window.addEventListener('resize', handleLayoutShift);

		return () => {
			window.removeEventListener('resize', handleLayoutShift);
		};
	}, [isOpen, updateDropdownPosition, groups, topOptions, searchTerm]);

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}

		const handlePointerDown = event => {
			const clickedInsideTrigger =
				triggerRef.current && triggerRef.current.contains(event.target);
			const clickedInsideDropdown =
				dropdownRef.current &&
				dropdownRef.current.contains(event.target);

			if (!clickedInsideTrigger && !clickedInsideDropdown) {
				closeDropdown();
			}
		};

		const handleEscape = event => {
			if (event.key === 'Escape') {
				closeDropdown();
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen, closeDropdown]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (typeof onOpenRef.current === 'function') {
			onOpenRef.current();
		}

		if (searchEnabled) {
			requestAnimationFrame(() => {
				if (searchInputRef.current) {
					searchInputRef.current.focus();
				}
			});
		}
	}, [isOpen, searchEnabled]);

	const openOrCloseDropdown = () => {
		if (isDisabled) {
			return;
		}

		setIsOpen(previousState => !previousState);
	};

	const renderOption = (option, optionKeyPrefix) => {
		const isSelected = selectedOption?.value === option.value;
		const customClassName =
			typeof getOptionClassName === 'function'
				? getOptionClassName(option, isSelected)
				: '';

		return h(
			'button',
			{
				type: 'button',
				key: `${optionKeyPrefix}-${option.value}`,
				className: [
					'fotogrids-render-select__option',
					isSelected ? 'is-selected' : '',
					customClassName || '',
				]
					.filter(Boolean)
					.join(' '),
				style:
					typeof getOptionStyle === 'function'
						? getOptionStyle(option, isSelected)
						: undefined,
				role: 'option',
				'aria-selected': isSelected,
				onClick: () => {
					if (typeof onSelect === 'function') {
						onSelect(option.value, option);
					}
					closeDropdown();
				},
			},
			typeof renderOptionLabel === 'function'
				? renderOptionLabel(option, isSelected)
				: option.label,
		);
	};

	const dropdownElement =
		isOpen && dropdownPosition
			? h(
					'div',
					{
						className: [
							'fotogrids-render-select__dropdown',
							`fotogrids-render-select__dropdown--${dropdownPosition.placement}`,
							dropdownClassName,
						]
							.filter(Boolean)
							.join(' '),
						style: {
							position: 'absolute',
							top: `${dropdownPosition.top}px`,
							left: `${dropdownPosition.left}px`,
							width: `${dropdownPosition.width}px`,
							maxHeight: `${dropdownPosition.maxHeight}px`,
							transform:
								dropdownPosition.placement === 'top'
									? 'translateY(-100%)'
									: undefined,
						},
						ref: dropdownRef,
					},
					[
						searchEnabled &&
							h(
								'div',
								{
									className:
										'fotogrids-render-select__search',
									key: 'search',
								},
								h('input', {
									ref: searchInputRef,
									type: 'text',
									className:
										'fotogrids-input fotogrids-render-select__search-input',
									placeholder:
										searchPlaceholder ||
										__('Search...', 'fotogrids'),
									value: searchTerm,
									onChange: event => {
										if (
											typeof onSearchTermChange ===
											'function'
										) {
											onSearchTermChange(
												event.target.value,
											);
										}
									},
									onKeyDown: event => event.stopPropagation(),
								}),
							),
						h(
							'div',
							{
								className: [
									'fotogrids-render-select__options',
									optionsClassName,
								]
									.filter(Boolean)
									.join(' '),
								id: listboxId,
								role: 'listbox',
								onScroll: onDropdownScroll,
							},
							[
								...topOptions.map(option =>
									renderOption(option, 'top'),
								),
								...groups.map((group, groupIndex) =>
									h(
										'div',
										{
											className:
												'fotogrids-render-select__group',
											key:
												group.id ||
												`group-${groupIndex}`,
										},
										[
											group.label &&
												h(
													'div',
													{
														className:
															'fotogrids-render-select__group-label',
													},
													group.label,
												),
											...(Array.isArray(group.options)
												? group.options.map(option =>
														renderOption(
															option,
															group.id ||
																`group-${groupIndex}`,
														),
													)
												: []),
											group.status &&
												h(
													'div',
													{
														className:
															'fotogrids-render-select__status',
													},
													group.status,
												),
										],
									),
								),
							],
						),
					],
				)
			: null;

	const portalElement =
		dropdownElement && typeof createPortal === 'function'
			? createPortal(dropdownElement, document.body)
			: dropdownElement;

	return h(
		'div',
		{
			className: [
				'fotogrids-render-select',
				rootClassName,
				isOpen ? 'fotogrids-render-select--is-open' : '',
			]
				.filter(Boolean)
				.join(' '),
		},
		[
			setting.label &&
				h(
					'label',
					{
						className: 'fotogrids-setting__label',
						key: 'label',
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
			h(
				'button',
				{
					type: 'button',
					ref: triggerRef,
					className: [
						'fotogrids-render-select__trigger',
						triggerClassName,
					]
						.filter(Boolean)
						.join(' '),
					disabled: isDisabled,
					'aria-expanded': isOpen,
					'aria-haspopup': 'listbox',
					'aria-controls': listboxId,
					onClick: openOrCloseDropdown,
					key: 'trigger',
				},
				h(
					'span',
					{
						className: 'fotogrids-render-select__selected',
						style:
							typeof getOptionStyle === 'function'
								? getOptionStyle(selectedOption, true)
								: undefined,
					},
					selectedOption?.label || '',
				),
				h(
					'span',
					{
						className: 'fotogrids-render-select__caret',
						'aria-hidden': 'true',
					},
					renderIcon('chevron_down'),
				),
			),
			setting.description &&
				h(
					'div',
					{
						className: 'fotogrids-setting__description',
						key: 'description',
					},
					setting.description,
				),
			portalElement,
		].filter(Boolean),
	);
};

window.FotoGridsRenderSettings.renderSelect = config => {
	return wp.element.createElement(RenderSelectComponent, config);
};
