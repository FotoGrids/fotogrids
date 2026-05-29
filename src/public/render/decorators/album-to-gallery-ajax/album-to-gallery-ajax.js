/**
 * FotoGrids — Album → Gallery (AJAX swap)
 *
 * Intercepts clicks on [data-fg-album-ajax-trigger] (an <a> wrapping each
 * album item). On click:
 *
 *   1. POST to the render URL carried in data-fg-render-url with the
 *      gallery's ID and nonce.
 *   2. Server returns { html, css: { handle: url } }.
 *   3. Inject any CSS handles that aren't already in <head> (mirrors the
 *      password-gate unlock pattern).
 *   4. Swap the album wrapper's contents for the rendered gallery HTML.
 *   5. The runtime's MutationObserver picks up the inserted gallery and
 *      fires every onGallery callback against it — no manual init here.
 *
 * Graceful degradation:
 *   • middle-click / ctrl-click / cmd-click — let the browser handle it
 *     natively (the <a> has a real href to the gallery's view page).
 *   • no JS / JS error — the <a> navigates to the view page.
 *   • REST 404 / non-200 — fall back to navigation (window.location).
 *
 * No imports — standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    /**
     * Per-album-wrapper snapshot of the original (pre-swap) innerHTML.
     * Lives in a WeakMap so detached/garbage-collected wrappers don't leak
     * their HTML strings. Populated immediately before innerHTML = data.html,
     * consumed by restoreAlbum() when the Back button is clicked inside a
     * swapped wrapper.
     *
     * @type {WeakMap<Element, string>}
     */
    var originalHtmlByAlbum = new WeakMap();

    /**
     * Triggers that already have a click listener attached. WeakSet so we
     * don't pin detached DOM in memory.
     *
     * We deliberately use a WeakSet here instead of a `data-` attribute
     * (which used to be the idempotence guard). When restoreAlbum() replays
     * the original innerHTML, the browser parses a brand-new tree of <a>
     * elements — the old triggers (with their listeners) are gone. The
     * `data-fg-album-ajax-bound` attribute survived the round-trip in the
     * serialised HTML, so on a second click the trigger LOOKED bound, but
     * actually had no listener — falling through to native nav.
     *
     * WeakSet identity is per live Element, so freshly parsed nodes never
     * appear to be "already bound" and bindTrigger() always wires them up.
     *
     * @type {WeakSet<Element>}
     */
    var boundTriggers = new WeakSet();

    /**
     * Inject <link rel="stylesheet"> tags for any CSS handles the render
     * pipeline collected that aren't already in the document. Mirrors the
     * Password_Gate unlock flow's helper exactly.
     *
     * @param {Record<string, string>} cssUrls  handle → absolute URL map
     */
    function injectMissingStyles( cssUrls ) {
        if ( ! cssUrls || typeof cssUrls !== 'object' ) return;

        Object.keys( cssUrls ).forEach( function ( handle ) {
            var url = cssUrls[ handle ];
            if ( ! handle || ! url ) return;
            var linkId = 'fotogrids-css-' + handle;
            if ( document.getElementById( linkId ) ) return;

            var link = document.createElement( 'link' );
            link.rel  = 'stylesheet';
            link.id   = linkId;
            link.href = url;
            document.head.appendChild( link );
        } );
    }

    /**
     * Inject <script> tags for any JS handles the render pipeline declared
     * that aren't already in the document. Necessary because the host
     * album page only enqueues the modules its OWN render needed — but a
     * swapped-in gallery may need extra modules (lightbox.js, direct-link,
     * external-link, sharing, lazy-load, stats, loading-icon, filter-ui,
     * deep-linking, pagination layouts, etc.) that weren't enqueued
     * upstream. Late-loaded modules self-scan the DOM on init so they
     * still wire the swapped-in gallery even though they start after the
     * MutationObserver fired.
     *
     * @param {Record<string, {src: string, in_footer: boolean}>} jsData
     *     handle → {src, in_footer} map. The in_footer flag is informative
     *     only — script tags are appended async to <head> either way; the
     *     browser fetches them in parallel and executes them in load order
     *     (good enough for our modules since their init is idempotent).
     */
    function injectMissingScripts( jsData ) {
        if ( ! jsData || typeof jsData !== 'object' ) return;

        Object.keys( jsData ).forEach( function ( handle ) {
            var entry = jsData[ handle ];
            var url   = entry && entry.src ? entry.src : '';
            if ( ! handle || ! url ) return;
            var scriptId = 'fotogrids-js-' + handle;
            if ( document.getElementById( scriptId ) ) return;
            // Also skip if WordPress already enqueued this handle the
            // normal way (id="<handle>-js"), to avoid loading the same
            // module twice.
            if ( document.getElementById( handle + '-js' ) ) return;

            var script   = document.createElement( 'script' );
            script.id    = scriptId;
            script.src   = url;
            script.async = false; // preserve load order between siblings
            document.head.appendChild( script );
        } );
    }

    /**
     * Resolve the album wrapper that owns a trigger. Used as the target
     * container for the swap.
     *
     * @param {Element} trigger
     * @returns {Element|null}
     */
    function albumWrapperFor( trigger ) {
        return trigger.closest( '.fotogrids-album' );
    }

    /**
     * Handle a trigger click — perform the AJAX swap.
     *
     * @param {Element} trigger  The <a> element with data-fg-album-ajax-trigger.
     * @param {Event}   event
     */
    function handleTriggerClick( trigger, event ) {
        // Honour modifier clicks — middle/ctrl/cmd/shift = native navigation.
        if ( event.defaultPrevented ) return;
        if ( event.button !== 0 ) return;
        if ( event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) return;

        var galleryId  = parseInt( trigger.dataset.fgGalleryId || '0', 10 );
        var renderUrl  = trigger.dataset.fgRenderUrl || '';
        var nonce      = trigger.dataset.fgRenderNonce || '';
        var viaAlbumId = parseInt( trigger.dataset.fgViaAlbum || '0', 10 );
        var albumEl    = albumWrapperFor( trigger );

        if ( ! galleryId || ! renderUrl || ! albumEl ) {
            // Missing context → let the link navigate normally.
            return;
        }

        event.preventDefault();

        albumEl.classList.add( 'fotogrids-album--is-loading' );

        // Visit-context: forward the source album so the rendered gallery
        // can build a "back to this album" breadcrumb. Falls back to the
        // ?fg_via= already baked into the href on JS-off / fetch failure.
        var requestBody = { gallery_id: galleryId };
        if ( viaAlbumId > 0 ) {
            requestBody.via_album_id = viaAlbumId;
        }

        fetch( renderUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce':   nonce,
            },
            credentials: 'same-origin',
            body: JSON.stringify( requestBody ),
        } )
            .then( function ( response ) {
                if ( ! response.ok ) {
                    // Fall back to navigation. The throw cascades into the
                    // .catch handler below.
                    throw new Error( 'render-endpoint-failed' );
                }
                return response.json();
            } )
            .then( function ( data ) {
                if ( ! data || ! data.html ) {
                    throw new Error( 'render-endpoint-empty' );
                }

                injectMissingStyles( data.css || {} );
                injectMissingScripts( data.js || {} );

                // Stash the album's original HTML before the swap so the
                // in-place Back button (rendered inside the swapped-in
                // gallery by Collection_Header) can restore it. Don't
                // overwrite an existing snapshot — successive drill-downs
                // (album → gallery A → back → gallery B) should all
                // restore to the *original* album, not to gallery A.
                if ( ! originalHtmlByAlbum.has( albumEl ) ) {
                    originalHtmlByAlbum.set( albumEl, albumEl.innerHTML );
                }
                albumEl.dataset.fgAjaxSwapped = '1';

                // Replace the album's contents with the rendered gallery
                // HTML. The runtime's MutationObserver picks up the new
                // .fotogrids-collection wrapper and fires its onGallery
                // callbacks (the swapped-in HTML is a gallery).
                albumEl.innerHTML = data.html;

                document.dispatchEvent( new CustomEvent( 'fotogrids:album_swapped', {
                    bubbles: true,
                    detail:  {
                        albumEl:   albumEl,
                        galleryId: galleryId,
                    },
                } ) );
            } )
            .catch( function () {
                // Whatever went wrong, navigate to the gallery's view page
                // — that's the URL the <a> would have used by default.
                var href = trigger.getAttribute( 'href' );
                if ( href && href !== '#' ) {
                    window.location.href = href;
                }
            } )
            .then( function () {
                albumEl.classList.remove( 'fotogrids-album--is-loading' );
            } );
    }

    /**
     * Wire a single trigger. Idempotent — re-binding a trigger is a no-op.
     *
     * @param {Element} trigger
     */
    function bindTrigger( trigger ) {
        if ( boundTriggers.has( trigger ) ) return;
        boundTriggers.add( trigger );

        trigger.addEventListener( 'click', function ( event ) {
            handleTriggerClick( trigger, event );
        } );
    }

    /**
     * Attach the AJAX behaviour to an album wrapper. Called by the runtime's
     * onAlbum callback for every album wrapper.
     *
     * @param {Element} albumEl
     */
    function attach( albumEl ) {
        albumEl.querySelectorAll( '[data-fg-album-ajax-trigger]' ).forEach( bindTrigger );
    }

    /**
     * Restore an album wrapper to its pre-swap state, if we have a snapshot.
     * Used by Collection_Header's Back button when the visitor reached the
     * current gallery via an AJAX swap (rather than a full page load).
     *
     * Returns true if a restore happened, false otherwise. Callers can use
     * the return value to decide whether to fall back to native navigation.
     *
     * @param {Element} albumEl
     * @returns {boolean}
     */
    function restoreAlbum( albumEl ) {
        if ( ! albumEl || ! originalHtmlByAlbum.has( albumEl ) ) {
            return false;
        }

        var original = originalHtmlByAlbum.get( albumEl );
        originalHtmlByAlbum.delete( albumEl );
        delete albumEl.dataset.fgAjaxSwapped;

        albumEl.innerHTML = original;

        // The runtime's MutationObserver fires on .fotogrids-collection
        // *insertions*, but here the album wrapper itself wasn't replaced —
        // only its descendants. The runtime never re-runs onAlbum for
        // this wrapper, so the restored trigger <a>s never get a listener
        // through the normal path. Re-bind them explicitly so the user can
        // drill into the same (or another) child gallery again.
        attach( albumEl );

        document.dispatchEvent( new CustomEvent( 'fotogrids:album_restored', {
            bubbles: true,
            detail:  { albumEl: albumEl },
        } ) );

        return true;
    }

    /**
     * True when the wrapper currently holds an AJAX-swapped gallery
     * (i.e. has a stashed pre-swap HTML snapshot waiting to be restored).
     *
     * @param {Element} albumEl
     * @returns {boolean}
     */
    function isAlbumSwapped( albumEl ) {
        return !! albumEl && originalHtmlByAlbum.has( albumEl );
    }

    function init() {
        if ( window.FotoGrids && typeof window.FotoGrids.onAlbum === 'function' ) {
            window.FotoGrids.onAlbum( attach, 15 );
        }

        // Expose the restore API on the cross-module namespace. Collection_Header
        // calls FotoGrids.modules.albumAjax.restore(albumEl) when the user
        // clicks the in-gallery Back button while still inside an AJAX-swapped
        // album wrapper. Defensive: only assign if the runtime is present.
        if ( window.FotoGrids && window.FotoGrids.modules ) {
            window.FotoGrids.modules.albumAjax = {
                restore:   restoreAlbum,
                isSwapped: isAlbumSwapped,
            };
        }
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
