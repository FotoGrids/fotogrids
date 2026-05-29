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

/**
 * True when the tooltip is in interactive mode — pointer-events enabled,
 * mouseleave does NOT auto-hide, dismissal happens via outside-click or
 * Escape. Set by showInteractive(); cleared by hideImmediately().
 *
 * @type {boolean}
 */
let interactiveMode = false;

/**
 * Outside-click handler installed when interactive mode opens, removed
 * when it closes. Kept as a module-level ref so we can remove the same
 * function instance we added.
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

// ---------------------------------------------------------------------------
// Tooltip element
// ---------------------------------------------------------------------------

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
        tooltipEl.className = 'fg-tooltip';
        tooltipEl.role      = 'tooltip';
        tooltipEl.hidden    = true;
        tooltipEl.setAttribute( 'aria-hidden', 'true' );

        // Hide on scroll / resize so stale positions don't linger.
        // Interactive mode opts out — see hideOnScrollOrResize().
        window.addEventListener( 'scroll',  hideOnScrollOrResize, { passive: true, capture: true } );
        window.addEventListener( 'resize',  hideOnScrollOrResize, { passive: true } );
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
    // Arrow offset along the cross-axis, measured from the tooltip's
    // top-left corner. When the tooltip is clamped away from the host
    // centre (e.g. near a viewport edge), the arrow stays pointed at the
    // host instead of sliding along with the body. Computed below per
    // direction and exposed as --fg-tt-arrow-x / --fg-tt-arrow-y so the
    // CSS can position the ::before pseudo-element off it.
    let arrowX = null;
    let arrowY = null;

    // How far the arrow tip must stay from the tooltip's own rounded
    // corners so it never visually detaches from the body. We use the
    // arrow's half-width as the minimum inset; combined with the border
    // radius this keeps the triangle inside the rounded chrome.
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

    // Use fixed positioning (relative to viewport).
    el.style.position = 'fixed';
    el.style.top      = `${Math.round( top )}px`;
    el.style.left     = `${Math.round( left )}px`;

    // Publish arrow position as CSS custom properties so the arrow stays
    // pointed at the host even when the tooltip body is clamped to the
    // viewport edge. The CSS reads --fg-tt-arrow-x / --fg-tt-arrow-y and
    // falls back to 50% when unset (e.g. before the first position()).
    if ( arrowX !== null ) {
        el.style.setProperty( '--fg-tt-arrow-x', `${Math.round( arrowX )}px` );
        el.style.removeProperty( '--fg-tt-arrow-y' );
    } else if ( arrowY !== null ) {
        el.style.setProperty( '--fg-tt-arrow-y', `${Math.round( arrowY )}px` );
        el.style.removeProperty( '--fg-tt-arrow-x' );
    }

    // Data attribute for the entrance animation direction.
    el.dataset.dir = dir;
}

// ---------------------------------------------------------------------------
// Show / hide
// ---------------------------------------------------------------------------

function showImmediately( host, label ) {
    // Interactive mode owns the tooltip exclusively — refuse to overwrite
    // its content with a text label. Otherwise, when a popover hosts
    // child elements that have their own text tooltips bound (e.g. the
    // share-bar buttons inside the lightbox share popover), entering one
    // of those children fires this function, wipes the popover's DOM,
    // and replaces it with the child's label. From the user's POV: the
    // popover "disappears" the moment the cursor moves into it.
    if ( interactiveMode ) return;

    const el = getTooltipEl( host );
    el.textContent = label;
    el.hidden      = false;
    el.removeAttribute( 'aria-hidden' );
    el.classList.add( 'fg-tooltip--visible' );
    position( host );
    activeHost = host;
}

/**
 * Internal hide — actually closes the tooltip. Does NOT check
 * interactive mode; reserved for dismissal paths that have already
 * decided to close (outside-click handler, Escape handler, explicit
 * hideInteractive call).
 *
 * The public `hideImmediately` short-circuits when interactive mode is
 * open — see below.
 */
function reallyHide() {
    if ( ! tooltipEl ) return;

    // Cancel any pending content-morph timer so a stale finishOpen
    // doesn't re-open the tooltip after we just closed it.
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
    tooltipEl.classList.remove( 'fg-tooltip--visible' );
    tooltipEl.classList.remove( 'fg-tooltip--interactive' );
    tooltipEl.classList.remove( 'fg-tooltip--swapping' );
    tooltipEl.dataset.dir = '';
    // Clear any custom content so the next text tooltip starts clean.
    tooltipEl.textContent = '';
    activeHost = null;
}

/**
 * Public hide entry point.
 *
 * If interactive mode is open we refuse to close — interactive popovers
 * own the tooltip exclusively and dismiss only via outside-click,
 * Escape, or programmatic hideInteractive(). Without this guard, any
 * surface that wires its own mouseleave→hide chain (the lightbox
 * toolbar does exactly this; see _bindFgToolbarTooltip) would close
 * the popover as soon as the cursor moved off the trigger button.
 */
function hideImmediately() {
    if ( interactiveMode ) return;
    reallyHide();
}

