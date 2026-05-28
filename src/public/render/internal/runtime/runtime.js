/**
 * FotoGrids Frontend Runtime
 *
 * The minimum amount of JavaScript that must be present on any page
 * rendering a FotoGrids gallery. It does NOT implement any feature — no
 * filters, no lightbox, no sharing, no masonry, no stats, no password
 * gate. Its sole job is to discover gallery elements and announce them
 * so the per-feature modules can attach to each one.
 *
 * See README.md in this directory for the full contract.
 *
 * No imports — standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    var VERSION = '1.0.0';

    // -------------------------------------------------------------------------
    // Internal state
    // -------------------------------------------------------------------------

    /**
     * Registered onGallery callbacks, kept sorted by priority ascending.
     *
     * @type {Array<{ cb: Function, priority: number, seq: number }>}
     */
    var callbacks = [];

    /**
     * Monotonic counter used as a tiebreaker when two callbacks share
     * a priority — preserves registration order within a priority bucket.
     *
     * @type {number}
     */
    var callbackSeq = 0;

    /**
     * Initialized gallery elements (WeakSet so detached elements GC).
     *
     * @type {WeakSet<Element>}
     */
    var initialized = new WeakSet();

    /**
     * List of initialized gallery records, exposed via getInstances().
     *
     * @type {Array<{ element: Element, galleryId: string|null }>}
     */
    var instances = [];

    /**
     * The MutationObserver, installed exactly once.
     *
     * @type {MutationObserver|null}
     */
    var galleryObserver = null;

    // -------------------------------------------------------------------------
    // Callback management
    // -------------------------------------------------------------------------

    /**
     * Inserts a callback into the queue, kept sorted by (priority, seq).
     *
     * @param {Function} cb
     * @param {number} priority
     */
    function insertCallback( cb, priority ) {
        callbacks.push( { cb: cb, priority: priority, seq: callbackSeq++ } );
        callbacks.sort( function ( a, b ) {
            if ( a.priority !== b.priority ) {
                return a.priority - b.priority;
            }
            return a.seq - b.seq;
        } );
    }

    /**
     * Runs every registered callback against a single gallery element.
     * Catches and logs any callback error so one broken module can't
     * stop the others.
     *
     * @param {Element} galleryElement
     */
    function runCallbacks( galleryElement ) {
        for ( var i = 0; i < callbacks.length; i++ ) {
            try {
                callbacks[ i ].cb( galleryElement );
            } catch ( err ) {
                if ( window.console && console.warn ) {
                    console.warn( 'FotoGrids: onGallery callback threw', err );
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Gallery initialization
    // -------------------------------------------------------------------------

    /**
     * Initializes a single gallery element: marks it initialized, records it,
     * runs every registered callback against it, then dispatches
     * fotogrids:gallery_initialized.
     *
     * Safe to call multiple times on the same element — second and later
     * calls are no-ops.
     *
     * @param {Element} galleryElement
     */
    function initializeGallery( galleryElement ) {
        if ( ! galleryElement || initialized.has( galleryElement ) ) {
            return;
        }
        initialized.add( galleryElement );

        // The render pipeline writes data-fg-gallery-id on every wrapper
        // (Render_Controller::build_wrapper). Read that, not the legacy
        // data-gallery-id which the pipeline doesn't emit.
        var record = {
            element:   galleryElement,
            galleryId: galleryElement.dataset.fgGalleryId || null,
        };
        instances.push( record );

        // Mark the element so existing CSS / external code can detect it.
        galleryElement.dataset.fotogridsInitialized = '1';

        runCallbacks( galleryElement );

        document.dispatchEvent( new CustomEvent( 'fotogrids:gallery_initialized', {
            bubbles: true,
            detail:  {
                galleryElement: galleryElement,
                galleryId:      record.galleryId,
                instance:       record,
            },
        } ) );
    }

    /**
     * Finds every .fotogrids-gallery element in the document and initializes
     * each one. Idempotent — initializeGallery() guards against double init.
     */
    function initializeAllGalleries() {
        var elements = document.querySelectorAll( '.fotogrids-gallery' );
        for ( var i = 0; i < elements.length; i++ ) {
            initializeGallery( elements[ i ] );
        }
    }

    // -------------------------------------------------------------------------
    // MutationObserver — picks up dynamically inserted galleries
    // -------------------------------------------------------------------------

    /**
     * Installs the runtime's single MutationObserver. Feature modules MUST
     * NOT install their own — they subscribe via FotoGrids.onGallery() and
     * the same callback fires for static and dynamic galleries.
     */
    function installObserver() {
        if ( galleryObserver !== null || ! ( 'MutationObserver' in window ) ) {
            return;
        }

        galleryObserver = new MutationObserver( function ( mutations ) {
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
                    if ( node.matches && node.matches( '.fotogrids-gallery' ) ) {
                        announceInserted( node );
                    }

                    // Galleries nested inside the inserted subtree.
                    if ( node.querySelectorAll ) {
                        var nested = node.querySelectorAll( '.fotogrids-gallery' );
                        for ( var k = 0; k < nested.length; k++ ) {
                            announceInserted( nested[ k ] );
                        }
                    }
                }
            }
        } );

        galleryObserver.observe( document.body, { childList: true, subtree: true } );
    }

    /**
     * Fires fotogrids:gallery_inserted (preserved legacy event) and then
     * initializes the gallery. Skips already-initialized elements.
     *
     * @param {Element} galleryElement
     */
    function announceInserted( galleryElement ) {
        if ( initialized.has( galleryElement ) ) {
            return;
        }

        document.dispatchEvent( new CustomEvent( 'fotogrids:gallery_inserted', {
            bubbles: true,
            detail:  {
                galleryElement: galleryElement,
                galleryId:      galleryElement.dataset.fgGalleryId || null,
            },
        } ) );

        initializeGallery( galleryElement );
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    var publicApi = {
        version: VERSION,

        /**
         * Subscribe to per-gallery initialization.
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
        onGallery: function ( cb, priority ) {
            if ( typeof cb !== 'function' ) {
                return;
            }
            var pri = ( typeof priority === 'number' && isFinite( priority ) ) ? priority : 10;
            insertCallback( cb, pri );

            // Late subscriber — replay against galleries already initialized,
            // so the callback never misses a gallery just because a module
            // loaded after DOMContentLoaded.
            if ( instances.length > 0 ) {
                for ( var i = 0; i < instances.length; i++ ) {
                    try {
                        cb( instances[ i ].element );
                    } catch ( err ) {
                        if ( window.console && console.warn ) {
                            console.warn( 'FotoGrids: onGallery replay callback threw', err );
                        }
                    }
                }
            }
        },

        /**
         * Returns the current list of initialized gallery records.
         *
         * @return {Array<{ element: Element, galleryId: string|null }>}
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
        initializeAllGalleries();
        document.dispatchEvent( new CustomEvent( 'fotogrids:ready', { bubbles: true } ) );
    }

    // Expose the API BEFORE booting so module scripts that load earlier in
    // the page (defer) can already call onGallery() during their own init.
    window.FotoGrids = publicApi;

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', boot );
    } else {
        boot();
    }

} )();
