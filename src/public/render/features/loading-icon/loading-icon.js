/**
 * FotoGrids - Loading Icon
 *
 * Manages the data-fg-media-state attribute on .fg-item elements.
 *
 * This script owns both starting and stopping the loader animations:
 *  1. For every collection (initial DOM, DOMContentLoaded, and the runtime's
 *     onCollection hook, which also reports collections inserted later) it
 *     starts the WAAPI loader animation on each .fg-item's loader svg, keyed
 *     by the collection's data-fg-loading-icon, and stores the handles in
 *     window.fgLoaderHandles (a WeakMap keyed by .fg-item).
 *  2. Wire load/error listeners on every <img> inside each collection, and on
 *     the items announced by fotogrids:items_inserted (pagination, random
 *     re-sort).
 *  3. When an image settles, cancel its loader's WAAPI handles and set
 *     data-fg-media-state="loaded" so CSS hides the loader and reveals the
 *     image.
 *
 * The icon map (window.fotogridsLoadingIcons) is published via
 * wp_add_inline_script before this file runs.
 *
 * Individually per image, so heavy galleries reveal each thumbnail as it
 * arrives. Pointer-events on the clickable wrapper (<a>) are blocked via CSS
 * while state="loading" so the lightbox can't be triggered prematurely.
 *
 * No imports - standalone vanilla-JS compiled by webpack.
 */

