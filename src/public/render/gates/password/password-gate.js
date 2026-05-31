/**
 * FotoGrids — Password Gate (client)
 *
 * Owns the lock-screen submit handler. Binds to every .fg-lock-form on
 * the page, intercepts submit, POSTs to the unlock REST endpoint, and:
 *
 *   • on success: injects any CSS handles the render pipeline collected
 *     for the now-unlocked gallery (so the gallery's per-render
 *     stylesheets are present before its HTML is inserted), then swaps
 *     the lock wrapper for the rendered gallery HTML. The runtime's
 *     MutationObserver picks the inserted gallery up and runs every
 *     onGallery() callback against it — no manual gallery init here.
 *   • on failure: shows the inline error and clears the input.
 *
 * Also binds dynamically inserted forms via FotoGrids.onGallery()'s
 * MutationObserver path (we hook the same observer indirectly through
 * a delegated submit listener on document).
 *
 * No imports — standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    /**
     * Injects <link rel="stylesheet"> tags for any CSS handles that the
     * render pipeline collected during the unlock request but that are
     * not already present in the document.
     *
     * The server returns a { handle: url } map. We use the handle as
     * the <link> element's id attribute so duplicate injections are
     * skipped cheaply.
     *
     * @param {Record<string, string>} cssUrls  handle → absolute URL map
     */
    function injectMissingStyles( cssUrls ) {
        if ( ! cssUrls || typeof cssUrls !== 'object' ) return;

        Object.keys( cssUrls ).forEach( function ( handle ) {
            let url = cssUrls[ handle ];
            if ( ! handle || ! url ) return;

            const linkId = 'fotogrids-css-' + handle;
            if ( document.getElementById( linkId ) ) return;

            const link = document.createElement( 'link' );
            link.rel  = 'stylesheet';
            link.id   = linkId;
            link.href = url;
            document.head.appendChild( link );
        } );
    }

    /**
     * Inject any JS handles the render pipeline declared for the unlocked
     * gallery that aren't already in the document. Mirrors the
     * Album_To_Gallery_Ajax injectMissingScripts helper.
     *
     * @param {Record<string, {src: string, in_footer: boolean}>} jsData
     */
    function injectMissingScripts( jsData ) {
        if ( ! jsData || typeof jsData !== 'object' ) return;

        Object.keys( jsData ).forEach( function ( handle ) {
            const entry = jsData[ handle ];
            let url   = entry && entry.src ? entry.src : '';
            if ( ! handle || ! url ) return;
            const scriptId = 'fotogrids-js-' + handle;
            if ( document.getElementById( scriptId ) ) return;
            if ( document.getElementById( handle + '-js' ) ) return;

            const script   = document.createElement( 'script' );
            script.id    = scriptId;
            script.src   = url;
            script.async = false;
            document.head.appendChild( script );
        } );
    }

    /**
     * Wire up a single lock form. Idempotent — repeat calls on the
     * same form are no-ops.
     *
     * @param {HTMLFormElement} form
     */
    function bindLockForm( form ) {
        if ( ! form || form.dataset.fotogridsLockBound === '1' ) {
            return;
        }
        form.dataset.fotogridsLockBound = '1';

        form.addEventListener( 'submit', function ( event ) {
            event.preventDefault();
            unlockGallery( form );
        } );
    }

    /**
     * Submit the password, swap in the rendered gallery HTML on success,
     * or show an inline error on failure. No page reload needed.
     *
     * @param {HTMLFormElement} form
     */
    function unlockGallery( form ) {
        const card      = form.closest( '.fg-gate-card' );
        const errorEl   = form.querySelector( '.fg-lock-error' );
        const submitBtn = form.querySelector( '.fg-lock-submit' );
        const input     = form.querySelector( '.fg-lock-input' );
        const wrapper   = form.closest( '.fotogrids-gate' );

        const galleryId = parseInt( form.dataset.galleryId || '0', 10 );
        const unlockUrl = form.dataset.unlockUrl || '';
        // The lock form carries its own nonce in data-nonce — we don't
        // rely on a global settings object here.
        const nonce    = form.dataset.nonce || '';
        const password = input ? input.value : '';

        if ( ! galleryId || ! unlockUrl ) {
            return;
        }

        if ( card ) card.classList.add( 'is-loading' );
        if ( submitBtn ) submitBtn.disabled = true;
        if ( errorEl ) errorEl.classList.remove( 'is-visible' );

        fetch( unlockUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce':   nonce,
            },
            credentials: 'same-origin',
            body: JSON.stringify( { password: password } ),
        } )
            .then( function ( response ) {
                return response.json().then( function ( data ) {
                    return { ok: response.ok, data: data };
                } );
            } )
            .then( function ( result ) {
                const data = result.data;

                if ( ! result.ok || ! data || ! data.success ) {
                    if ( errorEl ) errorEl.classList.add( 'is-visible' );
                    if ( input ) {
                        input.value = '';
                        input.focus();
                    }
                    return;
                }

                injectMissingStyles( data.css || {} );
                injectMissingScripts( data.js || {} );

                const html = data.html || '';
                if ( ! html || ! wrapper ) {
                    window.location.reload();
                    return;
                }

                const tempDiv = document.createElement( 'div' );
                tempDiv.innerHTML = html;

                const newNodes = Array.prototype.slice.call( tempDiv.childNodes );
                if ( newNodes.length === 0 ) {
                    window.location.reload();
                    return;
                }

                const parent = wrapper.parentNode;
                if ( ! parent ) {
                    window.location.reload();
                    return;
                }

                newNodes.forEach( function ( node ) {
                    parent.insertBefore( node, wrapper );
                } );
                parent.removeChild( wrapper );

                // Notify other modules. The runtime's MutationObserver
                // will already have fired fotogrids:gallery_inserted for
                // any .fotogrids-collection in the inserted nodes; this
                // event is a higher-level "the gate was passed" signal
                // for anything that cares (e.g. analytics).
                document.dispatchEvent( new CustomEvent( 'fotogrids:gallery_unlocked', {
                    bubbles: true,
                    detail:  { galleryId: galleryId },
                } ) );
            } )
            .catch( function () {
                if ( errorEl ) errorEl.classList.add( 'is-visible' );
            } )
            .then( function () {
                // finally — restore form state
                if ( card ) card.classList.remove( 'is-loading' );
                if ( submitBtn ) submitBtn.disabled = false;
            } );
    }

    /**
     * Bind every lock form currently on the page. The runtime's
     * MutationObserver fires fotogrids:gallery_inserted for galleries,
     * but the gate replaces the gallery, so static lock-form discovery
     * runs once at boot, and a delegated submit listener handles forms
     * inserted later (e.g. an album-ajax load returning a locked gallery).
     */
    function bindAll() {
        document.querySelectorAll( '.fotogrids-gate .fg-lock-form' ).forEach( bindLockForm );
    }

    function init() {
        bindAll();

        // Catch lock forms inserted after the initial pass — we don't
        // run our own MutationObserver (per the runtime contract); a
        // delegated submit listener achieves the same with no observer.
        document.addEventListener( 'submit', function ( e ) {
            const form = e.target;
            if ( ! form || ! form.classList || ! form.classList.contains( 'fg-lock-form' ) ) return;
            if ( form.dataset.fotogridsLockBound === '1' ) return;
            // Bind on the fly, then re-dispatch the submit event so the
            // newly-bound handler picks it up. Simpler than handling the
            // submit inline twice.
            bindLockForm( form );
            e.preventDefault();
            unlockGallery( form );
        }, true );
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
