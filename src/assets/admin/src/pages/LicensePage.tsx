import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { 
    Card, 
    CardBody, 
    CardHeader, 
    TextControl,
    Button,
    Notice
} from '@wordpress/components';

const LicensePage = () => {
    const [licenseKey, setLicenseKey] = useState('');
    const [currentLicense, setCurrentLicense] = useState(null);
    const [activating, setActivating] = useState(false);
    const [message, setMessage] = useState('');

    const handleActivate = async () => {
        if (!licenseKey.trim()) {
            setMessage(__('Please enter a license key.', 'fotogrids'));
            return;
        }

        setActivating(true);
        setMessage('');

        try {
            // This would activate the license via REST API
            await new Promise(resolve => setTimeout(resolve, 2000)); // Mock delay
            
            // Mock successful activation
            setCurrentLicense({
                key: licenseKey,
                type: 'starter',
                status: 'active',
                expiry: '2025-12-31',
            });
            setMessage(__('License activated successfully!', 'fotogrids'));
            setLicenseKey('');
        } catch (error) {
            setMessage(__('Invalid license key. Please check and try again.', 'fotogrids'));
        } finally {
            setActivating(false);
        }
    };

    const handleDeactivate = async () => {
        setActivating(true);
        setMessage('');

        try {
            // This would deactivate the license via REST API
            await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
            
            setCurrentLicense(null);
            setMessage(__('License deactivated successfully.', 'fotogrids'));
        } catch (error) {
            setMessage(__('Error deactivating license. Please try again.', 'fotogrids'));
        } finally {
            setActivating(false);
        }
    };

    const getLicenseTypeLabel = (type: string) => {
        switch (type) {
            case 'starter':
                return __('Starter Pro', 'fotogrids');
            case 'expert':
                return __('Expert Pro', 'fotogrids');
            case 'commerce':
                return __('Commerce Pro', 'fotogrids');
            case 'lifetime':
                return __('Lifetime', 'fotogrids');
            default:
                return type;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'success';
            case 'expired':
                return 'warning';
            case 'disabled':
                return 'error';
            default:
                return 'info';
        }
    };

    return (
        <div className="fotogrids-license-page">
            {message && (
                <Notice 
                    status={message.includes('Error') || message.includes('Invalid') ? 'error' : 'success'} 
                    isDismissible={true}
                    onRemove={() => setMessage('')}
                >
                    {message}
                </Notice>
            )}

            <div className="license-content">
                {currentLicense ? (
                    <Card>
                        <CardHeader>
                            <h3>{__('Active License', 'fotogrids')}</h3>
                        </CardHeader>
                        <CardBody>
                            <div className="license-info">
                                <div className="license-status">
                                    <span className={`status-badge status-${currentLicense.status}`}>
                                        {currentLicense.status.charAt(0).toUpperCase() + currentLicense.status.slice(1)}
                                    </span>
                                </div>
                                
                                <div className="license-details">
                                    <div className="license-detail">
                                        <strong>{__('Plan:', 'fotogrids')}</strong> {getLicenseTypeLabel(currentLicense.type)}
                                    </div>
                                    <div className="license-detail">
                                        <strong>{__('License Key:', 'fotogrids')}</strong> 
                                        <code>{currentLicense.key.substring(0, 8)}...{currentLicense.key.substring(-8)}</code>
                                    </div>
                                    <div className="license-detail">
                                        <strong>{__('Expires:', 'fotogrids')}</strong> {currentLicense.expiry}
                                    </div>
                                </div>

                                <div className="license-actions">
                                    <Button 
                                        variant="secondary"
                                        onClick={handleDeactivate}
                                        isBusy={activating}
                                        disabled={activating}
                                    >
                                        {__('Deactivate License', 'fotogrids')}
                                    </Button>
                                    <Button 
                                        variant="primary"
                                        href="https://fotogrids.com/account"
                                        target="_blank"
                                    >
                                        {__('Manage Account', 'fotogrids')}
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <h3>{__('Activate License', 'fotogrids')}</h3>
                        </CardHeader>
                        <CardBody>
                            <div className="license-activation">
                                <p>
                                    {__(
                                        'Enter your license key to unlock Pro features. You can find your license key in your purchase confirmation email or account dashboard.',
                                        'fotogrids'
                                    )}
                                </p>

                                <TextControl
                                    label={__('License Key', 'fotogrids')}
                                    value={licenseKey}
                                    onChange={setLicenseKey}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    help={__('Enter your FotoGrids Pro license key', 'fotogrids')}
                                />

                                <div className="activation-actions">
                                    <Button 
                                        variant="primary"
                                        onClick={handleActivate}
                                        isBusy={activating}
                                        disabled={activating}
                                    >
                                        {activating ? __('Activating...', 'fotogrids') : __('Activate License', 'fotogrids')}
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <h3>{__('Pro Features', 'fotogrids')}</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="pro-features">
                            <div className="feature-tier">
                                <h4>{__('Starter Pro', 'fotogrids')}</h4>
                                <ul>
                                    <li>{__('Advanced templates (Slider, Polaroid)', 'fotogrids')}</li>
                                    <li>{__('Page builder widgets (Elementor, Divi, etc.)', 'fotogrids')}</li>
                                    <li>{__('Hover effects and animations', 'fotogrids')}</li>
                                    <li>{__('Custom thumbnail filters', 'fotogrids')}</li>
                                </ul>
                            </div>

                            <div className="feature-tier">
                                <h4>{__('Expert Pro', 'fotogrids')}</h4>
                                <ul>
                                    <li>{__('Everything in Starter Pro', 'fotogrids')}</li>
                                    <li>{__('Video gallery support', 'fotogrids')}</li>
                                    <li>{__('EXIF data and map view', 'fotogrids')}</li>
                                    <li>{__('Advanced filtering and search', 'fotogrids')}</li>
                                    <li>{__('Dynamic galleries from external sources', 'fotogrids')}</li>
                                </ul>
                            </div>

                            <div className="feature-tier">
                                <h4>{__('Commerce Pro', 'fotogrids')}</h4>
                                <ul>
                                    <li>{__('Everything in Expert Pro', 'fotogrids')}</li>
                                    <li>{__('WooCommerce integration', 'fotogrids')}</li>
                                    <li>{__('Watermarking and item protection', 'fotogrids')}</li>
                                    <li>{__('White labeling options', 'fotogrids')}</li>
                                    <li>{__('CTA buttons and sale ribbons', 'fotogrids')}</li>
                                </ul>
                            </div>
                        </div>

                        <div className="upgrade-cta">
                            <Button 
                                variant="primary"
                                href="https://fotogrids.com/pricing"
                                target="_blank"
                            >
                                {__('Get FotoGrids Pro', 'fotogrids')}
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
};

export default LicensePage;