( function () {
    'use strict';

    const STATE_ATTR   = 'data-fg-media-state';
    const STATE_LOADED = 'loaded';

    /**
     * Returns the global WeakMap of animation handles, creating it on first use.
     *
     * @returns {WeakMap<Element, Array>}
     */
    function getHandleMap() {
        if ( ! window.fgLoaderHandles ) {
            window.fgLoaderHandles = new WeakMap();
        }
        return window.fgLoaderHandles;
    }


    /**
     * Cancels all WAAPI Animation objects and rAF handles stored for an item.
     *
     * @param {Element} item The .fg-item <figure> element.
     */
    function cancelLoaderAnimation( item ) {
        const handles = getHandleMap().get( item );
        if ( ! handles ) {
            return;
        }

        handles.forEach( function ( h ) {
            if ( h && typeof h.cancel === 'function' ) {
                // Web Animations API Animation object.
                h.cancel();
            } else if ( typeof h === 'number' ) {
                // rAF id returned by fgAnimAttr.
                cancelAnimationFrame( h );
            }
        } );

        getHandleMap().delete( item );
    }


    /**
     * Marks a .fg-item as fully loaded: cancels its loader animations and sets
     * data-fg-media-state="loaded".
     *
     * @param {HTMLElement} item The .fg-item <figure> element.
     */
    function markLoaded( item ) {
        cancelLoaderAnimation( item );
        item.setAttribute( STATE_ATTR, STATE_LOADED );
    }

    /**
     * Resolves the WAAPI animate function for a collection from the page-level
     * icon map, keyed by the collection's data-fg-loading-icon attribute.
     * Falls back to the first icon in the map, then to the single-icon global
     * (window.fotogridsLoadingIcon) that lightbox surfaces also use.
     *
     * @param {Element} container A .fotogrids-collection element.
     * @returns {Function|null}
     */
    function resolveAnimateFn( container ) {
        const icons = window.fotogridsLoadingIcons;
        if ( icons && typeof icons === 'object' ) {
            const name = container.getAttribute( 'data-fg-loading-icon' ) || '';
            let icon = icons[ name ];
            if ( ! icon ) {
                const keys = Object.keys( icons );
                if ( keys.length ) icon = icons[ keys[ 0 ] ];
            }
            if ( icon && typeof icon.animate === 'function' ) {
                return icon.animate;
            }
        }
        if ( window.fotogridsLoadingIcon && typeof window.fotogridsLoadingIcon.animate === 'function' ) {
            return window.fotogridsLoadingIcon.animate;
        }
        return null;
    }

    /**
     * Starts the loader animation on a single .fg-item and stores the handles
     * so markLoaded can cancel them. No-op when the item already has handles
     * (idempotent across the multiple wiring passes) or has no loader svg.
     *
     * @param {Element}  item
     * @param {Function} animateFn
     */
    function startItemAnimation( item, animateFn ) {
        if ( ! animateFn || getHandleMap().has( item ) ) {
            return;
        }
        const svg = item.querySelector( '.fg-item-loader svg' );
        if ( ! svg ) {
            return;
        }
        try {
            const h = animateFn( svg );
            getHandleMap().set( item, Array.isArray( h ) ? h : [] );
        } catch ( e ) {
            // Never let an animation error break gallery functionality.
        }
    }

    /**
     * Starts loader animations for every item in a collection, using the icon
     * configured on that collection.
     *
     * @param {Element} container A .fotogrids-collection element.
     */
    function startGalleryAnimations( container ) {
        const animateFn = resolveAnimateFn( container );
        if ( ! animateFn ) {
            return;
        }
        container.querySelectorAll( '.fg-item' ).forEach( function ( item ) {
            startItemAnimation( item, animateFn );
        } );
    }

    /**
     * Wires load/error listeners onto a single <img> element.
     *
     * If the image is already complete, marks it loaded immediately. The initial
     * pass sets `deferImmediate: true` to schedule markLoaded on its own animation
     * frame so cached images reveal progressively; dynamic inserts pass nothing.
     *
     * @param {HTMLImageElement} img
     * @param {{ deferImmediate?: boolean }} [opts]
     */
    function wireImage( img, opts ) {
        const item = img.closest( '.fg-item' );
        if ( ! item ) {
            return;
        }

        const deferImmediate = !! ( opts && opts.deferImmediate );

        // Already resolved (naturalWidth > 0 means decoded image) OR errored
        // (complete but no natural size). Both go through markLoaded.
        if ( img.complete ) {
            if ( deferImmediate ) {
                // Defer to the next frame so the loader paints at least once and
                // the initial pass does not reveal every cached image in one batch.
                requestAnimationFrame( function () { markLoaded( item ); } );
            } else {
                markLoaded( item );
            }
            return;
        }

        const onSettle = () => {
            markLoaded( item );
            img.removeEventListener( 'load',  onSettle );
            img.removeEventListener( 'error', onSettle );
        };

        img.addEventListener( 'load',  onSettle );
        img.addEventListener( 'error', onSettle );

        // Re-check after binding: the image may have finished between the complete
        // check and addEventListener, which would leave it stuck in "loading".
        // onSettle removes its own listeners, so this cannot double-fire.
        if ( img.complete ) {
            onSettle();
        }
    }

    /**
     * Wires all images inside a collection container (gallery or album -
     * both render <figure data-fg-media-state="loading"> items whose
     * state needs flipping to "loaded" once the image arrives).
     *
     * Two modes:
     *
     *   - Initial pass (init() → wireGallery): images are wired with
     *     deferImmediate=true and staggered across animation frames, so cached
     *     images reveal progressively instead of in one batched paint.
     *
     *   - Dynamic pass: no staggering; inserted images are not complete yet.
     *
     * @param {Element} container A .fotogrids-collection element.
     * @param {{ initial?: boolean }} [opts]
     */
    function wireGallery( container, opts ) {
        const initial = !! ( opts && opts.initial );

        // Start the loader animations before wiring load listeners, so a
        // cached image's markLoaded (which cancels the animation) always has
        // handles to cancel and, in the initial pass, one painted frame first.
        startGalleryAnimations( container );

        const imgs = container.querySelectorAll( '.fg-item-media img' );

        if ( ! initial ) {
            imgs.forEach( function ( img ) { wireImage( img ); } );
            return;
        }

        // Initial pass - stagger across animation frames so the browser
        // paints the loader animation at least once per item and reveals
        // images progressively as their markLoaded mutation lands.
        let i = 0;
        function step() {
            // Small batches per frame keep large galleries from wiring for seconds.
            const BATCH = 4;
            const end = Math.min( i + BATCH, imgs.length );
            for ( ; i < end; i++ ) {
                wireImage( imgs[ i ], { deferImmediate: true } );
            }
            if ( i < imgs.length ) {
                requestAnimationFrame( step );
            }
        }
        if ( imgs.length > 0 ) {
            requestAnimationFrame( step );
        }
    }


    /**
     * Initial pass - wire every gallery already in the DOM.
     *
     * Uses the initial=true wireGallery mode so already-complete images
     * get progressively revealed across animation frames instead of all
     * in one main-thread-blocking batch.
     */
    function init() {
        document.querySelectorAll( '.fotogrids-collection' ).forEach( function ( container ) {
            wireGallery( container, { initial: true } );
        } );
    }

    /**
     * Starts the loader animation and wires the image of a single .fg-item
     * added to an existing collection.
     *
     * @param {Element} item       The .fg-item element.
     * @param {Element} collection Its .fotogrids-collection element.
     */
    function wireItem( item, collection ) {
        startItemAnimation( item, resolveAnimateFn( collection ) );
        const img = item.querySelector( '.fg-item-media img' );
        if ( img ) {
            wireImage( img );
        }
    }

    /**
     * Handles fotogrids:items_inserted, dispatched (bubbling) on a collection
     * whenever items are appended to or swapped into it.
     *
     * @param {CustomEvent} event
     */
    function onItemsInserted( event ) {
        const detail     = event.detail || {};
        const collection = detail.galleryEl
            || ( event.target instanceof Element ? event.target.closest( '.fotogrids-collection' ) : null );
        if ( ! collection || ! Array.isArray( detail.items ) ) {
            return;
        }

        detail.items.forEach( function ( node ) {
            if ( ! ( node instanceof Element ) ) {
                return;
            }
            if ( node.matches( '.fg-item' ) ) {
                wireItem( node, collection );
            }
            node.querySelectorAll( '.fg-item' ).forEach( function ( item ) {
                wireItem( item, collection );
            } );
        } );
    }

    // Wired from several points and made safe by idempotency: synchronously (the
    // footer script usually runs after the gallery markup), on DOMContentLoaded,
    // and through the runtime's onCollection hook, because some page builders
    // commit the gallery only after footer scripts have run.
    init();
    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    }
    if ( window.FotoGrids && typeof window.FotoGrids.onCollection === 'function' ) {
        window.FotoGrids.onCollection( function ( collectionEl ) {
            wireGallery( collectionEl, { initial: true } );
        } );
    }
    document.addEventListener( 'fotogrids:items_inserted', onItemsInserted );

} )();
