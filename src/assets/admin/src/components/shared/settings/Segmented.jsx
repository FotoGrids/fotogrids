import React from 'react';
import Icon from '../Icon';

/**
 * Segmented — a segmented control (a horizontal group of mutually-exclusive
 * options). Used for Hard/Soft crop, Viewport/Device detection, etc.
 *
 * @param {Object}   props
 * @param {Array}    props.options    [{ value, label, icon? }] — icon is a FotoGridsIcons name.
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
}) => {
    return (
        <div
            className={`fotogrids-segmented ${className}`.trim()}
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
                            'fotogrids-segmented__option' +
                            (isActive ? ' fg-is-active' : '')
                        }
                        onClick={() => !disabled && onChange(opt.value)}
                    >
                        {opt.icon && (
                            <Icon name={opt.icon} className="fotogrids-segmented__icon" />
                        )}
                        {opt.label && (
                            <span className="fotogrids-segmented__label">{opt.label}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default Segmented;
