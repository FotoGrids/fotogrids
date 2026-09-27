/**
 * FotoGrids - Pagination: page buttons.
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
 * No imports - standalone vanilla JS compiled by webpack as an entry.
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
        let pagination = window.FotoGrids.modules.pagination;
        let s = pagination.state( gEl );

        // Filters change the server's totalPages; rebuild the chip list to match.
        rebuildChips( nav, s.totalPages );

        // Prev / Next disabled state.
        const prev = nav.querySelector( '[data-fg-pagination-trigger="prev"]' );
        const next = nav.querySelector( '[data-fg-pagination-trigger="next"]' );
        if ( prev ) prev.disabled = s.page <= 1;
        if ( next ) next.disabled = s.page >= s.totalPages;

        // Active number.
        nav.querySelectorAll( '[data-fg-pagination-trigger="page"]' ).forEach( function ( btn ) {
            let n = parseInt( btn.dataset.fgPaginationPage || '0', 10 );
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
     * PHP renders chips 1..N for the unfiltered total; filters can change
     * totalPages, so chips are added or removed to match. The markup mirrors
     * Page_Buttons::render_number_buttons(). Ellipsis chips are left to
     * applyTruncation().
     *
     * @param {Element} nav
     * @param {number}  totalPages
     */
    function rebuildChips( nav, totalPages ) {
        let list = nav.querySelector( '.fg-pagination__numbers' );
        if ( ! list ) return;
        if ( ! totalPages || totalPages < 1 ) totalPages = 1;

        // Drop any ellipsis chips first - applyTruncation() will rebuild
        // them after rebuildChips() finishes. Leaving them in would
        // confuse the index walk below.
        list.querySelectorAll( '.fg-pagination__ellipsis-item' ).forEach( function ( el ) {
            el.remove();
        } );

        const existing = Array.prototype.slice.call(
            list.querySelectorAll( '.fg-pagination__number-item' )
        );

        // Trim chips beyond the new total.
        for ( let i = existing.length - 1; i >= totalPages; i-- ) {
            existing[ i ].remove();
        }

        // Append chips for pages that don't have one yet.
        for ( let p = existing.length + 1; p <= totalPages; p++ ) {
            const li  = document.createElement( 'li' );
            li.className = 'fg-pagination__number-item';

            let btn = document.createElement( 'button' );
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
     * When data-fg-pages-truncate is "0" every page button stays visible, after
     * clearing ellipses and trim flags left by a previous sync.
     *
     * When truncation is on, the visible set is:
     *   - boundary pages on each end: { 1, N }
     *   - the current page and `siblings` pages on either side of it
     * Anything outside that set is hidden via .fg-is-trimmed and gaps are
     * filled with disabled-button ellipsis chips wrapped in
     * .fg-pagination__number-item <li>s (same wrapper class as the real
     * chips, plus a .fg-pagination__ellipsis-item marker for removal on the
     * next sync).
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
        let list = nav.querySelector( '.fg-pagination__numbers' );
        if ( ! list ) return;

        // Remove ellipsis chips from the previous sync; PHP never emits
        // .fg-pagination__ellipsis-item.
        list.querySelectorAll( '.fg-pagination__ellipsis-item' ).forEach( function ( el ) {
            el.remove();
        } );

        // Real numbered chips only.
        const numberItems = Array.prototype.slice.call(
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
        // the CSS const hasn't been emitted for any reason (e.g. tests).
        const rawSiblings = getComputedStyle( gEl ).getPropertyValue( '--fg-pagination-siblings' );
        let siblings    = parseInt( rawSiblings, 10 );
        if ( isNaN( siblings ) || siblings < 0 ) siblings = 1;

        // Worst-case visible count (current in the middle):
        //   1 + ellipsis + siblings + current + siblings + ellipsis + last
        // = 5 + 2*siblings chips, plus the two ellipsis slots.
        // If the gallery has fewer pages than that, truncation can't
        // actually save space - show everything.
        const minTotalForTruncation = 5 + 2 * siblings;
        if ( total <= minTotalForTruncation ) {
            showAll();
            return;
        }

        // Build the visible set: boundaries + sibling window around current.
        const visible      = Object.create( null );
        visible[ 1 ]     = true;
        visible[ total ] = true;
        const winStart = Math.max( 2, current - siblings );
        const winEnd   = Math.min( total - 1, current + siblings );
        for ( let p = winStart; p <= winEnd; p++ ) {
            visible[ p ] = true;
        }

        // The <li> wrapper is trimmed rather than the <button>, so the item and its
        // gap leave the flex flow.
        numberItems.forEach( function ( item ) {
            let btn = item.querySelector( '.fg-pagination__number' );
            if ( ! btn ) return;
            let n = parseInt( btn.dataset.fgPaginationPage || '0', 10 );
            if ( visible[ n ] ) {
                item.classList.remove( 'fg-is-trimmed' );
            } else {
                item.classList.add( 'fg-is-trimmed' );
            }
        } );

        // Ellipsis chips fill gaps between non-adjacent visible pages. They are
        // disabled buttons in the same <li> wrapper, so they line up with the numbers.
        const visibleItems = numberItems.filter( function ( item ) {
            return ! item.classList.contains( 'fg-is-trimmed' );
        } );

        for ( let i = 0; i < visibleItems.length - 1; i++ ) {
            const aBtn = visibleItems[ i ].querySelector( '.fg-pagination__number' );
            const bBtn = visibleItems[ i + 1 ].querySelector( '.fg-pagination__number' );
            const aN   = parseInt( aBtn.dataset.fgPaginationPage || '0', 10 );
            const bN   = parseInt( bBtn.dataset.fgPaginationPage || '0', 10 );
            if ( bN - aN > 1 ) {
                const dotsLi  = document.createElement( 'li' );
                dotsLi.className = 'fg-pagination__number-item fg-pagination__ellipsis-item';

                const dotsBtn = document.createElement( 'button' );
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
        const trigger = target.dataset.fgPaginationTrigger;
        if ( trigger === 'prev' ) return Math.max( 1, s.page - 1 );
        if ( trigger === 'next' ) return Math.min( s.totalPages, s.page + 1 );
        if ( trigger === 'page' ) {
            let n = parseInt( target.dataset.fgPaginationPage || '0', 10 );
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

        const nav = gEl.querySelector( '[data-fg-pagination-role="pages"]' );
        if ( ! nav ) return;

        let pagination = window.FotoGrids
            && window.FotoGrids.modules
            && window.FotoGrids.modules.pagination;
        if ( ! pagination ) return;

        // Initial sync (also primes the scroll-on-next-change guard).
        syncBar( gEl, nav );

        nav.addEventListener( 'click', function ( event ) {
            let btn = event.target.closest( '[data-fg-pagination-trigger]' );
            if ( ! btn || btn.disabled ) return;
            event.preventDefault();

            let s    = pagination.state( gEl );
            const page = resolveTargetPage( btn, s );
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

        // Filter change: swap to the new filter state, then re-sync the bar.
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
