import React from 'react';

const { __ } = wp.i18n;

const GeneralTab = () => {
    return (
        <div key="general-content">
            <h3>{__('General Settings', 'fotogrids')}</h3>
            <table className="form-table">
                <tr>
                    <th>
                        <label htmlFor="fotogrids-default-layout">
                            {__('Default Layout', 'fotogrids')}
                        </label>
                    </th>
                    <td>
                        <select id="fotogrids-default-layout" name="default_layout">
                            <option value="grid">{__('Grid', 'fotogrids')}</option>
                            <option value="masonry">{__('Masonry', 'fotogrids')}</option>
                            <option value="justified">{__('Justified', 'fotogrids')}</option>
                        </select>
                        <p className="description">
                            {__('Default layout for new galleries', 'fotogrids')}
                        </p>
                    </td>
                </tr>
                <tr>
                    <th>
                        <label htmlFor="fotogrids-default-columns">
                            {__('Default Columns', 'fotogrids')}
                        </label>
                    </th>
                    <td>
                        <input 
                            type="number" 
                            id="fotogrids-default-columns" 
                            name="default_columns" 
                            min="1" 
                            max="6" 
                            defaultValue="3" 
                        />
                        <p className="description">
                            {__('Default number of columns for grid layouts', 'fotogrids')}
                        </p>
                    </td>
                </tr>
                <tr>
                    <th>
                        <label htmlFor="fotogrids-item-size">
                            {__('Item Size', 'fotogrids')}
                        </label>
                    </th>
                    <td>
                        <select id="fotogrids-item-size" name="item_size">
                            <option value="thumbnail">{__('Thumbnail (150x150)', 'fotogrids')}</option>
                            <option value="medium">{__('Medium (300x300)', 'fotogrids')}</option>
                            <option value="large">{__('Large (1024x1024)', 'fotogrids')}</option>
                            <option value="full">{__('Full Size', 'fotogrids')}</option>
                        </select>
                        <p className="description">
                            {__('Default item size for gallery thumbnails', 'fotogrids')}
                        </p>
                    </td>
                </tr>
            </table>
        </div>
    );
};

export default GeneralTab;

