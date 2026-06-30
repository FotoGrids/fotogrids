/**
 * FotoGrids - Masonry Layout
 *
 * JS-positioned masonry. The track is position:relative; items are
 * position:absolute. Column count comes from --fg-cols (fixed mode) or
 * is derived from --fg-col-min vs container width (auto mode). Per-item
 * heights are measured via getBoundingClientRect after sizing the item
 * to its column width.
 *
 * Order modes (read from data-fg-masonry-order):
 *   - 'row'    : every item drops into the currently-shortest column
 *                (Pinterest-style; left-to-right reading order on top row).
 *   - 'column' : items fill column 1 top-to-bottom, then column 2, etc.
 */

import {
    readCssInteger,
    readCssNumber,
    readCssLength,
    visibleItems,
    distributeIntegers,
    createLayoutAttach,
    bootLayout,
} from '../_helpers/layout-helpers.js';

function readColumnsMode( collectionEl ) {
    return collectionEl.getAttribute( 'data-fg-columns-mode' ) === 'auto' ? 'auto' : 'fixed';
}

function readOrder( collectionEl ) {
    return collectionEl.getAttribute( 'data-fg-masonry-order' ) === 'column' ? 'column' : 'row';
}

/**
 * Resolve the column count for the active breakpoint.
 *
 * @param {HTMLElement} collectionEl
 * @param {number} containerWidth
 * @param {number} gap
 * @return {number} Minimum 1.
 */
function resolveColumnCount( collectionEl, containerWidth, gap ) {
    const mode = readColumnsMode( collectionEl );

    if ( mode === 'fixed' ) {
        const cols = readCssInteger( collectionEl, '--fg-cols', 4 );
        return Math.max( 1, cols );
    }

    const colMin = readCssNumber( collectionEl, '--fg-col-min', 240 );
    const slot   = colMin + gap;
    if ( slot <= 0 ) return 1;
    const cols = Math.floor( ( containerWidth + gap ) / slot );
    return Math.max( 1, cols );
}

/**
 * Place items into rows (row-major). For each item: pick the currently
 * shortest column, set the item's left/top, advance that column's
 * height. Returns the final per-column heights so the caller can size
 * the track.
 *
 * @param {HTMLElement[]} items
 * @param {number[]} columnLefts
 * @param {number[]} columnWidths
 * @param {number} gap
 * @return {number[]} columnHeights after placement.
 */
/**
 * Compute the height an item occupies at a given column width.
 *
 * The media height is derived from the image's intrinsic aspect ratio (natural
 * dimensions, or the width/height attributes) scaled to the column width, which
 * is stable and available immediately even before the image has loaded.
 *
 * Flowing (non-overlay) captions add their measured height on top. The caption
 * is measured from the DOM, so the item must already be sized to its column
 * width before this runs (see the two-pass layout in `layout`): a flowing
 * caption's height depends on the width it wraps at and on percentage padding,
 * both of which resolve against the item's final width.
 *
 * @param {HTMLElement} item        The gallery item.
 * @param {number}      columnWidth The width the item is being laid out at.
 * @return {number}
 */
function measureItemHeight( item, columnWidth ) {
    const img = item.querySelector( 'img' );
    let height;

    const ratioW = img ? ( img.naturalWidth || parseFloat( img.getAttribute( 'width' ) ) ) : 0;
    const ratioH = img ? ( img.naturalHeight || parseFloat( img.getAttribute( 'height' ) ) ) : 0;

    if ( img && ratioW > 0 && ratioH > 0 ) {
        height = columnWidth * ( ratioH / ratioW );
    } else {
        // No usable intrinsic ratio (e.g. a non-image item) - fall back to the
        // media box, which by this pass is sized to the column width.
        const media = item.querySelector( '.fg-item-media' );
        height = media ? media.getBoundingClientRect().height : item.getBoundingClientRect().height;
    }

    // Flowing (non-overlay) captions add to the item's real height: the flex
    // gap between media and caption (the Caption Distance from Media setting,
    // applied as `gap` on the flex item) plus the caption box, whose measured
    // height already includes its own padding.
    const caption = item.querySelector( '.fg-caption' );
    if ( caption && window.getComputedStyle( caption ).position !== 'absolute' ) {
        const gapHost    = caption.parentElement || item;
        const captionGap = parseFloat( window.getComputedStyle( gapHost ).rowGap );
        height += isNaN( captionGap ) ? 0 : captionGap;
        height += caption.getBoundingClientRect().height;
    }

    return height;
}

