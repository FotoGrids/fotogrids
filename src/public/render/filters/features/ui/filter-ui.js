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
        let style = this.galleryEl.dataset.fgFilterStyle || 'buttons';

        // Multi-select within a single source. Default true to match the
        // PHP default for `filtering_multiple_enabled`. Dropdowns are
        // inherently single-select and ignore this flag.
        this.multiple = this.galleryEl.dataset.fgFilterMultiple !== 'false';

        if ( style === 'dropdowns' ) {
            this._initDropdowns();
        } else if ( style === 'checkboxes' ) {
            this._initCheckboxes();
        } else {
            this._initButtons();
        }

        // Global "All" reset button.
        let allBtn = this.filterContainer.querySelector( '[data-fg-filter-all]' );
        let self   = this;
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
        const toggleBtn = this.galleryEl.querySelector( '[data-fg-filter-toggle]' );
        if ( toggleBtn ) {
            const container = this.filterContainer;
            toggleBtn.addEventListener( 'click', function () {
                const collapsed = container.getAttribute( 'data-fg-filter-collapsed' ) === 'true';
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


    FilterController.prototype._initButtons = function () {
        let self   = this;
        let groups = this.filterContainer.querySelectorAll( '.fg-filter-group' );

        groups.forEach( function ( group ) {
            let sourceId = group.dataset.fgFilterSource;
            const buttons  = group.querySelectorAll( '[data-fg-filter]' );

            buttons.forEach( function ( btn ) {
                btn.addEventListener( 'click', function () {
                    let value = btn.dataset.fgFilter;

                    if ( self.multiple ) {
                        let state = self.state.get( sourceId );
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
                    } else {
                        // Single-select: clicking an active value clears it,
                        // clicking any other value replaces the set entirely.
                        const current = self.state.get( sourceId );
                        if ( current && current.has( value ) && current.size === 1 ) {
                            self.state.delete( sourceId );
                        } else {
                            self.state.set( sourceId, new Set( [ value ] ) );
                        }
                    }

                    self._apply();
                    self._syncUi();
                } );
            } );

            // Arrow-key keyboard navigation within each button group.
            const btns = Array.prototype.slice.call( group.querySelectorAll( '.fg-filter-btn' ) );
            group.addEventListener( 'keydown', function ( e ) {
                const focused = document.activeElement;
                const idx     = btns.indexOf( focused );
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


    FilterController.prototype._initDropdowns = function () {
        let self   = this;
        let groups = this.filterContainer.querySelectorAll( '.fg-filter-group' );

        groups.forEach( function ( group ) {
            let sourceId = group.dataset.fgFilterSource;
            let dropdown = group.querySelector( '.fg-filter-dropdown' );
            if ( ! dropdown ) return;

            let trigger = dropdown.querySelector( '.fg-filter-dropdown-trigger' );
            const list    = dropdown.querySelector( '.fg-filter-dropdown-list' );
            if ( ! trigger || ! list ) return;

            const open = function () {
                list.classList.add( 'fg-is-open' );
                trigger.setAttribute( 'aria-expanded', 'true' );
                // Close other open dropdowns in this filter bar.
                self.filterContainer.querySelectorAll( '.fg-filter-dropdown-list.fg-is-open' ).forEach( function ( other ) {
                    if ( other !== list ) {
                        other.classList.remove( 'fg-is-open' );
                        const otherTrigger = other.closest( '.fg-filter-dropdown' )
                            && other.closest( '.fg-filter-dropdown' ).querySelector( '.fg-filter-dropdown-trigger' );
                        if ( otherTrigger ) {
                            otherTrigger.setAttribute( 'aria-expanded', 'false' );
                        }
                    }
                } );
            };
            const close = function () {
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
                    let value = option.dataset.fgFilter != null ? option.dataset.fgFilter : '';

                    if ( value === '' ) {
                        // "All" always clears the source and closes,
                        // regardless of multi/single mode.
                        self.state.delete( sourceId );
                        close();
                    } else if ( self.multiple ) {
                        // Multi: toggle this value in/out of the active
                        // set and keep the popover open so the user can
                        // pick more without re-opening.
                        let state = self.state.get( sourceId );
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
                        // No close() - the document-level click handler
                        // closes the popover when the user clicks outside.
                    } else {
                        // Single: clicking the active value clears it,
                        // any other value replaces the set, and the
                        // popover closes either way.
                        const current = self.state.get( sourceId );
                        if ( current && current.has( value ) ) {
                            self.state.delete( sourceId );
                        } else {
                            self.state.set( sourceId, new Set( [ value ] ) );
                        }
                        close();
                    }

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
                        const next = option.nextElementSibling;
                        if ( next ) next.focus();
                    } else if ( e.key === 'ArrowUp' ) {
                        e.preventDefault();
                        const prev = option.previousElementSibling;
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
                    const first = list.querySelector( '.fg-filter-dropdown-option' );
                    if ( first ) first.focus();
                }
            } );
        } );
    };


    FilterController.prototype._initCheckboxes = function () {
        let self   = this;
        let groups = this.filterContainer.querySelectorAll( '.fg-filter-group' );

        groups.forEach( function ( group ) {
            let sourceId   = group.dataset.fgFilterSource;
            const checkboxes = group.querySelectorAll( '[data-fg-filter]' );

            checkboxes.forEach( function ( cb ) {
                cb.addEventListener( 'change', function () {
                    if ( self.multiple ) {
                        let state = self.state.get( sourceId );
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
                    } else {
                        // Single-select: checking a box replaces the set for
                        // this source; unchecking clears the source entirely.
                        // Sibling checkboxes are updated by _syncUi().
                        if ( cb.checked ) {
                            self.state.set( sourceId, new Set( [ cb.value ] ) );
                        } else {
                            self.state.delete( sourceId );
                        }
                    }

                    self._apply();
                    self._syncUi();
                } );
            } );
        } );
    };


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
        const items = this.galleryEl.querySelectorAll( '.fg-item' );

        if ( this.state.size === 0 ) {
            items.forEach( function ( item ) {
                item.classList.remove( 'fg-is-filtered-out' );
                item.removeAttribute( 'aria-hidden' );
            } );
            return;
        }

        let self = this;
        items.forEach( function ( item ) {
            let visible = true;

            self.state.forEach( function ( activeValues, sourceId ) {
                if ( ! visible ) return;
                let group = self.galleryEl.querySelector(
                    '.fg-filter-group[data-fg-filter-source="' + sourceId + '"]'
                );
                let attrKey   = ( group && group.dataset.fgFilterAttr ) || 'data-fg-tags';
                const dsKey     = attrToDatasetKey( attrKey );
                const rawValue  = item.dataset[ dsKey ] || '';
                const tokens    = rawValue !== '' ? new Set( rawValue.split( ' ' ).filter( Boolean ) ) : new Set();

                let sourceMatch = false;
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
        const hasActive = this.state.size > 0;

        let allBtn = this.filterContainer.querySelector( '[data-fg-filter-all]' );
        if ( allBtn ) {
            allBtn.classList.toggle( 'fg-is-active', ! hasActive );
            allBtn.setAttribute( 'aria-pressed', String( ! hasActive ) );
        }

        let style  = this.galleryEl.dataset.fgFilterStyle || 'buttons';
        let self   = this;
        let groups = this.filterContainer.querySelectorAll( '.fg-filter-group' );

        groups.forEach( function ( group ) {
            let sourceId   = group.dataset.fgFilterSource;
            const activeVals = self.state.get( sourceId ) || new Set();

            if ( style === 'dropdowns' ) {
                let dropdown = group.querySelector( '.fg-filter-dropdown' );
                if ( ! dropdown ) return;

                let trigger    = dropdown.querySelector( '.fg-filter-dropdown-trigger' );
                const valueLabel = trigger && trigger.querySelector( '.fg-filter-dropdown-value' );
                const options    = dropdown.querySelectorAll( '.fg-filter-dropdown-option' );

                // Mark every option whose value is in activeVals. When no
                // values are active, the "All" option (data-fg-filter="")
                // is marked active.
                options.forEach( function ( opt ) {
                    const val = opt.dataset.fgFilter != null ? opt.dataset.fgFilter : '';
                    const isActive = val === ''
                        ? activeVals.size === 0
                        : activeVals.has( val );
                    opt.classList.toggle( 'fg-is-active', isActive );
                    opt.setAttribute( 'aria-selected', String( isActive ) );
                } );

                if ( valueLabel ) {
                    let text = '';
                    if ( activeVals.size === 0 ) {
                        const allOpt = dropdown.querySelector( '.fg-filter-dropdown-option[data-fg-filter=""]' );
                        if ( allOpt ) {
                            text = ( allOpt.firstChild && allOpt.firstChild.textContent && allOpt.firstChild.textContent.trim() )
                                || ( allOpt.textContent && allOpt.textContent.trim() )
                                || '';
                        }
                    } else {
                        // Join every active option's label. The first text
                        // node carries the option label; the count badge
                        // is a separate child node we skip.
                        const labels = [];
                        activeVals.forEach( function ( val ) {
                            const opt = dropdown.querySelector(
                                '.fg-filter-dropdown-option[data-fg-filter="' + CSS.escape( val ) + '"]'
                            );
                            if ( ! opt ) return;
                            const t = ( opt.firstChild && opt.firstChild.textContent && opt.firstChild.textContent.trim() )
                                || ( opt.textContent && opt.textContent.trim() )
                                || '';
                            if ( t ) labels.push( t );
                        } );
                        text = labels.join( ', ' );
                    }
                    valueLabel.textContent = text;
                }
            } else if ( style === 'checkboxes' ) {
                group.querySelectorAll( '[data-fg-filter]' ).forEach( function ( cb ) {
                    cb.checked = activeVals.has( cb.value );
                } );
            } else {
                group.querySelectorAll( '[data-fg-filter]' ).forEach( function ( btn ) {
                    const active = activeVals.has( btn.dataset.fgFilter );
                    btn.classList.toggle( 'fg-is-active', active );
                    btn.setAttribute( 'aria-pressed', String( active ) );
                } );
            }
        } );
    };


    function attach( galleryEl ) {
        const filterContainer = galleryEl.querySelector( '.fotogrids-filters' );
        if ( ! filterContainer ) return;

        // Idempotent — the runtime calls every onGallery callback once per
        // gallery, but defensive against duplicate calls (third-party code).
        if ( filterContainer.dataset.fgFiltersReady === 'true' ) return;
        filterContainer.dataset.fgFiltersReady = 'true';

        const controller = new FilterController( galleryEl, filterContainer );
        controller.init();

        // Register the controller against the gallery so other modules
        // (pagination, lightbox) can read current filter state and
        // subscribe to changes.
        registerController( galleryEl, controller );
    }

    /** @type {WeakMap<Element, FilterController>} */
    const controllersByGallery = new WeakMap();

    /** @type {WeakMap<Element, Array<function>>} */
    const changeListeners = new WeakMap();

    function registerController( galleryEl, controller ) {
        controllersByGallery.set( galleryEl, controller );

        // Track the last-seen filter fingerprint so we only fire the
        // change event when filters actually change. Without this, the
        // "All" reset button (and every benign re-apply) would re-trigger
        // a server fetch even though the filter state was unchanged.
        let lastFingerprint = fingerprintActive( buildActiveMap( controller ) );

        const originalApply = controller._apply;
        controller._apply = function () {
            originalApply.call( this );

            const currentMap = buildActiveMap( controller );
            const currentFp  = fingerprintActive( currentMap );

            if ( currentFp === lastFingerprint ) {
                // No actual change — likely a benign re-paint (e.g. user
                // clicked "All" while already cleared, or re-selected
                // an already-active value). Skip notifications.
                return;
            }
            lastFingerprint = currentFp;

            const cbs = changeListeners.get( galleryEl );
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
        const keys = Object.keys( map ).sort();
        const pairs = keys.map( function ( k ) {
            const vals = ( map[ k ] || [] ).slice().sort();
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
        const out = {};
        controller.state.forEach( function ( values, sourceId ) {
            if ( values.size === 0 ) return;
            let group = controller.galleryEl.querySelector(
                '.fg-filter-group[data-fg-filter-source="' + sourceId + '"]'
            );
            let attrKey = group && group.dataset.fgFilterAttr;
            if ( ! attrKey ) return;
            // Convert 'data-fg-tags' → 'tags' (last segment after fg-).
            const m = attrKey.match( /^data-fg-(.+)$/ );
            const argKey = m ? m[1] : '';
            if ( ! argKey ) return;
            out[ argKey ] = Array.from( values );
        } );
        return out;
    }

    function exposeFiltersApi() {
        const FG = window.FotoGrids;
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
                const ctrl = controllersByGallery.get( galleryEl );
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
