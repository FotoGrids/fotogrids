import React from 'react';

const { __ } = wp.i18n;

const CustomCodeTab = () => {
    const allowDynamicExecution = window.fotogridsAdmin?.customJsAllowDynamicExecution || false;

    return (
        <div key="custom-code-content">
            <h3>{__('JavaScript Security', 'fotogrids')}</h3>
            <p className="fotogrids-section-description">
                {__('By default, FotoGrids blocks dynamic code execution (eval, Function constructor, and string-based timers) in custom JavaScript fields. This protects against accidental or malicious use of those constructs by lower-privilege users who have access to gallery editing.', 'fotogrids')}
            </p>
            <table className="form-table">
                <tbody>
                    <tr>
                        <th>
                            <label htmlFor="fotogrids-custom-js-allow-dynamic">
                                {__('Allow Dynamic Execution', 'fotogrids')}
                            </label>
                        </th>
                        <td>
                            <label>
                                <input
                                    type="checkbox"
                                    id="fotogrids-custom-js-allow-dynamic"
                                    name="fotogrids_custom_js_allow_dynamic_execution"
                                    value="1"
                                    defaultChecked={allowDynamicExecution}
                                />
                                {' ' + __('Allow eval, Function constructor, and string-based setTimeout / setInterval in custom JavaScript', 'fotogrids')}
                            </label>
                            <p className="description">
                                {__('This setting applies to all roles that can edit galleries, except administrators — administrators are never restricted. Only enable this if you have a specific need for dynamic code execution and trust all users with gallery editing access.', 'fotogrids')}
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default CustomCodeTab;
