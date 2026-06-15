import React, { useState } from 'react';
import { persistSetting } from './persist-setting';

const { __ } = wp.i18n;

/**
 * Step 3 — Setup mode (Easy vs Advanced).
 *
 * The pick is persisted immediately to `fotogrids_settings_mode` via the
 * shared AJAX setting endpoint and surfaced through
 * `window.fotogridsAdmin.settingsMode`.
 */
// Each mode's description is modelled as two paragraphs so it renders
// with a real line break between the lead-in and the supporting copy.
// Keeping them as separate translatable strings means translators don't
// have to preserve embedded \n or HTML.
const MODES = [
    {
        id:    'easy',
        title: __( 'Easy', 'fotogrids' ),
        body:  [
            __( 'For sites where you only want to change the basics and let FotoGrids do the heavy lifting.', 'fotogrids' ),
            __( 'Most settings are set to default as per industry best practices. One just has to set it and forget it.', 'fotogrids' ),
        ],
    },
    {
        id:    'advanced',
        title: __( 'Advanced', 'fotogrids' ),
        body:  [
            __( 'For advanced users who want to control every aspect of FotoGrids.', 'fotogrids' ),
            __( 'You are offered options to change everything and have full control over how galleries look and behave.', 'fotogrids' ),
        ],
    },
];

const StepComplexity = () => {
    // Initial value comes from the localized PHP payload so a reopened
    // wizard remembers the user's pick. Default is "easy".
    const initialMode = ( window.fotogridsAdmin && window.fotogridsAdmin.settingsMode )
        ? String( window.fotogridsAdmin.settingsMode )
        : 'easy';
    const [ mode, setMode ] = useState( initialMode === 'advanced' ? 'advanced' : 'easy' );

    const handlePick = ( id ) => {
        setMode( id );
        persistSetting( 'fotogrids_settings_mode', id );
    };

    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--complexity">
            <h1
                className="fotogrids-setup__step-heading"
                data-fg-setup-step-heading
                tabIndex={ -1 }
            >
                { __( 'Pick a setup mode', 'fotogrids' ) }
            </h1>
            <p className="fotogrids-setup__step-subhead">
                { __( 'You can switch any time in FotoGrids Settings.', 'fotogrids' ) }
            </p>

            <div
                className="fotogrids-setup__card-grid fotogrids-setup__card-grid--complexity"
                role="radiogroup"
                aria-label={ __( 'Setup mode', 'fotogrids' ) }
            >
                { MODES.map( ( opt ) => {
                    const isActive = mode === opt.id;
                    return (
                        <button
                            type="button"
                            key={ opt.id }
                            role="radio"
                            aria-checked={ isActive }
                            className={ `fotogrids-setup__complexity-card ${ isActive ? 'fg-is-active' : '' }` }
                            onClick={ () => handlePick( opt.id ) }
                        >
                            <span className="fotogrids-setup__complexity-radio" aria-hidden="true">
                                <span className="fotogrids-setup__complexity-radio-dot" />
                            </span>
                            <span className="fotogrids-setup__complexity-body">
                                <span className="fotogrids-setup__complexity-title">{ opt.title }</span>
                                { opt.body.map( ( paragraph, i ) => (
                                    <span
                                        key={ i }
                                        className="fotogrids-setup__complexity-text"
                                    >
                                        { paragraph }
                                    </span>
                                ) ) }
                            </span>
                        </button>
                    );
                } ) }
            </div>
        </div>
    );
};

export default StepComplexity;
