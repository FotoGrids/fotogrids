/**
 * FotoGrids — Pagination: page buttons.
 *
 * Subscribes to FotoGrids.onGallery. For each gallery whose
 * data-fg-pagination-method === 'pages', it:
 *
 *   1. Locates the [data-fg-pagination-role="pages"] nav.
 *   2. Wires click handlers on prev/next/numbered buttons →
 *      FotoGrids.modules.pagination.goToPage(gEl, n, { mode: 'replace' }).
 *   3. After every page change, re-syncs prev/next disabled state, the
 *      .fg-is-active class on the active number, and the boundary-and-
 *      siblings truncation driven by data-fg-pages-truncate and the
 *      --fg-pagination-siblings CSS var (per-breakpoint).
 *
 * No imports — standalone vanilla JS compiled by webpack as an entry.
 */

( function () {
    'use strict';

    /**
     * Re-sync the bar's visual state from the wrapper's current page.
     *
     * @param {Element} gEl
     * @param {Element} nav
     */
    function syncBar( gEl, nav ) {
        var pagination = window.FotoGrids.modules.pagination;
        var s = pagination.state( gEl );

        // Reconcile the rendered chip list with the current totalPages.
        // PHP renders 1..N chips for the unfiltered count; once a filter
        // is applied the server returns a new totalPages reflecting the
        // filtered set, and the chip list must match — otherwise we
        // either leave stale chips for pages that no longer exist or
        // are missing chips for newly-reachable pages.
        rebuildChips( nav, s.totalPages );

        // Prev / Next disabled state.
        var prev = nav.querySelector( '[data-fg-pagination-trigger="prev"]' );
        var next = nav.querySelector( '[data-fg-pagination-trigger="next"]' );
        if ( prev ) prev.disabled = s.page <= 1;
        if ( next ) next.disabled = s.page >= s.totalPages;

        // Active number.
        nav.querySelectorAll( '[data-fg-pagination-trigger="page"]' ).forEach( function ( btn ) {
            var n = parseInt( btn.dataset.fgPaginationPage || '0', 10 );
            if ( n === s.page ) {
                btn.classList.add( 'fg-is-active' );
                btn.setAttribute( 'aria-current', 'page' );
            } else {
                btn.classList.remove( 'fg-is-active' );
                btn.removeAttribute( 'aria-current' );
            }
        } );

        applyTruncation( gEl, nav, s.page, s.totalPages );

        // Scroll the gallery back into view so the user sees the new page.
        // Only when switching pages, not on initial load.
        if ( gEl.dataset.fgPagesInitialScroll !== '1' ) {
            gEl.dataset.fgPagesInitialScroll = '1';
        } else {
            gEl.scrollIntoView( { behavior: 'smooth', block: 'start' } );
        }
    }

    /**
     * Reconcile the rendered numbered-chip list with `totalPages`.
     *
     * PHP renders chips 1..N for the unfiltered gallery total. When
     * filters mutate the active set the server returns a different
     * totalPages, so we add or remove chips to match before any
     * active-state / truncation pass runs.
     *
     * Mirrors the PHP markup in Page_Buttons::render_number_buttons() —
     * same element + class structure, same data attrs — so styling and
     * the click delegation in attach() keep working unchanged. Ellipsis
     * chips (.fg-pagination__ellipsis-item) are excluded so they get
     * cleared and rebuilt by applyTruncation() on the same pass.
     *
     * @param {Element} nav
     * @param {number}  totalPages
     */
    function rebuildChips( nav, totalPages ) {
        var list = nav.querySelector( '.fg-pagination__numbers' );
        if ( ! list ) return;
        if ( ! totalPages || totalPages < 1 ) totalPages = 1;

        // Drop any ellipsis chips first — applyTruncation() will rebuild
        // them after rebuildChips() finishes. Leaving them in would
        // confuse the index walk below.
        list.querySelectorAll( '.fg-pagination__ellipsis-item' ).forEach( function ( el ) {
            el.remove();
        } );

        var existing = Array.prototype.slice.call(
            list.querySelectorAll( '.fg-pagination__number-item' )
        );

        // Trim chips beyond the new total.
        for ( var i = existing.length - 1; i >= totalPages; i-- ) {
            existing[ i ].remove();
        }

        // Append chips for pages that don't have one yet.
        for ( var p = existing.length + 1; p <= totalPages; p++ ) {
            var li  = document.createElement( 'li' );
            li.className = 'fg-pagination__number-item';

            var btn = document.createElement( 'button' );
            btn.type = 'button';
            btn.className = 'fg-pagination__btn fg-pagination__number';
            btn.setAttribute( 'data-fg-pagination-trigger', 'page' );
            btn.setAttribute( 'data-fg-pagination-page', String( p ) );
            btn.textContent = String( p );

            li.appendChild( btn );
            list.appendChild( li );
        }
    }

    /**
     * Apply page-bar truncation (boundary + siblings + ellipses).
     *
     * When the wrapper's data-fg-pages-truncate is "0" we keep every page
     * button visible — bail fast after clearing any leftover ellipses /
     * trim flags from a previous sync.
     *
     * When truncation is on, the visible set is:
     *   - boundary pages on each end: { 1, N }
     *   - the current page and `siblings` pages on either side of it
     * Anything outside that set is hidden via .fg-is-trimmed and gaps are
     * filled with disabled-button ellipsis chips wrapped in
     * .fg-pagination__number-item <li>s (same wrapper class as the real
     * chips, plus a .fg-pagination__ellipsis-item marker so we can find
     * and remove them on the next sync).
     *
     * `siblings` is read off the computed --fg-pagination-siblings CSS
     * variable, so the per-breakpoint @media block emitted by PHP
     * (Responsive_Var → Style_Var_Builder) automatically downgrades it to
     * 1 on mobile and 2 on desktop/tablet without any JS breakpoint plumbing.
     *
     * @param {Element} gEl
     * @param {Element} nav
     * @param {number}  current
     * @param {number}  total
     */
    function applyTruncation( gEl, nav, current, total ) {
        var list = nav.querySelector( '.fg-pagination__numbers' );
        if ( ! list ) return;

        // Clear any ellipsis chips inserted on a previous sync so we can
        // rebuild them cleanly against the new current page / total. The
        // marker class .fg-pagination__ellipsis-item only sits on chips
        // we created at runtime — PHP never emits it — so this is safe.
        list.querySelectorAll( '.fg-pagination__ellipsis-item' ).forEach( function ( el ) {
            el.remove();
        } );

        // Only collect the real numbered chips; any leftover ellipsis-
        // items would have been removed in the cleanup above, but the
        // :not() guards against future markup changes where the cleanup
        // doesn't reach (e.g. server-side prerendered ellipses).
        var numberItems = Array.prototype.slice.call(
            list.querySelectorAll( '.fg-pagination__number-item:not(.fg-pagination__ellipsis-item)' )
        );
        if ( numberItems.length === 0 ) return;

        // Helper: clear .fg-is-trimmed on every <li> wrapper. Used for
        // both the "truncate off" branch and the "short bar" branch.
        function showAll() {
            numberItems.forEach( function ( item ) {
                item.classList.remove( 'fg-is-trimmed' );
            } );
        }

        if ( gEl.dataset.fgPagesTruncate !== '1' ) {
            showAll();
            return;
        }

        // Sibling count from the wrapper's computed style. Defaults to 1 if
        // the CSS var hasn't been emitted for any reason (e.g. tests).
        var rawSiblings = getComputedStyle( gEl ).getPropertyValue( '--fg-pagination-siblings' );
        var siblings    = parseInt( rawSiblings, 10 );
        if ( isNaN( siblings ) || siblings < 0 ) siblings = 1;

        // Worst-case visible count (current in the middle):
        //   1 + ellipsis + siblings + current + siblings + ellipsis + last
        // = 5 + 2*siblings chips, plus the two ellipsis slots.
        // If the gallery has fewer pages than that, truncation can't
        // actually save space — show everything.
        var minTotalForTruncation = 5 + 2 * siblings;
        if ( total <= minTotalForTruncation ) {
            showAll();
            return;
        }

        // Build the visible set: boundaries + sibling window around current.
        var visible      = Object.create( null );
        visible[ 1 ]     = true;
        visible[ total ] = true;
        var winStart = Math.max( 2, current - siblings );
        var winEnd   = Math.min( total - 1, current + siblings );
        for ( var p = winStart; p <= winEnd; p++ ) {
            visible[ p ] = true;
        }

        // Toggle .fg-is-trimmed on each <li> wrapper to match the visible
        // set. We mark the wrapper (not the inner <button>) so the whole
        // list-item drops out of the flex flow, including its gap, rather
        // than leaving an empty zero-width <li> behind.
        numberItems.forEach( function ( item ) {
            var btn = item.querySelector( '.fg-pagination__number' );
            if ( ! btn ) return;
            var n = parseInt( btn.dataset.fgPaginationPage || '0', 10 );
            if ( visible[ n ] ) {
                item.classList.remove( 'fg-is-trimmed' );
            } else {
                item.classList.add( 'fg-is-trimmed' );
            }
        } );

        // Insert ellipsis chips wherever two consecutive visible pages
        // aren't actually adjacent in the page sequence. The ellipsis
        // renders as a disabled .fg-pagination__btn inside the same
        // .fg-pagination__number-item wrapper as the numbered chips, so
        // its height/padding/font/baseline line up exactly with the
        // surrounding buttons. CSS strips the interactive states so it
        // reads as a gap indicator rather than a clickable target.
        var visibleItems = numberItems.filter( function ( item ) {
            return ! item.classList.contains( 'fg-is-trimmed' );
        } );

        for ( var i = 0; i < visibleItems.length - 1; i++ ) {
            var aBtn = visibleItems[ i ].querySelector( '.fg-pagination__number' );
            var bBtn = visibleItems[ i + 1 ].querySelector( '.fg-pagination__number' );
            var aN   = parseInt( aBtn.dataset.fgPaginationPage || '0', 10 );
            var bN   = parseInt( bBtn.dataset.fgPaginationPage || '0', 10 );
            if ( bN - aN > 1 ) {
                var dotsLi  = document.createElement( 'li' );
                dotsLi.className = 'fg-pagination__number-item fg-pagination__ellipsis-item';

                var dotsBtn = document.createElement( 'button' );
                dotsBtn.type = 'button';
                dotsBtn.className = 'fg-pagination__btn fg-pagination__ellipsis';
                dotsBtn.disabled = true;
                dotsBtn.setAttribute( 'aria-hidden', 'true' );
                dotsBtn.setAttribute( 'tabindex', '-1' );
                dotsBtn.textContent = '…';

                dotsLi.appendChild( dotsBtn );
                visibleItems[ i + 1 ].parentNode.insertBefore( dotsLi, visibleItems[ i + 1 ] );
            }
        }
    }

    /**
     * Resolve next page number from a click target.
     *
     * @param {Element} target
     * @param {{page:number,totalPages:number}} s
     * @returns {number|null}
     */
    function resolveTargetPage( target, s ) {
        var trigger = target.dataset.fgPaginationTrigger;
        if ( trigger === 'prev' ) return Math.max( 1, s.page - 1 );
        if ( trigger === 'next' ) return Math.min( s.totalPages, s.page + 1 );
        if ( trigger === 'page' ) {
            var n = parseInt( target.dataset.fgPaginationPage || '0', 10 );
            return n > 0 ? n : null;
        }
        return null;
    }

    /**
     * Attach behaviour to a single gallery.
     *
     * @param {Element} gEl
     */
    function attach( gEl ) {
        if ( gEl.dataset.fgPaginationMethod !== 'pages' ) return;
        if ( gEl.dataset.fgPageButtonsBound === '1' ) return;
        gEl.dataset.fgPageButtonsBound = '1';

        var nav = gEl.querySelector( '[data-fg-pagination-role="pages"]' );
        if ( ! nav ) return;

        var pagination = window.FotoGrids
            && window.FotoGrids.modules
            && window.FotoGrids.modules.pagination;
        if ( ! pagination ) return;

        // Initial sync (also primes the scroll-on-next-change guard).
        syncBar( gEl, nav );

        nav.addEventListener( 'click', function ( event ) {
            var btn = event.target.closest( '[data-fg-pagination-trigger]' );
            if ( ! btn || btn.disabled ) return;
            event.preventDefault();

            var s    = pagination.state( gEl );
            var page = resolveTargetPage( btn, s );
            if ( page === null || page === s.page ) return;

            nav.classList.add( 'fg-is-loading' );

            pagination
                .goToPage( gEl, page, { mode: 'replace' } )
                .catch( function () { /* surfaced inside goToPage */ } )
                .then( function () {
                    nav.classList.remove( 'fg-is-loading' );
                    syncBar( gEl, nav );
                } );
        } );

        // Also re-sync if the page changes via another path (e.g. lightbox
        // "next" walking past the end of the current page).
        pagination.onChange( gEl, function () { syncBar( gEl, nav ); } );

        // Filter change → swap to the new filter state. Restores from
        // cache instantly when available; falls back to a server fetch
        // for never-before-seen combinations. syncBar re-renders the
        // pagination chrome (active state, ellipsis trimming) against
        // whatever the new state is.
        gEl.addEventListener( 'fotogrids:filters_changed', function () {
            nav.classList.add( 'fg-is-loading' );
            pagination
                .swapToFilterState( gEl )
                .catch( function () { /* surfaced inside goToPage */ } )
                .then( function () {
                    nav.classList.remove( 'fg-is-loading' );
                    syncBar( gEl, nav );
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
