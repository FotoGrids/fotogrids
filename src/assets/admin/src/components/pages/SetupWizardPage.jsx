import React, { useEffect, useState, useCallback } from 'react';

import Modal from '../shared/Modal/Modal';
import Button from '../shared/Button';

import StepWelcome from '../setup-wizard/StepWelcome';
import StepPersona from '../setup-wizard/StepPersona';
import StepComplexity from '../setup-wizard/StepComplexity';
import StepAccount from '../setup-wizard/StepAccount';
import StepCreateGallery from '../setup-wizard/StepCreateGallery';
import { persistSetting } from '../setup-wizard/persist-setting';

const { __ } = wp.i18n;

/**
 * SetupWizardPage — first-run wizard rendered as a page-less full-screen
 * Modal. Opens over whichever admin page the user is on, gated on a URL
 * query param (?fotogrids_setup_step=N).
 *
 * UI structure (after recent changes):
 *
 *   • Top: a 4px progress bar painted absolutely against the top edge of
 *     the dialog. Fills left → right as the user advances.
 *   • Header: brand + title only (no step counter).
 *   • Body: the active step component, centred.
 *   • Footer: hidden on step 1 (welcome owns its own buttons), then
 *     slides up from the bottom on step 2. Stays visible thereafter.
 */

const STEP_QUERY_PARAM = 'fotogrids_setup_step';

const STEPS = [
    { id: 'welcome',    index: 1, component: StepWelcome },
    { id: 'persona',    index: 2, component: StepPersona },
    { id: 'complexity', index: 3, component: StepComplexity },
    { id: 'account',    index: 4, component: StepAccount },
    { id: 'create',     index: 5, component: StepCreateGallery },
];

const TOTAL = STEPS.length;

const readStepFromUrl = () => {
    try {
        const url = new URL( window.location.href );
        const raw = url.searchParams.get( STEP_QUERY_PARAM );
        if ( raw === null ) return null;
        const n = parseInt( raw, 10 );
        if ( isNaN( n ) || n < 1 || n > TOTAL ) return null;
        return n;
    } catch ( _e ) {
        return null;
    }
};

const writeStepToUrl = ( index ) => {
    try {
        const url = new URL( window.location.href );
        if ( index === null ) {
            url.searchParams.delete( STEP_QUERY_PARAM );
        } else {
            url.searchParams.set( STEP_QUERY_PARAM, String( index ) );
        }
        window.history.replaceState( {}, '', url.toString() );
    } catch ( _e ) { /* History unavailable */ }
};

