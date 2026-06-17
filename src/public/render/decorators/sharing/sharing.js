/**
 * FotoGrids - Sharing
 *
 * Owns:
 *   • the per-thumbnail share bar (when 'thumbnail' placement is active)
 *   • the view-page footer share bar (when 'view_footer' placement is active)
 *   • the cross-module renderShareBar(config, context) function used by the
 *     lightbox to draw its own toolbar share bar
 *   • the network icons + labels
 *   • all share-bar styles (now in sharing.css, not injected from JS)
 *
 * Activation:
 *   • Per-gallery thumbnail bars: subscribes to FotoGrids.onGallery(); for
 *     each gallery, reads data-fg-sharing JSON. Early-return if sharing
 *     disabled or 'thumbnail' placement is not active.
 *   • Footer bars: bootstraps any [data-fg-share-footer] elements on the
 *     page (used by the View Page footer; placement='view_footer').
 *
 * Cross-module API:
 *   window.FotoGrids.modules.sharing.renderShareBar(config, context)
 *   window.FotoGridsSharing.renderShareBar(config, context)    // legacy
 *
 * No imports - standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    function __( s ) {
        if ( window.wp && window.wp.i18n && typeof window.wp.i18n.__ === 'function' ) {
            return window.wp.i18n.__( s, 'fotogrids' );
        }
        return s;
    }

    /**
     * Display labels keyed by the stored network id.
     */
    function networkLabels() {
        return {
            facebook:  __( 'Facebook' ),
            x:         __( 'X' ),
            pinterest: __( 'Pinterest' ),
            linkedin:  __( 'LinkedIn' ),
            whatsapp:  __( 'WhatsApp' ),
            telegram:  __( 'Telegram' ),
            reddit:    __( 'Reddit' ),
            email:     __( 'Email' ),
            copy_link: __( 'Copy link' ),
        };
    }

    /**
     * Inline brand/glyph SVGs keyed by network id. Use currentColor so
     * they inherit the button's text colour.
     */
    const NETWORK_ICONS = {
        facebook:  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/></svg>',
        x:         '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>',
        pinterest: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.62 11.16-.1-.95-.2-2.4.04-3.44.22-.93 1.4-5.96 1.4-5.96s-.36-.72-.36-1.78c0-1.67.97-2.92 2.17-2.92 1.02 0 1.52.77 1.52 1.69 0 1.03-.66 2.57-1 4-.28 1.2.6 2.18 1.78 2.18 2.14 0 3.78-2.26 3.78-5.51 0-2.88-2.07-4.9-5.02-4.9-3.42 0-5.43 2.56-5.43 5.21 0 1.03.4 2.14.9 2.74.1.12.11.22.08.34l-.33 1.37c-.05.22-.18.27-.4.16-1.5-.7-2.43-2.88-2.43-4.64 0-3.78 2.75-7.25 7.92-7.25 4.16 0 7.39 2.96 7.39 6.92 0 4.13-2.6 7.45-6.22 7.45-1.21 0-2.35-.63-2.74-1.38l-.75 2.84c-.27 1.04-1 2.35-1.49 3.15A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/></svg>',
        linkedin:  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0Z"/></svg>',
        whatsapp:  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M.06 24l1.68-6.13A11.82 11.82 0 0 1 .16 11.9C.16 5.34 5.5 0 12.06 0a11.8 11.8 0 0 1 8.4 3.49 11.8 11.8 0 0 1 3.48 8.41c0 6.56-5.34 11.9-11.9 11.9a11.9 11.9 0 0 1-5.68-1.45L.06 24Zm6.6-3.8c1.67.99 3.27 1.58 5.4 1.58 5.45 0 9.9-4.43 9.9-9.88a9.85 9.85 0 0 0-9.9-9.9C6.6 2 2.16 6.43 2.16 11.9c0 2.24.65 3.92 1.75 5.68l-1 3.63 3.74-.98ZM17.6 14.6c-.07-.12-.27-.2-.56-.34-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47a8.96 8.96 0 0 1-1.65-2.06c-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.28.18-1.4Z"/></svg>',
        telegram:  '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-1.99.93l-5.5-4.05-2.66 2.56c-.3.3-.55.55-1.12.55l.4-5.65 10.32-9.32c.45-.4-.1-.62-.7-.22L6.1 13.4l-5.45-1.7c-1.18-.37-1.2-1.18.25-1.74L22.5 1.95c.97-.36 1.83.22 1.4 1.84Z"/></svg>',
        // Reddit: official "alien" shape only, no brand-red background
        // circle. The source path uses Reddit's original coordinate
        // system (viewBox -269 361 72 72) where the alien is the inner
        // content of the red circle and only fills ~55% of the canvas.
        // To present it as a 0 0 72 72 icon that fills the space like
        // every other network icon, we wrap the original path in a <g>
        // that translates from the source coordinates into the new
        // viewBox and uniformly scales the alien up so it occupies the
        // padded interior of the 72x72 canvas.
        //
        //   Alien bbox in source coords: ~ (-253, 376) → (-213, 424)
        //     → ~40 wide × 48 tall, centred around (-233, 400).
        //   Target: fill a 60x60 interior of the 72x72 viewBox (6u pad)
        //     centred around (36, 36).
        //   Scale = 60 / 48 = 1.25 (taller axis dominates).
        //   Translate (after scale) = (36 - 1.25 × -233, 36 - 1.25 × 400)
        //                            = (327.25, -464).
        reddit:    '<svg viewBox="0 0 72 72" width="100%" height="100%" fill="currentColor" aria-hidden="true"><g transform="translate(327.25 -464) scale(1.25)"><path d="m-224.8 404.5c-2.1 0-3.7-1.7-3.7-3.7 0-2.1 1.7-3.8 3.7-3.8s3.7 1.7 3.7 3.8c.1 2-1.6 3.7-3.7 3.7m.7 6.2c-2.6 2.6-7.5 2.8-8.9 2.8s-6.3-.2-8.9-2.8c-.4-.4-.4-1 0-1.4s1-.4 1.4 0c1.6 1.6 5.1 2.2 7.5 2.2 2.5 0 5.9-.6 7.5-2.2.4-.4 1-.4 1.4 0s.4 1 0 1.4m-20.9-9.9c0-2.1 1.7-3.8 3.8-3.8s3.7 1.7 3.7 3.8-1.7 3.7-3.7 3.7c-2.1 0-3.8-1.7-3.8-3.7m36-3.8c0-2.9-2.4-5.3-5.3-5.3-1.4 0-2.7.6-3.6 1.5-3.6-2.6-8.5-4.3-14-4.5l2.4-11.3 7.8 1.7c.1 2 1.7 3.6 3.7 3.6 2.1 0 3.7-1.7 3.7-3.7 0-2.1-1.7-3.7-3.7-3.7-1.5 0-2.7.9-3.3 2.1l-8.7-1.9c-.2-.1-.5 0-.7.1s-.4.3-.4.6l-2.6 12.3v.2c-5.6.1-10.6 1.8-14.3 4.4-.9-.9-2.2-1.5-3.6-1.5-2.9 0-5.3 2.4-5.3 5.3 0 2.1 1.3 4 3.1 4.8-.1.5-.1 1.1-.1 1.6 0 8.1 9.4 14.6 21 14.6s21-6.5 21-14.6c0-.5 0-1.1-.1-1.6 1.7-.7 3-2.6 3-4.7"/></g></svg>',
        email:     '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 7L10.1649 12.7154C10.8261 13.1783 11.1567 13.4097 11.5163 13.4993C11.8339 13.5785 12.1661 13.5785 12.4837 13.4993C12.8433 13.4097 13.1739 13.1783 13.8351 12.7154L22 7M6.8 20H17.2C18.8802 20 19.7202 20 20.362 19.673C20.9265 19.3854 21.3854 18.9265 21.673 18.362C22 17.7202 22 16.8802 22 15.2V8.8C22 7.11984 22 6.27976 21.673 5.63803C21.3854 5.07354 20.9265 4.6146 20.362 4.32698C19.7202 4 18.8802 4 17.2 4H6.8C5.11984 4 4.27976 4 3.63803 4.32698C3.07354 4.6146 2.6146 5.07354 2.32698 5.63803C2 6.27976 2 7.11984 2 8.8V15.2C2 16.8802 2 17.7202 2.32698 18.362C2.6146 18.9265 3.07354 19.3854 3.63803 19.673C4.27976 20 5.11984 20 6.8 20Z"/></svg>',
        copy_link: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.99999 13C10.4294 13.5741 10.9773 14.0491 11.6065 14.3929C12.2357 14.7367 12.9315 14.9411 13.6466 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9547 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.552 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997M14 11C13.5705 10.4258 13.0226 9.95078 12.3934 9.60703C11.7642 9.26327 11.0685 9.05885 10.3533 9.00763C9.63819 8.95641 8.9204 9.0596 8.24864 9.31018C7.57688 9.56077 6.96687 9.9529 6.45999 10.46L3.45999 13.46C2.5492 14.403 2.04522 15.666 2.05662 16.977C2.06801 18.288 2.59385 19.542 3.52089 20.4691C4.44793 21.3961 5.702 21.9219 7.01298 21.9333C8.32396 21.9447 9.58697 21.4408 10.53 20.53L12.24 18.82"/></svg>',
    };

    /**
     * Map a stored network id to the shareItem network key.
     *
     * @param {string} network
     * @returns {string}
     */
    function networkKeyFor( network ) {
        if ( network === 'x' ) return 'twitter';
        if ( network === 'copy_link' ) return 'copy';
        return network;
    }

    /**
     * Dispatch a fotogrids:share event so the Stats module (or any
     * listener) can record the share. Sharing itself does not call the
     * REST API; stats are a separate module's concern.
     *
     * @param {string|number} itemId
     * @param {string} network
     */
    function dispatchShareEvent( itemId, network ) {
        document.dispatchEvent( new CustomEvent( 'fotogrids:share', {
            bubbles: true,
            detail:  {
                itemId:  itemId != null ? String( itemId ) : '',
                network: network,
            },
        } ) );
    }

    /**
     * Resolve the URL to share for an item, by context.
     *
     * Never returns the raw image file (that gives a context-less link
     * with no preview). On a view page the share is the view URL with a
     * deep-link to the item; on an embedded page it is the host page,
     * optionally with a deep-link hash, governed by the
     * embedded_share_target setting.
     *
     * @param {HTMLElement} img
     * @returns {string}
     */
    function resolveShareUrl( img ) {
        const settings   = window.fotogridsSharing || window.fotogrids || {};
        let itemId     = img.dataset ? ( img.dataset.id || '' ) : '';
        const base       = window.location.href.split( '#' )[ 0 ];
        // The View Page sets `fotogrids-view` on <body>, not <html>.
        const isViewPage = ( document.body && document.body.classList.contains( 'fotogrids-view' ) )
            || document.documentElement.classList.contains( 'fotogrids-view' );
        const deepLink   = settings.deep_linking_enabled !== false;

        if ( isViewPage ) {
            if ( deepLink && itemId ) {
                try {
                    let url = new URL( window.location.href );
                    url.searchParams.set( 'fg-item', String( itemId ) );
                    url.hash = '';
                    return url.toString();
                } catch ( e ) {
                    return base;
                }
            }
            return base;
        }

        const target = settings.embedded_share_target || 'image';
        if ( target === 'image' && deepLink && itemId ) {
            const galleryEl = img.closest ? img.closest( '.fotogrids-collection.fotogrids-gallery' ) : null;
            // Pipeline writes data-fg-gallery-id on the wrapper.
            let galleryId = galleryEl ? galleryEl.dataset.fgGalleryId : '';
            if ( galleryId ) {
                return base + '#fg-' + galleryId + '-' + itemId;
            }
        }
        return base;
    }

    /**
     * Copy a string to the clipboard. Returns a Promise that resolves to
     * true on success, false on failure.
     *
     * Tries the modern Clipboard API first - it's the only path that
     * works in cross-origin iframes and is the future-proof option. But
     * the modern API requires a secure context (HTTPS or localhost); on
     * a plain HTTP dev environment `navigator.clipboard` is undefined.
     * So we fall back to the legacy execCommand('copy') route, which
     * works on plain HTTP back to IE.
     *
     * The legacy path needs a real textarea in the DOM and a Selection.
     * We stash it off-screen, select its contents, run the copy, and
     * remove it.
     *
     * @param {string} text
     * @returns {Promise<boolean>}
     */
    function copyToClipboard( text ) {
        // Modern path - only present in secure contexts.
        if ( navigator.clipboard && typeof navigator.clipboard.writeText === 'function' ) {
            return navigator.clipboard.writeText( text )
                .then( function () { return true; } )
                .catch( function ( err ) {
                    if ( window.console && console.warn ) {
                        console.warn( 'FotoGrids: clipboard.writeText failed; falling back to execCommand.', err );
                    }
                    return legacyCopy( text );
                } );
        }

        return Promise.resolve( legacyCopy( text ) );
    }

    /**
     * Legacy clipboard write via document.execCommand('copy') on a
     * temporary textarea. Works in plain-HTTP contexts where the modern
     * Clipboard API is unavailable.
     *
     * The textarea is mounted inside the currently-focused root so that
     * when a modal <dialog> (like the lightbox) is open, the textarea
     * lives inside the dialog and isn't focus-trapped out. Without
     * this, .select() in the textarea silently fails inside an open
     * modal dialog and execCommand('copy') returns false.
     *
     * @param {string} text
     * @returns {boolean}
     */
    function legacyCopy( text ) {
        // Pick the right parent. If a modal <dialog> is open we mount
        // inside it (focus trap won't block the .select()). Otherwise
        // fall back to <body>.
        let openDialog = null;
        document.querySelectorAll( 'dialog[open]' ).forEach( function ( dlg ) {
            if ( ! openDialog ) openDialog = dlg;
        } );
        const parent = openDialog || document.body;

        const ta = document.createElement( 'textarea' );
        ta.value = text;
        // Avoid scrolling to bottom / visible jump.
        ta.setAttribute( 'readonly', '' );
        ta.style.position = 'fixed';
        ta.style.top      = '0';
        ta.style.left     = '0';
        ta.style.opacity  = '0';
        // pointer-events:none would prevent .focus() from selecting on
        // some browsers; we hide via opacity only. The textarea is at
        // top:0 left:0 which is fine for a 1-frame appearance.
        parent.appendChild( ta );

        // Preserve focus and selection so we can restore them after the copy.
        // execCommand('copy') reads from window.getSelection(), so we focus
        // the textarea, select its contents, copy, then restore. The focus
        // restoration is critical - without it the share button's blur
        // handler fires and hides its tooltip just after the click.
        const previouslyFocused = document.activeElement;
        const previousSelection = document.getSelection
            && document.getSelection().rangeCount > 0
                ? document.getSelection().getRangeAt( 0 )
                : null;

        ta.focus( { preventScroll: true } );
        ta.select();
        if ( typeof ta.setSelectionRange === 'function' ) {
            ta.setSelectionRange( 0, text.length );
        }

        let ok = false;
        try {
            ok = document.execCommand( 'copy' );
        } catch ( err ) {
            if ( window.console && console.warn ) {
                console.warn( 'FotoGrids: legacy execCommand copy threw', err );
            }
            ok = false;
        }

        parent.removeChild( ta );

        // Restore focus FIRST so a stray blur event doesn't hide the
        // button's tooltip.
        if ( previouslyFocused && typeof previouslyFocused.focus === 'function' ) {
            try {
                previouslyFocused.focus( { preventScroll: true } );
            } catch ( e ) {
                // Some browsers don't accept the options object; fall back.
                previouslyFocused.focus();
            }
        }

        if ( previousSelection ) {
            const sel = document.getSelection();
            sel.removeAllRanges();
            sel.addRange( previousSelection );
        }

        return ok;
    }

    /**
     * Open a share popup for the chosen network, or write to clipboard
     * for copy.
     *
     * Returns a Promise<boolean> so callers can react to copy success
     * specifically. For network popups it resolves to true if a window
     * opened, false otherwise. For copy it resolves to whether the
     * clipboard write succeeded.
     *
     * @param {HTMLElement} img       Proxy element carrying data-id / data-fg-full-src / alt.
     * @param {string}      network   shareItem network key (e.g. 'twitter', 'copy').
     * @returns {Promise<boolean>}
     */
    function shareItem( img, network ) {
        const itemUrl     = img.dataset && img.dataset.fgFullSrc ? img.dataset.fgFullSrc : img.src;
        const caption     = img.alt || '';
        const shareTarget = resolveShareUrl( img );

        let shareUrl = '';

        switch ( network ) {
            case 'facebook':
                shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent( shareTarget );
                break;
            case 'twitter':
                shareUrl = 'https://twitter.com/intent/tweet?url=' + encodeURIComponent( shareTarget ) + '&text=' + encodeURIComponent( caption );
                break;
            case 'pinterest':
                shareUrl = 'https://pinterest.com/pin/create/button/?url=' + encodeURIComponent( shareTarget ) + '&media=' + encodeURIComponent( itemUrl ) + '&description=' + encodeURIComponent( caption );
                break;
            case 'email':
                shareUrl = 'mailto:?subject=' + encodeURIComponent( caption ) + '&body=' + encodeURIComponent( shareTarget );
                break;
            case 'copy':
                return copyToClipboard( shareTarget ).then( function ( ok ) {
                    if ( ok ) {
                        dispatchShareEvent( img.dataset && img.dataset.id, network );
                    }
                    return ok;
                } );
        }

        if ( shareUrl ) {
            window.open( shareUrl, '_blank', 'width=600,height=400' );
            dispatchShareEvent( img.dataset && img.dataset.id, network );
            return Promise.resolve( true );
        }
        return Promise.resolve( false );
    }

    /**
     * Build a share bar element from a resolved sharing config and an item
     * context. Reused by the lightbox toolbar, the thumbnail decorator
     * and the view-page footer.
     *
     * @param {Object} config             Resolved sharing - { networks, button_style, button_size }.
     * @param {Object} context            { id, fullUrl, caption, galleryId, galleryEl }.
     * @param {Object} [options]          Optional layout overrides.
     * @param {string} [options.layout]   'grid' | 'row'. 'grid' adds a 2-column grid
     *                                    modifier (used inside the lightbox info panel and
     *                                    anywhere a balanced 2-up cluster reads better).
     *                                    'row' (default) keeps the base flex row.
     * @returns {HTMLElement|null}
     */
    function renderShareBar( config, context, options ) {
        if ( ! config || ! config.networks ) return null;

        const order  = [ 'facebook', 'x', 'pinterest', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'email', 'copy_link' ];
        const active = order.filter( function ( n ) { return config.networks[ n ]; } );
        if ( active.length === 0 ) return null;

        const labels = networkLabels();
        const style  = config.button_style || 'icons_only';
        const size   = config.button_size || 'medium';
        const layout = ( options && options.layout === 'grid' ) ? 'grid' : 'row';

        let bar = document.createElement( 'div' );
        bar.className = 'fotogrids-share-bar fotogrids-share-bar--' + style + ' fotogrids-share-bar--' + size + ' fotogrids-share-bar--' + layout;

        // A detached proxy carrying the item data shareItem expects.
        const proxy = document.createElement( 'span' );
        proxy.dataset.id   = context.id != null ? String( context.id ) : '';
        proxy.dataset.fgFullSrc = context.fullUrl || '';
        proxy.alt          = context.caption || '';
        if ( context.galleryEl ) {
            // proxy.dataset.galleryId is what resolveShareUrl reads (via
            // the proxy's own `closest()` override and indirectly through
            // img.dataset.galleryId fallback paths). The pipeline writes
            // data-fg-gallery-id on the wrapper, hence dataset.fgGalleryId.
            proxy.dataset.galleryId = context.galleryId
                || ( context.galleryEl.dataset ? context.galleryEl.dataset.fgGalleryId : '' );
        }
        proxy.closest = function ( sel ) {
            if ( ! context.galleryEl ) return null;
            if (
                sel === '.fotogrids-gallery'
                || sel === '.fotogrids-collection'
                || sel === '.fotogrids-collection.fotogrids-gallery'
            ) {
                return context.galleryEl;
            }
            return null;
        };

        function labelFor( network ) {
            return labels[ network ] || network;
        }

        active.forEach( function ( network ) {
            const btn = document.createElement( 'button' );
            btn.type = 'button';
            btn.className = 'fotogrids-share-bar__btn fotogrids-share-bar__btn--' + network;
            btn.setAttribute( 'aria-label', labelFor( network ) );
            btn.dataset.network = network;

            const showIcon  = style !== 'labels_only';
            const showLabel = style !== 'icons_only';

            if ( showIcon && NETWORK_ICONS[ network ] ) {
                const iconWrap = document.createElement( 'span' );
                iconWrap.className = 'fotogrids-share-bar__icon';
                iconWrap.innerHTML = NETWORK_ICONS[ network ];
                btn.appendChild( iconWrap );
            }
            if ( showLabel ) {
                const labelEl = document.createElement( 'span' );
                labelEl.className = 'fotogrids-share-bar__label';
                labelEl.textContent = labelFor( network );
                btn.appendChild( labelEl );
            }

            const tooltip = ( network === 'copy_link' )
                ? __( 'Copy link' )
                : __( 'Share on %s' ).replace( '%s', labelFor( network ) );
            btn.dataset.fgTooltip    = tooltip;
            btn.dataset.fgTooltipDir = 'above';
            if ( ! showLabel ) {
                btn.title = tooltip;
            }

            btn.addEventListener( 'click', function ( e ) {
                e.preventDefault();
                e.stopPropagation();

                const result = shareItem( proxy, networkKeyFor( network ) );

                if ( network === 'copy_link' ) {
                    // Tooltip feedback depends on whether the copy
                    // actually landed in the clipboard. We default to
                    // the failure message and flip to success on
                    // resolution - that way a stuck/unresolved Promise
                    // doesn't lie to the user.
                    const successLabel = __( 'Link copied' );
                    const failureLabel = __( 'Copy failed' );
                    const baseLabel    = __( 'Copy link' );

                    const showFeedback = function ( label, kind ) {
                        // FgTooltip.refresh() reads aria-label first, then
                        // title. Update both - without aria-label being
                        // up-to-date, refresh() shows the stale label and
                        // the next mouseenter snaps back too.
                        btn.dataset.fgTooltip = label;
                        btn.title             = label;
                        btn.setAttribute( 'aria-label', label );
                        if ( window.FgTooltip && typeof window.FgTooltip.refresh === 'function' ) {
                            window.FgTooltip.refresh( btn );
                        }
                        // Visual modifier so the button itself can flash
                        // a state (useful inside the interactive lightbox
                        // popover where the surrounding tooltip already
                        // hosts the share grid and won't show its own
                        // text refresh).
                        btn.classList.remove( 'fotogrids-share-bar__btn--just-copied', 'fotogrids-share-bar__btn--copy-failed' );
                        if ( kind === 'success' ) {
                            btn.classList.add( 'fotogrids-share-bar__btn--just-copied' );
                        } else if ( kind === 'failure' ) {
                            btn.classList.add( 'fotogrids-share-bar__btn--copy-failed' );
                        }
                        // Note: don't call .bind() again - each bind()
                        // adds a fresh set of event listeners on the
                        // same host, leaking handlers across clicks.
                    };

                    Promise.resolve( result ).then( function ( ok ) {
                        showFeedback( ok ? successLabel : failureLabel, ok ? 'success' : 'failure' );
                        setTimeout( function () { showFeedback( baseLabel, 'idle' ); }, 2000 );
                    } );
                }
            } );

            if ( window.FgTooltip ) {
                window.FgTooltip.bind( btn, tooltip );
            }

            bar.appendChild( btn );
        } );

        return bar;
    }

    /**
     * For a gallery whose data-fg-sharing config includes 'thumbnail'
     * placement, render a share bar inside each .fg-item.
     *
     * @param {Element} galleryEl
     */
    function attachThumbnailBars( galleryEl ) {
        const raw = galleryEl.dataset.fgSharing;
        if ( ! raw ) return;

        let config;
        try {
            config = JSON.parse( raw );
        } catch ( e ) {
            return;
        }

        if ( ! config.enabled || ! Array.isArray( config.placements ) || ! config.placements.includes( 'thumbnail' ) ) {
            return;
        }

        // Pipeline writes data-fg-gallery-id on the wrapper.
        let galleryId = galleryEl.dataset.fgGalleryId || '';

        galleryEl.querySelectorAll( '.fg-item' ).forEach( function ( figure ) {
            if ( figure.querySelector( '.fotogrids-share-bar' ) ) return;
            const img = figure.querySelector( 'img' );
            if ( ! img ) return;

            const triggerEl = figure.querySelector( '[data-fg-item-id]' );
            let itemId = img.dataset.id || ( triggerEl ? triggerEl.dataset.fgItemId : '' );

            let bar = renderShareBar( config, {
                id:        itemId,
                fullUrl:   img.dataset.fgFullSrc || img.src,
                caption:   img.alt || '',
                galleryEl: galleryEl,
                galleryId: galleryId,
            } );

            if ( bar ) {
                bar.classList.add( 'fotogrids-share-bar--thumbnail' );
                figure.appendChild( bar );
            }
        } );
    }

    /**
     * Populate any [data-fg-share-footer] containers on the page from
     * their JSON config. Used by the View Page footer; placement is
     * 'view_footer' in the resolved config.
     */
    function attachFooterBars() {
        document.querySelectorAll( '[data-fg-share-footer]' ).forEach( function ( container ) {
            if ( container.querySelector( '.fotogrids-share-bar' ) ) return;

            let config;
            try {
                config = JSON.parse( container.dataset.fgShareFooter );
            } catch ( e ) {
                return;
            }
            if ( ! config || ! config.enabled ) return;

            let bar = renderShareBar(
                config,
                {
                    id:        '',
                    fullUrl:   '',
                    caption:   document.title || '',
                    galleryEl: null,
                    galleryId: '',
                },
                { layout: 'row' }
            );
            if ( bar ) {
                bar.classList.add( 'fotogrids-share-bar--footer' );
                container.appendChild( bar );
            }
        } );
    }

    const publicApi = {
        renderShareBar: renderShareBar,
        shareItem:      shareItem,
        resolveShareUrl: resolveShareUrl,
        networkKeyFor:  networkKeyFor,
    };

    function init() {
        if ( window.FotoGrids && window.FotoGrids.modules ) {
            window.FotoGrids.modules.sharing = publicApi;
        }
        // Legacy global preserved so the lightbox (which still reads
        // window.FotoGridsSharing.renderShareBar) keeps working.
        window.FotoGridsSharing = publicApi;

        if ( window.FotoGrids && typeof window.FotoGrids.onGallery === 'function' ) {
            window.FotoGrids.onGallery( attachThumbnailBars, 10 );
        }

        attachFooterBars();
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
