/**
 * FotoGrids Gallery - Gutenberg block.
 *
 * Thin shell over the shared PageBuilders core components. The block
 * itself contributes only:
 *   - the registerBlockType call (attributes + supports come from block.json)
 *   - the edit() function that composes:
 *       * BlockPlaceholder (when no gallery is picked)
 *       * PickerModal (when the user clicks Select)
 *       * LivePreview (when a gallery is picked)
 *       * InspectorGalleryPanel (always, in the sidebar when selected)
 *   - the toolbar (Change Gallery, Edit Gallery, alignment)
 *
 * Layout/columns/captions/lightbox/lazy/customCSS are intentionally not
 * exposed on the block - those are gallery settings, not block settings.
 * See gutenberg-block-plan.md §5.
 */

import './gallery.scss';

import React, { useEffect, useMemo, useState } from 'react';
import { registerBlockType } from '@wordpress/blocks';
import {
    useBlockProps,
    InspectorControls,
    BlockControls,
    BlockAlignmentToolbar,
} from '@wordpress/block-editor';
import { ToolbarGroup, ToolbarButton } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import metadata from '../../blocks/gallery/block.json';
import transforms from './transforms/gallery-transforms';
import GalleryBlockIcon from './icons/GalleryBlockIcon';

import PickerModal from '@modules/PageBuilders/core/assets/src/components/PickerModal';
import LivePreview from '@modules/PageBuilders/core/assets/src/components/LivePreview';
import BlockPlaceholder from '@modules/PageBuilders/core/assets/src/components/BlockPlaceholder';
import InspectorGalleryPanel from '@modules/PageBuilders/core/assets/src/components/InspectorGalleryPanel';
import PreviewOptionsPanel from '@modules/PageBuilders/core/assets/src/components/PreviewOptionsPanel';
import PreviewOptionsToolbar from '@modules/PageBuilders/core/assets/src/components/PreviewOptionsToolbar';
// Shared collection styles ship as their own bundle
// (`fotogrids-pb-collection` handle, /assets/collection.css) and are
// enqueued separately. Each block stylesheet declares it as a dep, so
// it ships once per page no matter how many FotoGrids blocks exist.

const readPbConfig = () => window?.fotogridsPageBuilders || {};

