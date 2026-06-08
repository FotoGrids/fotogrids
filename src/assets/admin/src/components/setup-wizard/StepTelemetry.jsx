import React, { useState } from 'react';
import Toggle from '../shared/Toggle';
import Button from '../shared/Button';

const { __ } = wp.i18n;

/**
 * Step 3 — Anonymous statistics opt-in.
 *
 * Mockup only. The opt-in is local state; nothing is saved. The "see the
 * exact payload" affordance is a non-functional link button for now — in
 * the real wizard it opens a JSON preview popover.
 */
const StepTelemetry = () => {
    const [ optedIn, setOptedIn ] = useState( false );

    const collected = [
        __( 'Plugin version, WordPress version, PHP version', 'fotogrids' ),
        __( 'Active layouts (Grid, Justified, Masonry)', 'fotogrids' ),
        __( 'Counts: galleries, albums, items', 'fotogrids' ),
        __( 'Settings you’ve changed from default', 'fotogrids' ),
    ];

    const notCollected = [
        __( 'Image content', 'fotogrids' ),
        __( 'Image URLs or filenames', 'fotogrids' ),
        __( 'Visitor data', 'fotogrids' ),
        __( 'Personal information', 'fotogrids' ),
    ];

    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--telemetry">
            <h1
                className="fotogrids-setup__step-heading"
                data-fg-setup-step-heading
                tabIndex={ -1 }
            >
                { __( 'Help shape the next version', 'fotogrids' ) }
            </h1>
            <p className="fotogrids-setup__step-subhead">
                { __( 'Send anonymous usage data so we know which layouts and features get used. Nothing personal, no image content, no URLs.', 'fotogrids' ) }
            </p>

            <div className="fotogrids-setup__permissions">
                <div className="fotogrids-setup__permissions-col">
                    <h3 className="fotogrids-setup__permissions-title">
                        { __( 'What gets sent', 'fotogrids' ) }
                    </h3>
                    <ul className="fotogrids-setup__permissions-list fotogrids-setup__permissions-list--collected">
                        { collected.map( ( item ) => (
                            <li key={ item }>
                                <span className="fotogrids-setup__permission-mark" aria-hidden="true">✓</span>
                                <span>{ item }</span>
                            </li>
                        ) ) }
                    </ul>
                </div>

                <div className="fotogrids-setup__permissions-col">
                    <h3 className="fotogrids-setup__permissions-title">
                        { __( 'What never gets sent', 'fotogrids' ) }
                    </h3>
                    <ul className="fotogrids-setup__permissions-list fotogrids-setup__permissions-list--blocked">
                        { notCollected.map( ( item ) => (
                            <li key={ item }>
                                <span className="fotogrids-setup__permission-mark" aria-hidden="true">×</span>
                                <span>{ item }</span>
                            </li>
                        ) ) }
                    </ul>
                </div>
            </div>

            <div className="fotogrids-setup__toggle-row">
                <Toggle
                    id="fotogrids-setup-telemetry"
                    checked={ optedIn }
                    onChange={ setOptedIn }
                    label={ __( 'Send anonymous statistics', 'fotogrids' ) }
                />
                <Button
                    variant="link"
                    size="sm"
                    onClick={ ( e ) => e.preventDefault() }
                >
                    { __( 'See the exact payload', 'fotogrids' ) }
                </Button>
            </div>
        </div>
    );
};

export default StepTelemetry;
