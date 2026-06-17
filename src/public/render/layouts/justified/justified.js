/**
 * FotoGrids - Justified Layout
 *
 * Row-packer for the justified layout. Reads the per-row target height
 * from CSS variable `--fg-justified-row-height` (resolved at runtime
 * against the active breakpoint via the Style_Var_Builder cascade) and
 * the tolerance / last-row / max-rows / page-trailing-row behaviour from
 * the `data-fg-justified-*` attributes the PHP Layout_Justified writes
 * onto the wrapper.
 *
 * Layout primitives (attach scaffolding, dimension waiting, gap reads)
 * come from layouts/_helpers/layout-helpers.js so the justified and
 * masonry modules share boilerplate.
 */

import {
    aspectRatioFor,
    readTrackGap,
    readCssNumber,
    hasNextPage,
    visibleItems,
    createLayoutAttach,
    bootLayout,
} from '../_helpers/layout-helpers.js';

function readTolerance( collectionEl ) {
    const raw = collectionEl.getAttribute( 'data-fg-justified-tolerance' );
    const parsed = parseInt( raw, 10 );
    if ( isNaN( parsed ) ) return 0.25;
    return Math.max( 0, Math.min( 100, parsed ) ) / 100;
}

function readLastRow( collectionEl ) {
    return collectionEl.getAttribute( 'data-fg-justified-last-row' ) || 'nojustify';
}

function readMaxRows( collectionEl ) {
    const raw = collectionEl.getAttribute( 'data-fg-justified-max-rows' );
    const parsed = parseInt( raw, 10 );
    return isNaN( parsed ) || parsed < 0 ? 0 : parsed;
}

function readPageTrailingRow( collectionEl ) {
    const raw = collectionEl.getAttribute( 'data-fg-justified-page-trailing-row' ) || 'fill';
    return raw === 'match' ? 'match' : 'fill';
}

/**
 * Pack the items into rows via shrink-vs-grow lookahead.
 *
 * @param {HTMLElement[]} items
 * @param {number} containerWidth
 * @param {number} gap
 * @param {number} targetHeight
 * @return {Array<Array<{ item: HTMLElement, aspect: number }>>}
 */
function buildRows( items, containerWidth, gap, targetHeight ) {
    const rows = [];
    let current = [];
    let currentAspectSum = 0;

    const availableWidth = ( count ) => containerWidth - Math.max( 0, count - 1 ) * gap;
    const rowHeightFor = ( aspectSum, count ) => {
        if ( aspectSum <= 0 || count <= 0 ) return targetHeight;
        return availableWidth( count ) / aspectSum;
    };

    for ( let i = 0; i < items.length; i++ ) {
        const item = items[ i ];
        const aspect = aspectRatioFor( item );

        const withCount = current.length + 1;
        const withAspect = currentAspectSum + aspect;
        const naturalWidthWith = withAspect * targetHeight + Math.max( 0, withCount - 1 ) * gap;

        if ( naturalWidthWith < containerWidth || current.length === 0 ) {
            current.push( { item, aspect } );
            currentAspectSum = withAspect;
            continue;
        }

        const heightWith    = rowHeightFor( withAspect,        withCount );
        const heightWithout = rowHeightFor( currentAspectSum,  current.length );

        const deltaWith    = Math.abs( heightWith    - targetHeight );
        const deltaWithout = Math.abs( heightWithout - targetHeight );

        if ( deltaWith <= deltaWithout ) {
            current.push( { item, aspect } );
            rows.push( current );
            current = [];
            currentAspectSum = 0;
        } else {
            rows.push( current );
            current = [ { item, aspect } ];
            currentAspectSum = aspect;
        }
    }

    if ( current.length > 0 ) {
        rows.push( current );
    }

    return rows;
}

/**
 * Apply width + height to every item in a packed row. Distributes
 * floor-rounding error across the row so the rightmost item lands at
 * exactly containerWidth - totalGap.
 *
 * @return {number} The applied row height.
 */
