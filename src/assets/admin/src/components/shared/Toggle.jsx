/**
 * Toggle - shared React component.
 *
 * Uses the exact same class names as renderToggle.js so it inherits
 * toggle.scss with zero additional CSS. Drop-in wherever a toggle is needed
 * in React: ItemEditModal tabs, VideoEmbedModal, plugin settings, etc.
 *
 * Props
 * ─────
 * checked   boolean        Current on/off state.
 * onChange  fn(bool)       Called with the new value on click.
 * label     string|node    Label text (or JSX).
 * description string|node  Optional helper text below the label.
 * id        string         Optional - ties label[for] to the button id.
 * disabled  boolean        Greys out and disables interaction.
 * size      'default'|'small'  Maps to the --small modifier.
 * color     'default'|'green'  Maps to the --green modifier.
 */

import React from 'react';

const Toggle = ( {
    checked   = false,
    onChange,
    label,
    labelLight = false,
    description,
    id,
    disabled  = false,
    size      = 'default',
    color     = 'default',
} ) => {
    const buttonClass = [
        'fotogrids-toggle',
        checked              ? 'fgt-is-checked'         : '',
        size  === 'small'    ? 'fotogrids-toggle--small' : '',
        color === 'green'    ? 'fotogrids-toggle--green' : '',
    ].filter( Boolean ).join( ' ' );

    return (
        <div className="fotogrids-toggle-control">
            <div className="fotogrids-toggle-wrapper">
                <button
                    type="button"
                    id={ id }
                    role="switch"
                    aria-checked={ checked }
                    className={ buttonClass }
                    onClick={ () => ! disabled && onChange( ! checked ) }
                    disabled={ disabled }
                >
                    <span className="fotogrids-toggle__track" />
                    <span className="fotogrids-toggle__thumb" />
                </button>
            </div>
            { label && (
                <label
                    className={ `fotogrids-setting__label ${labelLight ? 'fotogrids-setting__label--light' : ''}` }
                    htmlFor={ id }
                    style={ id ? undefined : { cursor: 'default' } }
                >
                    { label }
                </label>
            ) }
            { description && (
                <div className="fotogrids-setting__description">
                    { description }
                </div>
            ) }
        </div>
    );
};

export default Toggle;
