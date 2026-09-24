import './fg-tooltip.scss';

/**
 * FotoGrids Tooltip
 *
 * Lightweight, accessible tooltip for any public-facing FotoGrids surface.
 * Not lightbox-scoped - any frontend module can import and use it.
 *
 * Usage
 * -----
 *   import FgTooltip from './fg-tooltip';           // ES module
 *   FgTooltip.bind( buttonEl, 'Label text' );       // attach to an element
 *   FgTooltip.bind( buttonEl );                     // reads aria-label automatically
 *
 * Or declaratively - any element with [data-fg-tooltip] is picked up automatically
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
 * announce it on focus. (aria-label on the host is kept untouched - it is the
 * primary label; the tooltip is the visual complement.)
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

/**
 * True when the tooltip is in interactive mode - pointer-events enabled,
 * mouseleave does NOT auto-hide, dismissal happens via outside-click or
 * Escape. Set by showInteractive(); cleared by hideImmediately().
 *
 * @type {boolean}
 */
let interactiveMode = false;

/**
 * Outside-click handler installed when interactive mode opens, removed
 * when it closes. Module-level so the same function instance can be removed.
 *
 * @type {((e: MouseEvent) => void) | null}
 */
let interactiveOutsideClick = null;

/**
 * Keydown handler installed when interactive mode opens (Escape dismiss).
 *
 * @type {((e: KeyboardEvent) => void) | null}
 */
let interactiveKeydown = null;

/**
 * Pending timer for the morph fade-out leg (text → interactive). Tracked
 * so close-during-morph can cancel a stale finishOpen.
 *
 * @type {number|null}
 */
let interactiveSwapTimer = null;


/**
 * Returns the singleton tooltip element, creating it on first call.
 *
 * If the host lives inside a <dialog> element, the tooltip is re-parented
 * into that dialog so it inherits the browser's top-layer rendering - a
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
        tooltipEl.className = 'fg-f-tooltip';
        tooltipEl.role      = 'tooltip';
        tooltipEl.hidden    = true;
        tooltipEl.setAttribute( 'aria-hidden', 'true' );

        // Hide on scroll / resize so stale positions don't linger.
        // Interactive mode opts out - see hideOnScrollOrResize().
        window.addEventListener( 'scroll',  hideOnScrollOrResize, { passive: true, capture: true } );
        window.addEventListener( 'resize',  hideOnScrollOrResize, { passive: true } );
    }

    // Re-parent into a dialog if the host is inside one, otherwise into body.
    const targetParent = host ? ( host.closest( 'dialog' ) || document.body ) : document.body;
    if ( tooltipEl.parentElement !== targetParent ) {
        targetParent.appendChild( tooltipEl );
    }

    return tooltipEl;
}


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
    // Arrow offset in tooltip-local coordinates, published as --fg-tt-arrow-x/y
    // so the arrow stays on the host when the body is clamped to the viewport.
    let arrowX = null;
    let arrowY = null;

    // Minimum arrow inset from the tooltip's rounded corners.
    const ARROW_HALF = 6;            // matches --fg-tt-arrow-size default
    const ARROW_INSET = ARROW_HALF + 4;

    if ( dir === 'above' || dir === 'below' ) {
        // Horizontally centred on host; clamped to viewport.
        left = rect.left + rect.width / 2 - tw / 2;
        left = Math.max( EDGE_PAD_PX, Math.min( left, vw - tw - EDGE_PAD_PX ) );
        top  = dir === 'above'
            ? rect.top    - th - MARGIN_PX
            : rect.bottom      + MARGIN_PX;

        // Arrow x in tooltip-local coordinates = host centre - tooltip left.
        const hostCentreX = rect.left + rect.width / 2;
        arrowX = hostCentreX - left;
        // Keep the arrow inside the tooltip's rounded chrome.
        arrowX = Math.max( ARROW_INSET, Math.min( arrowX, tw - ARROW_INSET ) );
    } else {
        // Vertically centred on host; clamped to viewport.
        top  = rect.top + rect.height / 2 - th / 2;
        top  = Math.max( EDGE_PAD_PX, Math.min( top, vh - th - EDGE_PAD_PX ) );
        left = dir === 'left'
            ? rect.left  - tw - MARGIN_PX
            : rect.right      + MARGIN_PX;

        // Arrow y in tooltip-local coordinates = host centre - tooltip top.
        const hostCentreY = rect.top + rect.height / 2;
        arrowY = hostCentreY - top;
        arrowY = Math.max( ARROW_INSET, Math.min( arrowY, th - ARROW_INSET ) );
    }

    el.style.position = 'fixed';
    el.style.top      = `${Math.round( top )}px`;
    el.style.left     = `${Math.round( left )}px`;

    // The CSS falls back to 50% while these are unset.
    if ( arrowX !== null ) {
        el.style.setProperty( '--fg-tt-arrow-x', `${Math.round( arrowX )}px` );
        el.style.removeProperty( '--fg-tt-arrow-y' );
    } else if ( arrowY !== null ) {
        el.style.setProperty( '--fg-tt-arrow-y', `${Math.round( arrowY )}px` );
        el.style.removeProperty( '--fg-tt-arrow-x' );
    }

    el.dataset.dir = dir;
}


function showImmediately( host, label ) {
    // An open interactive popover owns the tooltip; hovering a child with its
    // own text tooltip must not replace the popover content.
    if ( interactiveMode ) return;

    const el = getTooltipEl( host );
    el.textContent = label;
    el.hidden      = false;
    el.removeAttribute( 'aria-hidden' );
    el.classList.add( 'fg-f-tooltip--visible' );
    position( host );
    activeHost = host;
}

/**
 * Internal hide - actually closes the tooltip. Does NOT check
 * interactive mode; reserved for dismissal paths that have already
 * decided to close (outside-click handler, Escape handler, explicit
 * hideInteractive call).
 *
 * The public `hideImmediately` short-circuits when interactive mode is
 * open - see below.
 */
