/**
 * FotoGrids - Loading Icon
 *
 * Manages the data-fg-media-state attribute on .fg-item elements.
 *
 * This script owns both starting and stopping the loader animations:
 *  1. For every gallery (initial DOM, DOMContentLoaded, the runtime's
 *     onGallery hook, and the MutationObserver for dynamic inserts) it starts
 *     the WAAPI loader animation on each .fg-item's loader svg, keyed by the
 *     gallery's data-fg-loading-icon, and stores the handles in
 *     window.fgLoaderHandles (a WeakMap keyed by .fg-item).
 *  2. Wire load/error listeners on every <img> inside each gallery.
 *  3. When an image settles, cancel its loader's WAAPI handles and set
 *     data-fg-media-state="loaded" so CSS hides the loader and reveals the
 *     image.
 *
 * Animations were previously started by an inline <script> emitted inside the
 * gallery markup (Loading_Icon::html_after). That script was removed so the
 * markup can pass through wp_kses(); starting the animations here from the
 * onGallery hook is the runtime-contract-compliant replacement. The icon map
 * (window.fotogridsLoadingIcons) is published via wp_add_inline_script before
 * this file, so it is always defined when the passes below run.
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
     * Returns the global WeakMap where inline scripts store animation handles.
     * Creates it if it doesn't exist yet (handles the race where loading-icon.js
     * evaluates before a gallery's inline script, which shouldn't happen in
     * footer-script placement but is defensive).
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
     * configured on that collection. Replaces the per-gallery inline <script>
     * that Loading_Icon::html_after used to emit.
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
     * If the image is already complete (cached hit or footer-script timing),
     * marks it loaded immediately. The inline per-gallery script has already
     * started the animation, so cancelling here is safe - the animation ran
     * for 0ms and the user sees a clean instant reveal.
     *
     * Callers that want already-complete images to be revealed progressively
     * (initial-load pass) pass `deferImmediate: true`, which schedules the
     * markLoaded call onto its own animation frame. Per-item callers (the
     * MutationObserver path for paginated arrivals) pass nothing - images
     * inserted dynamically aren't complete yet, and even when they cache-hit
     * they're spaced out across separate insertions, so deferring would just
     * add latency.
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
                // Don't synchronously cancel the loader animation that the
                // inline html_after script just started. We need at least
                // one paint between animation start and animation cancel
                // for the user to see the loader. Without this, the entire
                // initial-load wireGallery loop runs to completion before
                // the browser paints anything, batching all images into a
                // single reveal AND cancelling every animation before it
                // ever ran a visible frame.
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

        // Race guard: the image can finish loading in the window between the
        // img.complete check above and addEventListener here - its load event
        // then fires with no listener attached and is lost forever, leaving
        // the item stuck in data-fg-media-state="loading". This is easy to hit
        // on pages where other work (lazy-load wiring, the image-zoom lens's
        // full-size background fetch, watermark URL rewrites) shifts decode
        // timing. Re-check after binding: if it already completed, settle now.
        // onSettle removes its own listeners, so this can't double-fire.
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
     *   - INITIAL pass (init() → wireGallery): every image is wired with
     *     deferImmediate=true AND staggered across animation frames so
     *     already-complete images reveal one per frame instead of all at
     *     once. This is the only path that runs against the parser-painted
     *     initial slice, where many images may already be cached/complete
     *     by footer-script time. Without staggering, the synchronous loop
     *     locks the main thread and the browser flushes every
     *     data-fg-media-state="loaded" mutation in a single paint, which
     *     looks (and is) batched.
     *
     *   - DYNAMIC pass (MutationObserver → wireGallery for late-inserted
     *     wrappers, or wireImage for a single .fg-item arrival): no
     *     staggering. Inserted items aren't complete yet, so the load
     *     listener path handles streaming naturally.
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
            // Process a small batch per frame so very large galleries don't
            // take forever to finish initial wiring on slow devices. One
            // image per frame would push a 60-image gallery to ~1s of frames
            // even if every image is already loaded.
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
     * MutationObserver - handles galleries inserted after page load
     * (album AJAX loads, password-unlock swaps, dynamic insertions).
     *
     * Dynamically inserted items don't have a prior inline script, so
     * we start animations here for those items.
     */
    function observeDynamic() {
        if ( ! ( 'MutationObserver' in window ) ) {
            return;
        }

        const observer = new MutationObserver( function ( mutations ) {
            mutations.forEach( function ( mutation ) {
                mutation.addedNodes.forEach( function ( node ) {
                    if ( ! ( node instanceof Element ) ) {
                        return;
                    }

                    // Newly inserted gallery wrapper - start animations + wire
                    // images inside it (wireGallery starts the animations).
                    if ( node.matches( '.fotogrids-collection' ) ) {
                        wireGallery( node );
                    }

                    // Galleries nested inside an inserted subtree.
                    node.querySelectorAll( '.fotogrids-collection' ).forEach( function ( gallery ) {
                        wireGallery( gallery );
                    } );

                    // Individual .fg-item appended into an existing gallery
                    // (e.g. pagination load-more).
                    if ( node.matches( '.fg-item' ) ) {
                        const gallery = node.closest( '.fotogrids-collection' );
                        if ( gallery ) {
                            startItemAnimation( node, resolveAnimateFn( gallery ) );
                        }
                        const img = node.querySelector( '.fg-item-media img' );
                        if ( img ) {
                            wireImage( img );
                        }
                    }
                } );
            } );
        } );

        observer.observe( document.body, { childList: true, subtree: true } );
    }

    // Wire galleries at several points and let idempotency sort it out.
    //
    // The script is enqueued in_footer:true, so USUALLY the gallery markup
    // is already parsed and queryable when this evaluates - so we call
    // init() synchronously, which also avoids waiting on DOMContentLoaded
    // (that event doesn't fire until every in-flight <img> settles, which on
    // a cold cache batches all reveals into one late paint).
    //
    // BUT "footer script runs after the gallery is in the DOM" is not
    // guaranteed across all themes/page builders. With some builders the
    // footer script can run before the builder has finished committing the
    // gallery node, so a single synchronous init() wires nothing and the
    // items sit forever in data-fg-media-state="loading". We therefore ALSO
    // run init() on DOMContentLoaded and (when present) via the FotoGrids
    // runtime's onGallery hook. Re-running is safe: wireImage() short-circuits
    // already-loaded items and its load listener removes itself, so an item
    // is never double-processed.
    init();
    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    }
    if ( window.FotoGrids && typeof window.FotoGrids.onGallery === 'function' ) {
        window.FotoGrids.onGallery( function ( galleryEl ) {
            wireGallery( galleryEl, { initial: true } );
        } );
    }
    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', observeDynamic );
    } else {
        observeDynamic();
    }

} )();
