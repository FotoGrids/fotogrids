/**
 * FotoGrids - Single Item layout (Animate Images).
 *
 * When Animate Images is enabled the layout renders the full sorted set as
 * an absolutely-stacked deck. This module cross-fades through the items on
 * a timer, driving the active item via .fg-is-active / .fg-is-leaving (CSS
 * owns the fade). An optional progress indicator - a fill bar on one of the
 * four edges, or a circular spinner - counts down each interval in sync
 * with the timer.
 *
 * Reuses the shared carousel-helpers index state + autoplay. The timer
 * pauses on pointer hover (when enabled), on focus, and while the tab is
 * hidden; the indicator pauses and restarts in step with it.
 */

import { visibleItems, bootLayout } from '../_helpers/layout-helpers.js';
import { createIndexState, createAutoplay } from '../_helpers/carousel-helpers.js';

function readInt( el, attr, fallback ) {
    const v = parseInt( el.getAttribute( attr ), 10 );
    return isNaN( v ) ? fallback : v;
}

function readString( el, attr, fallback ) {
    const v = el.getAttribute( attr );
    return ( v === null || v === '' ) ? fallback : v;
}

/**
 * Read the Animate Images settings from the data attributes the PHP layout
 * wrote onto the collection element.
 */
function readSettings( collectionEl ) {
    return {
        delayMs:       Math.max( 1, readInt( collectionEl, 'data-fg-si-delay', 5 ) ) * 1000,
        progressStyle: readString( collectionEl, 'data-fg-si-progress-style', 'bar' ),
        barLocation:   readString( collectionEl, 'data-fg-si-progress-bar-loc', 'bottom' ),
        pauseOnHover:  collectionEl.getAttribute( 'data-fg-si-pause-on-hover' ) === '1',
    };
}

/**
 * Build the progress indicator element, or null when the style is 'none'.
 * The fill/spin duration is owned by CSS via --fg-si-progress-duration.
 */
function buildProgress( settings ) {
    if ( settings.progressStyle === 'none' ) return null;

    const el = document.createElement( 'div' );
    el.className = 'fg-si-progress fg-si-progress--' + settings.progressStyle;

    if ( settings.progressStyle === 'bar' ) {
        el.classList.add( 'fg-si-progress--' + settings.barLocation );
        const fill = document.createElement( 'div' );
        fill.className = 'fg-si-progress-fill';
        el.appendChild( fill );
    } else {
        const ring = document.createElement( 'div' );
        ring.className = 'fg-si-progress-ring';
        el.appendChild( ring );
    }

    return el;
}

function setup( collectionEl ) {
    const trackEl = collectionEl.querySelector( '.fg-single-item-track' );
    if ( ! trackEl ) return;

    const items = visibleItems( trackEl );

    // Nothing to cycle through with a single item - reveal it and bail.
    if ( items.length <= 1 ) {
        for ( let i = 0; i < items.length; i++ ) {
            items[ i ].classList.remove( 'fg-item-hidden' );
        }
        return;
    }

    const settings = readSettings( collectionEl );

    collectionEl.style.setProperty( '--fg-si-progress-duration', settings.delayMs + 'ms' );

    // The stage owns visibility through .fg-is-active now, so drop the
    // PHP-stamped initial hide on every item.
    for ( let i = 0; i < items.length; i++ ) {
        items[ i ].classList.remove( 'fg-item-hidden' );
    }

    const total      = items.length;
    const indexState = createIndexState( { total, loop: true, initial: 0 } );

    const progressEl = buildProgress( settings );
    if ( progressEl ) {
        trackEl.appendChild( progressEl );
    }

    const restartProgress = () => {
        if ( ! progressEl ) return;
        progressEl.classList.remove( 'fg-si-progress--paused', 'fg-si-progress--run' );
        // Force a reflow so removing then re-adding the run class restarts the
        // CSS animation from zero rather than letting it continue.
        void progressEl.offsetWidth;
        progressEl.classList.add( 'fg-si-progress--run' );
    };

    const pauseProgress = () => {
        if ( progressEl ) progressEl.classList.add( 'fg-si-progress--paused' );
    };

    const applyActive = ( next, prev ) => {
        for ( let i = 0; i < items.length; i++ ) {
            const el = items[ i ];
            el.classList.remove( 'fg-is-active', 'fg-is-leaving' );
            if ( i === next ) {
                el.classList.add( 'fg-is-active' );
            } else if ( i === prev && prev !== next ) {
                el.classList.add( 'fg-is-leaving' );
            }
        }
    };

    indexState.onChange( ( next, prev ) => {
        applyActive( next, prev );
        restartProgress();
    } );

    const autoplay = createAutoplay( {
        delay: settings.delayMs,
        onTick: () => { indexState.next(); },
        pauseOnHover: settings.pauseOnHover,
        container: collectionEl,
        pauseOnVisibility: true,
    } );

    // The autoplay timer restarts the full delay on hover-out, so the
    // indicator must restart with it; on hover-in both freeze. Bound to the
    // same events the timer listens to so the two stay in step.
    if ( settings.pauseOnHover ) {
        collectionEl.addEventListener( 'mouseenter', pauseProgress );
        collectionEl.addEventListener( 'mouseleave', restartProgress );
        collectionEl.addEventListener( 'focusin', pauseProgress );
        collectionEl.addEventListener( 'focusout', restartProgress );
    }

    applyActive( 0, 0 );
    restartProgress();
    autoplay.start();
}

function attach( collectionEl ) {
    if ( ! collectionEl.matches( '[data-fg-layout="single-item"]' ) ) return;
    if ( collectionEl.getAttribute( 'data-fg-si-auto-progress' ) !== '1' ) return;
    if ( collectionEl.dataset.fgSingleItemReady === '1' ) return;
    collectionEl.dataset.fgSingleItemReady = '1';
    setup( collectionEl );
}

bootLayout( attach, 10 );
