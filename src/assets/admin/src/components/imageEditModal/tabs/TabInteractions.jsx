import React from 'react';

const TabInteractions = ({ formData, handleInputChange }) => {
    return (
        <div className="fotogrids-tab-panel active">
            <div className="fotogrids-interactions-section">
                <h4>Image Interactions</h4>
                <div className="fotogrids-external-url-section">
                    <div className="fotogrids-field-group">
                        <label htmlFor="fotogrids-image-external-url">External URL</label>
                        <input
                            type="url"
                            id="fotogrids-image-external-url"
                            placeholder="https://example.com"
                            value={formData.external_url}
                            onChange={(e) => handleInputChange('external_url', e.target.value)}
                        />
                        <p className="description">
                            URL to redirect to when this image is clicked.
                        </p>
                    </div>
                    <div className="fotogrids-field-group">
                        <label htmlFor="fotogrids-image-link-target">Link Target</label>
                        <select
                            id="fotogrids-image-link-target"
                            value={formData.link_target}
                            onChange={(e) => handleInputChange('link_target', e.target.value)}
                        >
                            <option value="global">Use Gallery Default</option>
                            <option value="_self">Same Tab</option>
                            <option value="_blank">New Tab</option>
                        </select>
                        <p className="description">
                            How the external link should open.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TabInteractions;
