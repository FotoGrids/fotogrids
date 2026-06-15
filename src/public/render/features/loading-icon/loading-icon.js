/**
 * FotoGrids - Loading Icon
 *
 * Manages the data-fg-media-state attribute on .fg-item elements.
 *
 * WAAPI animations are started by an inline <script> emitted immediately after
 * each gallery wrapper (Loading_Icon::html_after). That script runs as the
 * browser parses the page - before images load from cache - and stores
 * animation handles in window.fgLoaderHandles (a WeakMap keyed by .fg-item).
 *
 * This footer script's job is purely state management:
 *  1. Wire load/error listeners on every <img> inside each gallery.
 *  2. When an image settles, cancel its loader's WAAPI handles (retrieved from
 *     window.fgLoaderHandles) and set data-fg-media-state="loaded" so CSS
 *     hides the loader and reveals the image.
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
     * MutationObserver path for paginated arrivals) pass nothing — images
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
        // img.complete check above and addEventListener here — its load event
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
     * Wires all images inside a collection container (gallery or album —
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
        const imgs = container.querySelectorAll( '.fg-item-media img' );

        if ( ! initial ) {
            imgs.forEach( function ( img ) { wireImage( img ); } );
            return;
        }

        // Initial pass — stagger across animation frames so the browser
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

        const animateFn = window.fotogridsLoadingIcon && typeof window.fotogridsLoadingIcon.animate === 'function'
            ? window.fotogridsLoadingIcon.animate
            : null;

        /**
         * Starts a loader animation for a dynamically inserted item.
         *
         * @param {Element} item
         */
        function startDynamicAnimation( item ) {
            if ( ! animateFn ) return;
            const svg = item.querySelector( '.fg-item-loader svg' );
            if ( ! svg ) return;
            try {
                const h = animateFn( svg );
                getHandleMap().set( item, Array.isArray( h ) ? h : [] );
            } catch ( e ) {
                // Never let an animation error break gallery functionality.
            }
        }

        const observer = new MutationObserver( function ( mutations ) {
            mutations.forEach( function ( mutation ) {
                mutation.addedNodes.forEach( function ( node ) {
                    if ( ! ( node instanceof Element ) ) {
                        return;
                    }

                    // Newly inserted gallery wrapper - wire images inside it.
                    if ( node.matches( '.fotogrids-collection' ) ) {
                        node.querySelectorAll( '.fg-item' ).forEach( startDynamicAnimation );
                        wireGallery( node );
                    }

                    // Galleries nested inside an inserted subtree.
                    node.querySelectorAll( '.fotogrids-collection' ).forEach( function ( gallery ) {
                        gallery.querySelectorAll( '.fg-item' ).forEach( startDynamicAnimation );
                        wireGallery( gallery );
                    } );

                    // Individual .fg-item appended into an existing gallery
                    // (e.g. pagination load-more).
                    if ( node.matches( '.fg-item' ) ) {
                        startDynamicAnimation( node );
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
    // is already parsed and queryable when this evaluates — so we call
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
