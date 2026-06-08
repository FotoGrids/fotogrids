import React, { useState } from 'react';
import Toggle from '../shared/Toggle';

const { __ } = wp.i18n;

/**
 * Step 4 — A few important defaults.
 *
 * Three controls only: default lightbox, default lazy-load, default layout.
 * Local state, not persisted.
 */
const StepPreferences = () => {
    const [ lightbox, setLightbox ] = useState( true );
    const [ lazyLoad, setLazyLoad ] = useState( true );
    const [ layout, setLayout ]     = useState( 'grid' );

    const layouts = [
        { id: 'grid',      label: __( 'Grid', 'fotogrids' ),      description: __( 'Equal cells, even rhythm.', 'fotogrids' ) },
        { id: 'justified', label: __( 'Justified', 'fotogrids' ), description: __( 'Rows of variable widths, no cropping.', 'fotogrids' ) },
        { id: 'masonry',   label: __( 'Masonry', 'fotogrids' ),   description: __( 'Pinterest-style columns.', 'fotogrids' ) },
    ];

    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--preferences">
            <h1
                className="fotogrids-setup__step-heading"
                data-fg-setup-step-heading
                tabIndex={ -1 }
            >
                { __( 'A few defaults', 'fotogrids' ) }
            </h1>
            <p className="fotogrids-setup__step-subhead">
                { __( 'These apply to every new gallery. You can change any of them per gallery later.', 'fotogrids' ) }
            </p>

            <div className="fotogrids-setup__pref-row">
                <Toggle
                    id="fotogrids-setup-lightbox"
                    checked={ lightbox }
                    onChange={ setLightbox }
                    label={ __( 'Lightbox enabled by default', 'fotogrids' ) }
                    description={ __( 'Visitors can click images to open them in an overlay.', 'fotogrids' ) }
                />
            </div>

            <div className="fotogrids-setup__pref-row">
                <Toggle
                    id="fotogrids-setup-lazy-load"
                    checked={ lazyLoad }
                    onChange={ setLazyLoad }
                    label={ __( 'Lazy-load enabled by default', 'fotogrids' ) }
                    description={ __( 'Images load as visitors scroll, keeping pages fast.', 'fotogrids' ) }
                />
            </div>

            <div className="fotogrids-setup__pref-row">
                <fieldset className="fotogrids-setup__radio-group">
                    <legend className="fotogrids-setup__radio-legend">
                        { __( 'Default layout for new galleries', 'fotogrids' ) }
                    </legend>
                    <div className="fotogrids-setup__radio-options">
                        { layouts.map( ( opt ) => (
                            <label
                                key={ opt.id }
                                className={ `fotogrids-setup__radio ${ layout === opt.id ? 'is-active' : '' }` }
                            >
                                <input
                                    type="radio"
                                    name="fotogrids-setup-layout"
                                    value={ opt.id }
                                    checked={ layout === opt.id }
                                    onChange={ () => setLayout( opt.id ) }
                                />
                                <span className="fotogrids-setup__radio-content">
                                    <span className="fotogrids-setup__radio-label">{ opt.label }</span>
                                    <span className="fotogrids-setup__radio-hint">{ opt.description }</span>
                                </span>
                            </label>
                        ) ) }
                    </div>
                </fieldset>
            </div>
        </div>
    );
};

export default StepPreferences;
