import React from 'react';

const { __ } = wp.i18n;

const AdvancedTab = () => {
    const shareStatistics = window.fotogridsAdmin?.shareStatistics || false;
    const autosave = window.fotogridsAdmin?.autosave || false;

    return (
        <div key="advanced-content">
            <h3>{__('Advanced Settings', 'fotogrids')}</h3>
            <table className="form-table">
                <tr>
                    <th>
                        <label htmlFor="fotogrids_autosave">
                            {__('Autosave', 'fotogrids')}
                        </label>
                    </th>
                    <td>
                        <label>
                            <input
                                type="checkbox"
                                name="fotogrids_autosave"
                                id="fotogrids_autosave"
                                value="1"
                                defaultChecked={autosave}
                            />
                            {' ' + __('Automatically save all changes', 'fotogrids')}
                        </label>
                        <p className="description">
                            {__('When enabled, all gallery, album and settings changes will be automatically saved.', 'fotogrids')}
                        </p>
                    </td>
                </tr>
                <tr>
                    <th>{__('Statistics & Analytics', 'fotogrids')}</th>
                    <td>
                        <label>
                            <input
                                type="checkbox"
                                name="fotogrids_share_statistics"
                                id="fotogrids_share_statistics"
                                value="1"
                                defaultChecked={shareStatistics}
                            />
                            {' ' + __('Help us improve FotoGrids by sharing anonymous usage statistics', 'fotogrids')}
                        </label>
                        <p className="description">
                            {__('When enabled, FotoGrids will send anonymous usage statistics to help us improve the plugin. This includes review prompt performance data and helps us understand which features are most valuable to users. No personal data is collected.', 'fotogrids')}
                        </p>
                    </td>
                </tr>
                <tr>
                    <th>{__('Uninstall Options', 'fotogrids')}</th>
                    <td>
                        <label>
                            <input type="checkbox" name="delete_data_on_uninstall" />
                            {' ' + __('Delete all data when plugin is uninstalled', 'fotogrids')}
                        </label>
                        <p className="description">
                            {__('Warning: This will permanently delete all galleries, albums, and settings', 'fotogrids')}
                        </p>
                    </td>
                </tr>
            </table>
        </div>
    );
};

export default AdvancedTab;

