/**
 * BlockPlaceholder - the pre-pick state shown when no gallery / album
 * is selected.
 *
 * Visually a static "skeleton" that previews what a gallery / album
 * *would* look like, plus the CTAs to actually pick one. The skeleton
 * is deliberately not a real render - no REST call fires, no
 * MutationObserver runs, so the inserter hover-preview lands here
 * cleanly with no flashing.
 *
 * Props:
 *   - kind:           'gallery' | 'album'
 *   - onOpenPicker:   () => void   primary action: open the picker modal
 *   - createNewUrl:   string       opens the FotoGrids new-gallery / new-album page
 *   - hasItems:       bool         true when the user has at least one gallery/album
 */

import React from 'react';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Static skeleton render. The grid mirrors a typical FotoGrids gallery
 * layout - 4 columns, 6 rows, soft gray tiles - and stays the same for
 * gallery and album blocks. Pure CSS, no animation, so it's quiet inside
 * the inserter's hover preview.
 */
const Skeleton = ({ kind, tileCount = 9 }) => {
    const tiles = [];
    for (let i = 0; i < tileCount; i++) {
        tiles.push(
            <div key={i} className="fg-pb-skeleton__tile" aria-hidden="true" />
        );
    }
    return (
        <div className={`fg-pb-skeleton fg-pb-skeleton--${kind}`} aria-hidden="true">
            <div className="fg-pb-skeleton__grid">{tiles}</div>
        </div>
    );
};

const BlockPlaceholder = ({
    kind,
    onOpenPicker,
    createNewUrl,
    hasItems = true,
}) => {
    const isAlbum = kind === 'album';

    const label = isAlbum
        ? __('FotoGrids Album', 'fotogrids')
        : __('FotoGrids Gallery', 'fotogrids');

    const instructions = hasItems
        ? (isAlbum
            ? __('Choose an album to insert, or create a new one.', 'fotogrids')
            : __('Choose a gallery to insert, or create a new one.', 'fotogrids'))
        : (isAlbum
            ? __('You haven’t created any albums yet. Create your first one to get started.', 'fotogrids')
            : __('You haven’t created any galleries yet. Create your first one to get started.', 'fotogrids'));

    return (
        <div className="fg-pb-block-placeholder">
            <Skeleton kind={kind} tileCount={isAlbum ? 4 : 9} />
            <div className="fg-pb-block-placeholder__chrome">
                <div className="fg-pb-block-placeholder__label">{label}</div>
                <div className="fg-pb-block-placeholder__instructions">
                    {instructions}
                </div>
                <div className="fg-pb-block-placeholder__actions">
                    {hasItems && (
                        <Button variant="primary" onClick={onOpenPicker}>
                            {isAlbum
                                ? __('Select an album', 'fotogrids')
                                : __('Select a gallery', 'fotogrids')
                            }
                        </Button>
                    )}
                    {createNewUrl && (
                        <Button
                            variant={hasItems ? 'tertiary' : 'primary'}
                            href={createNewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {hasItems
                                ? (isAlbum
                                    ? __('Create new album', 'fotogrids')
                                    : __('Create new gallery', 'fotogrids'))
                                : (isAlbum
                                    ? __('Create your first album', 'fotogrids')
                                    : __('Create your first gallery', 'fotogrids'))
                            }
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlockPlaceholder;
