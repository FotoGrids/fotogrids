/**
 * PreviewOptionsPanel - Inspector panel for preview-only toggles.
 *
 * These toggles affect ONLY how the gallery is shown inside the editor
 * preview. They never affect the published page. Persisted as per-block
 * attributes so each block remembers its own preview state.
 *
 * The first two toggles ship in v1:
 *   - clickBehavior  off by default. Buttons/links still render with
 *                    real styling, but click events are neutralised so
 *                    the lightbox / links don't intercept clicks while
 *                    the user is editing.
 *   - pagination     on  by default. The renderer paginates and the
 *                    real load-more / page-buttons chrome shows. When
 *                    off, the host asks the server to render all items
 *                    so nothing is hidden behind pagination.
 *
 * Future toggles (statistics opt-out, lazy-load opt-out, etc.) slot in
 * here without changing the call sites.
 */

import React from 'react';
import { PanelBody, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const PreviewOptionsPanel = ({
    clickBehavior,
    pagination,
    onChangeClickBehavior,
    onChangePagination,
    initialOpen = false,
}) => (
    <PanelBody
        title={__('Preview', 'fotogrids')}
        initialOpen={initialOpen}
    >
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
    </PanelBody>
);

export default PreviewOptionsPanel;
