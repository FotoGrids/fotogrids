/**
 * FotoGrids — Shared carousel helpers.
 *
 * Pure primitives used by carousel-style layouts (Slider, Image Viewer).
 * Each helper is independent — no helper imports another, no global state,
 * no DOM mutation outside of the explicit render* helpers.
 *
 * Consumers compose these into a layout's frontend behaviour. None of
 * these helpers know about FotoGrids-specific data attributes or
 * settings — they take primitive inputs and return primitive APIs.
 */

const TRANSITION_DURATION_MS = {
    fast:   150,
    normal: 300,
    slow:   450,
};

/* =========================================================================
 * Index state machine
 * ========================================================================= */

/**
 * Tracks the active index of a finite collection with optional loop
 * semantics. Subscribers receive notifications on every change.
 *
 * @param {{ total: number, loop?: boolean, initial?: number }} opts
 * @return {{
 *   current: () => number,
 *   total:   () => number,
 *   setTotal:(n: number) => void,
 *   next:    () => boolean,
 *   prev:    () => boolean,
 *   goTo:    (n: number) => boolean,
 *   hasNext: () => boolean,
 *   hasPrev: () => boolean,
 *   onChange:(cb: (next: number, prev: number) => void) => () => void,
 * }}
 */
export function createIndexState( opts ) {
    let total   = Math.max( 0, opts.total | 0 );
    const loop  = !! opts.loop;
    let index   = Math.max( 0, Math.min( total - 1, opts.initial | 0 ) );
    const subs  = [];

    const fire = ( prev ) => {
        for ( let i = 0; i < subs.length; i++ ) {
            try { subs[ i ]( index, prev ); }
            catch ( e ) { if ( window.console ) console.warn( 'carousel-helpers indexState cb threw', e ); }
        }
    };

    const setIndex = ( next ) => {
        if ( total === 0 ) return false;
        if ( next === index ) return false;
        const prev = index;
        index = next;
        fire( prev );
        return true;
    };

    return {
        current: () => index,
        total:   () => total,
        setTotal( n ) {
            total = Math.max( 0, n | 0 );
            if ( index > total - 1 ) {
                index = Math.max( 0, total - 1 );
            }
        },
        next() {
            if ( total === 0 ) return false;
            if ( index < total - 1 ) return setIndex( index + 1 );
            if ( loop )             return setIndex( 0 );
            return false;
        },
        prev() {
            if ( total === 0 ) return false;
            if ( index > 0 )    return setIndex( index - 1 );
            if ( loop )         return setIndex( total - 1 );
            return false;
        },
        goTo( n ) {
            if ( total === 0 ) return false;
            const target = Math.max( 0, Math.min( total - 1, n | 0 ) );
            return setIndex( target );
        },
        hasNext: () => total > 0 && ( loop || index < total - 1 ),
        hasPrev: () => total > 0 && ( loop || index > 0 ),
        onChange( cb ) {
            subs.push( cb );
            return () => {
                const i = subs.indexOf( cb );
                if ( i !== -1 ) subs.splice( i, 1 );
            };
        },
    };
}

/* =========================================================================
 * Transition duration resolver
 * ========================================================================= */

/**
 * Resolve the symbolic transition duration name to a millisecond count.
 * Falls back to 300ms when the name is unrecognised.
 *
 * @param {string} name 'fast' | 'normal' | 'slow' | 'custom' | other.
 * @param {number} customMs Used when name === 'custom'.
 * @return {number}
 */
export function resolveTransitionDurationMs( name, customMs ) {
    if ( name === 'custom' ) {
        const parsed = parseInt( customMs, 10 );
        return isNaN( parsed ) || parsed < 0 ? 300 : parsed;
    }
    if ( name in TRANSITION_DURATION_MS ) {
        return TRANSITION_DURATION_MS[ name ];
    }
    return 300;
}

/* =========================================================================
 * Visibility classes
 * ========================================================================= */

/**
 * Maps the chrome-visibility setting value to a CSS class string the
 * caller applies to the chrome wrapper. The layout's stylesheet defines
 * the rules for each class (hide/show on hover, etc.).
 *
 * @param {string} visibility 'always' | 'hover_show' | 'hover_hide'
 * @return {string}
 */
export function resolveVisibilityClasses( visibility ) {
    switch ( visibility ) {
        case 'hover_show': return 'fg-chrome--hover-show';
        case 'hover_hide': return 'fg-chrome--hover-hide';
        case 'always':
        default:           return 'fg-chrome--always';
    }
}

