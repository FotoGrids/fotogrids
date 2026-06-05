/**
 * Block transforms for fotogrids/album.
 *
 * Plan §8: only the shortcode-side transforms apply to albums - there is
 * no core counterpart that maps onto a FotoGrids album.
 */

import { createBlock } from '@wordpress/blocks';

const fromShortcode = {
    type: 'shortcode',
    tag: 'fotogrids_album',
    attributes: {
        albumId: {
            type: 'number',
            shortcode: ({ named: { id } }) => parseInt(id, 10) || 0,
        },
    },
};

const toShortcode = {
    type: 'block',
    blocks: ['core/shortcode'],
    transform: ({ albumId }) => createBlock('core/shortcode', {
        text: `[fotogrids_album id="${parseInt(albumId, 10) || 0}"]`,
    }),
    isMatch: ({ albumId }) => Number(albumId) > 0,
};

export default {
    from: [ fromShortcode ],
    to: [ toShortcode ],
};
