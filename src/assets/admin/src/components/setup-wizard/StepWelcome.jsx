import React, { useState } from 'react';
import Toggle from '../shared/Toggle';
import Button from '../shared/Button';
import Modal from '../shared/Modal/Modal';
import Icon from '../shared/Icon';
import { persistSetting } from './persist-setting';

const { __ } = wp.i18n;

const TELEMETRY_LEARN_MORE_URL = 'https://freemius.com/privacy/usage-tracking/';
const PRIVACY_POLICY_URL       = 'https://go.fotogrids.com/privacy/';

// Permission categories shown in the "Learn more" modal. The same four
// buckets Freemius's own opt-in screen surfaces, in our voice.
const TELEMETRY_PERMISSIONS = [
    {
        id:    'profile',
        icon:  'people',
        title: __( 'Basic profile info', 'fotogrids' ),
        body:  __( 'Your WordPress user’s first & last name and email address.', 'fotogrids' ),
    },
    {
        id:    'site',
        icon:  'link',
        title: __( 'Basic website info', 'fotogrids' ),
        body:  __( 'Homepage URL & title, WordPress and PHP versions, site language.', 'fotogrids' ),
    },
    {
        id:    'plugin',
        icon:  'puzzle',
        title: __( 'Basic plugin info', 'fotogrids' ),
        body:  __( 'Current FotoGrids & SDK versions, and whether they are active or being uninstalled.', 'fotogrids' ),
    },
    {
        id:    'extensions',
        icon:  'list',
        title: __( 'Other plugins & themes', 'fotogrids' ),
        body:  __( 'Names, slugs, versions, and whether each one is active. Helps us catch conflicts early.', 'fotogrids' ),
    },
];

/**
 * Step 1 — Welcome.
 *
 * Front door for the wizard. Sets the tone, captures the anonymous-stats
 * opt-in inline, and owns its own primary / secondary buttons (Start
 * Setup / Skip for Now). The shared shell footer is hidden on this step;
 * the buttons here drive forward / close.
 *
 * The opt-in toggle saves immediately on flip — it writes the
 * fotogrids_share_statistics option and mirrors the choice to Freemius's
 * tracking opt-in/out. Reading the current value from
 * window.fotogridsAdmin.shareStatistics on mount keeps the wizard in
 * sync with the Settings > Advanced toggle.
 *
 * "Learn more about usage tracking" opens a stacked Modal listing the
 * permission categories the toggle controls. The wizard itself is a
 * full-screen Modal; fg-modal supports stacking so this opens on top
 * and ESC closes the top one first.
 *
 * Props
 * ─────
 * onStart  fn()  Advance the wizard to step 2.
 * onSkip   fn()  Close the wizard without saving anything.
 */
