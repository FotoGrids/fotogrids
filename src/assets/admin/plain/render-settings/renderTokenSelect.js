window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const TokenSelectComponent = ({
	setting,
	currentValue,
	isDisabled = false,
	updateSetting,
	getFieldState,
	getOptionState,
	renderIcon,
	isDefaultsMode,
	isOptionVisible,
	__,
}) => {
	const {
		createElement: h,
		createPortal,
		useCallback,
		useEffect,
		useRef,
		useState,
	} = wp.element;

	// The setting stores JSON: ["caption","exif",...] or legacy comma-string;
	// normalise to a plain JS array internally.
	const parseValue = (raw) => {
		if (Array.isArray(raw)) {
			return raw;
		}
		if (typeof raw === 'string' && raw.trim().startsWith('[')) {
			try {
				const parsed = JSON.parse(raw);
				return Array.isArray(parsed) ? parsed : [];
			} catch (e) {
				return [];
			}
		}
		if (typeof raw === 'string' && raw.trim().length > 0) {
			return raw
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
		}
		return [];
	};

	const serializeValue = (arr) => JSON.stringify(arr);

	// Options - filter isGlobalDefault in defaults mode (same as button_group),
	// then drop any option whose per-option `condition` evaluates false against
	// the current settings. Per-option conditions let us hide dropdown choices
	// that only make sense when another setting is on (e.g. an "Embedded"
	// placement that requires AJAX navigation to be on).
	const baseOptions = isDefaultsMode
		? (setting.options || []).filter((o) => !o.isGlobalDefault)
		: setting.options || [];
	const allOptions = baseOptions.filter((option) => {
		if (!option || !option.condition) return true;
		if (typeof isOptionVisible !== 'function') return true;
		return isOptionVisible(option);
	});

	const sortable = setting.sortable === true;
	const keepOpen = setting.keep_open === true;

	const [selectedValues, setSelectedValues] = useState(() =>
		parseValue(currentValue)
	);
	const [isOpen, setIsOpen] = useState(false);
	const [dropdownPosition, setDropdownPosition] = useState(null);
	const [dragOverIndex, setDragOverIndex] = useState(null);

	const triggerRef = useRef(null);
	const dropdownRef = useRef(null);
	const tokensRef = useRef(null);
	const dragSrcIndex = useRef(null);
	const dragInsertSlot = useRef(null);

	useEffect(() => {
		setSelectedValues(parseValue(currentValue));
	}, [currentValue]);

	// When a per-option condition turns an option off, drop any stale selected
	// value referencing it. Without this, the user would still see (and could
	// not remove without re-enabling the gating setting) a chip whose option
	// is no longer in the dropdown.
	useEffect(() => {
		const visibleValues = new Set(allOptions.map((o) => o.value));
		const pruned = selectedValues.filter((v) => visibleValues.has(v));
		if (pruned.length !== selectedValues.length) {
			setSelectedValues(pruned);
			updateSetting(setting.key, serializeValue(pruned));
		}
	}, [allOptions.map((o) => o.value).join('|')]);

	const settingState =
		typeof getFieldState === 'function'
			? getFieldState(setting.key)
			: 'editable';
	const showSettingBadge = settingState !== 'editable';
	const ProBadge =
		window.FotoGridsTooltip && window.FotoGridsTooltip.ProBadge;

	const resolveOptionState = (optionValue) => {
		if (typeof getOptionState === 'function') {
			return getOptionState(setting.key, optionValue);
		}
		return 'editable';
	};

	const updateDropdownPosition = useCallback(() => {
		if (!triggerRef.current) return;

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
		const minPanelHeight = 160;
		const availableBelow =
			viewportHeight - triggerRect.bottom - desiredMargin - sidePadding;
		const availableAbove = triggerRect.top - desiredMargin - sidePadding;
		const placement =
			availableBelow >= minPanelHeight || availableBelow >= availableAbove
				? 'bottom'
				: 'top';
		const maxHeight = Math.max(
			120,
			placement === 'bottom' ? availableBelow : availableAbove
		);
		const width = Math.min(
			Math.max(triggerRect.width, 200),
			viewportWidth - sidePadding * 2
		);
		const left = Math.min(
			Math.max(sidePadding, triggerRect.left),
			Math.max(sidePadding, viewportWidth - width - sidePadding)
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
			maxHeight,
			placement,
		});
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		updateDropdownPosition();
		window.addEventListener('resize', updateDropdownPosition);
		return () =>
			window.removeEventListener('resize', updateDropdownPosition);
	}, [isOpen, updateDropdownPosition]);

	useEffect(() => {
		if (!isOpen) return;

		const handlePointerDown = (e) => {
			const inTrigger =
				triggerRef.current && triggerRef.current.contains(e.target);
			const inDropdown =
				dropdownRef.current && dropdownRef.current.contains(e.target);
			if (!inTrigger && !inDropdown) setIsOpen(false);
		};
		const handleEscape = (e) => {
			if (e.key === 'Escape') setIsOpen(false);
		};

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen]);

	const commit = useCallback(
		(nextValues) => {
			setSelectedValues(nextValues);
			updateSetting(setting.key, serializeValue(nextValues));
		},
		[setting.key, updateSetting]
	);

	const toggleOption = useCallback(
		(value) => {
			if (isDisabled) return;

			setSelectedValues((prev) => {
				const idx = prev.indexOf(value);
				const next =
					idx === -1
						? [...prev, value]
						: prev.filter((v) => v !== value);

				updateSetting(setting.key, serializeValue(next));
				return next;
			});

			if (!keepOpen) setIsOpen(false);
		},
		[isDisabled, keepOpen, setting.key, updateSetting]
	);

	const removeToken = useCallback(
		(value) => {
			if (isDisabled) return;
			setSelectedValues((prev) => {
				const next = prev.filter((v) => v !== value);
				updateSetting(setting.key, serializeValue(next));
				return next;
			});
		},
		[isDisabled, setting.key, updateSetting]
	);

	const handleDragStart = (e, index) => {
		dragSrcIndex.current = index;
		dragInsertSlot.current = null;
		e.dataTransfer.effectAllowed = 'move';
		// Firefox requires data to be set
		e.dataTransfer.setData('text/plain', String(index));
	};

	// Compute the insertion slot from the pointer X against every rendered
	// token, independent of which element the event fired on. Slot 0 = before
	// the first token, slot N = after the last. Reading the live token rects
	// (rather than the event target) keeps drop reliable when the cursor is
	// over a gap, the insertion marker, or a token child.
	const getInsertionSlotFromPointer = (clientX) => {
		const container = tokensRef.current;
		if (!container) return null;
		const tokenEls = Array.from(
			container.querySelectorAll('.fotogrids-token-select__token')
		);
		for (let i = 0; i < tokenEls.length; i++) {
			const rect = tokenEls[i].getBoundingClientRect();
			if (clientX < rect.left + rect.width / 2) {
				return i;
			}
		}
		return tokenEls.length;
	};

	// Apply a reorder and commit. Kept outside any state-updater so the side
	// effect (updateSetting) is not run during render reconciliation.
	const commitReorder = (srcIndex, insertAt) => {
		if (srcIndex === null || insertAt === null) return;
		// No-op: dropping in the slot immediately before or after itself.
		if (insertAt === srcIndex || insertAt === srcIndex + 1) return;

		const next = [...selectedValues];
		const [moved] = next.splice(srcIndex, 1);
		const adjustedInsert = insertAt > srcIndex ? insertAt - 1 : insertAt;
		next.splice(adjustedInsert, 0, moved);
		commit(next);
	};

	const handleContainerDragOver = (e) => {
		if (dragSrcIndex.current === null) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		const slot = getInsertionSlotFromPointer(e.clientX);
		dragInsertSlot.current = slot;
		setDragOverIndex(slot);
	};

	const handleContainerDrop = (e) => {
		if (dragSrcIndex.current === null) return;
		e.preventDefault();
		const srcIndex = dragSrcIndex.current;
		const insertAt =
			dragInsertSlot.current !== null
				? dragInsertSlot.current
				: getInsertionSlotFromPointer(e.clientX);

		dragSrcIndex.current = null;
		dragInsertSlot.current = null;
		setDragOverIndex(null);

		commitReorder(srcIndex, insertAt);
	};

	const handleDragLeave = (e) => {
		// Only clear if we're truly leaving the tokens container.
		if (!e.currentTarget.contains(e.relatedTarget)) {
			setDragOverIndex(null);
			dragInsertSlot.current = null;
		}
	};

	const handleDragEnd = () => {
		// Fires after drop (or on cancel). The container drop handler has
		// already captured and cleared the refs by this point.
		dragSrcIndex.current = null;
		dragInsertSlot.current = null;
		setDragOverIndex(null);
	};

	const optionByValue = {};
	allOptions.forEach((o) => {
		optionByValue[o.value] = o;
	});

	const renderInsertionMarker = (slotIndex) => {
		if (
			!sortable ||
			dragOverIndex !== slotIndex ||
			dragSrcIndex.current === null
		)
			return null;
		return h('span', {
			key: `marker-${slotIndex}`,
			className: 'fotogrids-token-select__insert-marker',
			'aria-hidden': 'true',
		});
	};

	const renderToken = (value, index) => {
		const option = optionByValue[value];
		const label = option ? option.label : value;

		const tokenProps = {
			key: value,
			className: [
				'fotogrids-token-select__token',
				sortable ? 'fotogrids-token-select__token--sortable' : '',
			]
				.filter(Boolean)
				.join(' '),
		};

		if (sortable && !isDisabled) {
			tokenProps.draggable = true;
			tokenProps.onDragStart = (e) => handleDragStart(e, index);
			tokenProps.onDragEnd = handleDragEnd;
		}

		return [
			renderInsertionMarker(index),
			h(
				'span',
				tokenProps,
				[
					sortable &&
						!isDisabled &&
						h(
							'span',
							{
								key: 'drag-handle',
								className: 'fotogrids-token-select__token-drag',
								'aria-hidden': 'true',
							},
							renderIcon('move')
						),
					h(
						'span',
						{
							key: 'label',
							className: 'fotogrids-token-select__token-label',
						},
						label
					),
					!isDisabled &&
						h(
							'button',
							{
								key: 'remove',
								type: 'button',
								className:
									'fotogrids-token-select__token-remove',
								'aria-label': `${__('Remove', 'fotogrids')} ${label}`,
								onClick: (e) => {
									e.stopPropagation();
									removeToken(value);
								},
							},
							renderIcon('x')
						),
				].filter(Boolean)
			),
		];
	};

	const renderDropdownOption = (option) => {
		const isSelected = selectedValues.includes(option.value);
		const optionState = resolveOptionState(option.value);
		const isLocked = optionState !== 'editable';

		return h(
			'button',
			{
				key: option.value,
				type: 'button',
				className: [
					'fotogrids-token-select__option',
					isSelected
						? 'fotogrids-token-select__option--selected'
						: '',
					isLocked ? 'fotogrids-token-select__option--locked' : '',
				]
					.filter(Boolean)
					.join(' '),
				disabled: isLocked,
				onClick: () => !isLocked && toggleOption(option.value),
			},
			[
				h(
					'span',
					{
						key: 'check',
						className: 'fotogrids-token-select__option-check',
						'aria-hidden': 'true',
					},
					isSelected ? renderIcon('check_square') : null
				),
				h(
					'span',
					{
						key: 'label',
						className: 'fotogrids-token-select__option-label',
					},
					option.label
				),
				isLocked &&
					ProBadge &&
					h(ProBadge, {
						key: 'pro-badge',
						tier: option.tier_required,
						state: optionState,
					}),
			].filter(Boolean)
		);
	};

	const dropdownElement =
		isOpen && dropdownPosition
			? h(
					'div',
					{
						ref: dropdownRef,
						className: [
							'fotogrids-token-select__dropdown',
							`fotogrids-token-select__dropdown--${dropdownPosition.placement}`,
						].join(' '),
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
					},
					h(
						'div',
						{
							className: 'fotogrids-token-select__options',
							role: 'listbox',
							'aria-multiselectable': 'true',
						},
						allOptions.map(renderDropdownOption)
					)
				)
			: null;

	const portal =
		dropdownElement && typeof createPortal === 'function'
			? createPortal(dropdownElement, document.body)
			: dropdownElement;

	const hasTokens = selectedValues.length > 0;

	return h(
		'div',
		{
			className: [
				'fotogrids-token-select',
				isDisabled ? 'fotogrids-token-select--disabled' : '',
				isOpen ? 'fotogrids-token-select--open' : '',
			]
				.filter(Boolean)
				.join(' '),
		},
		[
			setting.label &&
				h(
					'label',
					{
						key: 'label',
						className: 'fotogrids-setting__label',
					},
					[
						setting.label,
						showSettingBadge &&
							ProBadge &&
							h(ProBadge, {
								key: 'pro-badge',
								tier: setting.tier_required,
								state: settingState,
							}),
					].filter(Boolean)
				),

			h(
				'div',
				{
					key: 'input',
					ref: triggerRef,
					className: 'fotogrids-token-select__input',
					role: 'button',
					tabIndex: isDisabled ? -1 : 0,
					'aria-expanded': isOpen,
					'aria-haspopup': 'listbox',
					onClick: () => !isDisabled && setIsOpen((s) => !s),
					onKeyDown: (e) => {
						if (
							!isDisabled &&
							(e.key === 'Enter' || e.key === ' ')
						) {
							e.preventDefault();
							setIsOpen((s) => !s);
						}
					},
				},
				[
					hasTokens
						? h(
								'div',
								{
									key: 'tokens',
									ref: tokensRef,
									className: 'fotogrids-token-select__tokens',
									onDragOver: sortable
										? handleContainerDragOver
										: undefined,
									onDrop: sortable
										? handleContainerDrop
										: undefined,
									onDragLeave: sortable
										? handleDragLeave
										: undefined,
								},
								[
									...selectedValues.flatMap((v, i) =>
										renderToken(v, i)
									),
									renderInsertionMarker(
										selectedValues.length
									),
								].filter(Boolean)
							)
						: h(
								'span',
								{
									key: 'placeholder',
									className:
										'fotogrids-token-select__placeholder',
								},
								setting.placeholder ||
									__('Select items…', 'fotogrids')
							),

					h(
						'span',
						{
							key: 'caret',
							className: 'fotogrids-token-select__caret',
							'aria-hidden': 'true',
						},
						renderIcon('chevron_down')
					),
				]
			),

			setting.description &&
				h(
					'div',
					{
						key: 'description',
						className: 'fotogrids-setting__description',
					},
					setting.description
				),

			portal,
		].filter(Boolean)
	);
};

window.FotoGridsRenderSettings.renderTokenSelect = (
	setting,
	currentValue,
	isDisabled,
	context
) => {
	const { createElement: h } = wp.element;
	return h(TokenSelectComponent, {
		setting,
		currentValue,
		isDisabled,
		...context,
	});
};
