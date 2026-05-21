import './fg-tooltip.scss';

/**
 * FotoGrids Tooltip
 *
 * Lightweight, accessible tooltip for any public-facing FotoGrids surface.
 * Not lightbox-scoped — any frontend module can import and use it.
 *
 * Usage
 * -----
 *   import FgTooltip from './fg-tooltip';           // ES module
 *   FgTooltip.bind( buttonEl, 'Label text' );       // attach to an element
 *   FgTooltip.bind( buttonEl );                     // reads aria-label automatically
 *
 * Or declaratively — any element with [data-fg-tooltip] is picked up automatically
 * when FgTooltip.init() is called (called once by the module on DOMContentLoaded).
 *
 * Positioning
 * -----------
 * The tooltip measures available space in all four directions and places itself
 * in the direction with the most room, falling back to "above" when tied.
 * It is clamped to the viewport on the cross-axis so it never overflows.
 *
 * Accessibility
 * -------------
 * The tooltip element carries role="tooltip". Each bound host element gets a
 * generated aria-describedby pointing at the tooltip id so screen readers
 * announce it on focus. (aria-label on the host is kept untouched — it is the
 * primary label; the tooltip is the visual complement.)
 *
 * Source:  src/public/render/fg-tooltip/fg-tooltip.js
 * Webpack: entry key 'fg-tooltip'  →  assets/js/fg-tooltip.js
 *          (CSS extracted to)        assets/css/fg-tooltip.css
 */

const TOOLTIP_ID    = 'fg-tooltip';
const SHOW_DELAY_MS = 120;
const HIDE_DELAY_MS = 80;
const MARGIN_PX     = 8;   // gap between anchor edge and tooltip
const EDGE_PAD_PX   = 6;   // minimum distance from viewport edge

/** @type {HTMLElement|null} */
let tooltipEl   = null;
let showTimer   = null;
let hideTimer   = null;
let activeHost  = null;

// ---------------------------------------------------------------------------
// Tooltip element
// ---------------------------------------------------------------------------

/**
 * Returns the singleton tooltip element, creating it on first call.
 *
 * If the host lives inside a <dialog> element, the tooltip is re-parented
 * into that dialog so it inherits the browser's top-layer rendering — a
 * tooltip appended to <body> is invisible behind an open <dialog> regardless
 * of z-index, because <dialog> establishes its own top-layer stacking context.
 *
 * @param {Element|null} [host] The element the tooltip is being shown for.
 * @returns {HTMLElement}
 */
function getTooltipEl( host ) {
    if ( ! tooltipEl ) {
        tooltipEl = document.createElement( 'div' );
        tooltipEl.id        = TOOLTIP_ID;
        tooltipEl.className = 'fg-tooltip';
        tooltipEl.role      = 'tooltip';
        tooltipEl.hidden    = true;
        tooltipEl.setAttribute( 'aria-hidden', 'true' );

        // Hide on scroll / resize so stale positions don't linger.
        window.addEventListener( 'scroll',  hideImmediately, { passive: true, capture: true } );
        window.addEventListener( 'resize',  hideImmediately, { passive: true } );
    }

    // Re-parent into a dialog if the host is inside one, otherwise into body.
    // This is necessary because an open <dialog> renders in the browser top layer
    // and any fixed/absolute element outside it is painted behind it.
    const targetParent = host ? ( host.closest( 'dialog' ) || document.body ) : document.body;
    if ( tooltipEl.parentElement !== targetParent ) {
        targetParent.appendChild( tooltipEl );
    }

    return tooltipEl;
}

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

/**
 * Position the tooltip relative to a host element.
 * Picks the direction with the most available space, or uses a forced direction
 * when the host carries [data-fg-tooltip-dir].
 *
 * @param {HTMLElement} host
 */
function position( host ) {
    const el   = getTooltipEl( host );
    const rect = host.getBoundingClientRect();
    const vw   = window.innerWidth  || document.documentElement.clientWidth;
    const vh   = window.innerHeight || document.documentElement.clientHeight;

    // Measure the tooltip (it must be visible to measure).
    el.hidden = false;
    el.style.transform = 'none';    // reset so clientWidth is accurate
    el.style.top  = '0';
    el.style.left = '0';
    const tw = el.offsetWidth;
    const th = el.offsetHeight;

    // Available space in each direction (gap included).
    const space = {
        above: rect.top    - MARGIN_PX,
        below: vh - rect.bottom - MARGIN_PX,
        left:  rect.left   - MARGIN_PX,
        right: vw - rect.right  - MARGIN_PX,
    };

    // Honour a forced direction from the host element; fall back to auto-pick.
    const forced = host.dataset.fgTooltipDir;
    const dir    = ( forced && space[ forced ] !== undefined )
        ? forced
        : Object.keys( space ).reduce( ( best, d ) => space[ d ] > space[ best ] ? d : best, 'above' );

    let top, left;

    if ( dir === 'above' || dir === 'below' ) {
        // Horizontally centred on host; clamped to viewport.
        left = rect.left + rect.width / 2 - tw / 2;
        left = Math.max( EDGE_PAD_PX, Math.min( left, vw - tw - EDGE_PAD_PX ) );
        top  = dir === 'above'
            ? rect.top    - th - MARGIN_PX
            : rect.bottom      + MARGIN_PX;
    } else {
        // Vertically centred on host; clamped to viewport.
        top  = rect.top + rect.height / 2 - th / 2;
        top  = Math.max( EDGE_PAD_PX, Math.min( top, vh - th - EDGE_PAD_PX ) );
        left = dir === 'left'
            ? rect.left  - tw - MARGIN_PX
            : rect.right      + MARGIN_PX;
    }

    // Use fixed positioning (relative to viewport).
    el.style.position = 'fixed';
    el.style.top      = `${Math.round( top )}px`;
    el.style.left     = `${Math.round( left )}px`;

    // Data attribute for the entrance animation direction.
    el.dataset.dir = dir;
}

