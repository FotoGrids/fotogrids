/**
 * FotoGrids — Shared layout helpers.
 *
 * Pure ES module imported by the per-layout JS bundles (justified, masonry,
 * any future JS-positioned layout). Exports primitives for reading
 * intrinsic image dimensions, computing CSS-resolved values, and a
 * `createLayoutAttach` factory that wires up the standard set of
 * per-collection events every JS layout needs to subscribe to.
 *
 * No imports — pure helpers, no DOM mutation outside of the explicit
 * `revealItems` helper. Consumers own their own per-item positioning.
 */

const RESIZE_DEBOUNCE_MS = 120;

/**
 * Returns the item's aspect ratio (w / h). Prefers explicit width/height
 * attributes on the <img>, falling back to naturalWidth/naturalHeight,
 * and finally a sane 3/2 default.
 *
 * @param {HTMLElement} itemEl
 * @return {number}
 */
export function aspectRatioFor( itemEl ) {
    const img = itemEl.querySelector( 'img' );
    if ( ! img ) return 1.5;

    const attrW = parseInt( img.getAttribute( 'width' ), 10 );
    const attrH = parseInt( img.getAttribute( 'height' ), 10 );
    if ( attrW > 0 && attrH > 0 ) {
        return attrW / attrH;
    }

    if ( img.naturalWidth > 0 && img.naturalHeight > 0 ) {
        return img.naturalWidth / img.naturalHeight;
    }

    return 1.5;
}

/**
 * Resolves once every image inside `items` has either explicit
 * width/height attributes or has fully loaded. Returns immediately when
 * every image already has dimensions known.
 *
 * @param {HTMLElement[]} items
 * @return {Promise<void>}
 */
export function waitForDimensions( items ) {
    const pending = [];
    for ( let i = 0; i < items.length; i++ ) {
        const img = items[ i ].querySelector( 'img' );
        if ( ! img ) continue;

        const attrW = parseInt( img.getAttribute( 'width' ), 10 );
        const attrH = parseInt( img.getAttribute( 'height' ), 10 );
        if ( attrW > 0 && attrH > 0 ) continue;
        if ( img.complete && img.naturalWidth > 0 ) continue;

        pending.push( new Promise( ( resolve ) => {
            const done = () => {
                img.removeEventListener( 'load', done );
                img.removeEventListener( 'error', done );
                resolve();
            };
            img.addEventListener( 'load', done );
            img.addEventListener( 'error', done );
        } ) );
    }

    if ( pending.length === 0 ) {
        return Promise.resolve();
    }
    return Promise.all( pending ).then( () => undefined );
}

/**
 * Reads the computed `gap` value off a flex/grid container. Returns 0
 * when unset or unparsable.
 *
 * @param {HTMLElement} trackEl
 * @return {number}
 */
export function readTrackGap( trackEl ) {
    const raw = window.getComputedStyle( trackEl ).gap;
    if ( ! raw ) return 0;
    const parsed = parseFloat( raw );
    return isNaN( parsed ) ? 0 : parsed;
}

/**
 * Reads a CSS variable resolved against the given element. Returns the
 * supplied fallback when the variable is unset or non-positive. Use
 * for values where zero is meaningless (row heights, column minimums).
 *
 * @param {HTMLElement} el
 * @param {string} name CSS variable name (including the leading `--`).
 * @param {number} fallback
 * @return {number}
 */
export function readCssNumber( el, name, fallback ) {
    const raw = window.getComputedStyle( el ).getPropertyValue( name );
    if ( ! raw ) return fallback;
    const parsed = parseFloat( raw );
    return isNaN( parsed ) || parsed <= 0 ? fallback : parsed;
}

/**
 * Reads a CSS variable as a non-negative length. Allows zero. Used for
 * values like gap / spacing where a user-chosen zero is intentional.
 *
 * @param {HTMLElement} el
 * @param {string} name CSS variable name (including the leading `--`).
 * @param {number} fallback Returned when the variable is unset or invalid.
 * @return {number}
 */