/* =========================================================================
 * Scroll-to with custom duration
 * ========================================================================= */

/**
 * Animate an element's scrollLeft to `targetLeft` over `durationMs`.
 * Returns a cancel function; calling it stops the animation in place.
 *
 * Honours prefers-reduced-motion by jumping immediately when the user
 * has the OS setting enabled.
 *
 * @param {Element} el
 * @param {number} targetLeft
 * @param {number} durationMs
 * @param {{ easing?: (t: number) => number }} [opts]
 * @return {() => void} Cancel.
 */
export function scrollToDuration( el, targetLeft, durationMs, opts ) {
    if ( ! el ) return () => {};

    const reduceMotion = window.matchMedia
        && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

    if ( reduceMotion || durationMs <= 0 ) {
        el.scrollLeft = targetLeft;
        return () => {};
    }

    const startLeft = el.scrollLeft;
    const delta     = targetLeft - startLeft;
    if ( delta === 0 ) return () => {};

    const easing = ( opts && opts.easing ) || easeOutQuad;
    const startTs = performance.now();
    let cancelled = false;
    let frameId   = 0;

    const step = ( now ) => {
        if ( cancelled ) return;
        const elapsed = now - startTs;
        const t = Math.min( 1, elapsed / durationMs );
        el.scrollLeft = startLeft + delta * easing( t );
        if ( t < 1 ) {
            frameId = requestAnimationFrame( step );
        }
    };

    frameId = requestAnimationFrame( step );

    return () => {
        cancelled = true;
        cancelAnimationFrame( frameId );
    };
}

const easeOutQuad = ( t ) => t * ( 2 - t );

/* =========================================================================
 * Autoplay timer
 * ========================================================================= */

/**
 * Interval-based ticker for carousel autoplay. Pauses on hover, on
 * Page Visibility changes, and after user interaction (configurable
 * interactionPauseMs).
 *
 * @param {{
 *   delay:               number,
 *   onTick:              () => void,
 *   pauseOnHover?:       boolean,
 *   container?:          Element,
 *   pauseOnVisibility?:  boolean,
 *   interactionPauseMs?: number,
 * }} opts
 * @return {{ start: () => void, stop: () => void, pause: () => void, resume: () => void, destroy: () => void }}
 */
export function createAutoplay( opts ) {
    const delay              = Math.max( 0, opts.delay | 0 );
    const onTick             = typeof opts.onTick === 'function' ? opts.onTick : () => {};
    const pauseOnHover       = opts.pauseOnHover !== false;
    const container          = opts.container || null;
    const pauseOnVisibility  = opts.pauseOnVisibility !== false;
    const interactionPauseMs = Math.max( 0, opts.interactionPauseMs | 0 );

    let timerId         = 0;
    let interactionId   = 0;
    let running         = false;
    let pausedByHover   = false;
    let pausedByVis     = false;
    let pausedByInter   = false;

    const isPaused = () => pausedByHover || pausedByVis || pausedByInter;

    const tick = () => {
        if ( ! running || isPaused() ) return;
        try { onTick(); } catch ( e ) {}
        scheduleNext();
    };

    const scheduleNext = () => {
        clearTimeout( timerId );
        if ( ! running || isPaused() || delay <= 0 ) return;
        timerId = window.setTimeout( tick, delay );
    };

    const onMouseEnter = () => { if ( pauseOnHover ) { pausedByHover = true; clearTimeout( timerId ); } };
    const onMouseLeave = () => { if ( pauseOnHover ) { pausedByHover = false; scheduleNext(); } };
    const onFocusIn    = () => { pausedByHover = true; clearTimeout( timerId ); };
    const onFocusOut   = () => { pausedByHover = false; scheduleNext(); };
    const onVisibility = () => {
        if ( document.hidden ) { pausedByVis = true; clearTimeout( timerId ); }
        else                   { pausedByVis = false; scheduleNext(); }
    };

    if ( container && pauseOnHover ) {
        container.addEventListener( 'mouseenter', onMouseEnter );
        container.addEventListener( 'mouseleave', onMouseLeave );
        container.addEventListener( 'focusin',    onFocusIn );
        container.addEventListener( 'focusout',   onFocusOut );
    }
    if ( pauseOnVisibility ) {
        document.addEventListener( 'visibilitychange', onVisibility );
    }

    return {
        start() {
            if ( running ) return;
            running = true;
            scheduleNext();
        },
        stop() {
            running = false;
            clearTimeout( timerId );
        },
        pause: () => {
            pausedByInter = true;
            clearTimeout( timerId );
            clearTimeout( interactionId );
            if ( interactionPauseMs > 0 ) {
                interactionId = window.setTimeout( () => {
                    pausedByInter = false;
                    scheduleNext();
                }, interactionPauseMs );
            }
        },
        resume: () => {
            pausedByInter = false;
            clearTimeout( interactionId );
            scheduleNext();
        },
        destroy() {
            running = false;
            clearTimeout( timerId );
            clearTimeout( interactionId );
            if ( container && pauseOnHover ) {
                container.removeEventListener( 'mouseenter', onMouseEnter );
                container.removeEventListener( 'mouseleave', onMouseLeave );
                container.removeEventListener( 'focusin',    onFocusIn );
                container.removeEventListener( 'focusout',   onFocusOut );
            }
            if ( pauseOnVisibility ) {
                document.removeEventListener( 'visibilitychange', onVisibility );
            }
        },
    };
}

