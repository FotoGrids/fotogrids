/**
 * Checkbox - shared React checkbox.
 *
 * A small, accessible checkbox with FotoGrids brand styling. Uses a native
 * <input type="checkbox"> for behaviour and a sibling span for the visual
 * box + checkmark, so it works inside <label>, in forms, and inside admin
 * tables (wp-list-table) without fighting wp-admin core CSS.
 *
 * Props
 * ─────
 * checked      boolean        Current state.
 * onChange     fn(bool, evt)  Called with the next value on toggle.
 * label        string|node    Optional visible label next to the box.
 * id           string         Optional - ties label[for] to the input.
 * name         string         Optional - native input name.
 * value        string         Optional - native input value.
 * disabled     boolean        Greys out and disables interaction.
 * indeterminate boolean       Visually shows a dash instead of the check.
 * size         'sm'|'md'|'lg' Maps to the --size-* modifier (default 'md').
 * ariaLabel    string         Accessible label when no visible `label`.
 * className    string         Extra classes on the wrapper.
 */

import React, { useEffect, useRef } from 'react';

const SIZES = new Set(['sm', 'md', 'lg']);

const Checkbox = ({
    checked = false,
    onChange,
    label,
    strongerLabel = false,
    id,
    name,
    value,
    disabled = false,
    indeterminate = false,
    size = 'md',
    ariaLabel,
    className = '',
    description,
    ...rest
}) => {
    const inputRef = useRef(null);
    const resolvedSize = SIZES.has(size) ? size : 'md';

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.indeterminate = Boolean(indeterminate);
        }
    }, [indeterminate]);

    const classes = [
        'fg-checkbox',
        `fg-checkbox--size-${resolvedSize}`,
        checked && 'fg-checkbox--checked',
        indeterminate && 'fg-checkbox--indeterminate',
        disabled && 'fg-checkbox--disabled',
        className,
    ].filter(Boolean).join(' ');

    const handleChange = (event) => {
        if (!onChange) return;
        onChange(event.target.checked, event);
    };

    const Wrapper = label ? 'label' : 'span';

    return (
        <div className="fg-checkbox__wrapper">
            <Wrapper className={classes} htmlFor={label ? id : undefined}>
                <span className="fg-checkbox__control">
                    <input
                        ref={inputRef}
                        type="checkbox"
                        id={id}
                        name={name}
                        value={value}
                        checked={checked}
                        disabled={disabled}
                        onChange={handleChange}
                        aria-label={!label ? ariaLabel : undefined}
                        className="fg-checkbox__input"
                        {...rest}
                    />
                    <span className="fg-checkbox__box" aria-hidden="true">
                        <svg
                            className="fg-checkbox__check"
                            viewBox="0 0 16 16"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                className="fg-checkbox__check-path"
                                d="M3.5 8.5l3 3 6-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                className="fg-checkbox__dash-path"
                                d="M3.5 8h9"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </span>
                </span>
                {label && <span className={`fg-checkbox__label ${strongerLabel ? 'fg-checkbox__label--stronger' : ''}`}>{label}</span>}
            </Wrapper>
            {description && <span className="fg-checkbox__description">{description}</span>}
        </div>
    );
};

export default Checkbox;
