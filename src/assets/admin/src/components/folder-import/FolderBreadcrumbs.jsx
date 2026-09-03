/**
 * FolderBreadcrumbs
 *
 * Trail from the uploads root to the folder being browsed.
 *
 * @param {Object}   props
 * @param {Array}    props.crumbs       `{ label, path }` entries, root first.
 * @param {string}   props.currentPath  Path of the folder on screen.
 * @param {boolean}  [props.disabled]   Block navigation while work is in flight.
 * @param {Function} props.onNavigate   Called with the path of the crumb clicked.
 * @param {string}   [props.label]      Accessible name for the nav landmark.
 */

import React from 'react';
import Icon from '../shared/Icon.jsx';

const FolderBreadcrumbs = ({
    crumbs = [],
    currentPath = '',
    disabled = false,
    onNavigate,
    label,
}) => (
    <nav className="fg-upload-folder-crumbs" aria-label={label}>
        {crumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path || 'root'}>
                {index > 0 && (
                    <Icon name="chevron_right" className="fg-upload-folder-crumbs__sep" />
                )}
                <button
                    type="button"
                    className="fg-upload-folder-crumbs__item"
                    disabled={crumb.path === currentPath || disabled}
                    onClick={() => onNavigate?.(crumb.path)}
                >
                    {crumb.label}
                </button>
            </React.Fragment>
        ))}
    </nav>
);

export default FolderBreadcrumbs;
