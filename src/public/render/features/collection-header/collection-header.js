/**
 * FotoGrids — Collection Header behaviour
 *
 * The visible part of the header (back button + breadcrumb) is plain HTML
 * rendered server-side, so most of the experience needs no JS at all. The
 * only behaviour that does need JS is *in-place* back navigation when the
 * current gallery was loaded into an album wrapper via Album → Gallery
 * AJAX. In that case, clicking the Back button should:
 *
 *   - Un-swap the album wrapper, restoring the original tile grid, rather
 *     than navigating to the album's permalink (which would re-fetch and
 *     re-render the album page from scratch).
 *
 * For every other context — direct visit to a View Page, embedded gallery
 * without AJAX swap, or AJAX swap whose snapshot has been lost — the Back
 * button stays a plain <a href>, and the browser handles it natively.
 *
 * The album AJAX module exposes its `restore(albumEl)` / `isSwapped(albumEl)`
 * helpers via FotoGrids.modules.albumAjax. We probe that namespace at
 * click-time (not init) because the AJAX module may not be loaded on the
 * current page — e.g. a View Page render where there's no album wrapper
 * anywhere.
 *
 * No imports — standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    /**
     * Back links that already have a click listener attached. WeakSet
     * (not a `data-` attribute) so listeners are correctly re-attached
     * when innerHTML is replayed — the attribute would survive
     * serialisation but the listener wouldn't, causing the binder to
     * skip a fresh element that actually needs wiring.
     *
     * @type {WeakSet<Element>}
     */
    var boundBackLinks = new WeakSet();

    /**
     * Intercept a Back button click. Returns nothing — calls
     * event.preventDefault() and triggers the restore when we can, otherwise
     * lets the link navigate normally.
     *
     * @param {Element} backLink  The .fg-back-button anchor.
     * @param {Event}   event
     */
    function handleBackClick( backLink, event ) {
        // Honour modifier clicks — middle/ctrl/cmd/shift/alt should
        // always navigate natively (open in new tab etc).
        if ( event.defaultPrevented ) return;
        if ( event.button !== 0 ) return;
        if ( event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) return;

        // Walk up to the album wrapper that owns this gallery (if any).
        // .fotogrids-album is unambiguous — it only appears on album
        // wrappers — so a short selector is fine here (same lookup as
        // Album_To_Gallery_Ajax).
        var albumEl = backLink.closest( '.fotogrids-album' );
        if ( ! albumEl ) {
            return; // Embedded outside an album or no album in scope — natural nav.
        }

        var api = window.FotoGrids && window.FotoGrids.modules && window.FotoGrids.modules.albumAjax;
        if ( ! api || typeof api.restore !== 'function' ) {
            return; // AJAX module not loaded — natural nav back to album page.
        }

        if ( typeof api.isSwapped === 'function' && ! api.isSwapped( albumEl ) ) {
            return; // No snapshot to restore — natural nav.
        }

        event.preventDefault();
        api.restore( albumEl );
    }

    /**
     * Wire a single Back button. Idempotent.
     *
     * @param {Element} backLink
     */
    function bindBackLink( backLink ) {
        if ( boundBackLinks.has( backLink ) ) return;
        boundBackLinks.add( backLink );

        backLink.addEventListener( 'click', function ( event ) {
            handleBackClick( backLink, event );
        } );
    }

    /**
     * Attach behaviour to a gallery wrapper. Called by the runtime for both
     * static and dynamically-inserted galleries — so a gallery swapped into
     * an album wrapper by the AJAX flow gets its Back button wired up here.
     *
     * @param {Element} galleryEl
     */
    function attach( galleryEl ) {
        if ( ! galleryEl || ! galleryEl.querySelectorAll ) return;
        galleryEl.querySelectorAll( '.fg-back-button' ).forEach( bindBackLink );
    }

    function init() {
        if ( window.FotoGrids && typeof window.FotoGrids.onGallery === 'function' ) {
            window.FotoGrids.onGallery( attach, 20 );
        }
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