function applyRow( row, containerWidth, gap, targetHeight, stretch ) {
    const totalGap = Math.max( 0, row.length - 1 ) * gap;
    const availableWidth = containerWidth - totalGap;
    let totalAspect = row.reduce( ( sum, entry ) => sum + entry.aspect, 0 );
    if ( totalAspect <= 0 ) totalAspect = 1;

    const rowHeight = stretch ? availableWidth / totalAspect : targetHeight;
    const intHeight = Math.round( rowHeight );

    let cumulativeFloat = 0;
    let cumulativeInt   = 0;
    for ( let i = 0; i < row.length; i++ ) {
        const entry = row[ i ];
        cumulativeFloat += entry.aspect * rowHeight;
        const cumulativeRounded = Math.round( cumulativeFloat );
        const intWidth = cumulativeRounded - cumulativeInt;
        cumulativeInt = cumulativeRounded;

        entry.item.style.width = intWidth + 'px';
        entry.item.style.height = intHeight + 'px';
        entry.item.style.flexGrow = '0';
        entry.item.style.flexShrink = '0';
        entry.item.style.marginLeft = '';
        entry.item.style.marginRight = '';
        entry.item.removeAttribute( 'data-fg-justified-last-row' );
        entry.item.removeAttribute( 'data-fg-justified-last-row-first' );
        entry.item.removeAttribute( 'data-fg-justified-last-row-last' );
    }

    return rowHeight;
}

function applyMaxRowsCutoff( rows, cutoffRow ) {
    if ( cutoffRow <= 0 ) return;
    for ( let i = 0; i < rows.length; i++ ) {
        const hidden = i >= cutoffRow;
        for ( let j = 0; j < rows[ i ].length; j++ ) {
            rows[ i ][ j ].item.style.display = hidden ? 'none' : '';
        }
    }
}

function getCollectionEl( trackEl ) {
    return trackEl.closest( '[data-fg-layout="justified"]' );
}

function layout( trackEl ) {
    const collectionEl = getCollectionEl( trackEl );
    if ( ! collectionEl ) return;

    const containerWidth = trackEl.clientWidth;
    if ( containerWidth <= 0 ) return;

    const items = visibleItems( trackEl );
    if ( items.length === 0 ) return;

    const gap             = readTrackGap( trackEl );
    const targetHeight    = readCssNumber( collectionEl, '--fg-justified-row-height', 220 );
    const tolerance       = readTolerance( collectionEl );
    const lastRow         = readLastRow( collectionEl );
    const maxRows         = readMaxRows( collectionEl );
    const pageTrailingRow = readPageTrailingRow( collectionEl );
    const snapTrailingRow = pageTrailingRow === 'fill' && hasNextPage( collectionEl );

    const rows = buildRows( items, containerWidth, gap, targetHeight );
    if ( rows.length === 0 ) return;

    const lastIndex = rows.length - 1;
    const minHeight = targetHeight * ( 1 - tolerance );
    const maxHeight = targetHeight * ( 1 + tolerance );

    for ( let i = 0; i < rows.length; i++ ) {
        const isLast = i === lastIndex;
        const stretch = ! isLast || lastRow === 'justify' || ( isLast && snapTrailingRow );

        const appliedHeight = applyRow( rows[ i ], containerWidth, gap, targetHeight, stretch );

        if (
            isLast
            && stretch
            && lastRow !== 'justify'
            && ! snapTrailingRow
            && ( appliedHeight < minHeight || appliedHeight > maxHeight )
        ) {
            applyRow( rows[ i ], containerWidth, gap, targetHeight, false );
        }

        if ( isLast && ! snapTrailingRow ) {
            const lastRowEntries = rows[ i ];
            if ( lastRow === 'hide' ) {
                for ( let j = 0; j < lastRowEntries.length; j++ ) {
                    lastRowEntries[ j ].item.setAttribute( 'data-fg-justified-last-row', '1' );
                }
            } else if ( lastRow === 'center' || lastRow === 'right' ) {
                lastRowEntries[ 0 ].item.setAttribute( 'data-fg-justified-last-row-first', '1' );
                if ( lastRow === 'center' ) {
                    lastRowEntries[ lastRowEntries.length - 1 ].item.setAttribute( 'data-fg-justified-last-row-last', '1' );
                }
            }
        }
    }

    applyMaxRowsCutoff( rows, maxRows );

    collectionEl.dataset.fgContainerWidth = String( Math.round( containerWidth ) );
    collectionEl.setAttribute( 'data-fg-justified-packed', '1' );
}

const attach = createLayoutAttach( {
    collectionSelector: '[data-fg-layout="justified"]',
    trackSelector:      '.fg-justified-track',
    readyKey:           'fgJustifiedReady',
    layoutFn:           layout,
} );

bootLayout( attach, 10 );
