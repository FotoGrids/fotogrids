import React from 'react';

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
            <div className="fotogrids-form-fields">
                {exifFields.map((field) => (
                    <div key={field.key} className="fotogrids-form-field">
                        <label htmlFor={`fotogrids-exif-${field.key}`}>
                            {field.label}
                        </label>
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
                    </div>
                ))}
            </div>

            {!isProActive && (
                <div className="fotogrids-pro-feature-notice">
                    <div className="fotogrids-pro-feature-notice__content">
                        <span className="fotogrids-pro-badge">{strings.pro || ''}</span>
                        <span className="fotogrids-pro-feature-notice__text">
                            <strong>{strings.exifPerImageOverrides || ''}</strong>
                        </span>
                    </div>
                    <button
                        type="button"
                        className="fotogrids-button fotogrids-button--link"
                        onClick={handleUpgrade}
                    >
                        {strings.upgradeToPro || ''}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TabEXIF;
