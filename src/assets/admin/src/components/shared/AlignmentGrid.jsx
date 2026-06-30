import React from 'react';
import Icon from './Icon';

const { __ } = wp.i18n;

/**
 * The nine placement values in visual grid order (row by row), each paired
 * with its dots_grid_* icon and an accessible label.
 */
const POSITIONS = [
    { value: 'top-left', icon: 'dots_grid_top_left', label: __('Top left', 'fotogrids') },
    { value: 'top-center', icon: 'dots_grid_top_center', label: __('Top centre', 'fotogrids') },
    { value: 'top-right', icon: 'dots_grid_top_right', label: __('Top right', 'fotogrids') },
    { value: 'center-left', icon: 'dots_grid_center_left', label: __('Centre left', 'fotogrids') },
    { value: 'center', icon: 'dots_grid_center', label: __('Centre', 'fotogrids') },
    { value: 'center-right', icon: 'dots_grid_center_right', label: __('Centre right', 'fotogrids') },
    { value: 'bottom-left', icon: 'dots_grid_bottom_left', label: __('Bottom left', 'fotogrids') },
    { value: 'bottom-center', icon: 'dots_grid_bottom_center', label: __('Bottom centre', 'fotogrids') },
    { value: 'bottom-right', icon: 'dots_grid_bottom_right', label: __('Bottom right', 'fotogrids') },
];

/**
 * AlignmentGrid - a 3x3 placement picker. Generic: drives any nine-point
 * position choice (watermark placement, overlay anchoring, etc.). Controlled.
 *
 * Shares the fotogrids-alignment-grid visual treatment used by the
 * schema-driven collection-settings renderer.
 *
 * @param {Object}   props
 * @param {string}   props.value      One of the nine position values.
 * @param {Function} props.onChange   Called with the chosen position value.
 * @param {string}   [props.ariaLabel] Accessible name for the radiogroup.
 * @param {boolean}  [props.disabled]
 * @param {string}   [props.className]
 */
const AlignmentGrid = ({
    value,
    onChange,
    ariaLabel,
    disabled = false,
    className = '',
}) => {
    return (
        <div
            className={`fg-button-group__buttons fotogrids-alignment-grid ${className}`.trim()}
            role="radiogroup"
            aria-label={ariaLabel || __('Position', 'fotogrids')}
        >
            {POSITIONS.map((pos) => {
                const selected = value === pos.value;
                return (
                    <button
                        key={pos.value}
                        type="button"
                        className={`fg-button-group__button ${selected ? 'fg-is-active' : ''}`.trim()}
                        role="radio"
                        aria-checked={selected}
                        aria-label={pos.label}
                        title={pos.label}
                        disabled={disabled}
                        onClick={() => onChange(pos.value)}
                    >
                        <Icon name={pos.icon} />
                    </button>
                );
            })}
        </div>
    );
};

export default AlignmentGrid;
