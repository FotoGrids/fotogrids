import React from 'react';

/**
 * NumberField - a branded number input with an optional unit suffix and
 * helper text. Controlled.
 *
 * Moved from shared/settings/ to shared/ - this is a general-purpose form
 * primitive with no conceptual tie to settings pages.
 *
 * @param {Object}                 props
 * @param {string}                 [props.id]
 * @param {number}                 props.value
 * @param {Function}               props.onChange   Called with the parsed integer (NaN-safe → min or 0).
 * @param {number}                 [props.min]
 * @param {number}                 [props.max]
 * @param {number}                 [props.step]
 * @param {string}                 [props.unit]     Suffix shown inside the field, e.g. "px".
 * @param {string|React.ReactNode} [props.help]     Helper text under the field.
 * @param {boolean}                [props.disabled]
 * @param {string}                 [props.className]
 */
const NumberField = ({
    id,
    value,
    onChange,
    min,
    max,
    step = 1,
    unit,
    help,
    disabled = false,
    className = '',
}) => {
    const handleChange = (e) => {
        const raw = parseInt(e.target.value, 10);
        if (Number.isNaN(raw)) {
            onChange(typeof min === 'number' ? min : 0);
            return;
        }
        onChange(raw);
    };

    const baseClass = 'fotogrids-number-field';

    return (
        <div className={`${baseClass} ${className}`.trim()}>
            <div className={`${baseClass}__input-wrap ${unit ? 'fg-has-unit' : ''}`}>
                <input
                    id={id}
                    type="number"
                    className={`${baseClass}__input`}
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    disabled={disabled}
                    onChange={handleChange}
                />
                {unit && <span className={`${baseClass}__unit`}>{unit}</span>}
            </div>
            {help && <p className={`${baseClass}__help`}>{help}</p>}
        </div>
    );
};

export default NumberField;