/* =========================================================================
 * Swipe detector
 * ========================================================================= */

/**
 * Touch-only swipe detector. Calls `onSwipe('left'|'right'|'up'|'down')`
 * when a touch gesture crosses the threshold AND the dominant axis is
 * consistent with directionLock (when set).
 *
 * @param {Element} el
 * @param {{
 *   onSwipe:        (dir: 'left'|'right'|'up'|'down', distance: number) => void,
 *   threshold?:     number,
 *   directionLock?: 'horizontal' | 'vertical' | null,
 * }} opts
 * @return {() => void} Destroy.
 */
export function createSwipeDetector( el, opts ) {
    if ( ! el ) return () => {};

    const onSwipe       = typeof opts.onSwipe === 'function' ? opts.onSwipe : () => {};
    const threshold     = opts.threshold || 40;
    const directionLock = opts.directionLock || null;

    let startX = 0;
    let startY = 0;
    let active = false;

    const onTouchStart = ( e ) => {
        if ( ! e.touches || e.touches.length !== 1 ) return;
        active = true;
        startX = e.touches[ 0 ].clientX;
        startY = e.touches[ 0 ].clientY;
    };

    const onTouchEnd = ( e ) => {
        if ( ! active ) return;
        active = false;
        const t = ( e.changedTouches && e.changedTouches[ 0 ] ) || null;
        if ( ! t ) return;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const adx = Math.abs( dx );
        const ady = Math.abs( dy );

        if ( directionLock === 'horizontal' && ady > adx ) return;
        if ( directionLock === 'vertical'   && adx > ady ) return;

        if ( adx >= threshold && adx > ady ) {
            onSwipe( dx < 0 ? 'left' : 'right', adx );
        } else if ( ady >= threshold ) {
            onSwipe( dy < 0 ? 'up' : 'down', ady );
        }
    };

    const onTouchCancel = () => { active = false; };

    el.addEventListener( 'touchstart',  onTouchStart,  { passive: true } );
    el.addEventListener( 'touchend',    onTouchEnd,    { passive: true } );
    el.addEventListener( 'touchcancel', onTouchCancel, { passive: true } );

    return () => {
        el.removeEventListener( 'touchstart',  onTouchStart );
        el.removeEventListener( 'touchend',    onTouchEnd );
        el.removeEventListener( 'touchcancel', onTouchCancel );
    };
}

/* =========================================================================
 * Keyboard nav
 * ========================================================================= */

/**
 * Wires arrow keys (and optionally Home/End) on the supplied element.
 * Only fires when the element or one of its descendants has focus.
 *
 * @param {Element} el
 * @param {{
 *   onPrev?:     () => void,
 *   onNext?:     () => void,
 *   onHome?:     () => void,
 *   onEnd?:      () => void,
 *   orientation?: 'horizontal' | 'vertical' | 'both',
 * }} opts
 * @return {() => void} Destroy.
 */
