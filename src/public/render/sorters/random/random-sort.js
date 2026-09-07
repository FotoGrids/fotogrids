/**
 * FotoGrids - Random sort, client side.
 *
 * Random_Sorter picks its permutation server-side from a seed, so the order
 * is baked into the rendered HTML. Any cache holding that HTML - the
 * FotoGrids render cache, a page-builder cache, a caching plugin, a CDN -
 * hands the same permutation to every visitor for the life of the entry.
 * This module resolves the randomization after delivery instead, which no
 * cache can freeze. Two modes, read from data-fg-random-mode:
 *
 *   refetch - Requests a fresh selection from the render endpoint with a
 *             newly minted seed and swaps it in. The only mode that can
 *             change WHICH items appear, which is what a paginated
 *             collection or a Single Item layout needs. Items are held
 *             hidden until the response lands so the visitor never sees one
 *             set replaced by another.
 *   reorder - Rearranges the items already on the page. No request, but the
 *             selection is whatever the server sent.
 *
 * Runs at priority 0 so it lands before any layout module attaches
 * (bootLayout defaults to 10) - masonry and justified compute positions from
 * DOM order and must see the final list.
 *
 * Server order is the no-JS fallback and needs no further handling.
 *
 * No imports - standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    const MODE_ATTR = 'data-fg-random-mode';
    const MODE_REFETCH = 'refetch';
    const MODE_REORDER = 'reorder';

    /**
     * How long the items stay hidden waiting for the fetch. Past this the
     * server order is revealed and a late response is discarded - showing
     * the visitor a swap is worse than showing them one frozen order.
     */
    const HOLD_TIMEOUT_MS = 600;

    /** Class the stylesheet hangs the hold on. */
    const PENDING_CLASS = 'fg-random-pending';

    /** Upper bound of the server's random_seed validation. */
    const SEED_MAX = 2147483647;

    /**
     * Fisher-Yates over a copy of the supplied array.
     *
     * @param {Element[]} nodes
     * @return {Element[]}
     */
    function shuffled( nodes ) {
        const out = nodes.slice();
        for ( let i = out.length - 1; i > 0; i-- ) {
            const j = Math.floor( Math.random() * ( i + 1 ) );
            const tmp = out[ i ];
            out[ i ] = out[ j ];
            out[ j ] = tmp;
        }
        return out;
    }

    /**
     * Resolves the element whose children are the collection's items.
     * Layouts mark it with data-fg-items-root; the parent of the first
     * `.fg-item` covers the layouts that don't.
     *
     * @param {Element} collectionEl
     * @return {Element|null}
     */
    function resolveItemsRoot( collectionEl ) {
        const explicit = collectionEl.querySelector( '[data-fg-items-root="true"]' );
        if ( explicit ) {
            return explicit;
        }
        const firstItem = collectionEl.querySelector( '.fg-item' );
        return firstItem ? firstItem.parentElement : null;
    }

    /**
     * @param {Element} root
     * @return {Element[]}
     */
    function itemsIn( root ) {
        return Array.prototype.slice.call( root.querySelectorAll( ':scope > .fg-item' ) );
    }

    /**
     * Redistributes `nodes` across the DOM positions they currently occupy
     * inside `root`, in shuffled order. Positions held by anything else -
     * a layout's progress indicator, items from an earlier page - are left
     * untouched.
     *
     * @param {Element}   root
     * @param {Element[]} nodes
     */
    function reshuffleInPlace( root, nodes ) {
        const present = nodes.filter( function ( node ) {
            return node && node.parentElement === root;
        } );
        if ( present.length < 2 ) {
            return;
        }

        const slots = present.map( function ( node ) {
            const marker = document.createComment( '' );
            root.insertBefore( marker, node );
            return marker;
        } );

        const order = shuffled( present );
        for ( let i = 0; i < slots.length; i++ ) {
            root.insertBefore( order[ i ], slots[ i ] );
            root.removeChild( slots[ i ] );
        }
    }

    /**
     * @return {number} A seed inside the range the render endpoint accepts.
     */
    function mintSeed() {
        return Math.floor( Math.random() * SEED_MAX ) + 1;
    }

    /**
     * Adds <link> tags for any stylesheet the response needs that the page
     * does not already carry. Mirrors the pagination module's helper.
     *
     * @param {Record<string,string>} cssUrls
     */
    function injectMissingStyles( cssUrls ) {
        if ( ! cssUrls || typeof cssUrls !== 'object' ) {
            return;
        }
        Object.keys( cssUrls ).forEach( function ( handle ) {
            const url = cssUrls[ handle ];
            if ( ! handle || ! url ) {
                return;
            }
            const linkId = 'fotogrids-css-' + handle;
            if ( document.getElementById( linkId ) ) {
                return;
            }
            const link = document.createElement( 'link' );
            link.rel = 'stylesheet';
            link.id = linkId;
            link.href = url;
            document.head.appendChild( link );
        } );
    }

    /**
     * Replaces the collection's items with the ones in an items_only
     * response and announces them.
     *
     * @param {Element} collectionEl
     * @param {Element} root
     * @param {{html: string, css: Record<string,string>}} payload
     */
    function applyItems( collectionEl, root, payload ) {
        if ( ! payload || typeof payload.html !== 'string' || '' === payload.html ) {
            return;
        }

        injectMissingStyles( payload.css || {} );

        // items_only returns the layout's own items root. Unwrap it, or the
        // swap would nest a second track inside the existing one.
        const template = document.createElement( 'template' );
        template.innerHTML = payload.html;

        const topLevel = Array.prototype.slice.call( template.content.children );
        const incoming = (
            1 === topLevel.length
            && topLevel[ 0 ].dataset
            && 'true' === topLevel[ 0 ].dataset.fgItemsRoot
        )
            ? Array.prototype.slice.call( topLevel[ 0 ].children )
            : topLevel;

        if ( 0 === incoming.length ) {
            return;
        }

        root.innerHTML = '';
        const inserted = [];
        incoming.forEach( function ( node ) {
            root.appendChild( node );
            inserted.push( node );
        } );

        collectionEl.dispatchEvent( new CustomEvent( 'fotogrids:items_inserted', {
            bubbles: true,
            detail: { items: inserted, galleryEl: collectionEl },
        } ) );
    }

    /**
     * Requests a fresh random selection and swaps it in, holding the items
     * hidden until it lands.
     *
     * The minted seed is written back onto the wrapper so pagination and the
     * Lightbox draw their later requests from the same permutation.
     *
     * @param {Element} collectionEl
     * @param {Element} root
     */
    function fetchFreshSet( collectionEl, root ) {
        const url = collectionEl.dataset.fgRenderUrl || '';
        const galleryId = parseInt( collectionEl.dataset.fgGalleryId || '0', 10 );

        if ( ! url || ! galleryId || typeof window.fetch !== 'function' ) {
            return;
        }

        const seed = mintSeed();
        collectionEl.dataset.fgRandomSeed = String( seed );

        const breakpoint = ( window.FotoGrids && window.FotoGrids.activeBreakpoint )
            ? window.FotoGrids.activeBreakpoint()
            : 'desktop';

        root.classList.add( PENDING_CLASS );

        let settled = false;
        const release = function () {
            if ( settled ) {
                return;
            }
            settled = true;
            root.classList.remove( PENDING_CLASS );
        };

        const timer = window.setTimeout( release, HOLD_TIMEOUT_MS );

        window.fetch( url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': collectionEl.dataset.fgRenderNonce || '',
            },
            credentials: 'same-origin',
            body: JSON.stringify( {
                gallery_id: galleryId,
                page: 1,
                breakpoint: breakpoint,
                partial: 'items_only',
                random_seed: seed,
            } ),
        } )
            .then( function ( response ) {
                if ( ! response.ok ) {
                    throw new Error( 'random-sort/http-' + response.status );
                }
                return response.json();
            } )
            .then( function ( payload ) {
                // A response that arrives after the hold expired is dropped:
                // the visitor is already looking at the server order.
                if ( ! settled ) {
                    applyItems( collectionEl, root, payload );
                }
            } )
            .catch( function () {
                /* Server order stands. */
            } )
            .then( function () {
                window.clearTimeout( timer );
                release();
            } );
    }

    /**
     * Shuffles each newly paginated batch among itself. Re-shuffling the
     * whole list would move items the visitor is already reading.
     *
     * @param {Element} collectionEl
     */
    function bindInsertedBatches( collectionEl ) {
        collectionEl.addEventListener( 'fotogrids:items_inserted', function ( event ) {
            const inserted = event.detail && event.detail.items;
            if ( ! inserted || 0 === inserted.length ) {
                return;
            }
            const root = resolveItemsRoot( collectionEl );
            if ( ! root ) {
                return;
            }
            reshuffleInPlace( root, Array.prototype.slice.call( inserted ) );
        } );
    }

    function attach( collectionEl ) {
        const mode = collectionEl.getAttribute( MODE_ATTR );
        if ( MODE_REFETCH !== mode && MODE_REORDER !== mode ) {
            return;
        }
        if ( '1' === collectionEl.dataset.fgRandomSortReady ) {
            return;
        }
        collectionEl.dataset.fgRandomSortReady = '1';

        const root = resolveItemsRoot( collectionEl );
        if ( ! root ) {
            return;
        }

        if ( MODE_REFETCH === mode ) {
            // The server already applied a fresh permutation for the minted
            // seed, so no client shuffle runs on top - that would desync the
            // sequence indices the Lightbox navigates by.
            fetchFreshSet( collectionEl, root );
            return;
        }

        reshuffleInPlace( root, itemsIn( root ) );
        bindInsertedBatches( collectionEl );
    }

    function init() {
        if ( window.FotoGrids && typeof window.FotoGrids.onCollection === 'function' ) {
            window.FotoGrids.onCollection( attach, 0 );
        }
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