function placeRowMajor( items, columnLefts, columnWidths, gap ) {
    const columnHeights = new Array( columnLefts.length ).fill( 0 );

    for ( let i = 0; i < items.length; i++ ) {
        const item = items[ i ];

        let shortestCol = 0;
        let shortestHeight = columnHeights[ 0 ];
        for ( let c = 1; c < columnHeights.length; c++ ) {
            if ( columnHeights[ c ] < shortestHeight ) {
                shortestHeight = columnHeights[ c ];
                shortestCol = c;
            }
        }

        // Items are already sized to their column width (pass 1 in `layout`),
        // so the caption box and media measure at their final width here.
        const itemHeight = measureItemHeight( item, columnWidths[ shortestCol ] );
        item.style.left  = columnLefts[ shortestCol ] + 'px';
        item.style.top   = Math.round( shortestHeight ) + 'px';

        columnHeights[ shortestCol ] = shortestHeight + itemHeight + gap;
    }

    return columnHeights;
}

/**
 * Place items column-by-column (column-major). Distributes items evenly
 * - items 0..k-1 in column 0, k..2k-1 in column 1, etc. - where k is
 * ceil(N/cols).
 *
 * @param {HTMLElement[]} items
 * @param {number[]} columnLefts
 * @param {number[]} columnWidths
 * @param {number} gap
 * @return {number[]} columnHeights after placement.
 */
function placeColumnMajor( items, columnLefts, columnWidths, gap ) {
    const cols = columnLefts.length;
    const itemsPerCol = Math.ceil( items.length / cols );
    const columnHeights = new Array( cols ).fill( 0 );

    for ( let i = 0; i < items.length; i++ ) {
        const col = Math.min( cols - 1, Math.floor( i / itemsPerCol ) );
        const item = items[ i ];

        // Items are already sized to their column width (pass 1 in `layout`),
        // so the caption box and media measure at their final width here.
        const itemHeight = measureItemHeight( item, columnWidths[ col ] );
        item.style.left  = columnLefts[ col ] + 'px';
        item.style.top   = Math.round( columnHeights[ col ] ) + 'px';

        columnHeights[ col ] = columnHeights[ col ] + itemHeight + gap;
    }

    return columnHeights;
}

function getCollectionEl( trackEl ) {
    return trackEl.closest( '[data-fg-layout="masonry"]' );
}

function layout( trackEl ) {
    const collectionEl = getCollectionEl( trackEl );
    if ( ! collectionEl ) return;

    const containerWidth = trackEl.clientWidth;
    if ( containerWidth <= 0 ) return;

    const items = visibleItems( trackEl );
    if ( items.length === 0 ) {
        trackEl.style.height = '';
        return;
    }

    const gap         = readCssLength( collectionEl, '--fg-gap', 10 );
    const columnCount = resolveColumnCount( collectionEl, containerWidth, gap );
    const order       = readOrder( collectionEl );

    // Switch the wrapper into positioned mode so items become position:absolute
    // and the track is a relative container for the JS-computed top/left.
    collectionEl.setAttribute( 'data-fg-masonry-positioned', '1' );

    const totalGap       = Math.max( 0, columnCount - 1 ) * gap;
    const availableWidth = containerWidth - totalGap;
    const columnWeights  = new Array( columnCount ).fill( 1 );
    const columnWidths   = distributeIntegers( columnWeights, availableWidth );

    const columnLefts = new Array( columnCount );
    let runningLeft = 0;
    for ( let c = 0; c < columnCount; c++ ) {
        columnLefts[ c ] = runningLeft;
        runningLeft += columnWidths[ c ] + gap;
    }

    // Pass 1: size every item to its column width. All masonry columns share
    // the same width (give or take a sub-pixel rounding difference), so the
    // first column's width is representative. Reading clientWidth afterwards
    // forces a single synchronous reflow so that pass 2's caption measurement
    // (which depends on the wrapped width and on percentage padding) reads the
    // item at its final size rather than its pre-sized width.
    const sizingWidth = columnWidths[ 0 ];
    for ( let i = 0; i < items.length; i++ ) {
        items[ i ].style.width = sizingWidth + 'px';
    }
    void trackEl.clientWidth;

    // Pass 2: measure each item at its applied width and position it.
    const columnHeights = order === 'column'
        ? placeColumnMajor( items, columnLefts, columnWidths, gap )
        : placeRowMajor( items, columnLefts, columnWidths, gap );

    let maxHeight = 0;
    for ( let c = 0; c < columnHeights.length; c++ ) {
        if ( columnHeights[ c ] > maxHeight ) maxHeight = columnHeights[ c ];
    }
    // Each column counted a trailing gap after the last item - subtract one.
    if ( maxHeight > 0 ) maxHeight -= gap;
    trackEl.style.height = Math.round( maxHeight ) + 'px';

    collectionEl.dataset.fgContainerWidth = String( Math.round( containerWidth ) );
}

const attach = createLayoutAttach( {
    collectionSelector: '[data-fg-layout="masonry"]',
    trackSelector:      '.fg-masonry-track',
    readyKey:           'fgMasonryReady',
    layoutFn:           layout,
} );

bootLayout( attach, 10 );
