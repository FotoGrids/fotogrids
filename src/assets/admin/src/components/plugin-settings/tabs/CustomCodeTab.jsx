import React from 'react';

const { __ } = wp.i18n;

const CustomCodeTab = () => {
    return (
        <div key="custom-code-content">
            <h3>{__('Global Custom Code', 'fotogrids')}</h3>
            <table className="form-table">
                <tr>
                    <th>
                        <label htmlFor="fotogrids-custom-css">
                            {__('Custom CSS', 'fotogrids')}
                        </label>
                    </th>
                    <td>
                        <textarea
                            id="fotogrids-custom-css"
                            name="custom_css"
                            rows="10"
                            cols="50"
                            placeholder={__('/* Add your custom CSS here */', 'fotogrids')}
                        />
                        <p className="description">
                            {__('Custom CSS will be applied to all galleries', 'fotogrids')}
                        </p>
                    </td>
                </tr>
            </table>
        </div>
    );
};

export default CustomCodeTab;