const StepWelcome = ( { onStart, onSkip } ) => {
    const initialOptIn = !! ( window.fotogridsAdmin && window.fotogridsAdmin.shareStatistics );
    const [ optedIn, setOptedIn ] = useState( initialOptIn );
    const [ showInfo, setShowInfo ] = useState( false );

    const handleTelemetryToggle = ( next ) => {
        // Optimistic flip — the request is fire-and-forget. If the save
        // is refused we log a warning but don't roll the UI back; the
        // user's last interaction is the source of truth.
        setOptedIn( next );
        persistSetting( 'fotogrids_share_statistics', next );
    };

    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--welcome">
            <div className="fotogrids-setup__step--welcome__content">
                <div className="fotogrids-setup__hero">
                    <svg
                        className="fotogrids-setup__hero-logo"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 62.36 62.36"
                        role="img"
                        aria-label={ __( 'FotoGrids', 'fotogrids' ) }
                    >
                        <rect
                            className="fotogrids-setup__hero-logo-rect"
                            data-rect="top"
                            x="2.83" y="2.83" width="56.69" height="14.17"
                            fill="#3c46f0"
                        />
                        <rect
                            className="fotogrids-setup__hero-logo-rect"
                            data-rect="mid"
                            x="2.83" y="24.09" width="35.43" height="14.17"
                            fill="#f01e32"
                        />
                        <rect
                            className="fotogrids-setup__hero-logo-rect"
                            data-rect="bl"
                            x="2.83" y="45.35" width="14.17" height="14.17"
                            fill="#ffb914"
                        />
                        <rect
                            className="fotogrids-setup__hero-logo-rect"
                            data-rect="bm"
                            x="24.09" y="45.35" width="14.17" height="14.17"
                            fill="#323232"
                        />
                        <rect
                            className="fotogrids-setup__hero-logo-rect"
                            data-rect="right"
                            x="45.35" y="24.09" width="14.17" height="35.43"
                            fill="#323232"
                        />
                    </svg>
                </div>

                <div className="fotogrids-setup__step--welcome__content-inner">
                    <h1
                        className="fotogrids-setup__step-heading"
                        data-fg-setup-step-heading
                        tabIndex={ -1 }
                    >
                        { __( 'Welcome to FotoGrids', 'fotogrids' ) }
                    </h1>
                    <p className="fotogrids-setup__step-subhead">
                        { __( 'Create your first gallery in 5 easy steps!', 'fotogrids' ) }
                    </p>
                </div>

                <div className="fotogrids-setup__welcome-actions">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={ ( e ) => { e.preventDefault(); if ( typeof onStart === 'function' ) onStart(); } }
                    >
                        { __( 'Start Setup', 'fotogrids' ) }
                    </Button>
                    <Button
                        variant="primary"
                        style="ghost"
                        size="md"
                        onClick={ ( e ) => { e.preventDefault(); if ( typeof onSkip === 'function' ) onSkip(); } }
                    >
                        { __( 'Skip for Now', 'fotogrids' ) }
                    </Button>
                </div>

                <div className="fotogrids-setup__consent">
                    <Toggle
                        id="fotogrids-setup-telemetry"
                        checked={ optedIn }
                        onChange={ handleTelemetryToggle }
                        label={ __( 'Help us improve FotoGrids by sharing anonymous non-sensitive usage data', 'fotogrids' ) }
                        description={
                            <>
                                { __( 'You can turn this off anytime in FotoGrids Settings → Advanced.', 'fotogrids' ) }
                                {' '}
                                <button
                                    type="button"
                                    className="fg-inline-link fg-inline-link--variant-primary"
                                    onClick={ ( e ) => { e.preventDefault(); setShowInfo( true ); } }
                                >
                                    { __( 'Learn more about usage tracking', 'fotogrids' ) }
                                </button>
                            </>
                        }
                    />
                </div>
            </div>

            <Modal
                isOpen={ showInfo }
                size="sm"
                type="setup-telemetry-info"
                className="fotogrids-setup-telemetry-modal"
                onClose={ () => setShowInfo( false ) }
            >
                <Modal.Header>
                    <Modal.HeaderTitle>
                        { __( 'About usage tracking', 'fotogrids' ) }
                    </Modal.HeaderTitle>
                </Modal.Header>

                <Modal.Body>
                    <p className="fotogrids-setup-telemetry-modal__intro">
                        { __( 'Sharing this data is optional. It helps us constantly improve by catching bugs early, prioritising what to build next, and keeping FotoGrids compatible with your setup. None of it is sold, and we never collect image content, image URLs, or visitor data.', 'fotogrids' ) }
                    </p>

                    <ul className="fotogrids-setup-telemetry-modal__list" role="list">
                        { TELEMETRY_PERMISSIONS.map( ( p ) => (
                            <li key={ p.id } className="fotogrids-setup-telemetry-modal__item">
                                <span className="fotogrids-setup-telemetry-modal__item-icon" aria-hidden="true">
                                    <Icon name={ p.icon } />
                                </span>
                                <span className="fotogrids-setup-telemetry-modal__item-body">
                                    <span className="fotogrids-setup-telemetry-modal__item-title">{ p.title }</span>
                                    <span className="fotogrids-setup-telemetry-modal__item-text">{ p.body }</span>
                                </span>
                            </li>
                        ) ) }
                    </ul>

                    <p className="fotogrids-setup-telemetry-modal__footnote">
                        <span>
                            { __( 'You can turn this off any time from FotoGrids → Settings → Advanced.', 'fotogrids' ) }
                        </span>
                        <a
                            href={ PRIVACY_POLICY_URL }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fg-inline-link fg-inline-link--variant-primary"
                        >
                            { __( 'Read the full privacy policy', 'fotogrids' ) }
                        </a>
                        { '. ' }
                        <a
                            href={ TELEMETRY_LEARN_MORE_URL }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fg-inline-link fg-inline-link--variant-primary"
                        >
                            { __( 'See the underlying Freemius doc', 'fotogrids' ) }
                        </a>
                        { '.' }
                    </p>
                </Modal.Body>

                <Modal.Footer compact>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={ () => setShowInfo( false ) }
                    >
                        { __( 'Got it', 'fotogrids' ) }
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default StepWelcome;
