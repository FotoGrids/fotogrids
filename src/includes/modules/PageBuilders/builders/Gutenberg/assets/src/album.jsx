/**
 * FotoGrids Album - Gutenberg block.
 *
 * Mirror of the gallery block with album-specific Inspector content
 * (read-only layout_mode summary).
 */

import './album.scss';

import React, { useEffect, useMemo, useState } from 'react';
import { registerBlockType } from '@wordpress/blocks';
import {
    useBlockProps,
    InspectorControls,
    BlockControls,
    BlockAlignmentToolbar,
} from '@wordpress/block-editor';
import { PanelBody, ToolbarGroup, ToolbarButton, Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import metadata from '../../blocks/album/block.json';
import transforms from './transforms/album-transforms';
import AlbumBlockIcon from './icons/AlbumBlockIcon';

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

const LayoutModePanel = ({ layoutMode, editUrl }) => {
    if (!layoutMode) {
        return null;
    }
    const labels = {
        integrated: __('Integrated - galleries open inline on this page.', 'fotogrids'),
        standalone: __('Standalone - galleries open in their own View Page.', 'fotogrids'),
    };
    const text = labels[layoutMode] || sprintf(
        /* translators: %s: layout mode identifier */
        __('Layout mode: %s', 'fotogrids'),
        layoutMode
    );
    return (
        <PanelBody title={__('Layout mode', 'fotogrids')} initialOpen={false}>
            <p>{text}</p>
            {editUrl && (
                <Button
                    variant="link"
                    href={editUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {__('Change in the album editor', 'fotogrids')}
                </Button>
            )}
        </PanelBody>
    );
};

const Edit = ({ attributes, setAttributes, isSelected }) => {
    const {
        albumId,
        align,
        previewClickBehavior = false,
        previewPagination = false,
    } = attributes;
    const blockProps = useBlockProps({
        className: `fg-pb-block fg-pb-block--album${align ? ` align${align}` : ''}`,
    });

    const config = readPbConfig();
    const restUrl = config.restUrl || '/wp-json/fotogrids/v1/';
    const restNonce = config.restNonce || '';
    const createNewUrl = config.albumCreateUrl || '';
    const editBase = config.albumEditBase || '';

    // Never auto-open. The placeholder's "Select an album" button (and
    // the toolbar / inspector "Change album" buttons) are the only
    // intentional ways in.
    const [pickerOpen, setPickerOpen] = useState(false);
    const [item, setItem] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [layoutMode, setLayoutMode] = useState(null);

    useEffect(() => {
        if (!albumId) {
            setItem(null);
            setLayoutMode(null);
            return;
        }
        if (item && item.id === albumId) {
            return;
        }
        setItem({
            id: albumId,
            title: '',
            featured_thumb: null,
            item_count: 0,
            updated_at: null,
            requires_pro: false,
            status: 'publish',
        });
        const url = `${restUrl}picker/items?type=album&per_page=100&orderby=newest`;
        fetch(url, { headers: { 'X-WP-Nonce': restNonce } })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data || !Array.isArray(data.items)) return;
                const match = data.items.find((it) => it.id === albumId);
                if (match) setItem(match);
            })
            .catch(() => {});
    }, [albumId, restUrl, restNonce]);

    const onSelectFromPicker = (picked) => {
        setItem(picked);
        setAttributes({ albumId: picked.id });
        setRefreshKey((k) => k + 1);
        setPickerOpen(false);
    };

    const onPreviewResponse = (data) => {
        // The album preview payload returns the resolved settings via
        // data.assets?.localize - layout_mode lives on the album settings,
        // but the preview payload itself doesn't carry it. As a v1
        // simplification we surface "integrated by default" until we
        // expose the actual setting via the picker item or the preview
        // response. (Followup tracked in plan §3g.)
        if (data?.layout_mode) {
            setLayoutMode(data.layout_mode);
        }
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

    const editUrl = editBase && albumId ? `${editBase}${albumId}` : '';

    return (
        <div {...blockProps}>
            <BlockControls>
                <BlockAlignmentToolbar
                    value={align}
                    onChange={(value) => setAttributes({ align: value })}
                    controls={['left', 'center', 'right', 'wide', 'full']}
                />
                {albumId > 0 && (
                    <ToolbarGroup>
                        <ToolbarButton
                            icon="update"
                            label={__('Change album', 'fotogrids')}
                            onClick={() => setPickerOpen(true)}
                        />
                        {editUrl && (
                            <ToolbarButton
                                icon="edit"
                                label={__('Edit album', 'fotogrids')}
                                href={editUrl}
                                target="_blank"
                            />
                        )}
                    </ToolbarGroup>
                )}
                {albumId > 0 && (
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
                    kind="album"
                    editUrl={editUrl}
                    onChange={() => setPickerOpen(true)}
                    settingsSummary={settingsSummary}
                />
                {albumId > 0 && (
                    <PreviewOptionsPanel
                        clickBehavior={previewClickBehavior}
                        pagination={previewPagination}
                        onChangeClickBehavior={(v) => setAttributes({ previewClickBehavior: v })}
                        onChangePagination={(v) => setAttributes({ previewPagination: v })}
                    />
                )}
                <LayoutModePanel layoutMode={layoutMode} editUrl={editUrl} />
            </InspectorControls>

            {albumId > 0 ? (
                <>
                    {isSelected && (
                        <div className="fg-pb-block__tag" aria-hidden="true">
                            {__('FotoGrids Album', 'fotogrids')}
                        </div>
                    )}
                    <LivePreview
                        kind="album"
                        id={albumId}
                        restUrl={restUrl}
                        restNonce={restNonce}
                        refreshToken={refreshKey}
                        onResponse={onPreviewResponse}
                        clickBehavior={previewClickBehavior}
                        pagination={previewPagination}
                    />
                </>
            ) : (
                <BlockPlaceholder
                    kind="album"
                    onOpenPicker={() => setPickerOpen(true)}
                    createNewUrl={createNewUrl}
                />
            )}

            {pickerOpen && (
                <PickerModal
                    kind="album"
                    restUrl={restUrl}
                    restNonce={restNonce}
                    onSelect={onSelectFromPicker}
                    onClose={() => setPickerOpen(false)}
                    selectedId={albumId}
                    createNewUrl={createNewUrl}
                    title={__('Select a FotoGrids album', 'fotogrids')}
                />
            )}
        </div>
    );
};

registerBlockType(metadata.name, {
    // Multi-colour custom inserter icon. Passed via JS (not block.json)
    // because block.json's `icon` field only accepts a string handle, not
    // an SVG node. We deliberately don't wrap with `{src, foreground}` -
    // WordPress' has-colors mechanism applies a single colour to the
    // whole icon, which would override our per-cell stroke colours.
    icon: AlbumBlockIcon,
    edit: Edit,
    save: () => null,
    transforms,
});
