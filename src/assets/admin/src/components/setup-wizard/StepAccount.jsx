import React from 'react';
import Button from '../shared/Button';
import InfoBlock from '../shared/InfoBlock';

const { __ } = wp.i18n;

/**
 * Step 2 — Account (sign in or skip).
 *
 * Mockup only — the Sign in button is non-functional. In the real wizard
 * this hands off to the existing License page connect flow.
 */
const StepAccount = () => {
    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--account">
            <h1
                className="fotogrids-setup__step-heading"
                data-fg-setup-step-heading
                tabIndex={ -1 }
            >
                { __( 'Connect your FotoGrids account', 'fotogrids' ) }
            </h1>
            <p className="fotogrids-setup__step-subhead">
                { __( 'Already have one? Sign in to sync your license and preferred defaults. New here? Skip — you can connect any time from Settings → License.', 'fotogrids' ) }
            </p>

            <div className="fotogrids-setup__choice-row">
                <Button
                    variant="primary"
                    size="lg"
                    onClick={ ( e ) => e.preventDefault() }
                >
                    { __( 'Sign in', 'fotogrids' ) }
                </Button>
                <Button
                    variant="secondary"
                    size="lg"
                    onClick={ ( e ) => e.preventDefault() }
                >
                    { __( 'Skip for now', 'fotogrids' ) }
                </Button>
            </div>

            <InfoBlock
                icon="info_square"
                title={ __( 'Why connect?', 'fotogrids' ) }
                description={ __( 'Your license keeps Pro features unlocked across sites and lets us remember your preferred defaults. Free works without an account.', 'fotogrids' ) }
            />
        </div>
    );
};

export default StepAccount;
