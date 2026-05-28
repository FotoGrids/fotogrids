/**
 * FotoGrids — Lazy Load
 *
 * IntersectionObserver enhancement layer for lazy-loaded images.
 *
 * Two paths:
 *   • Native lazy: <img loading="lazy"> already handled by the browser; we
 *     only add a .fotogrids-lazy-loaded class on settle so CSS can fade
 *     the image in.
 *   • data-src lazy: <img data-src="..."> with no src yet — the IO swaps
 *     data-src → src when the image enters the viewport.
 *
 * Active when the gallery wrapper carries data-fg-lazy="1" (written by
 * the Lazy_Load feature module's wrapper_data_attrs).
 *
 * Subscribes to FotoGrids.onGallery for initial wiring, and listens for
 * `fotogrids:items_inserted` events on each gallery so newly-paginated
 * items are wired up the same way.
 *
 * No imports — standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    /**
     * Per-gallery observer state. We create the observers once per
     * gallery and reuse them for late-inserted items.
     *
     * @type {WeakMap<Element, { native: IntersectionObserver|null, dataSrc: IntersectionObserver|null }>}
     */
    var galleryObservers = new WeakMap();

    function ensureObservers( galleryEl ) {
        if ( galleryObservers.has( galleryEl ) ) {
            return galleryObservers.get( galleryEl );
        }

        var state = { native: null, dataSrc: null };

        if ( 'IntersectionObserver' in window ) {
            state.native = new IntersectionObserver( function ( entries, observer ) {
                entries.forEach( function ( entry ) {
                    if ( ! entry.isIntersecting ) return;
                    var img = entry.target;
                    if ( img.complete ) {
                        img.classList.add( 'fotogrids-lazy-loaded' );
                    } else {
                        img.addEventListener( 'load', function () {
                            img.classList.add( 'fotogrids-lazy-loaded' );
                        } );
                    }
                    observer.unobserve( img );
                } );
            } );

            state.dataSrc = new IntersectionObserver( function ( entries, observer ) {
                entries.forEach( function ( entry ) {
                    if ( ! entry.isIntersecting ) return;
                    var img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute( 'data-src' );
                    img.classList.add( 'fotogrids-lazy-loaded' );
                    observer.unobserve( img );
                } );
            } );
        }

        galleryObservers.set( galleryEl, state );
        return state;
    }

    /**
     * Bind lazy-load handlers to images inside `root` (either a whole
     * gallery wrapper or a list of inserted items).
     *
     * @param {Element} galleryEl
     * @param {Element|Element[]} scope  Where to search for new images.
     */
    function bindImages( galleryEl, scope ) {
        var state = ensureObservers( galleryEl );
        var scopes = Array.isArray( scope ) ? scope : [ scope ];

        scopes.forEach( function ( root ) {
            if ( ! root || ! root.querySelectorAll ) return;

            var nativeLazyImages = root.querySelectorAll( 'img[loading="lazy"]:not(.fotogrids-lazy-loaded)' );
            var dataSrcImages    = root.querySelectorAll( 'img[data-src]' );

            if ( state.native && state.dataSrc ) {
                nativeLazyImages.forEach( function ( img ) {
                    if ( img.dataset.fgLazyBound === '1' ) return;
                    img.dataset.fgLazyBound = '1';
                    state.native.observe( img );
                } );
                dataSrcImages.forEach( function ( img ) {
                    if ( img.dataset.fgLazyBound === '1' ) return;
                    img.dataset.fgLazyBound = '1';
                    state.dataSrc.observe( img );
                } );
            } else {
                // No IO — load everything immediately.
                nativeLazyImages.forEach( function ( img ) {
                    img.classList.add( 'fotogrids-lazy-loaded' );
                } );
                dataSrcImages.forEach( function ( img ) {
                    if ( img.dataset.src ) {
                        img.src = img.dataset.src;
                        img.removeAttribute( 'data-src' );
                    }
                    img.classList.add( 'fotogrids-lazy-loaded' );
                } );
            }
        } );
    }

    /**
     * Initial per-gallery setup. Wires up existing items and subscribes
     * the gallery to `fotogrids:items_inserted` so paginated additions
     * pick up the same behaviour.
     *
     * @param {Element} galleryEl
     */
    function attach( galleryEl ) {
        if ( ! galleryEl.matches( '[data-fg-lazy]' ) ) return;
        if ( galleryEl.dataset.fgLazyReady === '1' ) return;
        galleryEl.dataset.fgLazyReady = '1';

        bindImages( galleryEl, galleryEl );

        galleryEl.addEventListener( 'fotogrids:items_inserted', function ( event ) {
            var items = event.detail && event.detail.items;
            if ( ! items || ! items.length ) return;
            bindImages( galleryEl, items );
        } );
    }

    function init() {
        if ( window.FotoGrids && typeof window.FotoGrids.onGallery === 'function' ) {
            window.FotoGrids.onGallery( attach, 10 );
        }
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
