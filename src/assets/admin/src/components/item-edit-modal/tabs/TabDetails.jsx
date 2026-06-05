import React from 'react';

const TabDetails = ({ formData, handleInputChange, strings, disabled = false }) => {
    return (
        <div className="fotogrids-tab-panel fg-is-active">
            <div className="fg-form-fields">
                <div className="fg-form-field">
                    <label htmlFor="fotogrids-item-title">
                        {strings.title || 'Title'}
                    </label>
                    <input
                        type="text"
                        id="fotogrids-item-title"
                        value={formData?.title || ''}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        disabled={disabled}
                    />
                </div>
                <div className="fg-form-field">
                    <label htmlFor="fotogrids-item-alt">
                        {strings.altText || 'Alt Text'}
                    </label>
                    <input
                        type="text"
                        id="fotogrids-item-alt"
                        value={formData?.alt || ''}
                        onChange={(e) => handleInputChange('alt', e.target.value)}
                        disabled={disabled}
                    />
                </div>
                <div className="fg-form-field">
                    <label htmlFor="fotogrids-item-caption">
                        {strings.caption || 'Caption'}
                    </label>
                    <textarea
                        id="fotogrids-item-caption"
                        rows="3"
                        value={formData?.caption || ''}
                        onChange={(e) => handleInputChange('caption', e.target.value)}
                        disabled={disabled}
                    />
                </div>
                <div className="fg-form-field">
                    <label htmlFor="fotogrids-item-description">
                        {strings.description || 'Description'}
                    </label>
                    <textarea
                        id="fotogrids-item-description"
                        rows="4"
                        value={formData?.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        disabled={disabled}
                    />
                </div>
                <div className="fg-form-field">
                    <label htmlFor="fotogrids-item-credit">
                        {strings.credit || 'Credit'}
                    </label>
                    <input
                        type="text"
                        id="fotogrids-item-credit"
                        value={formData?.credit || ''}
                        onChange={(e) => handleInputChange('credit', e.target.value)}
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
};

export default TabDetails;
