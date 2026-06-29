/**
 * FotoGrids - Pagination: endless scroll.
 *
 * Subscribes to FotoGrids.onGallery. For each gallery whose
 * data-fg-pagination-method === 'endless_scroll', it:
 *
 *   1. Locates the [data-fg-pagination-sentinel] element.
 *   2. Attaches an IntersectionObserver. When the sentinel is intersecting,
 *      it calls FotoGrids.modules.pagination.goToPage(gEl, next, { mode:
 *      'append' }).
 *   3. Disconnects the observer when hasMore becomes false.
 *
 * No imports - standalone vanilla JS compiled by webpack as an entry.
 */

( function () {
    'use strict';

    /**
     * Attach observer to a single gallery.
     *
     * @param {Element} gEl
     */
    /**
     * Start the WAAPI loader animation on the endless-scroll bar's SVG,
     * using the same animate fn the gallery's per-item loaders use.
     * No-op if already running or icon map isn't loaded.
     *
     * @param {Element} loaderEl  .fg-pagination__loader
     */
    function startLoaderAnimation( loaderEl ) {
        if ( loaderEl.dataset.fgLoaderAnimRunning === '1' ) return;
        const icons = window.fotogridsLoadingIcons;
        if ( ! icons ) return;
        const iconName = loaderEl.dataset.fgLoadingIcon || '12-dots';
        const icon = icons[ iconName ] || icons[ Object.keys( icons )[ 0 ] ];
        if ( ! icon || typeof icon.animate !== 'function' ) return;
        const svg = loaderEl.querySelector( 'svg' );
        if ( ! svg ) return;
        try {
            let handles = icon.animate( svg );
            loaderEl.__fgLoaderHandles = handles;
            loaderEl.dataset.fgLoaderAnimRunning = '1';
        } catch ( e ) { /* swallow */ }
    }

    /**
     * Cancel running WAAPI animations on the loader, mirroring
     * loading-icon.js::cancelLoaderAnimation but scoped to the
     * endless-scroll bar's loader (not a per-item loader).
     *
     * @param {Element} loaderEl
     */
    function stopLoaderAnimation( loaderEl ) {
        let handles = loaderEl.__fgLoaderHandles;
        if ( handles && handles.forEach ) {
            handles.forEach( function ( h ) {
                if ( h && typeof h.cancel === 'function' ) h.cancel();
                else if ( typeof h === 'number' ) cancelAnimationFrame( h );
            } );
        }
        loaderEl.__fgLoaderHandles = null;
        loaderEl.dataset.fgLoaderAnimRunning = '0';
    }

    function attach( gEl ) {
        if ( gEl.dataset.fgPaginationMethod !== 'endless_scroll' ) return;
        if ( gEl.dataset.fgEndlessScrollBound === '1' ) return;
        gEl.dataset.fgEndlessScrollBound = '1';

        let sentinel = gEl.querySelector( '[data-fg-pagination-sentinel="true"]' );
        if ( ! sentinel ) return;

        const loaderEl = gEl.querySelector( '.fg-pagination__loader' );

        const pagination = window.FotoGrids
            && window.FotoGrids.modules
            && window.FotoGrids.modules.pagination;
        if ( ! pagination ) return;

        // Start/stop the loader animation explicitly around each fetch. A
        // class-watching MutationObserver coalesces the add+remove of
        // .fotogrids-gallery--is-paginating on fast responses, so the
        // animation could miss its start. Driving it from the fetch
        // lifecycle is deterministic.
        function startLoader() {
            if ( loaderEl ) startLoaderAnimation( loaderEl );
        }

        function stopLoader() {
            if ( loaderEl ) stopLoaderAnimation( loaderEl );
        }

        // Pacing model: one page per scroll gesture.
        //
        // After each fetch resolves, the sentinel is unobserved so the
        // observer doesn't immediately re-fire (which would cascade-load
        // every remaining page when the appended items aren't tall
        // enough to push the sentinel out of the 200px rootMargin).
        //
        // We re-observe on the next scroll event. That makes each user
        // scroll gesture trigger at most one page load - the canonical
        // "infinite scroll" behaviour.
        //
        // inFlight guards against rare double-fires during the fetch
        // round-trip (the unobserve happens synchronously before the
        // fetch resolves, but defence-in-depth never hurts).

        let inFlight = false;
        let observerActive = false;
        let exhausted = false;

        function activateObserver() {
            if ( observerActive || exhausted ) return;
            observerActive = true;
            observer.observe( sentinel );
        }

        function deactivateObserver() {
            if ( ! observerActive ) return;
            observerActive = false;
            observer.unobserve( sentinel );
        }

        const observer = new IntersectionObserver( function ( entries ) {
            entries.forEach( function ( entry ) {
                if ( ! entry.isIntersecting || inFlight ) return;

                const s = pagination.state( gEl );
                if ( ! s.hasMore ) {
                    exhausted = true;
                    deactivateObserver();
                    return;
                }

                inFlight = true;
                // Stop observing while we fetch. Re-observation happens
                // on the next scroll event (one page per gesture).
                deactivateObserver();
                startLoader();

                pagination
                    .goToPage( gEl, s.page + 1, { mode: 'append' } )
                    .then( function ( result ) {
                        if ( ! result.hasMore ) {
                            exhausted = true;
                        }
                    } )
                    .catch( function () { /* surfaced inside goToPage */ } )
                    .then( function () {
                        inFlight = false;
                        stopLoader();
                    } );
            } );
        }, {
            // 200px lead-in so the next page starts loading just before
            // the user reaches the bottom. Combined with the "one page
            // per scroll gesture" pacing this gives a snappy reveal
            // without cascading.
            rootMargin: '200px 0px',
            threshold:  0,
        } );

        // Initial activation.
        activateObserver();

        // Each scroll gesture re-arms the observer (if we'd unobserved
        // it after the previous fetch). Uses { passive: true } so we
        // don't fight against smooth-scroll. The listener is on window
        // because the sentinel's intersection root is the viewport.
        window.addEventListener( 'scroll', function () {
            if ( exhausted || inFlight ) return;
            activateObserver();
        }, { passive: true } );

        // Filter change → swap to the new filter state. Restores from
        // cache instantly when available; falls back to a server fetch
        // when seeing the filter combo for the first time. Re-arms the
        // observer in case it had been deactivated after has_more became
        // false on a previous state.
        gEl.addEventListener( 'fotogrids:filters_changed', function () {
            inFlight = true;
            deactivateObserver();
            startLoader();
            pagination
                .swapToFilterState( gEl )
                .then( function ( result ) {
                    if ( result.hasMore ) {
                        exhausted = false;
                        activateObserver();
                    } else {
                        exhausted = true;
                    }
                } )
                .catch( function () { /* surfaced inside goToPage */ } )
                .then( function () {
                    inFlight = false;
                    stopLoader();
                } );
        } );
    }

    function init() {
        if ( ! window.FotoGrids || typeof window.FotoGrids.onGallery !== 'function' ) return;
        window.FotoGrids.onGallery( attach, 20 );
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
