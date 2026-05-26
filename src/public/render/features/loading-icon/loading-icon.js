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

    // -------------------------------------------------------------------------
    // Handle map - shared with the inline per-gallery script
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Animation cancellation
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // State management
    // -------------------------------------------------------------------------

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
     * @param {HTMLImageElement} img
     */
    function wireImage( img ) {
        const item = img.closest( '.fg-item' );
        if ( ! item ) {
            return;
        }

        // Already resolved - naturalWidth > 0 means decoded image.
        if ( img.complete && img.naturalWidth > 0 ) {
            markLoaded( item );
            return;
        }

        // Error state (complete but no natural size).
        if ( img.complete ) {
            markLoaded( item );
            return;
        }

        const onSettle = () => {
            markLoaded( item );
            img.removeEventListener( 'load',  onSettle );
            img.removeEventListener( 'error', onSettle );
        };

        img.addEventListener( 'load',  onSettle );
        img.addEventListener( 'error', onSettle );
    }

    /**
     * Wires all images inside a gallery container.
     *
     * @param {Element} container A .fotogrids-gallery element.
     */
    function wireGallery( container ) {
        const imgs = container.querySelectorAll( '.fg-item-media img' );
        imgs.forEach( wireImage );
    }

    // -------------------------------------------------------------------------
    // Bootstrap
    // -------------------------------------------------------------------------

    /**
     * Initial pass - wire every gallery already in the DOM.
     */
    function init() {
        document.querySelectorAll( '.fotogrids-gallery' ).forEach( wireGallery );
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
                    if ( node.matches( '.fotogrids-gallery' ) ) {
                        node.querySelectorAll( '.fg-item' ).forEach( startDynamicAnimation );
                        wireGallery( node );
                    }

                    // Galleries nested inside an inserted subtree.
                    node.querySelectorAll( '.fotogrids-gallery' ).forEach( function ( gallery ) {
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

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', function () {
            init();
            observeDynamic();
        } );
    } else {
        init();
        observeDynamic();
    }

} )();
