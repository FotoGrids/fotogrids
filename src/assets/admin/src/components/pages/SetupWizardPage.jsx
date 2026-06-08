import React, { useEffect, useState, useCallback } from 'react';

import Button from '../shared/Button';
import StepWelcome from '../setup-wizard/StepWelcome';
import StepAccount from '../setup-wizard/StepAccount';
import StepTelemetry from '../setup-wizard/StepTelemetry';
import StepPreferences from '../setup-wizard/StepPreferences';

const { __ } = wp.i18n;

/**
 * SetupWizardPage — the 4-step first-run wizard.
 *
 * This is a UI mockup. No data is persisted, no telemetry is sent, no
 * account auth is wired. The Continue / Back buttons just move through the
 * step UI; Skip and the close X return the user to Plugin Settings.
 *
 * Step state survives reloads via the URL hash (#step-1 .. #step-4) so a
 * screenshot link points at the exact step. No DB writes, no transients.
 */

const STEPS = [
    { id: 'welcome',     index: 1, label: __( 'Welcome', 'fotogrids' ),         component: StepWelcome },
    { id: 'account',     index: 2, label: __( 'Account', 'fotogrids' ),         component: StepAccount },
    { id: 'telemetry',   index: 3, label: __( 'Anonymous stats', 'fotogrids' ), component: StepTelemetry },
    { id: 'preferences', index: 4, label: __( 'Preferences', 'fotogrids' ),     component: StepPreferences },
];

const TOTAL = STEPS.length;

const SETTINGS_URL = (() => {
    try {
        const base = window.fotogridsAdmin?.settingsBaseUrl;
        if ( base ) {
            return base;
        }
    } catch ( _e ) {
        // fall through
    }
    return 'admin.php?page=fotogrids-settings';
})();

const readStepFromHash = () => {
    const raw = ( window.location.hash || '' ).replace( /^#/, '' );
    const match = raw.match( /^step-(\d+)$/ );
    if ( ! match ) {
        return 1;
    }
    const n = parseInt( match[1], 10 );
    if ( isNaN( n ) || n < 1 || n > TOTAL ) {
        return 1;
    }
    return n;
};

const writeStepToHash = ( index ) => {
    try {
        const url = new URL( window.location.href );
        url.hash = `#step-${index}`;
        window.history.replaceState( {}, '', url.toString() );
    } catch ( _e ) {
        // History API unavailable - silently ignore.
    }
};

const SetupWizardPage = () => {
    const [ stepIndex, setStepIndex ] = useState( readStepFromHash );

    useEffect( () => {
        writeStepToHash( stepIndex );

        // Move focus to the step heading on transition so screen readers
        // announce the new step. Defer to the next tick so the DOM has
        // committed the new step content.
        const tid = window.setTimeout( () => {
            const heading = document.querySelector( '[data-fg-setup-step-heading]' );
            if ( heading && typeof heading.focus === 'function' ) {
                heading.focus();
            }
        }, 0 );
        return () => window.clearTimeout( tid );
    }, [ stepIndex ] );

    useEffect( () => {
        const onHashChange = () => setStepIndex( readStepFromHash() );
        window.addEventListener( 'hashchange', onHashChange );
        return () => window.removeEventListener( 'hashchange', onHashChange );
    }, [] );

    const goNext = useCallback( () => {
        setStepIndex( ( i ) => Math.min( TOTAL, i + 1 ) );
    }, [] );

    const goBack = useCallback( () => {
        setStepIndex( ( i ) => Math.max( 1, i - 1 ) );
    }, [] );

    const exitToSettings = useCallback( () => {
        // Mockup-only exit. Real wizard would persist a "skipped" flag here
        // and / or redirect to the post-wizard target. For now we just go
        // back to Plugin Settings.
        window.location.assign( SETTINGS_URL );
    }, [] );

    const current = STEPS[ stepIndex - 1 ];
    const StepComponent = current.component;
    const isLast = stepIndex === TOTAL;
    const isFirst = stepIndex === 1;

    return (
        <div className="fotogrids-setup" role="region" aria-label={ __( 'FotoGrids Setup Wizard', 'fotogrids' ) }>
            <div className="fotogrids-setup__shell">
                {/*
                  * The shared FotoGrids admin header is already rendered
                  * above this card (logo only — Docs / Support / What's
                  * New links are suppressed on the wizard). The wizard's
                  * own header therefore only carries the step counter
                  * and the close button.
                  */}
                <header className="fotogrids-setup__header">
                    <div className="fotogrids-setup__counter" aria-live="polite">
                        { /* translators: 1: current step number, 2: total steps. */ }
                        { wp.i18n.sprintf( __( 'Step %1$d of %2$d', 'fotogrids' ), stepIndex, TOTAL ) }
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="x"
                        iconOnly
                        ariaLabel={ __( 'Close wizard', 'fotogrids' ) }
                        onClick={ exitToSettings }
                        className="fotogrids-setup__close"
                    />
                </header>

                <nav className="fotogrids-setup__stepper" aria-label={ __( 'Setup steps', 'fotogrids' ) }>
                    <ol className="fotogrids-setup__stepper-list">
                        { STEPS.map( ( step ) => {
                            const state =
                                step.index < stepIndex ? 'is-complete'
                                : step.index === stepIndex ? 'is-current'
                                : 'is-upcoming';
                            return (
                                <li
                                    key={ step.id }
                                    className={ `fotogrids-setup__stepper-item ${ state }` }
                                    aria-current={ state === 'is-current' ? 'step' : undefined }
                                >
                                    <span className="fotogrids-setup__stepper-dot" aria-hidden="true">
                                        { step.index }
                                    </span>
                                    <span className="fotogrids-setup__stepper-label">{ step.label }</span>
                                </li>
                            );
                        } ) }
                    </ol>
                </nav>

                <main className="fotogrids-setup__body">
                    <StepComponent />
                </main>

                <footer className="fotogrids-setup__footer">
                    <Button
                        variant="link"
                        size="sm"
                        onClick={ exitToSettings }
                        className="fotogrids-setup__skip"
                    >
                        { __( 'Skip — I’ll set this up later', 'fotogrids' ) }
                    </Button>

                    <div className="fotogrids-setup__footer-actions">
                        <Button
                            variant="secondary"
                            size="md"
                            disabled={ isFirst }
                            onClick={ goBack }
                        >
                            { __( 'Back', 'fotogrids' ) }
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={ isLast ? exitToSettings : goNext }
                        >
                            { isLast ? __( 'Finish', 'fotogrids' ) : __( 'Continue', 'fotogrids' ) }
                        </Button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default SetupWizardPage;
