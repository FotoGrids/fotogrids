import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

const { __ } = wp.i18n;

const Select = ({
    value,
    onChange,
    options = [],
    placeholder = '',
    disabled = false,
    className = '',
    groups = null // Array of { label: string, options: array }
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const selectRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (groups) {
            for (const group of groups) {
                const found = group.options.find(opt => opt.value === value);
                if (found) {
                    setSelectedOption(found);
                    return;
                }
            }
        } else {
            const found = options.find(opt => opt.value === value);
            setSelectedOption(found || null);
        }
    }, [value, options, groups]);

    const updateDropdownPosition = useCallback(() => {
        if (!selectRef.current) return;

        const triggerRect = selectRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        const sidePadding = 8;
        const desiredMargin = 4;
        const minPanelHeight = 160;
        const availableBelow = viewportHeight - triggerRect.bottom - desiredMargin - sidePadding;
        const availableAbove = triggerRect.top - desiredMargin - sidePadding;
        const placement = availableBelow >= minPanelHeight || availableBelow >= availableAbove ? 'bottom' : 'top';
        const maxHeight = Math.max(120, placement === 'bottom' ? availableBelow : availableAbove);
        const width = Math.min(Math.max(triggerRect.width, 120), viewportWidth - sidePadding * 2);
        const left = Math.min(
            Math.max(sidePadding, triggerRect.left),
            Math.max(sidePadding, viewportWidth - width - sidePadding)
        );
        setDropdownPosition({
            top: placement === 'bottom'
                ? triggerRect.bottom + desiredMargin + scrollY
                : triggerRect.top - desiredMargin + scrollY,
            left: left + scrollX,
            width,
            maxHeight,
            placement
        });
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setDropdownPosition(null);
            return;
        }

        updateDropdownPosition();
        window.addEventListener('resize', updateDropdownPosition);
        window.addEventListener('scroll', updateDropdownPosition, true);

        return () => {
            window.removeEventListener('resize', updateDropdownPosition);
            window.removeEventListener('scroll', updateDropdownPosition, true);
        };
    }, [isOpen, updateDropdownPosition]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            const inTrigger = selectRef.current && selectRef.current.contains(event.target);
            const inDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
            if (!inTrigger && !inDropdown) {
                setIsOpen(false);
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    const handleSelect = (option) => {
        if (onChange) {
            onChange(option.value, option);
        }
        setIsOpen(false);
    };

    const displayText = selectedOption ? selectedOption.label : placeholder;

    return (
        <div
            ref={selectRef}
            className={`fotogrids-select ${isOpen ? 'fotogrids-select--is-open' : ''} ${disabled ? 'fotogrids-select--is-disabled' : ''} ${className}`}
        >
            <button
                type="button"
                className="fotogrids-select__trigger"
                onClick={handleToggle}
                disabled={disabled}
            >
                <span className="fotogrids-select__value">{displayText}</span>
                <Icon name="chevron_down" className="fotogrids-select__icon" />
            </button>

            {isOpen && dropdownPosition && createPortal(
                <div
                    ref={dropdownRef}
                    className={`fotogrids-select__dropdown fotogrids-select__dropdown--${dropdownPosition.placement}`}
                    style={{
                        position: 'absolute',
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`,
                        maxHeight: `${dropdownPosition.maxHeight}px`,
                        transform: dropdownPosition.placement === 'top' ? 'translateY(-100%)' : undefined,
                    }}
                >
                    {groups ? (
                        groups.map((group, groupIndex) => (
                            <div key={groupIndex} className="fotogrids-select__group">
                                {group.label && (
                                    <div className="fotogrids-select__group-label">
                                        {group.label}
                                    </div>
                                )}
                                {group.options.map((option, optionIndex) => (
                                    <button
                                        key={optionIndex}
                                        type="button"
                                        className={`fotogrids-select__option ${value === option.value ? 'is-selected' : ''}`}
                                        onClick={() => handleSelect(option)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        ))
                    ) : (
                        options.map((option, index) => (
                            <button
                                key={index}
                                type="button"
                                className={`fotogrids-select__option ${value === option.value ? 'is-selected' : ''}`}
                                onClick={() => handleSelect(option)}
                            >
                                {option.label}
                            </button>
                        ))
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default Select;