function reallyHide() {
    if ( ! tooltipEl ) return;

    // Cancel a pending morph so a stale finishOpen cannot reopen the tooltip.
    if ( interactiveSwapTimer !== null ) {
        clearTimeout( interactiveSwapTimer );
        interactiveSwapTimer = null;
    }

    // Tear down interactive mode if it was open.
    if ( interactiveMode ) {
        teardownInteractive();
    }

    tooltipEl.hidden  = true;
    tooltipEl.setAttribute( 'aria-hidden', 'true' );
    tooltipEl.classList.remove( 'fg-f-tooltip--visible' );
    tooltipEl.classList.remove( 'fg-f-tooltip--interactive' );
    tooltipEl.classList.remove( 'fg-f-tooltip--swapping' );
    tooltipEl.dataset.dir = '';
    // Clear any custom content so the next text tooltip starts clean.
    tooltipEl.textContent = '';
    activeHost = null;
}

/**
 * Public hide entry point.
 *
 * While an interactive popover is open this is a no-op: the popover closes
 * only via outside click, Escape or hideInteractive(), so a host's own
 * mouseleave handler cannot close it.
 */
function hideImmediately() {
    if ( interactiveMode ) return;
    reallyHide();
}

/**
 * Scroll/resize handler. Interactive popovers reposition instead of closing,
 * since the user may be scrolling inside them.
 */
function hideOnScrollOrResize() {
    if ( ! tooltipEl ) return;

    if ( interactiveMode && activeHost ) {
        // Keep the popover anchored to its host as the page scrolls.
        position( activeHost );
        return;
    }

    hideImmediately();
}

function scheduleShow( host, label ) {
    // No hover-driven shows while an interactive popover is open.
    if ( interactiveMode ) return;
    clearTimeout( hideTimer );
    clearTimeout( showTimer );
    showTimer = setTimeout( () => showImmediately( host, label ), SHOW_DELAY_MS );
}

function scheduleHide() {
    // Interactive mode: hover dismissal is OFF; popover closes only via
    // outside-click or Escape. Skip silently.
    if ( interactiveMode ) return;
    clearTimeout( showTimer );
    hideTimer = setTimeout( hideImmediately, HIDE_DELAY_MS );
}

// Interactive mode: the tooltip becomes a popover holding arbitrary DOM.
// While interactive, pointer-events are enabled so child controls receive
// clicks, mouseleave does NOT auto-hide, dismissal is via outside-click /
// Escape / programmatic close, and scroll/resize reposition rather than dismiss.

/**
 * Open the tooltip in interactive mode against `host`, with `contentEl`
 * as the inner DOM. Replaces any existing tooltip content.
 *
 * If the tooltip is already interactive for the same host (toggle case),
 * closes it instead - letting the caller bind a single button to a
 * toggle action.
 *
 * @param {HTMLElement} host       The anchor element.
 * @param {HTMLElement} contentEl  The DOM to render inside the tooltip.
 * @param {object}      [opts]
 * @param {string}      [opts.dir] Force direction ('above'|'below'|'left'|'right').
 * @returns {boolean}  True if newly opened, false if it toggled closed.
 */