export function createKeyboardNav( el, opts ) {
    if ( ! el ) return () => {};

    const onPrev       = typeof opts.onPrev === 'function' ? opts.onPrev : null;
    const onNext       = typeof opts.onNext === 'function' ? opts.onNext : null;
    const onHome       = typeof opts.onHome === 'function' ? opts.onHome : null;
    const onEnd        = typeof opts.onEnd  === 'function' ? opts.onEnd  : null;
    const orientation  = opts.orientation || 'horizontal';

    const onKeyDown = ( e ) => {
        if ( ! el.contains( document.activeElement ) && document.activeElement !== el ) return;

        const horizontal = orientation === 'horizontal' || orientation === 'both';
        const vertical   = orientation === 'vertical'   || orientation === 'both';

        switch ( e.key ) {
            case 'ArrowLeft':
                if ( horizontal && onPrev ) { e.preventDefault(); onPrev(); }
                break;
            case 'ArrowRight':
                if ( horizontal && onNext ) { e.preventDefault(); onNext(); }
                break;
            case 'ArrowUp':
                if ( vertical && onPrev ) { e.preventDefault(); onPrev(); }
                break;
            case 'ArrowDown':
                if ( vertical && onNext ) { e.preventDefault(); onNext(); }
                break;
            case 'Home':
                if ( onHome ) { e.preventDefault(); onHome(); }
                break;
            case 'End':
                if ( onEnd )  { e.preventDefault(); onEnd(); }
                break;
        }
    };

    document.addEventListener( 'keydown', onKeyDown );
    return () => document.removeEventListener( 'keydown', onKeyDown );
}

/* =========================================================================
 * Intersection-based pauser
 * ========================================================================= */

/**
 * Wraps an IntersectionObserver so callers can run setup/teardown when
 * an element enters or leaves the viewport. Useful for pausing autoplay
 * when the carousel scrolls off-screen.
 *
 * @param {{
 *   el:       Element,
 *   onEnter?: () => void,
 *   onLeave?: () => void,
 *   threshold?: number,
 * }} opts
 * @return {() => void} Destroy.
 */
export function createIntersectionPauser( opts ) {
    if ( ! opts || ! opts.el ) return () => {};
    if ( typeof window.IntersectionObserver !== 'function' ) return () => {};

    const onEnter = typeof opts.onEnter === 'function' ? opts.onEnter : () => {};
    const onLeave = typeof opts.onLeave === 'function' ? opts.onLeave : () => {};

    const observer = new IntersectionObserver( ( entries ) => {
        for ( let i = 0; i < entries.length; i++ ) {
            if ( entries[ i ].isIntersecting ) onEnter();
            else                                onLeave();
        }
    }, { threshold: opts.threshold || 0.1 } );

    observer.observe( opts.el );
    return () => observer.disconnect();
}

/* =========================================================================
 * Pointer drag-to-scroll
 * ========================================================================= */

/**
 * Mouse / pen / pointer drag-to-scroll on a horizontally-scrollable
 * element. On pointerdown, sets pointer capture and starts tracking;
 * pointermove updates scrollLeft by the delta. On pointerup/cancel,
 * releases capture and lets native scroll-snap settle.
 *
 * Touch events are deliberately NOT intercepted — native touch scroll +
 * scroll-snap handle them better than JS ever could.
 *
 * @param {Element} el The scrollable container (carousel viewport).
 * @param {{
 *   onDragStart?:        () => void,
 *   onDragEnd?:          ( dragDistance: number ) => void,
 *   threshold?:          number,
 *   ignoreClickSelector?: string,
 * }} [opts]
 * @return {() => void} Destroy.
 */
