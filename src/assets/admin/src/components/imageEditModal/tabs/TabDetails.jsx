import React from 'react';

const TabDetails = ({ formData, handleInputChange, strings }) => {
    return (
        <div className="fotogrids-tab-panel active">
            <table className="form-table">
                <tbody>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-image-title">
                                {strings.title || 'Title'}
                            </label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="fotogrids-image-title"
                                value={formData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                            />
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-image-alt">
                                {strings.altText || 'Alt Text'}
                            </label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="fotogrids-image-alt"
                                value={formData.alt}
                                onChange={(e) => handleInputChange('alt', e.target.value)}
                            />
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-image-caption">
                                {strings.caption || 'Caption'}
                            </label>
                        </th>
                        <td>
                            <textarea
                                id="fotogrids-image-caption"
                                rows="3"
                                value={formData.caption}
                                onChange={(e) => handleInputChange('caption', e.target.value)}
                            />
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-image-description">
                                {strings.description || 'Description'}
                            </label>
                        </th>
                        <td>
                            <textarea
                                id="fotogrids-image-description"
                                rows="4"
                                value={formData.description}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default TabDetails;
