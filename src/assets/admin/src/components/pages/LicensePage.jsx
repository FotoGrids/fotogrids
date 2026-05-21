import React, { useState, useEffect } from 'react';

const { __ } = wp.i18n;

const generateProFeatureKey = (str) => {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
};

const LicensePage = () => {
    const [licenseStatus, setLicenseStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [licenseKey, setLicenseKey] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [keyRevealed, setKeyRevealed] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);

    useEffect(() => {
        fetchLicenseStatus();
    }, []);

    const fetchLicenseStatus = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await wp.apiFetch({
                path: '/fotogrids/v1/admin/license/status',
                method: 'GET',
            });

            setLicenseStatus(response);
        } catch (err) {
            setError(err.message || __('Failed to fetch license status.', 'fotogrids'));
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async (e) => {
        e.preventDefault();

        if (!licenseKey.trim()) {
            setError(__('Please enter a license key.', 'fotogrids'));
            return;
        }

        setActivating(true);
        setError('');
        setSuccess('');

        try {
            const response = await wp.apiFetch({
                path: '/fotogrids/v1/admin/license/activate',
                method: 'POST',
                data: {
                    license_key: licenseKey.trim(),
                },
            });

            if (response.success) {
                setSuccess(response.message || __('License activated successfully!', 'fotogrids'));
                setLicenseKey('');
                await fetchLicenseStatus();
            } else {
                setError(response.message || __('License activation failed.', 'fotogrids'));
            }
        } catch (err) {
            setError(err.message || __('Failed to activate license.', 'fotogrids'));
        } finally {
            setActivating(false);
        }
    };

    const handleDeactivate = async () => {
        if (!confirm(__('Are you sure you want to deactivate this license?', 'fotogrids'))) {
            return;
        }

        setActivating(true);
        setError('');
        setSuccess('');

        try {
            const response = await wp.apiFetch({
                path: '/fotogrids/v1/admin/license/deactivate',
                method: 'POST',
            });

            if (response.success) {
                setSuccess(response.message || __('License deactivated successfully.', 'fotogrids'));
                await fetchLicenseStatus();
            } else {
                setError(response.message || __('License deactivation failed.', 'fotogrids'));
            }
        } catch (err) {
            setError(err.message || __('Failed to deactivate license.', 'fotogrids'));
        } finally {
            setActivating(false);
        }
    };

    if (loading) {
        return (
            <>
                <div className="fotogrids-license-loading">
                    <span className="spinner fg-is-active"></span>
                    <p>{__('Loading license information...', 'fotogrids')}</p>
                </div>
            </>
        );
    }

    const isPro = licenseStatus && licenseStatus.is_pro === true;
    const isFree = !isPro;
    const planName = licenseStatus && licenseStatus.plan ? licenseStatus.plan : null;

    let licenseTitle = '';
    let licenseSubtitle = __('Using FotoGrids Free', 'fotogrids');

    if (isPro) {
        licenseTitle = planName
            ? planName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : __('Pro', 'fotogrids');
        licenseSubtitle = __('Active license', 'fotogrids');
    } else {
        licenseTitle = __('Not activated', 'fotogrids');
    }

    return (
        <>
            {error && (
                <div className="fotogrids-license-notice fotogrids-license-error">
                    <p>{error}</p>
                    <button
                        type="button"
                        className="notice-dismiss"
                        onClick={() => setError('')}
                    >
                        <span className="screen-reader-text">{__('Dismiss this notice.', 'fotogrids')}</span>
                    </button>
                </div>
            )}

            {success && (
                <div className="fotogrids-license-notice fotogrids-license-success">
                    <p>{success}</p>
                    <button
                        type="button"
                        className="notice-dismiss"
                        onClick={() => setSuccess('')}
                    >
                        <span className="screen-reader-text">{__('Dismiss this notice.', 'fotogrids')}</span>
                    </button>
                </div>
            )}

            <div className="fotogrids-admin-blocks-grid">
                <div className="fotogrids-admin-block-card fg-abc-license">
                    <div className="fotogrids-admin-block-card-header">
                        <div
                            className={`fotogrids-admin-block-card-header-icon${isPro ? ' fg-abc-header-icon-pro' : ''}`}
                            dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.check_verified }}
                        />
                        <h3>{__('Your License', 'fotogrids')}</h3>
                    </div>
                    <div className="fotogrids-license-card-content">
                        <div className={`fotogrids-license-card-title${isPro ? ' fg-license-card-title-pro' : ''}`}>{licenseTitle}</div>
                        <div className="fotogrids-license-card-subtitle">{licenseSubtitle}</div>

                        {!isPro ? (
                            <div className="fotogrids-license-activate-form">
                                <form onSubmit={handleActivate}>
                                    <div className="fotogrids-license-input-group">
                                        <input
                                            type="text"
                                            value={licenseKey}
                                            onChange={(e) => setLicenseKey(e.target.value)}
                                            placeholder={__('Enter your license key', 'fotogrids')}
                                            disabled={activating}
                                            className="fotogrids-license-input"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="fotogrids-button fotogrids-button--primary"
                                        disabled={activating || !licenseKey.trim()}
                                    >
                                        {activating ? __('Activating...', 'fotogrids') : __('Activate License', 'fotogrids')}
                                    </button>
                                </form>
                                <p className="fotogrids-license-no-key">
                                    {__("Don’t have a license yet? ", 'fotogrids')}
                                    <a
                                        href="https://go.fotogrids.com/pricing/?utm_source=plugin&utm_medium=license-page&utm_campaign=no-key"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="fotogrids--inline-link fotogrids--inline-link--primary"
                                    >
                                        {__('See plans', 'fotogrids')}
                                    </a>
                                </p>
                            </div>
                        ) : (
                            <div className="fotogrids-license-card-details">
                                {licenseStatus && licenseStatus.license_key && (
                                    <div className="fotogrids-license-detail-row">
                                        <span className="fotogrids-license-detail-label">{__('License key', 'fotogrids')}</span>
                                        <div className="fotogrids-license-detail-value fotogrids-license-detail-value--key">
                                            <code className="fotogrids-license-key-display">
                                                {keyRevealed && licenseStatus.license_key_full
                                                    ? licenseStatus.license_key_full
                                                    : licenseStatus.license_key}
                                            </code>
                                            {licenseStatus.license_key_full && (
                                                <button
                                                    type="button"
                                                    className="fotogrids-button fotogrids-button--secondary fotogrids-button--smaller fotogrids-button--icon-only"
                                                    onClick={() => setKeyRevealed(!keyRevealed)}
                                                    aria-label={keyRevealed ? __('Hide license key', 'fotogrids') : __('Reveal license key', 'fotogrids')}
                                                >
                                                    <span
                                                        className="fotogrids-button__icon"
                                                        aria-hidden="true"
                                                        dangerouslySetInnerHTML={{
                                                            __html: keyRevealed
                                                                ? window.FotoGridsIcons?.eye_off
                                                                : window.FotoGridsIcons?.eye,
                                                        }}
                                                    />
                                                </button>
                                            )}
                                            {licenseStatus.license_key_full && (
                                                <button
                                                    type="button"
                                                    className="fotogrids-button fotogrids-button--primary fotogrids-button--smaller"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(licenseStatus.license_key_full);
                                                        setKeyCopied(true);
                                                        setTimeout(() => setKeyCopied(false), 2000);
                                                    }}
                                                    aria-label={__('Copy license key to clipboard', 'fotogrids')}
                                                >
                                                    {keyCopied ? __('Copied!', 'fotogrids') : __('Copy', 'fotogrids')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="fotogrids-license-detail-row">
                                    <span className="fotogrids-license-detail-label">{__('Expires', 'fotogrids')}</span>
                                    <span className="fotogrids-license-detail-value">
                                        {licenseStatus && licenseStatus.expires_formatted
                                            ? licenseStatus.expires_formatted
                                            : '—'}
                                    </span>
                                </div>
                                {licenseStatus && licenseStatus.activations !== null && licenseStatus.quota !== null && (
                                    <div className="fotogrids-license-detail-row">
                                        <span className="fotogrids-license-detail-label">{__('Activations', 'fotogrids')}</span>
                                        <span className="fotogrids-license-detail-value">
                                            {licenseStatus.activations} / {licenseStatus.quota}
                                        </span>
                                    </div>
                                )}
                                {licenseStatus && licenseStatus.account_email && (
                                    <div className="fotogrids-license-detail-row">
                                        <span className="fotogrids-license-detail-label">{__('Account', 'fotogrids')}</span>
                                        <span className="fotogrids-license-detail-value">
                                            {licenseStatus.account_email}
                                        </span>
                                    </div>
                                )}
                                {licenseStatus && licenseStatus.is_cancelled && (
                                    <div className="fotogrids-license-detail-row fotogrids-license-detail-row--warning">
                                        <span className="fotogrids-license-detail-label">{__('Subscription', 'fotogrids')}</span>
                                        <span className="fotogrids-license-detail-value">
                                            {__('Cancelled — license remains active until expiry.', 'fotogrids')}
                                        </span>
                                    </div>
                                )}
                                <div className="fotogrids-license-detail-row fotogrids-license-actions">
                                    <span className="fotogrids-license-detail-label">{__('Want to deactivate the license for any reason?', 'fotogrids')}</span>
                                    <button
                                        onClick={handleDeactivate}
                                        className="button button-secondary"
                                        disabled={activating}
                                    >
                                        {activating ? __('Deactivating...', 'fotogrids') : __('Deactivate', 'fotogrids')}
                                    </button>
                                </div>

                                {licenseStatus && licenseStatus.is_opted_in && (
                                    <div className="fotogrids-license-optin-status">
                                        <span className="fotogrids-license-optin-icon" aria-hidden="true">✓</span>
                                        <span className="fotogrids-license-optin-text">
                                            {__('Opted in to update notifications', 'fotogrids')}
                                        </span>
                                        <a
                                            href="https://go.fotogrids.com/opt-in-info"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="fotogrids-license-optin-info"
                                            aria-label={__('Learn more about update notifications and how to opt out', 'fotogrids')}
                                            title={__('Learn more about update notifications and how to opt out', 'fotogrids')}
                                        >
                                            <span aria-hidden="true">i</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {licenseStatus && licenseStatus.needs_pro_install && (
                    <div className="fotogrids-admin-block-card fg-abc-download-pro">
                        <div className="fotogrids-admin-block-card-header">
                            <div
                                className="fotogrids-admin-block-card-header-icon fg-abc-header-icon-pro"
                                dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.download }}
                            />
                            <h3>{__('Download the Pro plugin', 'fotogrids')}</h3>
                        </div>
                        <div className="fotogrids-admin-block-card-content">
                            <p>
                                {__('Your Pro license is active on this site. Download the Pro plugin and install it alongside FotoGrids to unlock Pro features.', 'fotogrids')}
                            </p>
                            <ol className="fotogrids-download-pro-steps">
                                <li>{__('Download the Pro plugin zip.', 'fotogrids')}</li>
                                <li>{__('In WordPress, go to Plugins → Add New → Upload Plugin.', 'fotogrids')}</li>
                                <li>{__('Upload the zip and click Activate.', 'fotogrids')}</li>
                            </ol>
                            <div className="fg-abc-buttons">
                                {licenseStatus.pro_download_url && (
                                    <a
                                        href={licenseStatus.pro_download_url}
                                        className="fotogrids-button fotogrids-button--primary"
                                    >
                                        {__('Download Pro plugin', 'fotogrids')}
                                    </a>
                                )}
                                <a
                                    href="https://go.fotogrids.com/install-pro"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="fotogrids-button fotogrids-button--invert fotogrids-button--accent"
                                >
                                    {__('How to upload & activate', 'fotogrids')}
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {isFree && (
                    <div className="fotogrids-admin-block-card fg-abc-upgrade">
                        <div className="fotogrids-admin-block-card-content">
                            <div className="fotogrids-pro-badge">
                                <div className="fotogrids-fireworks" />
                                <span>{__('Pro', 'fotogrids')}</span>
                            </div>
                            <h3>{__('Unlock Pro Features', 'fotogrids')}</h3>
                            <div className="pro-feature-list">
                                {[
                                    'Advanced Layouts',
                                    'SEO Optimization',
                                    'E-Commerce',
                                    'Custom Styling',
                                    'Priority Support',
                                    'Advanced Analytics',
                                    'Powerful Integrations',
                                    'Bulk Operations',
                                ].map((feature) => (
                                    <div key={generateProFeatureKey(feature)}>
                                        <span
                                            dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.check_badge_g }}
                                        />
                                        {__(feature, 'fotogrids')}
                                    </div>
                                ))}
                            </div>
                            <p>{__('Plus many more powerful features designed to save time, optimize performance, and help you grow like never before.', 'fotogrids')}</p>
                            <div className="fg-abc-buttons">
                                <a
                                    href="https://go.fotogrids.com/upgrade"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="fotogrids-button fotogrids-button--primary"
                                >
                                    {__('Upgrade Now', 'fotogrids')}
                                </a>
                                <a
                                    href="https://go.fotogrids.com/free-vs-pro"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="fotogrids-button fotogrids-button--invert fotogrids-button--accent"
                                >
                                    {__('Free vs. Pro', 'fotogrids')}
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default LicensePage;
