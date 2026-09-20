/**
 * The "Add New" split menu in the gallery metabox header.
 */

import React from 'react';
import { Button } from '../shared/Button';

const ADD_OPTIONS = [
    { action: 'upload',      labelKey: 'upload' },
    { action: 'library',     labelKey: 'fromLibrary' },
    { action: 'folder',      labelKey: 'uploadFromFolder' },
    { action: 'zip',         labelKey: 'uploadFromZip' },
    { action: 'video_embed', labelKey: 'videoEmbed' },
];

/**
 * Renders the Add New toggle and its menu of item sources.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen   Whether the menu is showing.
 * @param {Function} props.onToggle Toggles the menu.
 * @param {Function} props.onSelect Receives the chosen action key.
 * @param {Object}   props.strings  Localised strings.
 * @return {JSX.Element}
 */
const AddNewDropdown = ({ isOpen, onToggle, onSelect, strings }) => (
    <div className="fotogrids-add-new-dropdown">
        <Button
            variant="primary"
            size="sm"
            className={`fotogrids-add-new-toggle ${isOpen ? 'fotogrids-dropdown-open' : ''}`}
            onClick={onToggle}
            icon="plus"
            iconRight="chevron_down"
        >
            {strings.addNew}
        </Button>
        {isOpen && (
            <div className="fotogrids-add-new-menu fotogrids-dropdown-open">
                {ADD_OPTIONS.map(({ action, labelKey }) => (
                    <div
                        key={action}
                        className="fotogrids-add-option"
                        onClick={() => onSelect(action)}
                    >
                        {strings[labelKey]}
                    </div>
                ))}
                <div className="fotogrids-add-option fotogrids-add-option--pro" onClick={() => onSelect('instagram')}>
                    {strings.instagram}
                    <span className="fotogrids-pro-badge">Pro</span>
                </div>
            </div>
        )}
    </div>
);

export default AddNewDropdown;
