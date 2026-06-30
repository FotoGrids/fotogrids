/**
 * Block transforms for fotogrids/gallery.
 *
 * Three transforms ship in v1:
 *
 *   1. From [fotogrids_gallery] shortcode -> block (synchronous)
 *   2. From core/gallery block -> block (deferred-import: the transform
 *      stamps the source attachment IDs on _pendingImportAttachmentIds;
 *      the gallery block's Edit component picks that up, fires the
 *      `/import/core-gallery` REST call, sets the real galleryId, and
 *      clears the pending fields.)
 *   3. To [fotogrids_gallery id="X"] shortcode block (synchronous)
 *
 * Plan §8.
 */

import { createBlock } from '@wordpress/blocks';

const fromShortcode = {
    type: 'shortcode',
    tag: 'fotogrids_gallery',
    attributes: {
        galleryId: {
            type: 'number',
            shortcode: ({ named: { id } }) => parseInt(id, 10) || 0,
        },
    },
};

const fromCoreGallery = {
    type: 'block',
    blocks: ['core/gallery'],
    transform: (attributes, innerBlocks) => {
        const ids = collectCoreGalleryAttachmentIds(attributes, innerBlocks);

        return createBlock('fotogrids/gallery', {
            galleryId: 0,
            _pendingImportAttachmentIds: ids,
            _pendingImportTitle: '',
        });
    },
};

const toShortcode = {
    type: 'block',
    blocks: ['core/shortcode'],
    transform: ({ galleryId }) => createBlock('core/shortcode', {
        text: `[fotogrids_gallery id="${parseInt(galleryId, 10) || 0}"]`,
    }),
    isMatch: ({ galleryId }) => Number(galleryId) > 0,
};

/**
 * Pull attachment IDs out of a core/gallery's attributes + innerBlocks.
 *
 * The block evolved across WP versions:
 *   - Old galleries had `attributes.ids` directly.
 *   - Newer galleries hold images in `innerBlocks` (each a core/image).
 *
 * @param {Object} attributes
 * @param {Array}  innerBlocks
 * @return {number[]}
 */
const collectCoreGalleryAttachmentIds = (attributes, innerBlocks) => {
    const ids = [];

    if (Array.isArray(attributes?.ids)) {
        attributes.ids.forEach((id) => {
            const n = parseInt(id, 10);
            if (n > 0 && !ids.includes(n)) ids.push(n);
        });
    }
    if (Array.isArray(attributes?.images)) {
        attributes.images.forEach((image) => {
            const n = parseInt(image?.id, 10);
            if (n > 0 && !ids.includes(n)) ids.push(n);
        });
    }
    if (Array.isArray(innerBlocks)) {
        innerBlocks.forEach((block) => {
            if (block?.name === 'core/image') {
                const n = parseInt(block?.attributes?.id, 10);
                if (n > 0 && !ids.includes(n)) ids.push(n);
            }
        });
    }

    return ids;
};

export default {
    from: [ fromShortcode, fromCoreGallery ],
    to: [ toShortcode ],
};
