import React from 'react';
import NumberField from './NumberField';

const { __ } = wp.i18n;

/**
 * DimensionsField — a Width × Height pair built from two NumberFields.
 *
 * @param {Object}   props
 * @param {number}   props.width
 * @param {number}   props.height
 * @param {Function} props.onWidthChange
 * @param {Function} props.onHeightChange
 * @param {string}   [props.unit]            Defaults to "px".
 * @param {string}   [props.widthLabel]
 * @param {string}   [props.heightLabel]
 * @param {string}   [props.idPrefix]        Used to build the two input ids.
 * @param {number}   [props.min]
 * @param {number}   [props.max]
 * @param {boolean}  [props.disabled]
 */
const DimensionsField = ({
    width,
    height,
    onWidthChange,
    onHeightChange,
    unit = 'px',
    widthLabel = __('Width', 'fotogrids'),
    heightLabel = __('Height', 'fotogrids'),
    idPrefix,
    min = 0,
    max,
    disabled = false,
}) => {
    const wId = idPrefix ? `${idPrefix}-width` : undefined;
    const hId = idPrefix ? `${idPrefix}-height` : undefined;

    return (
        <div className="fotogrids-dimensions-field">
            <div className="fotogrids-dimensions-field__item">
                <label className="fotogrids-dimensions-field__label" htmlFor={wId}>
                    {widthLabel}
                </label>
                <NumberField
                    id={wId}
                    value={width}
                    onChange={onWidthChange}
                    unit={unit}
                    min={min}
                    max={max}
                    disabled={disabled}
                />
            </div>
            <span className="fotogrids-dimensions-field__times" aria-hidden="true">×</span>
            <div className="fotogrids-dimensions-field__item">
                <label className="fotogrids-dimensions-field__label" htmlFor={hId}>
                    {heightLabel}
                </label>
                <NumberField
                    id={hId}
                    value={height}
                    onChange={onHeightChange}
                    unit={unit}
                    min={min}
                    max={max}
                    disabled={disabled}
                />
            </div>
        </div>
    );
};

export default DimensionsField;
