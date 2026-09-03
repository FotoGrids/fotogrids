/**
 * FolderList
 *
 * Sub-folders of the folder being browsed, plus an entry for its parent.
 *
 * @param {Object}   props
 * @param {Array}    props.folders      `{ name, count }` entries.
 * @param {?string}  props.parent       Parent path, or null at the uploads root.
 * @param {string}   props.currentPath  Path of the folder on screen.
 * @param {boolean}  [props.disabled]   Block navigation while work is in flight.
 * @param {Function} props.onNavigate   Called with the path to open.
 */

import React from 'react';
import Icon from '../shared/Icon.jsx';

const FolderList = ({
    folders = [],
    parent = null,
    currentPath = '',
    disabled = false,
    onNavigate,
}) => {
    if (folders.length === 0 && parent === null) {
        return null;
    }

    return (
        <ul className="fg-upload-folder-list">
            {parent !== null && (
                <li>
                    <button
                        type="button"
                        className="fg-upload-folder-list__item"
                        onClick={() => onNavigate?.(parent)}
                        disabled={disabled}
                    >
                        <Icon name="folder" />
                        <span className="fg-upload-folder-list__name">..</span>
                    </button>
                </li>
            )}
            {folders.map((folder) => (
                <li key={folder.name}>
                    <button
                        type="button"
                        className="fg-upload-folder-list__item"
                        onClick={() =>
                            onNavigate?.(
                                currentPath ? `${currentPath}/${folder.name}` : folder.name
                            )
                        }
                        disabled={disabled}
                    >
                        <Icon name="folder" />
                        <span className="fg-upload-folder-list__name">{folder.name}</span>
                        {folder.count > 0 && (
                            <span className="fg-upload-folder-list__count">{folder.count}</span>
                        )}
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default FolderList;
