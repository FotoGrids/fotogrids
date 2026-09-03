/**
 * FolderTileGrid
 *
 * Selectable thumbnails for the importable images of one uploads folder.
 *
 * @param {Object}   props
 * @param {Array}    props.files            `{ name, path, thumbnail, size, attachment_id }`.
 * @param {string[]} props.selected         Paths currently selected.
 * @param {boolean}  [props.disabled]       Block selection while work is in flight.
 * @param {Function} props.onToggle         Called with the path of the tile clicked.
 * @param {string}   [props.newBadgeLabel]  Badge shown on files not yet in the library.
 */

import React from 'react';
import Icon from '../shared/Icon.jsx';
import formatBytes from '../shared/format-bytes';

const FolderTileGrid = ({
    files = [],
    selected = [],
    disabled = false,
    onToggle,
    newBadgeLabel,
}) => (
    <ul className="fg-upload-folder-grid">
        {files.map((file) => {
            const isSelected = selected.includes(file.path);

            return (
                <li
                    key={file.path}
                    className={`fg-upload-folder-tile${
                        isSelected ? ' fg-upload-folder-tile--selected' : ''
                    }`}
                >
                    <button
                        type="button"
                        className="fg-upload-folder-tile__button"
                        onClick={() => onToggle?.(file.path)}
                        disabled={disabled}
                        aria-pressed={isSelected}
                    >
                        <img
                            src={file.thumbnail}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="fg-upload-folder-tile__image"
                        />
                        {isSelected && (
                            <span className="fg-upload-folder-tile__check">
                                <Icon name="check" />
                            </span>
                        )}
                        {!file.attachment_id && (
                            <span className="fg-upload-folder-tile__badge">{newBadgeLabel}</span>
                        )}
                    </button>
                    <span className="fg-upload-folder-tile__name" title={file.name}>
                        {file.name}
                    </span>
                    <span className="fg-upload-folder-tile__meta">{formatBytes(file.size)}</span>
                </li>
            );
        })}
    </ul>
);

export default FolderTileGrid;