// ---------------------------------------------------------------------------
// Show / hide
// ---------------------------------------------------------------------------

function showImmediately( host, label ) {
    const el = getTooltipEl( host );
    el.textContent = label;
    el.hidden      = false;
    el.removeAttribute( 'aria-hidden' );
    el.classList.add( 'fg-tooltip--visible' );
    position( host );
    activeHost = host;
}

function hideImmediately() {
    if ( ! tooltipEl ) return;
    tooltipEl.hidden  = true;
    tooltipEl.setAttribute( 'aria-hidden', 'true' );
    tooltipEl.classList.remove( 'fg-tooltip--visible' );
    tooltipEl.dataset.dir = '';
    activeHost = null;
}

function scheduleShow( host, label ) {
    clearTimeout( hideTimer );
    clearTimeout( showTimer );
    showTimer = setTimeout( () => showImmediately( host, label ), SHOW_DELAY_MS );
}

function scheduleHide() {
    clearTimeout( showTimer );
    hideTimer = setTimeout( hideImmediately, HIDE_DELAY_MS );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bind tooltip behaviour to an element.
 *
 * @param {HTMLElement}  host
 * @param {string}       [label]        Tooltip text. Falls back to aria-label, then title.
 * @param {object}       [opts]
 * @param {string}       [opts.dir]     Force a placement direction: 'above'|'below'|'left'|'right'.
 *                                      Stored on the host as data-fg-tooltip-dir so position() honours it.
 */
function bind( host, label, opts ) {
    if ( ! ( host instanceof Element ) ) return;

    // Store forced direction so position() can read it.
    if ( opts?.dir ) {
        host.dataset.fgTooltipDir = opts.dir;
    }

    // Closure over a label resolver so dynamic aria-label changes are respected.
    const getLabel = () =>
        label ||
        host.getAttribute( 'aria-label' ) ||
        host.getAttribute( 'title' ) ||
        '';

    // Wire the tooltip id as aria-describedby so AT announce it on focus.
    const el = getTooltipEl();
    host.setAttribute( 'aria-describedby', el.id );

    const onEnter = () => { const l = getLabel(); if ( l ) scheduleShow( host, l ); };
    const onLeave = () => scheduleHide();
    const onFocus = () => { const l = getLabel(); if ( l ) showImmediately( host, l ); };
    const onBlur  = () => hideImmediately();

    host.addEventListener( 'mouseenter', onEnter );
    host.addEventListener( 'mouseleave', onLeave );
    host.addEventListener( 'focus',      onFocus );
    host.addEventListener( 'blur',       onBlur  );

    // Mark as bound so init() skips re-binding on subsequent calls.
    host.dataset.fgTooltipBound = '1';
}

/**
 * Refresh the visible tooltip label if `host` is currently the active host.
 * Call this after changing aria-label on a button whose tooltip may already
 * be showing (e.g. after a toggle action).
 *
 * @param {HTMLElement} host
 */
function refresh( host ) {
    if ( activeHost !== host || ! tooltipEl || tooltipEl.hidden ) return;
    const label = host.getAttribute( 'aria-label' ) || host.getAttribute( 'title' ) || '';
    if ( label ) {
        tooltipEl.textContent = label;
        position( host );
    } else {
        hideImmediately();
    }
}

/**
 * Declarative init — bind all [data-fg-tooltip] elements in the given root.
 * Safe to call multiple times; already-bound elements are skipped.
 *
 * @param {Element|Document} [root=document]
 */
function init( root ) {
    root = root || document;
    root.querySelectorAll( '[data-fg-tooltip]:not([data-fg-tooltip-bound])' ).forEach( ( el ) => {
        bind( el, el.dataset.fgTooltip || undefined );
    } );
}

// Auto-init on DOMContentLoaded for declarative usage.
if ( document.readyState === 'loading' ) {
    document.addEventListener( 'DOMContentLoaded', () => init() );
} else {
    init();
}

// Expose as a global so other separately-bundled entries (lightbox, frontend, etc.)
// can access it without ES module coupling across webpack entry points.
window.FgTooltip = { bind, init, refresh, showImmediately, hideImmediately };
