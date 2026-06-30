import React from 'react';
import { Button } from '../../shared/Button';
import FormField from '../../shared/FormField/FormField.jsx';
import FormFields from '../../shared/FormField/FormFields.jsx';

const TabEXIF = ({ formData, handleInputChange, strings = {}, disabled = false }) => {
    const isProActive = window.fotogridsSettings?.isProActive || false;
    const allFieldsDisabled = disabled || !isProActive;

    const handleUpgrade = () => {
        if (window.FotoGridsUpgrade) {
            window.FotoGridsUpgrade.launch();
        } else if (window.fotogridsUpgradeModal?.urls?.upgrade) {
            window.open(window.fotogridsUpgradeModal.urls.upgrade, '_blank');
        }
    };

    const exifFields = [
        { key: 'camera', label: strings.camera || '', type: 'text' },
        { key: 'aperture', label: strings.aperture || '', type: 'text' },
        { key: 'shutter_speed', label: strings.shutterSpeed || '', type: 'text' },
        { key: 'iso', label: strings.iso || '', type: 'text' },
        { key: 'lens', label: strings.lens || '', type: 'text' },
        { key: 'focal_length', label: strings.focalLength || '', type: 'text' },
        { key: 'date_taken', label: strings.dateTaken || '', type: 'text' },
        { key: 'copyright', label: strings.copyright || '', type: 'text' },
        { key: 'orientation', label: strings.orientation || '', type: 'text' },
        { key: 'flash', label: strings.flash || '', type: 'text' },
        { key: 'white_balance', label: strings.whiteBalance || '', type: 'text' },
        { key: 'exposure_mode', label: strings.exposureMode || '', type: 'text' }
    ];

    const exifData = formData?.exif || {};

    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <FormFields>
                {exifFields.map((field) => (
                    <FormField
                        key={field.key}
                        label={field.label}
                        htmlFor={`fotogrids-exif-${field.key}`}
                        layout="column"
                    >
                        <input
                            type={field.type}
                            id={`fotogrids-exif-${field.key}`}
                            value={exifData[field.key] || ''}
                            onChange={(e) => {
                                const newExif = {
                                    ...exifData,
                                    [field.key]: e.target.value
                                };
                                handleInputChange('exif', newExif);
                            }}
                            disabled={allFieldsDisabled}
                        />
                    </FormField>
                ))}
            </FormFields>

            {!isProActive && (
                <div className="fotogrids-pro-feature-notice">
                    <div className="fotogrids-pro-feature-notice__content">
                        <span className="fotogrids-pro-badge">{strings.pro || ''}</span>
                        <span className="fotogrids-pro-feature-notice__text">
                            <strong>{strings.exifPerImageOverrides || ''}</strong>
                        </span>
                    </div>
                    <Button variant="link" onClick={handleUpgrade}>
                        {strings.upgradeToPro || ''}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default TabEXIF;
