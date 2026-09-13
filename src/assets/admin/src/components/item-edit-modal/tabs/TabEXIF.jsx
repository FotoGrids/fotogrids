import React from 'react';
import ProFeatureNotice from '../../shared/ProFeatureNotice';
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

    // The EXIF field vocabulary, from the same registry the extractor reads.
    const exifFields = Array.isArray(strings.exifFields)
        ? strings.exifFields.map((field) => ({
              key: field.value,
              label: field.label || field.value
          }))
        : [];

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
                            type="text"
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
                <ProFeatureNotice
                    badge={strings.pro || ''}
                    actionLabel={strings.upgradeToPro || ''}
                    onAction={handleUpgrade}
                    center
                >
                    <strong>{strings.exifPerImageOverrides || ''}</strong>
                </ProFeatureNotice>
            )}
        </div>
    );
};

export default TabEXIF;
