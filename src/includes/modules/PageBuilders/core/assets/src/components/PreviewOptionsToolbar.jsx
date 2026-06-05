/**
 * PreviewOptionsToolbar - Block-toolbar dropdown that mirrors the
 * Inspector "Preview" panel.
 *
 * Same toggles, same state. Users can flip them from either spot.
 */

import React from 'react';
import { ToolbarGroup, ToolbarDropdownMenu, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

// Inline outline-eye icon. @wordpress/icons isn't reliably available as
// a global on every WordPress install (the `wp-icons` script handle is
// not always present), so we ship our own monochrome SVG. Every path /
// circle declares fill="none" explicitly so the toolbar's icon styles
// can't fill it.
const eyeIcon = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        aria-hidden="true"
        focusable="false"
    >
        <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <circle
            cx="12"
            cy="12"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
        />
    </svg>
);

const PreviewOptionsToolbar = ({
    clickBehavior,
    pagination,
    onChangeClickBehavior,
    onChangePagination,
}) => (
    <ToolbarGroup>
        <ToolbarDropdownMenu
            icon={eyeIcon}
            label={__('Preview options', 'fotogrids')}
            popoverProps={{ placement: 'bottom-start' }}
        >
            {() => (
                <div className="fg-pb-preview-options-toolbar">
                    <div className="fg-pb-preview-options-toolbar__heading">
                        {__('Editor preview', 'fotogrids')}
                    </div>
                    <ToggleControl
                        label={__('Make items clickable', 'fotogrids')}
                        // help={__('Disable this to make item clicks select the block in the editor instead of opening the configured gallery action, such as a lightbox or link. This only affects the editor preview.', 'fotogrids')}
                        help={__('When disabled, item clicks select the block in the editor instead of opening the gallery action. Published pages are not affected.', 'fotogrids')}
                        checked={!!clickBehavior}
                        onChange={onChangeClickBehavior}
                    />
                    <ToggleControl
                        label={__('Enable pagination controls', 'fotogrids')}
                        // help={__('Disable this to keep pagination controls visible but inactive in the editor, allowing all pages to be previewed at once. This only affects the editor preview.', 'fotogrids')}
                        help={__('When disabled, pagination controls stay visible but inactive in the editor. Published pages are not affected.', 'fotogrids')}
                        checked={!!pagination}
                        onChange={onChangePagination}
                    />
                </div>
            )}
        </ToolbarDropdownMenu>
    </ToolbarGroup>
);

export default PreviewOptionsToolbar;