export function createPointerDrag( el, opts ) {
    if ( ! el ) return () => {};
    const options    = opts || {};
    const threshold  = options.threshold || 4;
    const onDragStart = typeof options.onDragStart === 'function' ? options.onDragStart : null;
    const onDragEnd   = typeof options.onDragEnd   === 'function' ? options.onDragEnd   : null;
    const ignoreClickSelector = typeof options.ignoreClickSelector === 'string'
        ? options.ignoreClickSelector
        : '';

    let isDragging   = false;
    let startX       = 0;
    let startScroll  = 0;
    let pointerId    = null;
    let totalDelta   = 0;
    let didExceedThreshold = false;

    const onPointerDown = ( e ) => {
        if ( e.pointerType === 'touch' ) return;
        if ( e.button !== 0 ) return;
        isDragging   = true;
        startX       = e.clientX;
        startScroll  = el.scrollLeft;
        pointerId    = e.pointerId;
        totalDelta   = 0;
        didExceedThreshold = false;
    };

    const onPointerMove = ( e ) => {
        if ( ! isDragging || e.pointerId !== pointerId ) return;
        const delta = e.clientX - startX;
        totalDelta = delta;
        if ( ! didExceedThreshold && Math.abs( delta ) > threshold ) {
            didExceedThreshold = true;
            el.style.scrollSnapType = 'none';
            el.style.cursor = 'grabbing';
            // Capture only once a real drag begins. Capturing on pointerdown
            // would retarget the eventual click to el, hiding the true target
            // (e.g. an inline-video tile) from delegated click handlers.
            try { el.setPointerCapture( e.pointerId ); } catch ( err ) {}
            if ( onDragStart ) onDragStart();
        }
        if ( didExceedThreshold ) {
            el.scrollLeft = startScroll - delta;
            e.preventDefault();
        }
    };

    const onPointerEnd = ( e ) => {
        if ( ! isDragging || e.pointerId !== pointerId ) return;
        isDragging = false;
        if ( didExceedThreshold ) {
            try { el.releasePointerCapture( e.pointerId ); } catch ( err ) {}
        }
        el.style.scrollSnapType = '';
        el.style.cursor = '';
        if ( didExceedThreshold && onDragEnd ) onDragEnd( totalDelta );
        pointerId = null;
    };

    const onClick = ( e ) => {
        if ( ! didExceedThreshold ) return;
        didExceedThreshold = false;
        if ( ignoreClickSelector
            && e.target
            && typeof e.target.closest === 'function'
            && e.target.closest( ignoreClickSelector ) ) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
    };

    el.addEventListener( 'pointerdown',   onPointerDown );
    el.addEventListener( 'pointermove',   onPointerMove );
    el.addEventListener( 'pointerup',     onPointerEnd );
    el.addEventListener( 'pointercancel', onPointerEnd );
    el.addEventListener( 'click',         onClick, true );

    return () => {
        el.removeEventListener( 'pointerdown',   onPointerDown );
        el.removeEventListener( 'pointermove',   onPointerMove );
        el.removeEventListener( 'pointerup',     onPointerEnd );
        el.removeEventListener( 'pointercancel', onPointerEnd );
        el.removeEventListener( 'click',         onClick, true );
    };
}

/* =========================================================================
 * Chrome renderers
 * ========================================================================= */

/**
 * Render previous/next arrow buttons inside `container`. Returns the
 * button references plus a destroy function.
 *
 * @param {{
 *   container:  Element,
 *   prevSvg?:   string,
 *   nextSvg?:   string,
 *   prevLabel?: string,
 *   nextLabel?: string,
 *   onPrev:     () => void,
 *   onNext:     () => void,
 *   classNames?:{ wrap?: string, button?: string, prev?: string, next?: string },
 * }} opts
 * @return {{ prev: HTMLButtonElement, next: HTMLButtonElement, wrap: HTMLElement, destroy: () => void }}
 */
export function renderArrows( opts ) {
    const cls       = opts.classNames || {};
    const wrap      = document.createElement( 'div' );
    wrap.className  = 'fg-carousel-arrows ' + ( cls.wrap || '' );
    wrap.dataset.fgCarouselArrows = '1';

    const prev = document.createElement( 'button' );
    prev.type  = 'button';
    prev.className = 'fg-carousel-arrow fg-carousel-arrow--prev '
        + ( cls.button || '' ) + ' ' + ( cls.prev || '' );
    prev.setAttribute( 'aria-label', opts.prevLabel || 'Previous slide' );
    prev.innerHTML = opts.prevSvg || '&lsaquo;';

    const next = document.createElement( 'button' );
    next.type  = 'button';
    next.className = 'fg-carousel-arrow fg-carousel-arrow--next '
        + ( cls.button || '' ) + ' ' + ( cls.next || '' );
    next.setAttribute( 'aria-label', opts.nextLabel || 'Next slide' );
    next.innerHTML = opts.nextSvg || '&rsaquo;';

    const onPrevClick = ( e ) => { e.preventDefault(); opts.onPrev(); };
    const onNextClick = ( e ) => { e.preventDefault(); opts.onNext(); };

    prev.addEventListener( 'click', onPrevClick );
    next.addEventListener( 'click', onNextClick );

    wrap.appendChild( prev );
    wrap.appendChild( next );
    opts.container.appendChild( wrap );

    return {
        prev,
        next,
        wrap,
        destroy() {
            prev.removeEventListener( 'click', onPrevClick );
            next.removeEventListener( 'click', onNextClick );
            if ( wrap.parentNode ) wrap.parentNode.removeChild( wrap );
        },
    };
}

