/**
 * FotoGrids — Filter UI
 *
 * Owns the entire client-side filter behaviour for galleries that include
 * a .fotogrids-filters bar. Three styles supported: buttons (default),
 * dropdowns, checkboxes. AND across sources, OR within a source.
 *
 * Subscribes to FotoGrids.onGallery — runs once per gallery and idles if
 * the gallery has no filter bar.
 *
 * Replaces the monolithic FotoGridsGallery.initializeFilters() (+ all the
 * private _initFilter*, _applyFilters, _recalculateCounts, _syncFilterUI
 * methods) from frontend/src/index.js.
 *
 * No imports — standalone vanilla JS compiled by webpack.
 */

( function () {
    'use strict';

    /**
     * Per-gallery filter controller. One instance per gallery that has
     * a .fotogrids-filters bar.
     */
    function FilterController( galleryEl, filterContainer ) {
        this.galleryEl       = galleryEl;
        this.filterContainer = filterContainer;
        // Map<sourceId, Set<string>>. An empty Set is removed entirely
        // (size === 0 means no filter for that source).
        this.state = new Map();
    }

    FilterController.prototype.init = function () {
        var style = this.galleryEl.dataset.fgFilterStyle || 'buttons';

        if ( style === 'dropdowns' ) {
            this._initDropdowns();
        } else if ( style === 'checkboxes' ) {
            this._initCheckboxes();
        } else {
            this._initButtons();
        }

        // Global "All" reset button.
        var allBtn = this.filterContainer.querySelector( '[data-fg-filter-all]' );
        var self   = this;
        if ( allBtn ) {
            allBtn.addEventListener( 'click', function () {
                self.state.clear();
                self._apply();
                self._syncUi();
            } );
        }

        // Optional toggle button (lives as a sibling of .fotogrids-filters
        // inside the gallery wrapper, rendered only when
        // filter_display_mode === 'toggle').
        var toggleBtn = this.galleryEl.querySelector( '[data-fg-filter-toggle]' );
        if ( toggleBtn ) {
            var container = this.filterContainer;
            toggleBtn.addEventListener( 'click', function () {
                var collapsed = container.getAttribute( 'data-fg-filter-collapsed' ) === 'true';
                if ( collapsed ) {
                    container.removeAttribute( 'data-fg-filter-collapsed' );
                    toggleBtn.setAttribute( 'aria-expanded', 'true' );
                } else {
                    container.setAttribute( 'data-fg-filter-collapsed', 'true' );
                    toggleBtn.setAttribute( 'aria-expanded', 'false' );
                }
            } );
        }
    };

    // -----------------------------------------------------------------------
    // Style: buttons
    // -----------------------------------------------------------------------

    FilterController.prototype._initButtons = function () {
        var self   = this;
        var groups = this.filterContainer.querySelectorAll( '.fg-filter-group' );

        groups.forEach( function ( group ) {
            var sourceId = group.dataset.fgFilterSource;
            var buttons  = group.querySelectorAll( '[data-fg-filter]' );

            buttons.forEach( function ( btn ) {
                btn.addEventListener( 'click', function () {
                    var value = btn.dataset.fgFilter;
                    var state = self.state.get( sourceId );
                    if ( ! state ) {
                        state = new Set();
                        self.state.set( sourceId, state );
                    }

                    if ( state.has( value ) ) {
                        state.delete( value );
                        if ( state.size === 0 ) {
                            self.state.delete( sourceId );
                        }
                    } else {
                        state.add( value );
                    }

                    self._apply();
                    self._syncUi();
                } );
            } );

            // Arrow-key keyboard navigation within each button group.
            var btns = Array.prototype.slice.call( group.querySelectorAll( '.fg-filter-btn' ) );
            group.addEventListener( 'keydown', function ( e ) {
                var focused = document.activeElement;
                var idx     = btns.indexOf( focused );
                if ( idx === -1 ) return;
                if ( e.key === 'ArrowRight' || e.key === 'ArrowDown' ) {
                    e.preventDefault();
                    btns[ ( idx + 1 ) % btns.length ].focus();
                } else if ( e.key === 'ArrowLeft' || e.key === 'ArrowUp' ) {
                    e.preventDefault();
                    btns[ ( idx - 1 + btns.length ) % btns.length ].focus();
                }
            } );
        } );
    };

    // -----------------------------------------------------------------------
    // Style: dropdowns
    // -----------------------------------------------------------------------

    FilterController.prototype._initDropdowns = function () {
        var self   = this;
        var groups = this.filterContainer.querySelectorAll( '.fg-filter-group' );

        groups.forEach( function ( group ) {
            var sourceId = group.dataset.fgFilterSource;
            var dropdown = group.querySelector( '.fg-filter-dropdown' );
            if ( ! dropdown ) return;

            var trigger = dropdown.querySelector( '.fg-filter-dropdown-trigger' );
            var list    = dropdown.querySelector( '.fg-filter-dropdown-list' );
            if ( ! trigger || ! list ) return;

            var open = function () {
                list.classList.add( 'fg-is-open' );
                trigger.setAttribute( 'aria-expanded', 'true' );
                // Close other open dropdowns in this filter bar.
                self.filterContainer.querySelectorAll( '.fg-filter-dropdown-list.fg-is-open' ).forEach( function ( other ) {
                    if ( other !== list ) {
                        other.classList.remove( 'fg-is-open' );
                        var otherTrigger = other.closest( '.fg-filter-dropdown' )
                            && other.closest( '.fg-filter-dropdown' ).querySelector( '.fg-filter-dropdown-trigger' );
                        if ( otherTrigger ) {
                            otherTrigger.setAttribute( 'aria-expanded', 'false' );
                        }
                    }
                } );
            };
            var close = function () {
                list.classList.remove( 'fg-is-open' );
                trigger.setAttribute( 'aria-expanded', 'false' );
            };

            trigger.addEventListener( 'click', function ( e ) {
                e.stopPropagation();
                if ( list.classList.contains( 'fg-is-open' ) ) {
                    close();
                } else {
                    open();
                }
            } );

            document.addEventListener( 'click', function ( e ) {
                if ( ! dropdown.contains( e.target ) ) close();
            } );

            list.querySelectorAll( '.fg-filter-dropdown-option' ).forEach( function ( option ) {
                option.addEventListener( 'click', function () {
                    var value = option.dataset.fgFilter != null ? option.dataset.fgFilter : '';

                    if ( value === '' ) {
                        self.state.delete( sourceId );
                    } else {
                        var current = self.state.get( sourceId );
                        if ( current && current.has( value ) ) {
                            self.state.delete( sourceId );
                        } else {
                            self.state.set( sourceId, new Set( [ value ] ) );
                        }
                    }

                    close();
                    self._apply();
                    self._syncUi();
                } );

                option.addEventListener( 'keydown', function ( e ) {
                    if ( e.key === 'Enter' || e.key === ' ' ) {
                        e.preventDefault();
                        option.click();
                    } else if ( e.key === 'Escape' ) {
                        close();
                        trigger.focus();
                    } else if ( e.key === 'ArrowDown' ) {
                        e.preventDefault();
                        var next = option.nextElementSibling;
                        if ( next ) next.focus();
                    } else if ( e.key === 'ArrowUp' ) {
                        e.preventDefault();
                        var prev = option.previousElementSibling;
                        if ( prev ) {
                            prev.focus();
                        } else {
                            close();
                            trigger.focus();
                        }
                    }
                } );
            } );

            trigger.addEventListener( 'keydown', function ( e ) {
                if ( e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ' ) {
                    e.preventDefault();
                    open();
                    var first = list.querySelector( '.fg-filter-dropdown-option' );
                    if ( first ) first.focus();
                }
            } );
        } );
    };

    // -----------------------------------------------------------------------
    // Style: checkboxes
    // -----------------------------------------------------------------------

    FilterController.prototype._initCheckboxes = function () {
        var self   = this;
        var groups = this.filterContainer.querySelectorAll( '.fg-filter-group' );

        groups.forEach( function ( group ) {
            var sourceId   = group.dataset.fgFilterSource;
            var checkboxes = group.querySelectorAll( '[data-fg-filter]' );

            checkboxes.forEach( function ( cb ) {
                cb.addEventListener( 'change', function () {
                    var state = self.state.get( sourceId );
                    if ( ! state ) {
                        state = new Set();
                        self.state.set( sourceId, state );
                    }

                    if ( cb.checked ) {
                        state.add( cb.value );
                    } else {
                        state.delete( cb.value );
                        if ( state.size === 0 ) {
                            self.state.delete( sourceId );
                        }
                    }

                    self._apply();
                    self._syncUi();
                } );
            } );
        } );
    };

    // -----------------------------------------------------------------------
    // Filter application + count recalculation
    // -----------------------------------------------------------------------

    /**
     * Convert a data-fg-* attribute name to its dataset key.
     * e.g. "data-fg-tags" → "fgTags".
     */
    function attrToDatasetKey( attrKey ) {
        return attrKey
            .replace( /^data-/, '' )
            .replace( /-([a-z])/g, function ( _, c ) { return c.toUpperCase(); } );
    }

    /**
     * Applies the current filter state to all gallery items.
     *
     * Visibility logic:
     *   • If no source has an active filter set → show all items.
     *   • Otherwise, an item is visible if it satisfies every active
     *     source (AND across sources). Within one source, the item needs
     *     to carry at least one of the active values (OR within source).
     *
     * Show/hide uses class-based toggling (fg-is-filtered-out) rather
     * than style.display so the CSS in filter-ui.scss can transition.
     */
    FilterController.prototype._apply = function () {
        var items = this.galleryEl.querySelectorAll( '.fg-item' );

        if ( this.state.size === 0 ) {
            items.forEach( function ( item ) {
                item.classList.remove( 'fg-is-filtered-out' );
                item.removeAttribute( 'aria-hidden' );
            } );
            return;
        }

        var self = this;
        items.forEach( function ( item ) {
            var visible = true;

            self.state.forEach( function ( activeValues, sourceId ) {
                if ( ! visible ) return;
                var group = self.galleryEl.querySelector(
                    '.fg-filter-group[data-fg-filter-source="' + sourceId + '"]'
                );
                var attrKey   = ( group && group.dataset.fgFilterAttr ) || 'data-fg-tags';
                var dsKey     = attrToDatasetKey( attrKey );
                var rawValue  = item.dataset[ dsKey ] || '';
                var tokens    = rawValue !== '' ? new Set( rawValue.split( ' ' ).filter( Boolean ) ) : new Set();

                var sourceMatch = false;
                activeValues.forEach( function ( v ) {
                    if ( tokens.has( v ) ) sourceMatch = true;
                } );

                if ( ! sourceMatch ) {
                    visible = false;
                }
            } );

            if ( visible ) {
                item.classList.remove( 'fg-is-filtered-out' );
                item.removeAttribute( 'aria-hidden' );
            } else {
                item.classList.add( 'fg-is-filtered-out' );
                item.setAttribute( 'aria-hidden', 'true' );
            }
        } );

        // Counts deliberately NOT recomputed. The server renders each
        // filter option with the count of items in the FULL gallery
        // that carry that value (see Metadata_Filter_Source::get_options).
        // Recomputing here would shift the numbers based on whatever is
        // currently visible — and with pagination, "currently visible"
        // is just page 1, so counts would degrade as filters interact.
        // Stable counts give users a reliable picture of how many items
        // each filter would yield.
    };

    /**
     * Syncs the visual active state of all filter controls to match this.state.
     */
    FilterController.prototype._syncUi = function () {
        var hasActive = this.state.size > 0;

        var allBtn = this.filterContainer.querySelector( '[data-fg-filter-all]' );
        if ( allBtn ) {
            allBtn.classList.toggle( 'fg-is-active', ! hasActive );
            allBtn.setAttribute( 'aria-pressed', String( ! hasActive ) );
        }

        var style  = this.galleryEl.dataset.fgFilterStyle || 'buttons';
        var self   = this;
        var groups = this.filterContainer.querySelectorAll( '.fg-filter-group' );

        groups.forEach( function ( group ) {
            var sourceId   = group.dataset.fgFilterSource;
            var activeVals = self.state.get( sourceId ) || new Set();

            if ( style === 'dropdowns' ) {
                var dropdown = group.querySelector( '.fg-filter-dropdown' );
                if ( ! dropdown ) return;

                var trigger    = dropdown.querySelector( '.fg-filter-dropdown-trigger' );
                var valueLabel = trigger && trigger.querySelector( '.fg-filter-dropdown-value' );
                var options    = dropdown.querySelectorAll( '.fg-filter-dropdown-option' );
                var activeVal  = activeVals.size > 0 ? Array.from( activeVals )[ 0 ] : '';

                options.forEach( function ( opt ) {
                    var val = opt.dataset.fgFilter != null ? opt.dataset.fgFilter : '';
                    var isActive = val === activeVal || ( val === '' && activeVal === '' );
                    opt.classList.toggle( 'fg-is-active', isActive );
                    opt.setAttribute( 'aria-selected', String( isActive ) );
                } );

                if ( valueLabel ) {
                    var activeOpt;
                    if ( activeVal !== '' ) {
                        activeOpt = dropdown.querySelector(
                            '.fg-filter-dropdown-option[data-fg-filter="' + CSS.escape( activeVal ) + '"]'
                        );
                    } else {
                        activeOpt = dropdown.querySelector( '.fg-filter-dropdown-option[data-fg-filter=""]' );
                    }
                    var text = '';
                    if ( activeOpt ) {
                        text = ( activeOpt.firstChild && activeOpt.firstChild.textContent && activeOpt.firstChild.textContent.trim() )
                            || ( activeOpt.textContent && activeOpt.textContent.trim() )
                            || '';
                    }
                    valueLabel.textContent = text;
                }
            } else if ( style === 'checkboxes' ) {
                group.querySelectorAll( '[data-fg-filter]' ).forEach( function ( cb ) {
                    cb.checked = activeVals.has( cb.value );
                } );
            } else {
                group.querySelectorAll( '[data-fg-filter]' ).forEach( function ( btn ) {
                    var active = activeVals.has( btn.dataset.fgFilter );
                    btn.classList.toggle( 'fg-is-active', active );
                    btn.setAttribute( 'aria-pressed', String( active ) );
                } );
            }
        } );
    };

    // -----------------------------------------------------------------------
    // Per-gallery attach
    // -----------------------------------------------------------------------

    function attach( galleryEl ) {
        var filterContainer = galleryEl.querySelector( '.fotogrids-filters' );
        if ( ! filterContainer ) return;

        // Idempotent — the runtime calls every onGallery callback once per
        // gallery, but defensive against duplicate calls (third-party code).
        if ( filterContainer.dataset.fgFiltersReady === 'true' ) return;
        filterContainer.dataset.fgFiltersReady = 'true';

        var controller = new FilterController( galleryEl, filterContainer );
        controller.init();

        // Register the controller against the gallery so other modules
        // (pagination, lightbox) can read current filter state and
        // subscribe to changes.
        registerController( galleryEl, controller );
    }

    // -----------------------------------------------------------------------
    // Cross-module registry — `FotoGrids.modules.filters`
    // -----------------------------------------------------------------------

    /** @type {WeakMap<Element, FilterController>} */
    var controllersByGallery = new WeakMap();

    /** @type {WeakMap<Element, Array<function>>} */
    var changeListeners = new WeakMap();

    function registerController( galleryEl, controller ) {
        controllersByGallery.set( galleryEl, controller );

        // Track the last-seen filter fingerprint so we only fire the
        // change event when filters actually change. Without this, the
        // "All" reset button (and every benign re-apply) would re-trigger
        // a server fetch even though the filter state was unchanged.
        var lastFingerprint = fingerprintActive( buildActiveMap( controller ) );

        var originalApply = controller._apply;
        controller._apply = function () {
            originalApply.call( this );

            var currentMap = buildActiveMap( controller );
            var currentFp  = fingerprintActive( currentMap );

            if ( currentFp === lastFingerprint ) {
                // No actual change — likely a benign re-paint (e.g. user
                // clicked "All" while already cleared, or re-selected
                // an already-active value). Skip notifications.
                return;
            }
            lastFingerprint = currentFp;

            var cbs = changeListeners.get( galleryEl );
            if ( cbs ) {
                cbs.forEach( function ( cb ) {
                    try { cb( currentMap ); } catch ( e ) { /* swallow */ }
                } );
            }
            galleryEl.dispatchEvent( new CustomEvent( 'fotogrids:filters_changed', {
                bubbles: true,
                detail:  { galleryEl: galleryEl, filters: currentMap },
            } ) );
        };
    }

    /**
     * Canonical string fingerprint for a filter map. Used for equality
     * checks ("did anything actually change?") and as a cache key in
     * pagination's filter-view cache.
     *
     * Sorts keys, sorts values within each key — so { tags: ['b','a'] }
     * and { tags: ['a','b'] } produce the same fingerprint.
     *
     * @param {Object.<string,string[]>} map
     * @returns {string}
     */
    function fingerprintActive( map ) {
        var keys = Object.keys( map ).sort();
        var pairs = keys.map( function ( k ) {
            var vals = ( map[ k ] || [] ).slice().sort();
            return k + ':' + vals.join( ',' );
        } );
        return pairs.join( '|' );
    }

    /**
     * Convert the controller's Map<sourceId, Set<value>> into the REST
     * arg-key shape: { tags: ['nature'], people: [...] }. Reads the
     * arg-key from each group's data-fg-filter-attr (e.g. 'data-fg-tags'
     * → 'tags').
     *
     * @param {FilterController} controller
     * @returns {Object.<string, string[]>}
     */
    function buildActiveMap( controller ) {
        var out = {};
        controller.state.forEach( function ( values, sourceId ) {
            if ( values.size === 0 ) return;
            var group = controller.galleryEl.querySelector(
                '.fg-filter-group[data-fg-filter-source="' + sourceId + '"]'
            );
            var attrKey = group && group.dataset.fgFilterAttr;
            if ( ! attrKey ) return;
            // Convert 'data-fg-tags' → 'tags' (last segment after fg-).
            var m = attrKey.match( /^data-fg-(.+)$/ );
            var argKey = m ? m[1] : '';
            if ( ! argKey ) return;
            out[ argKey ] = Array.from( values );
        } );
        return out;
    }

    function exposeFiltersApi() {
        var FG = window.FotoGrids;
        if ( ! FG ) return false;
        if ( ! FG.modules ) FG.modules = {};
        FG.modules.filters = {
            /**
             * Get the active filter map for a gallery, in REST arg shape:
             *   { tags: ['nature'], people: [...] }
             *
             * @param {Element} galleryEl
             * @returns {Object.<string, string[]>}
             */
            getActive: function ( galleryEl ) {
                var ctrl = controllersByGallery.get( galleryEl );
                return ctrl ? buildActiveMap( ctrl ) : {};
            },
            /**
             * Subscribe to filter changes for one gallery. Callback
             * receives the active map. Also: gallery wrappers dispatch
             * a `fotogrids:filters_changed` event with the same payload.
             *
             * @param {Element}  galleryEl
             * @param {function} cb
             */
            onChange: function ( galleryEl, cb ) {
                if ( ! changeListeners.has( galleryEl ) ) {
                    changeListeners.set( galleryEl, [] );
                }
                changeListeners.get( galleryEl ).push( cb );
            },
            /**
             * Canonical string fingerprint for a filter map. Use this as
             * a stable cache key when caching responses keyed by filter
             * state.
             *
             * @param {Object.<string,string[]>} map
             * @returns {string}
             */
            fingerprint: fingerprintActive,
        };
        return true;
    }

    // -----------------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------------

    function init() {
        exposeFiltersApi();

        if ( window.FotoGrids && typeof window.FotoGrids.onGallery === 'function' ) {
            window.FotoGrids.onGallery( attach, 20 );
        }

        // Preserved legacy event so Pro extensions get their hook point.
        document.dispatchEvent( new CustomEvent( 'fotogrids/filters/ready', { bubbles: false } ) );
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }

} )();
