import React from 'react';

const { __ } = wp.i18n;

const LicenseTab = () => {
    return (
        <div key="license-content">
            <h3>{__('License & Pro Features', 'fotogrids')}</h3>
            <div className="fotogrids-license-status">
                <p>
                    <strong>{__('Status: ', 'fotogrids')}</strong>
                    <span className="license-free">{__('Free Version', 'fotogrids')}</span>
                </p>
                <div className="fotogrids-upgrade-section">
                    <h4>{__('Upgrade to Pro', 'fotogrids')}</h4>
                    <ul>
                        <li>{__('Advanced gallery templates (Slider, Polaroid, etc.)', 'fotogrids')}</li>
                        <li>{__('Video gallery support', 'fotogrids')}</li>
                        <li>{__('EXIF data display and map integration', 'fotogrids')}</li>
                        <li>{__('WooCommerce product galleries', 'fotogrids')}</li>
                        <li>{__('Page builder integrations (Elementor, Divi, etc.)', 'fotogrids')}</li>
                        <li>{__('Priority support and updates', 'fotogrids')}</li>
                    </ul>
                    <p>
                        <a href="#" className="button button-primary button-large">
                            {__('Get Pro Version', 'fotogrids')}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LicenseTab;