const SetupWizardPage = () => {
    const [ stepIndex, setStepIndex ] = useState( readStepFromUrl );

    // Persona state is lifted because the shell's Continue button gates
    // on it. Everything else stays inside its step component. Initial
    // value comes from the localized PHP payload so the picked card is
    // preserved across wizard close + reopen.
    const initialPersona = ( window.fotogridsAdmin && window.fotogridsAdmin.userPersona )
        ? String( window.fotogridsAdmin.userPersona )
        : null;
    const [ persona, setPersona ] = useState( initialPersona || null );

    // Persist immediately on pick — the user's last click wins. We
    // wrap the raw setter so the step component stays presentational.
    const handlePersonaPick = ( id ) => {
        setPersona( id );
        persistSetting( 'fotogrids_user_persona', id );
    };

    // ----- URL ↔ state sync -------------------------------------------------
    useEffect( () => {
        const sync = () => setStepIndex( readStepFromUrl() );
        window.addEventListener( 'popstate', sync );
        return () => window.removeEventListener( 'popstate', sync );
    }, [] );

    useEffect( () => {
        if ( stepIndex === null ) return undefined;

        writeStepToUrl( stepIndex );

        const tid = window.setTimeout( () => {
            const heading = document.querySelector( '[data-fg-setup-step-heading]' );
            if ( heading && typeof heading.focus === 'function' ) {
                heading.focus();
            }
        }, 0 );
        return () => window.clearTimeout( tid );
    }, [ stepIndex ] );

    const goNext = useCallback( () => {
        setStepIndex( ( i ) => ( i === null ? null : Math.min( TOTAL, i + 1 ) ) );
    }, [] );

    const goBack = useCallback( () => {
        setStepIndex( ( i ) => ( i === null ? null : Math.max( 1, i - 1 ) ) );
    }, [] );

    const closeWizard = useCallback( () => {
        setStepIndex( null );
        writeStepToUrl( null );
    }, [] );

    if ( stepIndex === null ) {
        return null;
    }

    const current = STEPS[ stepIndex - 1 ];
    const StepComponent = current.component;
    const isLast  = stepIndex === TOTAL;
    const isFirst = stepIndex === 1;

    // Per-step Continue gating.
    const continueDisabled = ( () => {
        if ( current.id === 'persona' ) {
            return persona === null;
        }
        return false;
    } )();

    // Step-component props, picked by step id so each step only sees what
    // it needs.
    const renderedStep = ( () => {
        if ( current.id === 'welcome' ) {
            return <StepComponent onStart={ goNext } onSkip={ closeWizard } />;
        }
        if ( current.id === 'persona' ) {
            return <StepComponent picked={ persona } onPick={ handlePersonaPick } />;
        }
        if ( current.id === 'create' ) {
            return <StepComponent onClose={ closeWizard } />;
        }
        return <StepComponent />;
    } )();

    // Progress bar fill — 0% before any step, 100% on the final step.
    // Steps are 1-indexed; with N steps the visual fill points are
    // 1/N .. N/N. We expose it as a CSS var so the SCSS can drive any
    // transition it wants.
    const progressFill = `${ Math.round( ( stepIndex / TOTAL ) * 100 ) }%`;

    return (
        <Modal
            isOpen
            size="full"
            type="setup-wizard"
            className={ `fotogrids-setup-modal fotogrids-setup-modal--step-${ stepIndex }` }
            onClose={ closeWizard }
            closeOnOverlay={ false }
            closeOnEsc
        >
            {/* Progress bar absolutely positioned against the top of the
              * dialog. Transparent rail, blue fill — width driven by a CSS
              * variable so the existing CSS handles the transition. */}
            <div
                className="fotogrids-setup__progress"
                role="progressbar"
                aria-valuemin={ 0 }
                aria-valuemax={ TOTAL }
                aria-valuenow={ stepIndex }
                aria-label={ __( 'Setup progress', 'fotogrids' ) }
                style={ { '--fg-setup-progress': progressFill } }
            >
                <span className="fotogrids-setup__progress-fill" aria-hidden="true" />
            </div>

            <Modal.Header compact>
                <Modal.HeaderLogo />
                <Modal.HeaderTitle>
                    { __( 'FotoGrids Setup Wizard', 'fotogrids' ) }
                </Modal.HeaderTitle>
            </Modal.Header>

            <Modal.Body>
                <div className="fotogrids-setup__body">
                    { renderedStep }
                </div>
            </Modal.Body>

            {/* Footer is hidden on step 1 entirely — the welcome step
              * owns its own primary / secondary buttons. From step 2
              * onward it slides up from the bottom (CSS handles the
              * transform on mount). Step 5 hides the primary button
              * since the cards themselves are the action. */}
            { ! isFirst && (
                <Modal.Footer
                    className="fotogrids-setup__footer-shell"
                    compact
                >
                    <div className="fotogrids-setup__footer">
                        <Button
                            variant="secondary"
                            style="ghost"
                            size="md"
                            onClick={ closeWizard }
                            className="fotogrids-setup__skip"
                        >
                            { __( 'Skip for now', 'fotogrids' ) }
                        </Button>
                        <div className="fotogrids-setup__footer-actions">
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={ goBack }
                            >
                                { __( 'Back', 'fotogrids' ) }
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                disabled={ continueDisabled }
                                onClick={ isLast ? closeWizard : goNext }
                            >
                                { isLast ? __( 'Finish', 'fotogrids' ) : __( 'Continue', 'fotogrids' ) }
                            </Button>
                        </div>
                    </div>
                </Modal.Footer>
            ) }
        </Modal>
    );
};

export default SetupWizardPage;
