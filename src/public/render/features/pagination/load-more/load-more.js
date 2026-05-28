/**
 * FotoGrids — Pagination: load-more.
 *
 * Subscribes to FotoGrids.onGallery. For each gallery whose
 * data-fg-pagination-method === 'load_more', it:
 *
 *   1. Locates the [data-fg-pagination-trigger="load-more"] button.
 *   2. Wires click → FotoGrids.modules.pagination.goToPage(gEl, next, {
 *      mode: 'append' }).
 *   3. Hides the button when hasMore becomes false (via the
 *      .fg-pagination--exhausted class).
 *
 * No imports — standalone vanilla JS compiled by webpack as an entry.
 */

( function () {
    'use strict';

    /**
     * Attach behaviour to a single gallery.
     *
     * @param {Element} gEl
     */
    function attach( gEl ) {
        if ( gEl.dataset.fgPaginationMethod !== 'load_more' ) return;
        if ( gEl.dataset.fgLoadMoreBound === '1' ) return;
        gEl.dataset.fgLoadMoreBound = '1';

        var bar    = gEl.querySelector( '[data-fg-pagination-role="load-more"]' );
        var button = bar && bar.querySelector( '[data-fg-pagination-trigger="load-more"]' );
        if ( ! button ) return;

        var pagination = window.FotoGrids
            && window.FotoGrids.modules
            && window.FotoGrids.modules.pagination;
        if ( ! pagination ) return;

        button.addEventListener( 'click', function ( event ) {
            event.preventDefault();
            if ( button.disabled ) return;

            var s = pagination.state( gEl );
            if ( ! s.hasMore ) {
                bar.classList.add( 'fg-pagination--exhausted' );
                return;
            }

            button.disabled = true;
            button.classList.add( 'fg-is-loading' );

            pagination
                .goToPage( gEl, s.page + 1, { mode: 'append' } )
                .then( function ( result ) {
                    if ( ! result.hasMore ) {
                        bar.classList.add( 'fg-pagination--exhausted' );
                    }
                } )
                .catch( function () { /* surfaced inside goToPage */ } )
                .then( function () {
                    button.disabled = false;
                    button.classList.remove( 'fg-is-loading' );
                } );
        } );

        // Filter change → swap to the new filter state. swapToFilterState
        // restores from cache instantly if the user has visited this
        // filter combination before; otherwise it fetches page 1.
        gEl.addEventListener( 'fotogrids:filters_changed', function () {
            bar.classList.remove( 'fg-pagination--exhausted' );
            button.disabled = true;
            button.classList.add( 'fg-is-loading' );

            pagination
                .swapToFilterState( gEl )
                .then( function ( result ) {
                    if ( ! result.hasMore ) {
                        bar.classList.add( 'fg-pagination--exhausted' );
                    }
                } )
                .catch( function () { /* surfaced inside goToPage */ } )
                .then( function () {
                    button.disabled = false;
                    button.classList.remove( 'fg-is-loading' );
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
