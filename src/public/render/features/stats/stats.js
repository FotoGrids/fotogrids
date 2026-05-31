/**
 * FotoGrids — Stats
 *
 * Fires view and share pings to the REST API.
 *
 * Per-gallery activation: the Stats feature module writes
 * data-fg-stats="{...}" onto every gallery wrapper for which
 * enable_statistics resolves to true. Galleries without that attribute
 * are silently skipped, so a page can mix tracked and untracked
 * galleries.
 *
 *   View:  subscribes to FotoGrids.onGallery and fires one ping per
 *          gallery on the first init.
 *   Share: listens for the document-level `fotogrids:share` event
 *          (dispatched by the Sharing module when a user shares an
 *          item) and fires the share ping. Sharing itself never calls
 *          fetch — the Stats module is the only place that talks to
 *          the REST API.
 *
 * No imports — standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    /**
     * Read and parse the per-gallery stats config from the wrapper's
     * data-fg-stats JSON. Returns null if missing or invalid.
     *
     * @param {Element} galleryEl
     * @returns {{enabled: boolean, restUrl: string, nonce: string}|null}
     */
    function readConfig( galleryEl ) {
        const raw = galleryEl.dataset.fgStats;
        if ( ! raw ) return null;
        try {
            const cfg = JSON.parse( raw );
            if ( ! cfg.enabled ) return null;
            return cfg;
        } catch ( e ) {
            return null;
        }
    }

    /**
     * Fire-and-forget POST. Network errors are swallowed — stats failure
     * must never affect gallery functionality.
     *
     * @param {string} url
     * @param {string} nonce
     * @param {Object} body
     */
    function ping( url, nonce, body ) {
        try {
            fetch( url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce':   nonce,
                },
                credentials: 'same-origin',
                body: JSON.stringify( body ),
            } ).catch( () => {} );
        } catch ( e ) {
            // ignore
        }
    }

    /**
     * Fire a view ping. Called once per collection wrapper via the
     * runtime's onGallery callback.
     *
     * The config carries the explicit objectType ('gallery' or 'album')
     * and objectId — written by the Stats feature module's PHP based on
     * the render's collection_kind. Album wrappers ping with the album's
     * post ID, not the gallery_id (which is 0 on album renders).
     *
     * @param {Element} galleryEl
     */
    function trackView( galleryEl ) {
        if ( galleryEl.dataset.fgStatsViewSent === '1' ) return;
        const cfg = readConfig( galleryEl );
        if ( ! cfg ) return;

        const objectType = cfg.objectType || 'gallery';
        const objectId   = parseInt( cfg.objectId || '0', 10 );
        if ( ! objectId ) return;

        galleryEl.dataset.fgStatsViewSent = '1';

        ping( cfg.restUrl + 'stats/view', cfg.nonce, {
            object_type: objectType,
            object_id:   objectId,
        } );
    }

    /**
     * Handle a fotogrids:share event by sending a share ping. The event
     * fires from the Sharing module when the user clicks a share button.
     *
     * We pick the first stats-enabled gallery on the page for the
     * REST URL/nonce. The share's object_id is the item, not the
     * gallery — but the nonce belongs to the request, not the gallery,
     * so any gallery's nonce works.
     *
     * @param {CustomEvent} e
     */
    function trackShare( e ) {
        const detail = e && e.detail;
        if ( ! detail || ! detail.itemId || ! detail.network ) return;

        // Find any gallery on the page that has stats enabled so we can
        // reuse its restUrl + nonce.
        const anyGallery = document.querySelector( '.fotogrids-collection.fotogrids-gallery[data-fg-stats]' );
        if ( ! anyGallery ) return;
        const cfg = readConfig( anyGallery );
        if ( ! cfg ) return;

        const itemId = parseInt( detail.itemId, 10 );
        if ( ! itemId ) return;

        ping( cfg.restUrl + 'stats/share', cfg.nonce, {
            object_type: 'item',
            object_id:   itemId,
            network:     detail.network,
        } );
    }

    function init() {
        if ( window.FotoGrids && typeof window.FotoGrids.onGallery === 'function' ) {
            window.FotoGrids.onGallery( trackView, 50 );
        }
        document.addEventListener( 'fotogrids:share', trackShare );
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
