/**
 * Tabs and actions row at the top of the gallery metabox.
 */

import React from 'react';
import { Button } from '../../shared/Button';
import AddNewDropdown from './AddNewDropdown.jsx';

/**
 * Renders the Manage / Preview tabs and, on the Manage tab, the item actions.
 *
 * @param {Object}   props
 * @param {string}   props.activeTab          Currently selected tab id.
 * @param {Object}   props.strings            Localised strings.
 * @param {Function} props.onTabSwitch        Switches tab.
 * @param {boolean}  props.addDropdownOpen    Whether the Add New menu is showing.
 * @param {Function} props.onAddDropdownToggle Toggles the Add New menu.
 * @param {Function} props.onAddOption        Receives the chosen Add New action.
 * @param {Function} props.onClearAll         Opens the remove-all confirmation.
 * @return {JSX.Element}
 */
const MetaboxHeader = ({
    activeTab,
    strings,
    onTabSwitch,
    addDropdownOpen,
    onAddDropdownToggle,
    onAddOption,
    onClearAll,
}) => (
    <div className="fotogrids-gallery-header">
        <div className="fotogrids-gallery-tabs">
            <button
                type="button"
                className={`fotogrids-gallery-tab ${activeTab === 'manage' ? 'fotogrids-gallery-tab--active' : ''}`}
                onClick={() => onTabSwitch('manage')}
            >
                <span className="fotogrids-icon" data-icon="edit"></span>
                {strings.manageItems}
            </button>
            <button
                type="button"
                className={`fotogrids-gallery-tab ${activeTab === 'preview' ? 'fotogrids-gallery-tab--active' : ''}`}
                onClick={() => onTabSwitch('preview')}
            >
                <span className="fotogrids-icon" data-icon="preview"></span>
                {strings.previewGallery}
            </button>
        </div>

        {activeTab === 'manage' && (
            <div className="fotogrids-gallery-actions">
                <AddNewDropdown
                    isOpen={addDropdownOpen}
                    onToggle={onAddDropdownToggle}
                    onSelect={onAddOption}
                    strings={strings}
                />
                <Button
                    variant="secondary"
                    size="sm"
                    className="fotogrids-items-remove-all"
                    onClick={onClearAll}
                >
                    {strings.removeAll}
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    className="fotogrids-items-bulk-editor"
                    onClick={() => {
                        if (window.FotoGridsUpgrade) {
                            window.FotoGridsUpgrade.launchForFeature.bulkOperations();
                        }
                    }}
                >
                    {strings.bulkEditor}
                    <span className="fotogrids-pro-badge">Pro</span>
                </Button>
            </div>
        )}
    </div>
);

export default MetaboxHeader;