/**
 * Scroll/resize hide handler. Interactive popovers must NOT close on
 * scroll — the user might scroll inside the tooltip itself or the
 * surrounding lightbox / dialog. We reposition instead when interactive.
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
    // Suspend hover-driven shows while an interactive popover is open.
    // showImmediately itself short-circuits when interactiveMode is true,
    // but scheduling a deferred show is also wasteful — bail early.
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

// ---------------------------------------------------------------------------
// Interactive mode
// ---------------------------------------------------------------------------
//
// The tooltip can switch from its default "text label, mouseleave hides"
// behaviour into an interactive popover that holds arbitrary DOM. While
// interactive:
//   • pointer-events are enabled so child controls receive clicks
//   • mouseleave does NOT auto-hide
//   • dismissal is via outside-click, Escape, or programmatic close
//   • scroll/resize reposition rather than dismiss
//
// Use cases: a small share grid in the lightbox toolbar, future quick-pick
// menus, anywhere the visual of "tooltip with content" beats "modal panel".

/**
 * Open the tooltip in interactive mode against `host`, with `contentEl`
 * as the inner DOM. Replaces any existing tooltip content.
 *
 * If the tooltip is already interactive for the same host (toggle case),
 * closes it instead — letting the caller bind a single button to a
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

    // Toggle: a second showInteractive call on the same host closes it.
    // Use reallyHide (bypassing the interactiveMode guard on hideImmediately)
    // since we want to actually close — we're the dismissal authority here.
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

    // Set interactiveMode + activeHost SYNCHRONOUSLY at the start of the
    // open. This is critical when there's a morph delay (see below):
    // during the fade-out leg, any mouseleave on the host would otherwise
    // call hideImmediately() which short-circuits ONLY when interactiveMode
    // is true. If we waited to set the flag until finishOpen() runs, the
    // tooltip would close mid-morph.
    activeHost      = host;
    interactiveMode = true;

    // The tooltip is most likely still visible right now showing the
    // host's text label ("Sharing" for the lightbox share button). To
    // make the swap feel like a content morph rather than a re-open,
    // we do a fade-out → swap content → reposition → fade-in dance.
    // If the tooltip wasn't visible (e.g. opened via keyboard), we
    // skip the fade-out leg.
    const wasVisible = el.classList.contains( 'fg-tooltip--visible' );

    const finishOpen = () => {
        // Swap content.
        el.textContent = '';
        // Wrap the supplied content in a fade-controllable inner so the
        // outer container (which carries the arrow + chrome) stays put
        // while only the inner crossfades.
        const inner = document.createElement( 'div' );
        inner.className = 'fg-tooltip__inner';
        inner.appendChild( contentEl );
        el.appendChild( inner );

        el.classList.add( 'fg-tooltip--interactive' );
        el.hidden = false;
        el.removeAttribute( 'aria-hidden' );
        el.classList.add( 'fg-tooltip--visible' );

        // Reposition for the new content size. The outer tooltip's
        // width/height transition (set in fg-tooltip.scss) makes the
        // resize itself smooth; position() updates the anchored top/left.
        position( host );

        host.setAttribute( 'aria-expanded', 'true' );
        setupInteractiveDismissal();

        // Fade inner content back in on next frame so the browser has
        // committed the size change before the opacity transition runs.
        requestAnimationFrame( () => {
            inner.classList.add( 'fg-tooltip__inner--visible' );
        } );
    };

    if ( wasVisible ) {
        // Fade-out leg. The inner content fades; the outer container
        // (background + arrow) stays on screen so the user sees a
        // continuous "morphing" tooltip rather than a flash.
        el.classList.add( 'fg-tooltip--swapping' );
        // Match the CSS fg-tt-swap-duration; if styles aren't loaded,
        // we fall through after 0ms.
        const SWAP_MS = 120;
        // Tracked so close-during-morph cancels a stale finishOpen.
        if ( interactiveSwapTimer !== null ) clearTimeout( interactiveSwapTimer );
        interactiveSwapTimer = setTimeout( () => {
            interactiveSwapTimer = null;
            el.classList.remove( 'fg-tooltip--swapping' );
            // If something closed the popover during the morph window
            // (toggle re-click, programmatic hideInteractive, ...) we
            // skip finishOpen — the popover is gone.
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
    // Outside-click: fire on capture so we beat in-tooltip handlers and
    // can decide whether to dismiss based on what was clicked.
    interactiveOutsideClick = ( e ) => {
        if ( ! tooltipEl || ! activeHost ) return;
        const target = e.target;
        if ( tooltipEl.contains( target ) ) return; // click inside popover — ignore
        if ( activeHost.contains( target ) ) return; // click on host — ignore (host toggles)
        reallyHide();
    };

    interactiveKeydown = ( e ) => {
        if ( e.key === 'Escape' ) {
            // Stop propagation so the lightbox (or any other Escape-aware
            // surface) doesn't ALSO handle this. Otherwise pressing
            // Escape inside the popover closes the popover AND the
            // lightbox in the same keystroke.
            e.stopPropagation();
            e.preventDefault();
            reallyHide();
            // Return focus to the host so the user is back in a sensible place.
            if ( activeHost && typeof activeHost.focus === 'function' ) {
                try { activeHost.focus( { preventScroll: true } ); } catch ( _ ) { activeHost.focus(); }
            }
        }
    };

    // Delay the outside-click install until after the current event
    // finishes — otherwise the click that opened the popover would also
    // immediately close it. Capture phase for both so we beat any
    // surface-level handlers (e.g. the lightbox's own Escape-closes-me
    // keydown listener).
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
    // Interactive mode — the tooltip becomes a popover-like surface
    // hosting arbitrary DOM (e.g. the lightbox toolbar's share grid).
    // See the "Interactive mode" section above.
    showInteractive,
    hideInteractive,
};
