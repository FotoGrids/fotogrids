import React, { useEffect, useState } from 'react';
import Button from '../shared/Button';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

/**
 * Step 4 — License activation.
 *
 * This is the wizard's License page tab. It does exactly what
 * /admin.php?page=fotogrids-license does, just inline: the user pastes
 * a key, we POST to `/fotogrids/v1/admin/license/activate`, we show
 * success or a specific error.
 *
 * Pro-already-active case: on mount we GET `/admin/license/status`. If
 * the site already has Pro active, we skip the key form entirely and
 * show a "Pro is active here" confirmation.
 *
 * Free users see a soft "See plans" link at the bottom — no signing in,
 * no account framing. The full account-connection flow lives in a
 * separate planned doc; this is the inline-key MVP that ships with the
 * wizard.
 */

const PRICING_URL =
    'https://go.fotogrids.com/pricing/?utm_source=plugin&utm_medium=setup-wizard&utm_campaign=no-key';

const StepAccount = () => {
    const [ status, setStatus ]         = useState( null );
    const [ loading, setLoading ]       = useState( true );
    const [ activating, setActivating ] = useState( false );
    const [ licenseKey, setLicenseKey ] = useState( '' );
    const [ error, setError ]           = useState( '' );
    const [ success, setSuccess ]       = useState( '' );

    useEffect( () => {
        let cancelled = false;

        wp.apiFetch( {
            path:   '/fotogrids/v1/admin/license/status',
            method: 'GET',
        } )
            .then( ( res ) => {
                if ( ! cancelled ) setStatus( res );
            } )
            .catch( ( err ) => {
                // Status fetch failed — fall through to the key-entry
                // form so the user still has a way to activate. We don't
                // bubble the fetch error to the UI because it's not
                // actionable here.
                if ( ! cancelled ) setStatus( null );
                // eslint-disable-next-line no-console
                console.warn( 'FotoGrids: license status fetch failed', err );
            } )
            .finally( () => {
                if ( ! cancelled ) setLoading( false );
            } );

        return () => { cancelled = true; };
    }, [] );

    const handleActivate = async ( e ) => {
        e.preventDefault();
        const trimmed = licenseKey.trim();
        if ( ! trimmed ) {
            setError( __( 'Please enter a license key.', 'fotogrids' ) );
            return;
        }

        setActivating( true );
        setError( '' );
        setSuccess( '' );

        try {
            const response = await wp.apiFetch( {
                path:   '/fotogrids/v1/admin/license/activate',
                method: 'POST',
                data:   { license_key: trimmed },
            } );

            if ( response && response.success ) {
                setSuccess( response.message || __( 'License activated.', 'fotogrids' ) );
                setLicenseKey( '' );

                // Re-fetch status so the UI flips to the "Pro is active"
                // confirmation without forcing the user to reload.
                try {
                    const fresh = await wp.apiFetch( {
                        path:   '/fotogrids/v1/admin/license/status',
                        method: 'GET',
                    } );
                    setStatus( fresh );
                } catch ( _e ) { /* not fatal */ }
            } else {
                setError( ( response && response.message )
                    || __( 'License activation failed.', 'fotogrids' ) );
            }
        } catch ( err ) {
            setError( err && err.message
                ? err.message
                : __( 'License activation failed.', 'fotogrids' ) );
        } finally {
            setActivating( false );
        }
    };

    const isPro = !! ( status && status.is_pro === true );

    return (
        <div className="fotogrids-setup__step fotogrids-setup__step--account">
            <h1
                className="fotogrids-setup__step-heading"
                data-fg-setup-step-heading
                tabIndex={ -1 }
            >
                { isPro
                    ? __( 'FotoGrids Pro is active', 'fotogrids' )
                    : __( 'Activate your license', 'fotogrids' ) }
            </h1>
            <p className="fotogrids-setup__step-subhead">
                { isPro
                    ? __( 'You’re all set - Pro features are unlocked on this site.', 'fotogrids' )
                    : (
                        <>
                            { __( 'Already have a FotoGrids Pro license? Paste your key below.', 'fotogrids' ) }
                            <br />
                            { __( 'Using the free version? Skip this step - you can always activate Pro later from the FotoGrids License page.', 'fotogrids' ) }
                        </>
                    ) }
            </p>

            { loading && (
                <p className="fotogrids-setup__account-loading">
                    { __( 'Checking license status…', 'fotogrids' ) }
                </p>
            ) }

            { ! loading && isPro && (
                <div className="fotogrids-setup__account-active">
                    <Icon
                        name="check_verified"
                        className="fotogrids-setup__account-active-icon"
                    />
                    <div className="fotogrids-setup__account-active-body">
                        <strong className="fotogrids-setup__account-active-title">
                            { status && status.plan
                                ? status.plan.replace( /_/g, ' ' ).replace( /\b\w/g, ( c ) => c.toUpperCase() )
                                : __( 'Pro', 'fotogrids' ) }
                        </strong>
                        <span className="fotogrids-setup__account-active-text">
                            { __( 'Manage your license from FotoGrids → License.', 'fotogrids' ) }
                        </span>
                    </div>
                </div>
            ) }

            { ! loading && ! isPro && (
                <form
                    className="fotogrids-setup__account-form"
                    onSubmit={ handleActivate }
                >
                    <div className="fotogrids-setup__account-input-row">
                        <input
                            id="fotogrids-setup-license-key"
                            type="text"
                            className="fotogrids-setup__account-input"
                            value={ licenseKey }
                            onChange={ ( e ) => setLicenseKey( e.target.value ) }
                            placeholder={ __( 'Enter your license key', 'fotogrids' ) }
                            aria-label={ __( 'License key', 'fotogrids' ) }
                            disabled={ activating }
                            autoComplete="off"
                            spellCheck="false"
                        />
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            disabled={ ! licenseKey.trim() || activating }
                            busy={ activating }
                        >
                            { activating
                                ? __( 'Activating…', 'fotogrids' )
                                : __( 'Activate', 'fotogrids' ) }
                        </Button>
                    </div>

                    { error && (
                        <div className="fotogrids-setup__account-notice fotogrids-setup__account-notice--error" role="alert">
                            { error }
                        </div>
                    ) }
                    { success && (
                        <div className="fotogrids-setup__account-notice fotogrids-setup__account-notice--success" role="status">
                            { success }
                        </div>
                    ) }

                    <p className="fotogrids-setup__account-no-key">
                        { __( 'Don\'t have a license yet?', 'fotogrids' ) }
                        { ' ' }
                        <a
                            href={ PRICING_URL }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fg-inline-link fg-inline-link--variant-primary"
                        >
                            { __( 'See plans', 'fotogrids' ) }
                        </a>
                    </p>
                </form>
            ) }
        </div>
    );
};

export default StepAccount;
