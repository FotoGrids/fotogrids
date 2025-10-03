import React from 'react';

const TabDetails = ({ formData, handleInputChange, strings }) => {
    return (
        <div className="fotogrids-tab-panel active">
            <table className="form-table">
                <tbody>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-item-title">
                                {strings.title || 'Title'}
                            </label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="fotogrids-item-title"
                                value={formData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                            />
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-item-alt">
                                {strings.altText || 'Alt Text'}
                            </label>
                        </th>
                        <td>
                            <input
                                type="text"
                                id="fotogrids-item-alt"
                                value={formData.alt}
                                onChange={(e) => handleInputChange('alt', e.target.value)}
                            />
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-item-caption">
                                {strings.caption || 'Caption'}
                            </label>
                        </th>
                        <td>
                            <textarea
                                id="fotogrids-item-caption"
                                rows="3"
                                value={formData.caption}
                                onChange={(e) => handleInputChange('caption', e.target.value)}
                            />
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-item-description">
                                {strings.description || 'Description'}
                            </label>
                        </th>
                        <td>
                            <textarea
                                id="fotogrids-item-description"
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