export function readCssLength( el, name, fallback ) {
    const raw = window.getComputedStyle( el ).getPropertyValue( name );
    if ( ! raw ) return fallback;
    const parsed = parseFloat( raw );
    return isNaN( parsed ) || parsed < 0 ? fallback : parsed;
}

/**
 * Reads a CSS variable as an integer count. Returns the fallback when
 * unset or non-numeric.
 *
 * @param {HTMLElement} el
 * @param {string} name
 * @param {number} fallback
 * @return {number}
 */
export function readCssInteger( el, name, fallback ) {
    const raw = window.getComputedStyle( el ).getPropertyValue( name );
    if ( ! raw ) return fallback;
    const parsed = parseInt( raw, 10 );
    return isNaN( parsed ) || parsed <= 0 ? fallback : parsed;
}

/**
 * Whether the collection has more pages after the current one. Used by
 * layouts to decide whether the visible trailing row/column is the
 * gallery's actual final row or a paginated intermediate.
 *
 * @param {HTMLElement} collectionEl
 * @return {boolean}
 */
export function hasNextPage( collectionEl ) {
    const current = parseInt( collectionEl.dataset.fgPageCurrent || '0', 10 );
    const total   = parseInt( collectionEl.dataset.fgPageTotal   || '0', 10 );
    if ( isNaN( current ) || isNaN( total ) || current <= 0 || total <= 0 ) {
        return false;
    }
    return current < total;
}

/**
 * Returns the non-filtered items inside `trackEl` in DOM order.
 *
 * @param {HTMLElement} trackEl
 * @return {HTMLElement[]}
 */
export function visibleItems( trackEl ) {
    const all = Array.prototype.slice.call(
        trackEl.querySelectorAll( ':scope > .fg-item' )
    );
    return all.filter( ( el ) => ! el.classList.contains( 'fg-is-filtered-out' ) );
}

/**
 * Distribute cumulative-float rounding across `n` slots so the integer
 * widths sum exactly to the integer `containerWidth - totalGap`. Returns
 * an array of integer widths.
 *
 * Each `weights[i]` represents the proportional share of slot i in the
 * total. (For justified rows: weight = aspect ratio. For masonry
 * columns: weight = 1 for each column.)
 *
 * @param {number[]} weights
 * @param {number} availableWidth Float pixel width to distribute.
 * @return {number[]} Integer pixel widths whose sum equals round(availableWidth).
 */
export function distributeIntegers( weights, availableWidth ) {
    const total = weights.reduce( ( sum, w ) => sum + ( w > 0 ? w : 0 ), 0 );
    if ( total <= 0 || weights.length === 0 ) {
        return weights.map( () => 0 );
    }

    const result = new Array( weights.length );
    let cumulativeFloat = 0;
    let cumulativeInt   = 0;

    for ( let i = 0; i < weights.length; i++ ) {
        cumulativeFloat += ( weights[ i ] / total ) * availableWidth;
        const cumulativeRounded = Math.round( cumulativeFloat );
        result[ i ] = cumulativeRounded - cumulativeInt;
        cumulativeInt = cumulativeRounded;
    }

    return result;
}

/**
 * Remove the fg-item-hidden class from every item in the supplied
 * collection. Used after first successful layout to reveal items.
 *
 * @param {HTMLElement[]} items
 */
export function revealItems( items ) {
    for ( let i = 0; i < items.length; i++ ) {
        items[ i ].classList.remove( 'fg-item-hidden' );
    }
}

/**
 * Creates the standard attach() function used by JS-positioned layout
 * modules. Wires up:
 *
 *   - dataset-key guard so each collection is wired exactly once
 *   - track lookup via opts.trackSelector
 *   - initial waitForDimensions + opts.layoutFn(trackEl)
 *   - ResizeObserver with debounced re-layout
 *   - `fotogrids:items_inserted` re-layout
 *   - `fotogrids:filters_changed` re-layout
 *
 * After every layoutFn call the helper removes fg-item-hidden from every
 * (currently visible) item so revealed items become visible.
 *
 * @param {{
 *   collectionSelector: string,
 *   trackSelector: string,
 *   readyKey: string,
 *   layoutFn: (trackEl: HTMLElement) => void,
 * }} opts
 * @return {(collectionEl: HTMLElement) => void}
 */
