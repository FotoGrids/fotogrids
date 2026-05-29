/**
 * FotoGrids Frontend Runtime
 *
 * The minimum amount of JavaScript that must be present on any page
 * rendering a FotoGrids gallery or album. It does NOT implement any
 * feature — no filters, no lightbox, no sharing, no masonry, no stats,
 * no password gate. Its sole job is to discover collection elements
 * (galleries and albums) and announce them so the per-feature modules
 * can attach to each one.
 *
 * See README.md in this directory for the full contract.
 *
 * No imports — standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    var VERSION = '1.1.0';

    // -------------------------------------------------------------------------
    // Internal state
    // -------------------------------------------------------------------------

    /**
     * Three independent callback queues, one per public subscription API.
     * Each queue is kept sorted by (priority asc, seq asc) so registration
     * order is preserved within a priority bucket.
     *
     * @type {Object<string, Array<{ cb: Function, priority: number, seq: number }>>}
     */
    var queues = {
        gallery:    [],
        album:      [],
        collection: [],
    };

    /**
     * Monotonic counter used as a tiebreaker when two callbacks share
     * a priority — preserves registration order within a priority bucket.
     *
     * @type {number}
     */
    var callbackSeq = 0;

    /**
     * Initialized collection elements (WeakSet so detached elements GC).
     *
     * @type {WeakSet<Element>}
     */
    var initialized = new WeakSet();

    /**
     * List of initialized collection records, exposed via getInstances().
     * Each record carries the collection kind so late-subscribed callbacks
     * can be replayed only against matching elements.
     *
     * @type {Array<{ element: Element, galleryId: string|null, kind: string }>}
     */
    var instances = [];

    /**
     * The MutationObserver, installed exactly once.
     *
     * @type {MutationObserver|null}
     */
    var collectionObserver = null;

    // -------------------------------------------------------------------------
    // Collection-kind discriminator
    // -------------------------------------------------------------------------

    /**
     * Returns the kind of collection wrapper this element represents.
     * Album wrappers carry the `fotogrids-album` discriminator class;
     * gallery wrappers carry `fotogrids-gallery`. Both also carry the
     * umbrella class `fotogrids-collection`.
     *
     * @param {Element} el
     * @return {string} 'album' or 'gallery'
     */
    function collectionKind( el ) {
        return el && el.classList && el.classList.contains( 'fotogrids-album' ) ? 'album' : 'gallery';
    }

    // -------------------------------------------------------------------------
    // Callback management
    // -------------------------------------------------------------------------

    /**
     * Inserts a callback into the named queue, kept sorted by (priority, seq).
     *
     * @param {string}   queueName One of 'gallery', 'album', 'collection'.
     * @param {Function} cb
     * @param {number}   priority
     */
    function insertCallback( queueName, cb, priority ) {
        var q = queues[ queueName ];
        q.push( { cb: cb, priority: priority, seq: callbackSeq++ } );
        q.sort( function ( a, b ) {
            if ( a.priority !== b.priority ) {
                return a.priority - b.priority;
            }
            return a.seq - b.seq;
        } );
    }

    /**
     * Runs every callback in a queue against a single collection element.
     * Catches and logs any callback error so one broken module can't stop
     * the others.
     *
     * @param {string}  queueName
     * @param {Element} collectionElement
     */
    function runQueue( queueName, collectionElement ) {
        var q = queues[ queueName ];
        for ( var i = 0; i < q.length; i++ ) {
            try {
                q[ i ].cb( collectionElement );
            } catch ( err ) {
                if ( window.console && console.warn ) {
                    console.warn( 'FotoGrids: ' + queueName + ' callback threw', err );
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Collection initialization
    // -------------------------------------------------------------------------

    /**
     * Initializes a single collection element: marks it initialized, records
     * it, runs the matching callback queues against it, then dispatches
     * fotogrids:gallery_initialized.
     *
     * Safe to call multiple times on the same element — second and later
     * calls are no-ops.
     *
     * @param {Element} collectionElement
     */
    function initializeCollection( collectionElement ) {
        if ( ! collectionElement || initialized.has( collectionElement ) ) {
            return;
        }
        initialized.add( collectionElement );

        var kind = collectionKind( collectionElement );

        // The render pipeline writes data-fg-gallery-id on every wrapper
        // (Render_Controller::build_wrapper). Read that, not the legacy
        // data-gallery-id which the pipeline doesn't emit.
        var record = {
            element:   collectionElement,
            galleryId: collectionElement.dataset.fgGalleryId || null,
            kind:      kind,
        };
        instances.push( record );

        // Mark the element so existing CSS / external code can detect it.
        collectionElement.dataset.fotogridsInitialized = '1';

        // Kind-specific queue first, then the always-fires collection queue.
        runQueue( kind, collectionElement );
        runQueue( 'collection', collectionElement );

        document.dispatchEvent( new CustomEvent( 'fotogrids:gallery_initialized', {
            bubbles: true,
            detail:  {
                galleryElement: collectionElement,
                galleryId:      record.galleryId,
                kind:           kind,
                instance:       record,
            },
        } ) );
    }

    /**
     * Finds every collection element in the document and initializes each
     * one. Idempotent — initializeCollection() guards against double init.
     */
    function initializeAllCollections() {
        var elements = document.querySelectorAll( '.fotogrids-collection' );
        for ( var i = 0; i < elements.length; i++ ) {
            initializeCollection( elements[ i ] );
        }
    }

    // -------------------------------------------------------------------------
    // MutationObserver — picks up dynamically inserted collections
    // -------------------------------------------------------------------------

    /**
     * Installs the runtime's single MutationObserver. Feature modules MUST
     * NOT install their own — they subscribe via FotoGrids.onGallery(),
     * onAlbum() or onCollection() and the same callback fires for static
     * and dynamic collections.
     */
    function installObserver() {
        if ( collectionObserver !== null || ! ( 'MutationObserver' in window ) ) {
            return;
        }

        collectionObserver = new MutationObserver( function ( mutations ) {
            for ( var i = 0; i < mutations.length; i++ ) {
                var added = mutations[ i ].addedNodes;
                if ( ! added || added.length === 0 ) {
                    continue;
                }

                for ( var j = 0; j < added.length; j++ ) {
                    var node = added[ j ];
                    if ( ! ( node instanceof Element ) ) {
                        continue;
                    }

                    // The inserted node itself.
                    if ( node.matches && node.matches( '.fotogrids-collection' ) ) {
                        announceInserted( node );
                    }

                    // Collections nested inside the inserted subtree.
                    if ( node.querySelectorAll ) {
                        var nested = node.querySelectorAll( '.fotogrids-collection' );
                        for ( var k = 0; k < nested.length; k++ ) {
                            announceInserted( nested[ k ] );
                        }
                    }
                }
            }
        } );

        collectionObserver.observe( document.body, { childList: true, subtree: true } );
    }

    /**
     * Fires fotogrids:gallery_inserted (preserved legacy event) and then
     * initializes the collection. Skips already-initialized elements.
     *
     * @param {Element} collectionElement
     */
    function announceInserted( collectionElement ) {
        if ( initialized.has( collectionElement ) ) {
            return;
        }

        document.dispatchEvent( new CustomEvent( 'fotogrids:gallery_inserted', {
            bubbles: true,
            detail:  {
                galleryElement: collectionElement,
                galleryId:      collectionElement.dataset.fgGalleryId || null,
                kind:           collectionKind( collectionElement ),
            },
        } ) );

        initializeCollection( collectionElement );
    }

    // -------------------------------------------------------------------------
    // Subscription factory
    // -------------------------------------------------------------------------

    /**
     * Builds a subscription function (onGallery/onAlbum/onCollection).
     * Each returned function inserts into its own queue, validates input,
     * and replays against already-initialized matching instances so late
     * subscribers never miss a collection.
     *
     * @param {string} queueName 'gallery' | 'album' | 'collection'
     * @return {Function}
     */
    function makeSubscriber( queueName ) {
        return function ( cb, priority ) {
            if ( typeof cb !== 'function' ) {
                return;
            }
            var pri = ( typeof priority === 'number' && isFinite( priority ) ) ? priority : 10;
            insertCallback( queueName, cb, pri );

            // Late subscriber — replay against already-initialized instances
            // whose kind matches this queue.
            if ( instances.length === 0 ) {
                return;
            }
            for ( var i = 0; i < instances.length; i++ ) {
                var rec = instances[ i ];
                if ( queueName !== 'collection' && rec.kind !== queueName ) {
                    continue;
                }
                try {
                    cb( rec.element );
                } catch ( err ) {
                    if ( window.console && console.warn ) {
                        console.warn( 'FotoGrids: ' + queueName + ' replay callback threw', err );
                    }
                }
            }
        };
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    var publicApi = {
        version: VERSION,

        /**
         * Subscribe to per-gallery initialization. Fires ONLY for gallery
         * wrappers (`.fotogrids-collection.fotogrids-gallery`).
         *
         * Fires once per gallery — for every gallery present at
         * DOMContentLoaded AND for every gallery the MutationObserver
         * picks up later. If subscribed AFTER galleries are already
         * initialized, the callback is invoked against every existing
         * gallery immediately, so late-loaded modules don't miss them.
         *
         * Lower priority runs first. Same priority preserves registration
         * order.
         *
         * @param {Function} cb       Receives (galleryElement).
         * @param {number} [priority] Default 10.
         */
        onGallery: makeSubscriber( 'gallery' ),

        /**
         * Subscribe to per-album initialization. Fires ONLY for album
         * wrappers (`.fotogrids-collection.fotogrids-album`).
         *
         * Same replay-on-late-subscribe semantics as onGallery.
         *
         * @param {Function} cb       Receives (albumElement).
         * @param {number} [priority] Default 10.
         */
        onAlbum: makeSubscriber( 'album' ),

        /**
         * Subscribe to per-collection initialization. Fires for BOTH
         * galleries and albums — any element matching
         * `.fotogrids-collection`. Use this only when a module genuinely
         * needs to run against both kinds; most modules want onGallery or
         * onAlbum instead.
         *
         * @param {Function} cb       Receives (collectionElement).
         * @param {number} [priority] Default 10.
         */
        onCollection: makeSubscriber( 'collection' ),

        /**
         * Returns the current list of initialized collection records.
         *
         * @return {Array<{ element: Element, galleryId: string|null, kind: string }>}
         */
        getInstances: function () {
            return instances.slice();
        },

        /**
         * Namespace where feature modules register their cross-module APIs.
         * Populated by modules; the runtime itself never reads or writes
         * properties on this object.
         *
         * @type {Object<string, *>}
         */
        modules: {},
    };

    // -------------------------------------------------------------------------
    // Boot
    // -------------------------------------------------------------------------

    function boot() {
        installObserver();
        initializeAllCollections();
        document.dispatchEvent( new CustomEvent( 'fotogrids:ready', { bubbles: true } ) );
    }

    // Expose the API BEFORE booting so module scripts that load earlier in
    // the page (defer) can already call onGallery()/onAlbum()/onCollection()
    // during their own init.
    window.FotoGrids = publicApi;

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', boot );
    } else {
        boot();
    }

} )();
