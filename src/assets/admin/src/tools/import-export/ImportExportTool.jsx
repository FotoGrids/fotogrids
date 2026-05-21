import React from 'react';
import { __ } from '@wordpress/i18n';

/**
 * Import / Export Tool
 *
 * Coming soon. Shows a meaningful empty state describing what the tool
 * will offer once implemented.
 */
const ImportExportTool = () => {
    return (
        <div className="fg-tool-coming-soon">
            <div className="fg-tool-coming-soon__icon">
                <span className="dashicons dashicons-database-import" />
            </div>
            <h2 className="fg-tool-coming-soon__title">
                {__('Import / Export', 'fotogrids')}
            </h2>
            <p className="fg-tool-coming-soon__description">
                {__(
                    'Export your galleries, albums, and settings to a portable file. Import them on another site or after a fresh install — no manual setup required.',
                    'fotogrids'
                )}
            </p>
            <div className="fg-tool-coming-soon__notice">
                <span className="dashicons dashicons-clock" />
                {__('This tool is coming soon.', 'fotogrids')}
            </div>
        </div>
    );
};

export default ImportExportTool;