export function createLayoutAttach( opts ) {
    const { collectionSelector, trackSelector, readyKey, layoutFn } = opts;

    /** @type {WeakMap<Element, { resizeTimer: number|null, observer: ResizeObserver|null, lastWidth: number }>} */
    const trackState = new WeakMap();

    function scheduleLayout( trackEl ) {
        const state = trackState.get( trackEl );
        if ( ! state ) return;
        if ( state.resizeTimer !== null ) {
            window.clearTimeout( state.resizeTimer );
        }
        state.resizeTimer = window.setTimeout( () => {
            state.resizeTimer = null;
            runLayoutAndReveal( trackEl );
        }, RESIZE_DEBOUNCE_MS );
    }

    function runLayoutAndReveal( trackEl ) {
        layoutFn( trackEl );
        const items = Array.prototype.slice.call(
            trackEl.querySelectorAll( ':scope > .fg-item' )
        );
        revealItems( items );
    }

    return function attach( collectionEl ) {
        if ( ! collectionEl.matches( collectionSelector ) ) return;
        if ( collectionEl.dataset[ readyKey ] === '1' ) return;
        collectionEl.dataset[ readyKey ] = '1';

        const trackEl = collectionEl.querySelector( trackSelector );
        if ( ! trackEl ) return;

        const state = { resizeTimer: null, observer: null, lastWidth: 0 };
        trackState.set( trackEl, state );

        const items = Array.prototype.slice.call(
            trackEl.querySelectorAll( ':scope > .fg-item' )
        );

        waitForDimensions( items ).then( () => {
            runLayoutAndReveal( trackEl );
        } );

        if ( typeof window.ResizeObserver === 'function' ) {
            state.observer = new window.ResizeObserver( ( entries ) => {
                for ( let i = 0; i < entries.length; i++ ) {
                    const width = entries[ i ].contentRect.width;
                    if ( Math.abs( width - state.lastWidth ) < 1 ) continue;
                    state.lastWidth = width;
                    scheduleLayout( trackEl );
                }
            } );
            state.observer.observe( trackEl );
        } else {
            window.addEventListener( 'resize', () => {
                scheduleLayout( trackEl );
            } );
        }

        collectionEl.addEventListener( 'fotogrids:items_inserted', ( event ) => {
            const inserted = event.detail && event.detail.items;
            if ( ! inserted || inserted.length === 0 ) {
                scheduleLayout( trackEl );
                return;
            }
            waitForDimensions( Array.prototype.slice.call( inserted ) ).then( () => {
                runLayoutAndReveal( trackEl );
            } );
        } );

        collectionEl.addEventListener( 'fotogrids:filters_changed', () => {
            scheduleLayout( trackEl );
        } );
    };
}

/**
 * Subscribes the supplied attach function to the FotoGrids runtime via
 * onCollection (preferred) or onGallery (fallback). Handles the
 * DOMContentLoaded gate.
 *
 * @param {(el: HTMLElement) => void} attach
 * @param {number} [priority] Default 10.
 */
export function bootLayout( attach, priority = 10 ) {
    function init() {
        if ( ! window.FotoGrids ) return;
        if ( typeof window.FotoGrids.onCollection === 'function' ) {
            window.FotoGrids.onCollection( attach, priority );
        } else if ( typeof window.FotoGrids.onGallery === 'function' ) {
            window.FotoGrids.onGallery( attach, priority );
        }
    }

    if ( document.readyState === 'loading' ) {
        document.addEventListener( 'DOMContentLoaded', init );
    } else {
        init();
    }
}
