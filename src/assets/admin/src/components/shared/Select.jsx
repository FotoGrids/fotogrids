import React, { useState, useRef, useEffect } from 'react';
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
    const [dropdownPosition, setDropdownPosition] = useState('bottom');
    const [isPositioned, setIsPositioned] = useState(false);
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

    useEffect(() => {
        if (isOpen && selectRef.current) {
            setIsPositioned(false);

            let positioned = false;

            const calculatePosition = () => {
                if (!selectRef.current) return;

                const triggerRect = selectRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - triggerRect.bottom;
                const spaceAbove = triggerRect.top;

                const dropdownHeight = dropdownRef.current?.offsetHeight || 300;
                const minSpaceNeeded = Math.min(dropdownHeight, 300) + 8;

                if (spaceBelow < minSpaceNeeded && spaceAbove > spaceBelow) {
                    setDropdownPosition('top');
                } else {
                    setDropdownPosition('bottom');
                }

                positioned = true;
                setIsPositioned(true);
            };

            const timeoutId = setTimeout(calculatePosition, 0);

            const handleScroll = () => {
                if (positioned) {
                    calculatePosition();
                }
            };
            const handleResize = () => {
                if (positioned) {
                    calculatePosition();
                }
            };

            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);

            return () => {
                clearTimeout(timeoutId);
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        } else {
            setIsPositioned(false);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
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

            {isOpen && (
                <div
                    ref={dropdownRef}
                    className={`fotogrids-select__dropdown fotogrids-select__dropdown--${dropdownPosition} ${!isPositioned ? 'fotogrids-select__dropdown--positioning' : ''}`}
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
                </div>
            )}
        </div>
    );
};

export default Select;
