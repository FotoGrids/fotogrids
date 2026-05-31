/**
 * FotoGrids — Pagination core (shared registry).
 *
 * Exposes `window.FotoGrids.modules.pagination` with:
 *   - state(galleryEl)            — { page, totalPages, pageSize, hasMore }
 *   - goToPage(galleryEl, page, opts)
 *   - prefetch(galleryEl, page)
 *   - onChange(galleryEl, cb)     — subscribe to page changes
 *
 * The three per-method JS files (endless-scroll, load-more, page-buttons)
 * each import nothing — they just read `FotoGrids.modules.pagination` and
 * wire their own UI to it. Cross-method coordination (e.g. preload_next_page)
 * lives in this file.
 *
 * No imports — standalone vanilla JS compiled by webpack as an entry.
 */

( function () {
    'use strict';

    /** Per-gallery state. Keyed by gallery wrapper element (WeakMap). */
    const galleryState = new WeakMap();

    /** Per-gallery change listeners. Keyed by gallery wrapper element. */
    const listeners = new WeakMap();

    /**
     * Per-gallery filter-view cache. Maps gallery → Map<fingerprint, snapshot>.
     * Each snapshot is taken after the most recent applyPage() call and
     * holds enough state to restore the user's exact view of that filter
     * combination without a re-fetch:
     *
     *   {
     *     html:       String,  // innerHTML of items root at last paint
     *     page:       Number,  // current page reached
     *     totalPages: Number,  // total pages of THIS filter set
     *     hasMore:    Boolean, // mirrors page < totalPages
     *   }
     *
     * Lives in JS memory only — cleared on page navigation/refresh.
     * Per [[user feedback]]: per-page-load cache, no localStorage.
     *
     * @type {WeakMap<Element, Map<string, object>>}
     */
    const filterViewCache = new WeakMap();

    /**
     * Per-gallery "last known filter fingerprint" so we know which cache
     * slot to write into when a paint completes. Updated by setActiveFilterFingerprint().
     *
     * @type {WeakMap<Element, string>}
     */
    const activeFingerprint = new WeakMap();

    /**
     * Per-gallery monotonic request token. Bumped every time we kick off
     * a fetch via goToPage/swapToFilterState; the token captured at fetch
     * time is checked when the response lands. If a newer fetch has
     * superseded this one, its DOM/cache write is dropped.
     *
     * Without this, rapid filter toggles produce overlapping in-flight
     * fetches whose responses can interleave — the later-arriving response
     * for an earlier filter wins, painting stale items AND poisoning the
     * cache slot of whichever filter is "active" at apply time. That's
     * the source of the "sometimes correct, sometimes wrong" totalPages
     * symptom on the bar.
     *
     * @type {WeakMap<Element, number>}
     */
    const inflightToken = new WeakMap();

    function nextToken( galleryEl ) {
        const t = ( inflightToken.get( galleryEl ) || 0 ) + 1;
        inflightToken.set( galleryEl, t );
        return t;
    }

    function isCurrentToken( galleryEl, token ) {
        return ( inflightToken.get( galleryEl ) || 0 ) === token;
    }

    /**
     * Filter-handling strategy.
     *
     *   'server' (default) — every filter change goes through a server
     *                        fetch. The server's total_pages is the only
     *                        thing that ever writes data-fg-page-total.
     *                        Single source of truth, no cache poisoning
     *                        possible.
     *   'cache'            — original behaviour: snapshot every paint into
     *                        a per-fingerprint cache, restore from cache
     *                        on filter revisits, fall back to server fetch
     *                        on cache miss. Kept as a fallback so we can
     *                        flip back without a code change if the
     *                        per-toggle round trip is felt as too sluggish.
     *
     * Toggle via:
     *   - data-fg-filter-strategy="cache" on the gallery wrapper (per-gallery)
     *   - FotoGrids.modules.pagination.setFilterStrategy('cache') (global default)
     *
     * @type {'server'|'cache'}
     */
    let defaultFilterStrategy = 'server';

    function strategyFor( galleryEl ) {
        const attr = galleryEl && galleryEl.dataset && galleryEl.dataset.fgFilterStrategy;
        if ( attr === 'server' || attr === 'cache' ) return attr;
        return defaultFilterStrategy;
    }

    /**
     * Reads pagination state off the gallery wrapper's data-fg-* attributes.
     * Always returns a fresh object — never the stored one, callers should
     * not mutate it.
     *
     * @param {Element} galleryEl
     * @returns {{page:number,totalPages:number,pageSize:number,method:string,preload:boolean,hasMore:boolean}}
     */
    function readState( galleryEl ) {
        const ds = galleryEl.dataset;
        const page       = parseInt( ds.fgPageCurrent || '1', 10 );
        const totalPages = parseInt( ds.fgPageTotal   || '1', 10 );
        const pageSize   = parseInt( ds.fgPageSize    || '0', 10 );

        return {
            page:       page,
            totalPages: totalPages,
            pageSize:   pageSize,
            method:     ds.fgPaginationMethod || 'load_more',
            preload:    ds.fgPaginationPreload === 'true',
            hasMore:    page < totalPages,
        };
    }

    /**
     * Writes page state back to the wrapper. Called after a successful
     * goToPage().
     *
     * @param {Element} galleryEl
     * @param {{page:number,totalPages:number}} next
     */
    function writeState( galleryEl, next ) {
        galleryEl.dataset.fgPageCurrent = String( next.page );
        galleryEl.dataset.fgPageTotal   = String( next.totalPages );
    }

    /**
     * Resolve the items container we should append/replace inside. The
     * layout module's root has the structural class (e.g. .fg-layout-grid)
     * — pagination doesn't know which layout is active, so we find it via
     * a stable role hook the layout modules emit.
     *
     * TODO (PHP side): every layout should write a
     * `data-fg-items-root="true"` attribute on its root element so the
     * JS doesn't have to guess. Until then, fall back to the wrapper's
     * first non-chrome child.
     *
     * @param {Element} galleryEl
     * @returns {Element|null}
     */
    function resolveItemsRoot( galleryEl ) {
        const explicit = galleryEl.querySelector( '[data-fg-items-root="true"]' );
        if ( explicit ) return explicit;

        // Fallback: first child that isn't a known chrome element.
        const chromeSelectors = [
            '.fotogrids-filters',
            '.fg-pagination',
            'style',
            '.fotogrids-password-gate',
        ];
        const children = Array.prototype.slice.call( galleryEl.children );
        for ( let i = 0; i < children.length; i++ ) {
            const el = children[ i ];
            const isChrome = chromeSelectors.some( function ( sel ) {
                return el.matches( sel );
            } );
            if ( ! isChrome ) return el;
        }
        return null;
    }

    /**
     * Inject <link rel="stylesheet"> tags for any CSS handles the render
     * pipeline collected that aren't already in the document. Mirrors the
     * Album_To_Gallery_Ajax helper exactly.
     *
     * @param {Record<string,string>} cssUrls
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
     * Notify listeners for a gallery that its page has changed.
     *
     * @param {Element} galleryEl
     * @param {object}  detail
     */
    function notify( galleryEl, detail ) {
        const cbs = listeners.get( galleryEl );
        if ( cbs ) {
            cbs.forEach( function ( cb ) {
                try { cb( detail ); } catch ( err ) { /* swallow listener errors */ }
            } );
        }
        galleryEl.dispatchEvent( new CustomEvent( 'fotogrids:page_changed', {
            bubbles: true,
            detail:  detail,
        } ) );
    }

    /**
     * Fetch a page from the server. Resolves with { html, css, page,
     * totalPages, pageSize, hasMore } or rejects.
     *
     * TODO: read the REST URL and nonce from the same global the
     * Album_To_Gallery_Ajax decorator uses (data-fg-render-url +
     * data-fg-render-nonce on a per-gallery element, OR a wp_localize
     * global). Decide which is cleaner once we wire the PHP side.
     *
     * @param {Element} galleryEl
     * @param {number}  page
     * @returns {Promise<object>}
     */
    function fetchPage( galleryEl, page ) {
        let url   = galleryEl.dataset.fgRenderUrl   || ( window.fotogrids && window.fotogrids.renderUrl )   || '';
        const nonce = galleryEl.dataset.fgRenderNonce || ( window.fotogrids && window.fotogrids.renderNonce ) || '';
        const galleryId = parseInt( galleryEl.dataset.fgGalleryId || '0', 10 );

        if ( ! url || ! galleryId ) {
            return Promise.reject( new Error( 'pagination/no-render-context' ) );
        }

        const breakpoint = ( window.FotoGrids && window.FotoGrids.activeBreakpoint )
            ? window.FotoGrids.activeBreakpoint()
            : 'desktop';

        // Pull active filter state from the filters module (if loaded).
        // Sent on every fetch so the server returns items from the
        // filtered set. When no filters are active, sends an empty
        // object which the server treats as "no filter".
        const filters = ( window.FotoGrids
            && window.FotoGrids.modules
            && window.FotoGrids.modules.filters
            && typeof window.FotoGrids.modules.filters.getActive === 'function' )
            ? window.FotoGrids.modules.filters.getActive( galleryEl )
            : {};

        // Random sort seed — only present when default_sort_order is
        // 'random'. Sending it back unchanged on every paginated request
        // is what keeps the shuffle stable across pages. The server
        // ignores zero/missing.
        const randomSeed = parseInt( galleryEl.dataset.fgRandomSeed || '0', 10 );

        const containerWidth = parseInt( galleryEl.dataset.fgContainerWidth || '0', 10 );

        return fetch( url, {
            method:      'POST',
            headers:     {
                'Content-Type': 'application/json',
                'X-WP-Nonce':   nonce,
            },
            credentials: 'same-origin',
            body: JSON.stringify( {
                gallery_id:      galleryId,
                page:            page,
                breakpoint:      breakpoint,
                partial:         'items_only',
                filters:         filters,
                random_seed:     randomSeed,
                container_width: containerWidth > 0 ? containerWidth : 0,
            } ),
        } )
            .then( function ( response ) {
                if ( ! response.ok ) {
                    throw new Error( 'pagination/http-' + response.status );
                }
                return response.json();
            } );
    }

    /**
     * Apply a fetched page to the gallery DOM.
     *
     * @param {Element} galleryEl
     * @param {{html:string,css:object,page:number,total_pages:number,page_size:number,has_more:boolean}} payload
     * @param {'replace'|'append'} mode
     * @param {string} [capturedFingerprint] Fingerprint captured at fetch
     *        time. When provided, the snapshot taken after this paint is
     *        keyed against THIS value (not `activeFingerprint.get(...)`
     *        which can move under us during overlapping requests).
     */
    function applyPage( galleryEl, payload, mode, capturedFingerprint ) {
        injectMissingStyles( payload.css || {} );

        let root = resolveItemsRoot( galleryEl );
        if ( ! root ) {
            throw new Error( 'pagination/no-items-root' );
        }

        // Parse the response. The layout module wraps items in a root
        // element (e.g. <div class="fg-grid-track" data-fg-items-root>),
        // and "items_only" returns that whole wrapper. We must unwrap
        // it before appending — otherwise we'd nest a second
        // .fg-grid-track inside the existing one.
        const template = document.createElement( 'template' );
        template.innerHTML = payload.html;

        let inserted = [];

        // If the top-level element of the response is itself an items
        // root, unwrap it. Otherwise, just take all top-level children.
        const topLevel = Array.prototype.slice.call( template.content.children );
        let sourceChildren = [];
        if ( topLevel.length === 1 && topLevel[ 0 ].dataset && topLevel[ 0 ].dataset.fgItemsRoot === 'true' ) {
            sourceChildren = Array.prototype.slice.call( topLevel[ 0 ].children );
        } else {
            sourceChildren = topLevel;
        }

        if ( mode === 'append' ) {
            sourceChildren.forEach( function ( node ) {
                root.appendChild( node );
                inserted.push( node );
            } );
        } else {
            root.innerHTML = '';
            sourceChildren.forEach( function ( node ) {
                root.appendChild( node );
                inserted.push( node );
            } );
        }

        // Tell per-item modules (lazy-load, loaded-effect, stats, sharing,
        // lightbox) that new items have arrived. They listen for this event
        // on the gallery wrapper.
        galleryEl.dispatchEvent( new CustomEvent( 'fotogrids:items_inserted', {
            bubbles: true,
            detail:  { items: inserted, galleryEl: galleryEl },
        } ) );

        // Snapshot the current view into the filter-view cache so a
        // future filter toggle that returns to this state can paint
        // instantly from cache. Use the fingerprint captured at FETCH
        // time — not whatever activeFingerprint holds now — so an
        // earlier-arriving response can't be filed under a later
        // filter's slot.
        //
        // Skipped entirely under the 'server' strategy: there's no
        // value in building cache state that swapToFilterState will
        // never read, and a stale snapshot here is exactly the class
        // of bug we're removing.
        if ( strategyFor( galleryEl ) !== 'server' ) {
            if ( typeof capturedFingerprint === 'string' ) {
                snapshotCurrentViewAs( galleryEl, capturedFingerprint );
            } else {
                snapshotCurrentView( galleryEl );
            }
        }

        writeState( galleryEl, {
            page:       payload.page,
            totalPages: payload.total_pages,
        } );

        notify( galleryEl, {
            galleryEl: galleryEl,
            page:      payload.page,
            mode:      mode,
            hasMore:   payload.has_more,
        } );

        // Kick off preload for the next page if enabled and there is one.
        if ( payload.has_more && readState( galleryEl ).preload ) {
            schedulePreload( galleryEl, payload.page + 1 );
        }
    }

    /**
     * Schedule an idle preload of the given page.
     *
     * @param {Element} galleryEl
     * @param {number}  page
     */
    function schedulePreload( galleryEl, page ) {
        const run = function () { fetchPage( galleryEl, page ).catch( function () { /* preload errors are silent */ } ); };

        if ( typeof window.requestIdleCallback === 'function' ) {
            window.requestIdleCallback( run, { timeout: 1500 } );
        } else {
            setTimeout( run, 250 );
        }
    }

    // -------------------------------------------------------------------------
    // Filter-view cache
    // -------------------------------------------------------------------------

    /**
     * Read the canonical fingerprint of the currently-active filter map
     * for this gallery. Delegates to FotoGrids.modules.filters.fingerprint
     * so filter-ui.js is the single source of truth.
     *
     * Returns '' (empty fingerprint) when filters module isn't loaded —
     * e.g. galleries without filtering enabled. That fingerprint just
     * means "no filter".
     *
     * @param {Element} galleryEl
     * @returns {string}
     */
    function currentFingerprint( galleryEl ) {
        const fmod = window.FotoGrids && window.FotoGrids.modules && window.FotoGrids.modules.filters;
        if ( ! fmod ) return '';
        const map = fmod.getActive ? fmod.getActive( galleryEl ) : {};
        return fmod.fingerprint ? fmod.fingerprint( map ) : '';
    }

    function ensureCacheBucket( galleryEl ) {
        if ( ! filterViewCache.has( galleryEl ) ) {
            filterViewCache.set( galleryEl, new Map() );
        }
        return filterViewCache.get( galleryEl );
    }

    /**
     * Snapshot the gallery's current view into the cache, keyed by the
     * fingerprint we last set as "active". Called after every applyPage()
     * so the snapshot always reflects the latest loaded state.
     *
     * If the active fingerprint isn't set yet (first paint), seed it
     * from the current filter state.
     *
     * @param {Element} galleryEl
     */
    function snapshotCurrentView( galleryEl ) {
        let root = resolveItemsRoot( galleryEl );
        if ( ! root ) return;

        if ( ! activeFingerprint.has( galleryEl ) ) {
            activeFingerprint.set( galleryEl, currentFingerprint( galleryEl ) );
        }
        const fp = activeFingerprint.get( galleryEl );
        let s  = readState( galleryEl );

        ensureCacheBucket( galleryEl ).set( fp, {
            html:       root.innerHTML,
            page:       s.page,
            totalPages: s.totalPages,
            hasMore:    s.hasMore,
        } );
    }

    /**
     * Same as snapshotCurrentView but writes under a caller-supplied
     * fingerprint instead of the currently-active one. Used by applyPage
     * so the snapshot key is the fingerprint that was active when the
     * fetch was kicked off — guaranteeing the cache slot reflects what
     * the server actually returned.
     *
     * @param {Element} galleryEl
     * @param {string}  fp
     */
    function snapshotCurrentViewAs( galleryEl, fp ) {
        let root = resolveItemsRoot( galleryEl );
        if ( ! root ) return;
        let s = readState( galleryEl );
        ensureCacheBucket( galleryEl ).set( fp, {
            html:       root.innerHTML,
            page:       s.page,
            totalPages: s.totalPages,
            hasMore:    s.hasMore,
        } );
    }

    /**
     * Restore a cached view into the gallery. Used when the user toggles
     * back to a filter state they've already seen — no fetch, instant
     * paint.
     *
     * @param {Element} galleryEl
     * @param {string}  fingerprint
     * @returns {{page:number, hasMore:boolean}|null} restored state or null if cache miss.
     */
    function restoreCachedView( galleryEl, fingerprint ) {
        const bucket = filterViewCache.get( galleryEl );
        if ( ! bucket ) return null;
        const snap = bucket.get( fingerprint );
        if ( ! snap ) return null;

        let root = resolveItemsRoot( galleryEl );
        if ( ! root ) return null;

        // Take the new items list to dispatch in fotogrids:items_inserted
        // so lazy-load, loading-icon, etc. re-bind on the restored DOM.
        root.innerHTML = snap.html;
        let inserted = Array.prototype.slice.call( root.children );

        writeState( galleryEl, {
            page:       snap.page,
            totalPages: snap.totalPages,
        } );
        activeFingerprint.set( galleryEl, fingerprint );

        notify( galleryEl, {
            galleryEl: galleryEl,
            page:      snap.page,
            mode:      'replace',
            hasMore:   snap.hasMore,
            fromCache: true,
        } );

        galleryEl.dispatchEvent( new CustomEvent( 'fotogrids:items_inserted', {
            bubbles: true,
            detail:  { items: inserted, galleryEl: galleryEl },
        } ) );

        return { page: snap.page, hasMore: snap.hasMore };
    }

    /**
     * Swap the gallery to a new filter state, using the cache when
     * possible. Called by pagination method modules in response to the
     * `fotogrids:filters_changed` event.
     *
     * Behaviour:
     *   1. Capture the current view under the PREVIOUS fingerprint (this
     *      already happened on the last applyPage call — but if items
     *      were inserted by another path since then, refresh).
     *   2. Compute new fingerprint.
     *   3. If new fingerprint is in cache → restore from cache, resolve
     *      immediately.
     *   4. Else → goToPage(1, { mode: 'replace' }) which fetches from
     *      the server and applies normally. The next applyPage will
     *      snapshot the result under the new fingerprint.
     *
     * Returns a Promise that resolves to { page, hasMore } in both
     * cache-hit and cache-miss paths.
     *
     * @param {Element} galleryEl
     * @returns {Promise<{page:number,hasMore:boolean,fromCache:boolean}>}
     */
    function swapToFilterState( galleryEl ) {
        const newFp = currentFingerprint( galleryEl );

        // Server-authoritative strategy: skip the cache entirely. The
        // server's total_pages becomes the only writer of
        // data-fg-page-total — no cache slot can carry stale state
        // because nothing reads the cache. The fingerprint+token race
        // guard inside goToPage stays active as defence-in-depth, but
        // is no longer load-bearing.
        if ( strategyFor( galleryEl ) === 'server' ) {
            activeFingerprint.set( galleryEl, newFp );
            return goToPage( galleryEl, 1, { mode: 'replace', fingerprint: newFp } ).then( function ( result ) {
                return { page: result.page, hasMore: result.hasMore, fromCache: false };
            } );
        }

        // 'cache' strategy — original behaviour.
        //
        // DO NOT snapshot here. By the time this fires, filter-ui has
        // already mutated the DOM (added fg-is-filtered-out classes to
        // non-matching items in preparation for the new filter state).
        // Snapshotting now would overwrite the clean previous-state
        // snapshot with one carrying stale filter classes.
        //
        // We rely on two snapshot moments that ARE clean:
        //   1. The onGallery init hook captures the unfiltered initial
        //      paint into cache[''].
        //   2. applyPage() captures every server-fetched paint into
        //      cache[<the fingerprint that was active during fetch>].
        // Both run while the DOM is in its canonical state for that
        // fingerprint.
        const restored = restoreCachedView( galleryEl, newFp );

        if ( restored ) {
            return Promise.resolve( { page: restored.page, hasMore: restored.hasMore, fromCache: true } );
        }

        // Cache miss — set the active fingerprint to the new value so
        // the post-fetch snapshot (taken by applyPage) lands in the
        // right cache slot. We also pass the captured fingerprint
        // into goToPage so its snapshot is keyed against the exact
        // filter state that was active when the fetch was issued —
        // robust against another swapToFilterState firing while this
        // fetch is in flight.
        activeFingerprint.set( galleryEl, newFp );

        return goToPage( galleryEl, 1, { mode: 'replace', fingerprint: newFp } ).then( function ( result ) {
            return { page: result.page, hasMore: result.hasMore, fromCache: false };
        } );
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Public state accessor.
     *
     * @param {Element} galleryEl
     */
    function state( galleryEl ) {
        return readState( galleryEl );
    }

    /**
     * Fetch + apply a page.
     *
     * @param {Element} galleryEl
     * @param {number}  page
     * @param {{mode?:'replace'|'append'}} opts
     * @returns {Promise<{page:number,hasMore:boolean}>}
     */
    function goToPage( galleryEl, page, opts ) {
        const mode = ( opts && opts.mode ) || 'replace';

        // Capture the filter fingerprint and a fresh request token at the
        // moment we kick the fetch off. If a later goToPage/swapToFilterState
        // bumps the token before this response lands, we drop the result —
        // both the DOM write and the cache snapshot — so the late response
        // can't poison a newer filter's view.
        const capturedFp    = ( opts && typeof opts.fingerprint === 'string' )
            ? opts.fingerprint
            : currentFingerprint( galleryEl );
        const capturedToken = nextToken( galleryEl );

        galleryEl.classList.add( 'fotogrids-gallery--is-paginating' );

        return fetchPage( galleryEl, page )
            .then( function ( payload ) {
                if ( ! isCurrentToken( galleryEl, capturedToken ) ) {
                    // Superseded by a newer request. Surface the payload
                    // so awaiting callers still resolve, but don't touch
                    // the DOM or cache — the newer request owns those.
                    return { page: payload.page, hasMore: payload.has_more, stale: true };
                }
                applyPage( galleryEl, payload, mode, capturedFp );
                return { page: payload.page, hasMore: payload.has_more };
            } )
            .catch( function ( err ) {
                // TODO: surface to the status region (role=status) so
                // screen readers announce the failure. For now, log.
                /* eslint-disable-next-line no-console */
                console.warn( '[fotogrids] pagination failed:', err );
                throw err;
            } )
            .then( function ( result ) {
                galleryEl.classList.remove( 'fotogrids-gallery--is-paginating' );
                return result;
            }, function ( err ) {
                galleryEl.classList.remove( 'fotogrids-gallery--is-paginating' );
                throw err;
            } );
    }

    /**
     * Prefetch a page (used by preload_next_page).
     *
     * @param {Element} galleryEl
     * @param {number}  page
     */
    function prefetch( galleryEl, page ) {
        return fetchPage( galleryEl, page );
    }

    /**
     * Subscribe to page-change notifications for a specific gallery.
     *
     * @param {Element}  galleryEl
     * @param {function} cb
     */
    function onChange( galleryEl, cb ) {
        if ( ! listeners.has( galleryEl ) ) {
            listeners.set( galleryEl, [] );
        }
        listeners.get( galleryEl ).push( cb );
    }

    function expose() {
        const FG = window.FotoGrids;
        if ( ! FG ) return false;
        if ( ! FG.modules ) FG.modules = {};
        FG.modules.pagination = {
            state:              state,
            goToPage:           goToPage,
            prefetch:           prefetch,
            onChange:           onChange,
            swapToFilterState:  swapToFilterState,
            /**
             * Set the global filter strategy. Per-gallery overrides via
             * data-fg-filter-strategy still win.
             *
             * @param {'server'|'cache'} s
             */
            setFilterStrategy: function ( s ) {
                if ( s === 'server' || s === 'cache' ) {
                    defaultFilterStrategy = s;
                }
            },
            /**
             * Read the strategy that would currently apply to a gallery.
             * Useful for tests / debugging.
             *
             * @param {Element} galleryEl
             * @returns {'server'|'cache'}
             */
            getFilterStrategy: function ( galleryEl ) {
                return strategyFor( galleryEl );
            },
        };
        return true;
    }

    function init() {
        if ( ! expose() ) {
            // Runtime not yet attached — wait for it.
            document.addEventListener( 'fotogrids:ready', expose, { once: true } );
            return;
        }

        // For every gallery that already has a paginated wrapper:
        //   1. (cache strategy only) Snapshot the initial server-
        //      rendered slice into the filter-view cache under the
        //      current (likely empty) filter fingerprint. This makes
        //      "filter, then un-filter" restore the original view
        //      instantly without a fetch.
        //   2. Kick off a preload if preload_next_page is enabled.
        window.FotoGrids.onGallery( function ( gEl ) {
            if ( gEl.dataset.fgPaginated !== 'true' ) return;
            if ( strategyFor( gEl ) !== 'server' ) {
                snapshotCurrentView( gEl );
            }
            let s = readState( gEl );
            if ( s.preload && s.hasMore ) {
                schedulePreload( gEl, s.page + 1 );
            }
        }, 5 );
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