const Edit = ({ attributes, setAttributes, isSelected }) => {
    const {
        galleryId,
        align,
        _pendingImportAttachmentIds: pendingIds,
        _pendingImportTitle: pendingTitle,
        previewClickBehavior = false,
        previewPagination = false,
    } = attributes;
    const blockProps = useBlockProps({
        className: `fg-pb-block fg-pb-block--gallery${align ? ` align${align}` : ''}`,
    });

    const config = readPbConfig();
    const restUrl = config.restUrl || '/wp-json/fotogrids/v1/';
    const restNonce = config.restNonce || '';
    const createNewUrl = config.galleryCreateUrl || '';
    const editBase = config.galleryEditBase || '';

    // Never auto-open. The placeholder's "Select a gallery" button (and
    // the toolbar / inspector "Change gallery" buttons) are the only
    // intentional ways in. Auto-opening on mount caused the inserter
    // hover-preview to flash because Edit re-mounts each hover and the
    // modal would open / close in a tight loop.
    const [pickerOpen, setPickerOpen] = useState(false);
    const [item, setItem] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState(null);

    // core/gallery -> fotogrids/gallery deferred-import handler.
    // The transform stamps `_pendingImportAttachmentIds`; on first mount
    // with those set, fire the import REST call, then clear them.
    useEffect(() => {
        if (!Array.isArray(pendingIds) || pendingIds.length === 0) {
            return undefined;
        }
        if (galleryId > 0) {
            // Import already happened; the pending fields are leftover.
            setAttributes({ _pendingImportAttachmentIds: [], _pendingImportTitle: '' });
            return undefined;
        }

        let cancelled = false;
        const run = async () => {
            setImporting(true);
            setImportError(null);
            try {
                const response = await fetch(`${restUrl}import/core-gallery`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': restNonce,
                    },
                    body: JSON.stringify({
                        attachment_ids: pendingIds,
                        title: pendingTitle || '',
                    }),
                });
                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.message || __('Import failed.', 'fotogrids'));
                }
                const data = await response.json();
                if (cancelled) return;
                setAttributes({
                    galleryId: data.gallery_id,
                    _pendingImportAttachmentIds: [],
                    _pendingImportTitle: '',
                });
                setRefreshKey((k) => k + 1);
            } catch (err) {
                if (cancelled) return;
                setImportError(err.message || __('Import failed.', 'fotogrids'));
            } finally {
                if (!cancelled) setImporting(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [pendingIds, pendingTitle, galleryId, restUrl, restNonce, setAttributes]);

    // When the block has a galleryId on first render, hydrate the
    // inspector with the picker-card payload so the sidebar shows real
    // title / thumb / item count without waiting for the preview render
    // to finish.
    useEffect(() => {
        if (!galleryId) {
            setItem(null);
            return;
        }
        if (item && item.id === galleryId) {
            return;
        }
        // Reuse the picker endpoint with a per_page=1 + an id filter would
        // be ideal, but we keep the API simple: fetch picker page 1 with a
        // tiny search, then find the id. As a pragmatic fallback we just
        // synthesise a minimal item from what we know - the live preview
        // will refresh once the user opens the picker again.
        setItem({
            id: galleryId,
            title: '',
            featured_thumb: null,
            item_count: 0,
            updated_at: null,
            status: 'publish',
        });
        // Best-effort hydrate from the picker endpoint.
        const url = `${restUrl}picker/items?type=gallery&per_page=100&orderby=newest`;
        fetch(url, { headers: { 'X-WP-Nonce': restNonce } })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data || !Array.isArray(data.items)) return;
                const match = data.items.find((it) => it.id === galleryId);
                if (match) setItem(match);
            })
            .catch(() => {});
    }, [galleryId, restUrl, restNonce]);

    const onSelectFromPicker = (picked) => {
        setItem(picked);
        setAttributes({ galleryId: picked.id });
        setRefreshKey((k) => k + 1);
        setPickerOpen(false);
    };

    const settingsSummary = useMemo(() => {
        if (!item) return [];
        const summary = [];
        if (item.layout) {
            summary.push({
                label: __('Layout', 'fotogrids'),
                value: String(item.layout).charAt(0).toUpperCase() + String(item.layout).slice(1),
            });
        }
        return summary;
    }, [item]);

    const editUrl = editBase && galleryId ? `${editBase}${galleryId}` : '';

    return (
        <div {...blockProps}>
            <BlockControls>
                <BlockAlignmentToolbar
                    value={align}
                    onChange={(value) => setAttributes({ align: value })}
                    controls={['left', 'center', 'right', 'wide', 'full']}
                />
                {galleryId > 0 && (
                    <ToolbarGroup>
                        <ToolbarButton
                            icon="update"
                            label={__('Change gallery', 'fotogrids')}
                            onClick={() => setPickerOpen(true)}
                        />
                        {editUrl && (
                            <ToolbarButton
                                icon="edit"
                                label={__('Edit gallery', 'fotogrids')}
                                href={editUrl}
                                target="_blank"
                            />
                        )}
                    </ToolbarGroup>
                )}
                {galleryId > 0 && (
                    <PreviewOptionsToolbar
                        clickBehavior={previewClickBehavior}
                        pagination={previewPagination}
                        onChangeClickBehavior={(v) => setAttributes({ previewClickBehavior: v })}
                        onChangePagination={(v) => setAttributes({ previewPagination: v })}
                    />
                )}
            </BlockControls>

            <InspectorControls>
                <InspectorGalleryPanel
                    item={item}
                    kind="gallery"
                    editUrl={editUrl}
                    onChange={() => setPickerOpen(true)}
                    settingsSummary={settingsSummary}
                />
                {galleryId > 0 && (
                    <PreviewOptionsPanel
                        clickBehavior={previewClickBehavior}
                        pagination={previewPagination}
                        onChangeClickBehavior={(v) => setAttributes({ previewClickBehavior: v })}
                        onChangePagination={(v) => setAttributes({ previewPagination: v })}
                    />
                )}
            </InspectorControls>

            {galleryId > 0 ? (
                <>
                    {isSelected && (
                        <div className="fg-pb-block__tag" aria-hidden="true">
                            {__('FotoGrids Gallery', 'fotogrids')}
                        </div>
                    )}
                    <LivePreview
                        kind="gallery"
                        id={galleryId}
                        restUrl={restUrl}
                        restNonce={restNonce}
                        refreshToken={refreshKey}
                        clickBehavior={previewClickBehavior}
                        pagination={previewPagination}
                    />
                </>
            ) : importing ? (
                <div className="fg-pb-block__importing">
                    {__('Importing the gallery into FotoGrids…', 'fotogrids')}
                </div>
            ) : importError ? (
                <div className="fg-pb-block__import-error">
                    <strong>{__('Import failed.', 'fotogrids')}</strong>
                    <p>{importError}</p>
                </div>
            ) : (
                <BlockPlaceholder
                    kind="gallery"
                    onOpenPicker={() => setPickerOpen(true)}
                    createNewUrl={createNewUrl}
                />
            )}

            {pickerOpen && (
                <PickerModal
                    kind="gallery"
                    restUrl={restUrl}
                    restNonce={restNonce}
                    onSelect={onSelectFromPicker}
                    onClose={() => setPickerOpen(false)}
                    selectedId={galleryId}
                    createNewUrl={createNewUrl}
                    title={sprintf(
                        /* translators: page-builder picker heading */
                        __('Select a FotoGrids gallery', 'fotogrids')
                    )}
                />
            )}
        </div>
    );
};

// Server-side register_block_type() (in Module.php) has already loaded the
// metadata from block.json. We only need to supply the edit/save halves
// here. Passing the metadata again would risk drift between JS and PHP.
registerBlockType(metadata.name, {
    // Multi-colour custom inserter icon. Passed via JS (not block.json)
    // because block.json's `icon` field only accepts a string handle, not
    // an SVG node. We deliberately don't wrap with `{src, foreground}` -
    // WordPress' has-colors mechanism applies a single colour to the
    // whole icon, which would override our per-cell stroke colours.
    icon: GalleryBlockIcon,
    edit: Edit,
    save: () => null,
    transforms,
});
