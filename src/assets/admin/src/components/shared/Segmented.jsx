import React from 'react';
import Icon from './Icon';

/**
 * Segmented - a segmented control (a horizontal group of mutually-exclusive
 * options). Used for Hard/Soft crop, Viewport/Device detection, import
 * conflict handling, and any other binary or tri-state choice.
 *
 * Moved from shared/settings/ to shared/ - this is a general-purpose UI
 * primitive with no conceptual tie to settings pages.
 *
 * @param {Object}   props
 * @param {Array}    props.options    [{ value, label, icon? }] - icon is a FotoGridsIcons name.
 * @param {*}        props.value      Currently selected value.
 * @param {Function} props.onChange   Called with the chosen value.
 * @param {string}   [props.ariaLabel]
 * @param {boolean}  [props.disabled]
 * @param {string}   [props.className]
 */
const Segmented = ({
    options = [],
    value,
    onChange,
    ariaLabel,
    disabled = false,
    className = '',
    size = 'default',
    variant = 'default',
}) => {
    const baseClass = 'fotogrids-segmented';
    const wrapperClass = `${baseClass} ${baseClass}--size-${size} ${baseClass}--variant-${variant}`;

    return (
        <div
            className={`${wrapperClass} ${className}`.trim()}
            role="radiogroup"
            aria-label={ariaLabel}
        >
            {options.map((opt) => {
                const isActive = opt.value === value;
                return (
                    <button
                        key={String(opt.value)}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        disabled={disabled}
                        className={
                            `${baseClass}__option` +
                            (isActive ? ' fg-is-active' : '')
                        }
                        onClick={() => !disabled && onChange(opt.value)}
                    >
                        {opt.icon && (
                            <Icon name={opt.icon} className={`${baseClass}__icon`} />
                        )}
                        {opt.label && (
                            <span className={`${baseClass}__label`}>{opt.label}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default Segmented;