/**
 * Render a list of bullet buttons inside `container`. Returns a
 * setCurrent(i) method to update the active bullet and a destroy
 * function. Re-rendering for total changes happens by calling destroy
 * and creating a new bullet group.
 *
 * @param {{
 *   container:   Element,
 *   count:       number,
 *   initial?:    number,
 *   onSelect:    (i: number) => void,
 *   labelFn?:    (i: number) => string,
 *   classNames?: { wrap?: string, bullet?: string, active?: string },
 * }} opts
 * @return {{ setCurrent: (i: number) => void, wrap: HTMLElement, destroy: () => void }}
 */
export function renderBullets( opts ) {
    const cls        = opts.classNames || {};
    const wrap       = document.createElement( 'div' );
    wrap.className   = 'fg-carousel-bullets ' + ( cls.wrap || '' );
    wrap.dataset.fgCarouselBullets = '1';

    const buttons   = [];
    const labelFn   = typeof opts.labelFn === 'function' ? opts.labelFn : ( i ) => 'Go to slide ' + ( i + 1 );
    const activeCls = cls.active || 'fg-is-active';
    let current     = Math.max( 0, Math.min( opts.count - 1, opts.initial | 0 ) );

    for ( let i = 0; i < opts.count; i++ ) {
        const b = document.createElement( 'button' );
        b.type  = 'button';
        b.className = 'fg-carousel-bullet ' + ( cls.bullet || '' );
        b.setAttribute( 'aria-label', labelFn( i ) );
        if ( i === current ) {
            b.classList.add( activeCls );
            b.setAttribute( 'aria-current', 'true' );
        }
        const slot = i;
        const handler = ( e ) => { e.preventDefault(); opts.onSelect( slot ); };
        b.addEventListener( 'click', handler );
        b._fgHandler = handler;
        buttons.push( b );
        wrap.appendChild( b );
    }

    opts.container.appendChild( wrap );

    return {
        wrap,
        setCurrent( i ) {
            const next = Math.max( 0, Math.min( buttons.length - 1, i | 0 ) );
            if ( next === current ) return;
            if ( buttons[ current ] ) {
                buttons[ current ].classList.remove( activeCls );
                buttons[ current ].removeAttribute( 'aria-current' );
            }
            current = next;
            if ( buttons[ current ] ) {
                buttons[ current ].classList.add( activeCls );
                buttons[ current ].setAttribute( 'aria-current', 'true' );
            }
        },
        destroy() {
            for ( let i = 0; i < buttons.length; i++ ) {
                if ( buttons[ i ]._fgHandler ) {
                    buttons[ i ].removeEventListener( 'click', buttons[ i ]._fgHandler );
                }
            }
            if ( wrap.parentNode ) wrap.parentNode.removeChild( wrap );
        },
    };
}

/**
 * Render a "N of M" counter inside `container`. Returns a setCurrent(i)
 * method to update the display.
 *
 * @param {{
 *   container:   Element,
 *   total:       number,
 *   initial?:    number,
 *   format?:     (current: number, total: number) => string,
 *   classNames?: { wrap?: string },
 * }} opts
 * @return {{ setCurrent: (i: number) => void, wrap: HTMLElement, destroy: () => void }}
 */
export function renderCounter( opts ) {
    const cls       = opts.classNames || {};
    const wrap      = document.createElement( 'div' );
    wrap.className  = 'fg-carousel-counter ' + ( cls.wrap || '' );
    wrap.dataset.fgCarouselCounter = '1';

    const format = typeof opts.format === 'function'
        ? opts.format
        : ( cur, total ) => ( cur + 1 ) + ' / ' + total;

    let current = Math.max( 0, Math.min( opts.total - 1, opts.initial | 0 ) );
    wrap.textContent = format( current, opts.total );

    opts.container.appendChild( wrap );

    return {
        wrap,
        setCurrent( i ) {
            const next = Math.max( 0, Math.min( opts.total - 1, i | 0 ) );
            if ( next === current ) return;
            current = next;
            wrap.textContent = format( current, opts.total );
        },
        destroy() {
            if ( wrap.parentNode ) wrap.parentNode.removeChild( wrap );
        },
    };
}