function showInteractive( host, contentEl, opts ) {
    if ( ! ( host instanceof Element ) || ! ( contentEl instanceof Element ) ) return false;

    // A second call on the same host closes the popover, bypassing the
    // interactive guard in hideImmediately().
    if ( interactiveMode && activeHost === host ) {
        reallyHide();
        return false;
    }

    // If interactive mode is open against a different host, close it first.
    if ( interactiveMode ) {
        reallyHide();
    }

    // Cancel any pending text-tooltip timers so they don't override us.
    clearTimeout( showTimer );
    clearTimeout( hideTimer );

    if ( opts?.dir ) {
        host.dataset.fgTooltipDir = opts.dir;
    }

    const el = getTooltipEl( host );

    // Set before the morph delay so a mouseleave during the fade-out cannot
    // close the popover.
    activeHost      = host;
    interactiveMode = true;

    // When a text tooltip is already showing, fade it out, swap the content and
    // fade back in so it reads as a morph; otherwise open directly.
    const wasVisible = el.classList.contains( 'fg-f-tooltip--visible' );

    const finishOpen = () => {
        el.textContent = '';
        // Wrap the supplied content in a fade-controllable inner so the
        // outer container (which carries the arrow + chrome) stays put
        // while only the inner crossfades.
        const inner = document.createElement( 'div' );
        inner.className = 'fg-f-tooltip__inner';
        inner.appendChild( contentEl );
        el.appendChild( inner );

        el.classList.add( 'fg-f-tooltip--interactive' );
        el.hidden = false;
        el.removeAttribute( 'aria-hidden' );
        el.classList.add( 'fg-f-tooltip--visible' );

        // Reposition for the new content size. The outer tooltip's
        // width/height transition (set in fg-tooltip.scss) makes the
        // resize itself smooth; position() updates the anchored top/left.
        position( host );

        host.setAttribute( 'aria-expanded', 'true' );
        setupInteractiveDismissal();

        // Fade inner content back in on next frame so the browser has
        // committed the size change before the opacity transition runs.
        requestAnimationFrame( () => {
            inner.classList.add( 'fg-f-tooltip__inner--visible' );
        } );
    };

    if ( wasVisible ) {
        // Fade-out leg. The inner content fades; the outer container
        // (background + arrow) stays on screen so the user sees a
        // continuous "morphing" tooltip rather than a flash.
        el.classList.add( 'fg-f-tooltip--swapping' );
        // Matches the CSS fg-tt-swap-duration; 0ms when the styles are missing.
        const SWAP_MS = 120;
        // Tracked so close-during-morph cancels a stale finishOpen.
        if ( interactiveSwapTimer !== null ) clearTimeout( interactiveSwapTimer );
        interactiveSwapTimer = setTimeout( () => {
            interactiveSwapTimer = null;
            el.classList.remove( 'fg-f-tooltip--swapping' );
            // Skip finishOpen if the popover was closed during the morph.
            if ( ! interactiveMode || activeHost !== host ) return;
            finishOpen();
        }, SWAP_MS );
    } else {
        finishOpen();
    }

    return true;
}

/**
 * Programmatically close the interactive popover. Safe to call when
 * nothing is open.
 */
function hideInteractive() {
    if ( interactiveMode ) {
        reallyHide();
    }
}

/**
 * Install the outside-click + Escape dismissal listeners.
 */
function setupInteractiveDismissal() {
    // Capture phase, so the check runs before handlers inside the popover.
    interactiveOutsideClick = ( e ) => {
        if ( ! tooltipEl || ! activeHost ) return;
        const target = e.target;
        if ( tooltipEl.contains( target ) ) return; // click inside popover - ignore
        if ( activeHost.contains( target ) ) return; // click on host - ignore (host toggles)
        reallyHide();
    };

    interactiveKeydown = ( e ) => {
        if ( e.key === 'Escape' ) {
            // Stop propagation so Escape closes only the popover, not the lightbox
            // behind it.
            e.stopPropagation();
            e.preventDefault();
            reallyHide();
            // Return focus to the host so the user is back in a sensible place.
            if ( activeHost && typeof activeHost.focus === 'function' ) {
                try { activeHost.focus( { preventScroll: true } ); } catch ( _ ) { activeHost.focus(); }
            }
        }
    };

    // Installed after the current event so the opening click does not close
    // the popover. Capture phase so these run before surface-level handlers.
    setTimeout( () => {
        document.addEventListener( 'click',   interactiveOutsideClick, true );
        document.addEventListener( 'keydown', interactiveKeydown,      true );
    }, 0 );
}

/**
 * Remove the interactive listeners + reset the aria state on the host.
 * Called from reallyHide / hideImmediately when interactiveMode was true.
 */
function teardownInteractive() {
    if ( interactiveOutsideClick ) {
        document.removeEventListener( 'click', interactiveOutsideClick, true );
        interactiveOutsideClick = null;
    }
    if ( interactiveKeydown ) {
        document.removeEventListener( 'keydown', interactiveKeydown, true );
        interactiveKeydown = null;
    }
    if ( activeHost ) {
        activeHost.setAttribute( 'aria-expanded', 'false' );
    }
    interactiveMode = false;
}


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
 * Declarative init - bind all [data-fg-tooltip] elements in the given root.
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
window.FgTooltip = {
    bind,
    init,
    refresh,
    showImmediately,
    hideImmediately,
    // Interactive mode - the tooltip becomes a popover-like surface
    // hosting arbitrary DOM (e.g. the lightbox toolbar's share grid).
    showInteractive,
    hideInteractive,
};
