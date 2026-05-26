/**
 * FotoGrids - Filter UI
 *
 * This file is intentionally minimal. All filter logic - initializeFilters(),
 * _initFilterButtons(), _initFilterDropdowns(), _initFilterCheckboxes(),
 * _applyFilters(), _recalculateCounts(), _syncFilterUI() - lives inside the
 * FotoGrids class in frontend/src/index.js (the main bundle), which is
 * always present on gallery pages.
 *
 * This file's purpose is to fire a page-level event after the footer JS
 * bundle runs, giving Pro extensions and third-party code a reliable hook
 * point to add custom filter sources or extend filter behaviour. It also
 * re-triggers filter initialisation for galleries that were lazy-loaded or
 * dynamically injected after the main bundle ran.
 *
 * No imports - standalone vanilla-JS compiled by webpack.
 */

( function () {
    'use strict';

    /**
     * Re-initialises filters for any galleries that have a filter bar but
     * whose FotoGrids instance has not yet wired up filter events.
     *
     * The main frontend bundle handles galleries present at DOMContentLoaded.
     * This footer script handles galleries that are rendered after the initial
     * load (e.g. after a password gate is cleared, or after an AJAX album
     * insert). It iterates `window.fotogridsInstances` (populated by the main
     * bundle) and calls initializeFilters() on instances whose filter container
     * has not yet received the `data-fg-filters-ready` attribute.
     */
    function reinitLateFilters() {
        if ( ! window.fotogridsInstances ) {
            return;
        }

        window.fotogridsInstances.forEach( function ( instance ) {
            var wrapper = instance.element;
            if ( ! wrapper ) return;

            var filterBar = wrapper.querySelector( '.fotogrids-filters' );
            if ( ! filterBar ) return;

            if ( filterBar.dataset.fgFiltersReady ) return;

            if ( typeof instance.initializeFilters === 'function' ) {
                instance.initializeFilters();
                filterBar.dataset.fgFiltersReady = 'true';
            }
        } );
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', reinitLateFilters );
    } else {
        reinitLateFilters();
    }

    /**
     * Dispatches `fotogrids/filters/ready` on document after initialisation,
     * giving Pro extensions a stable hook point.
     */
    document.dispatchEvent( new CustomEvent( 'fotogrids/filters/ready', { bubbles: false } ) );

} )();
