/**
 * FotoGrids - Image Viewer Layout
 *
 * One image at a time on a stacked stage. Unlike the Slider (a scrolling
 * strip), Image Viewer keeps every item absolutely stacked and toggles
 * which one is active via .fg-is-active. CSS owns the transition (fade /
 * horizontal / vertical / none).
 *
 * Chrome: a single control bar beneath the image (NOT overlaid). The bar
 * holds the prev arrow on the inline-start side, the next arrow on the
 * inline-end side, and the counter centred between them. This layout never
 * renders bullets or a thumbnail strip - only the bar.
 *
 * Reuses the shared carousel-helpers index state + autoplay/keyboard/swipe.
 */

import {
    visibleItems,
    bootLayout,
} from '../_helpers/layout-helpers.js';

import {
    createIndexState,
    createAutoplay,
    createKeyboardNav,
    createSwipeDetector,
    resolveTransitionDurationMs,
} from '../_helpers/carousel-helpers.js';

function readBool( el, attr ) {
    return el.getAttribute( attr ) === '1';
}

function readString( el, attr, fallback ) {
    const v = el.getAttribute( attr );
    return ( v === null || v === '' ) ? fallback : v;
}

function readInt( el, attr, fallback ) {
    const v = parseInt( el.getAttribute( attr ), 10 );
    return isNaN( v ) ? fallback : v;
}

/**
 * Read all viewer settings from the data attributes the PHP layout wrote.
 */
function readSettings( collectionEl ) {
    return {
        loop:                     readBool(   collectionEl, 'data-fg-loop' ),
        showCounter:              readBool(   collectionEl, 'data-fg-show-counter' ),
        autoplay:                 readBool(   collectionEl, 'data-fg-autoplay' ),
        autoplayDelay:            readInt(    collectionEl, 'data-fg-autoplay-delay', 4000 ),
        autoplayPauseOnHover:     readBool(   collectionEl, 'data-fg-autoplay-pause-on-hover' ),
        transition:               readString( collectionEl, 'data-fg-transition', 'fade' ),
        transitionDuration:       readString( collectionEl, 'data-fg-transition-duration', 'normal' ),
        transitionDurationCustom: readInt(    collectionEl, 'data-fg-transition-duration-custom', 300 ),
        hideArrowsAtEnds:         readBool(   collectionEl, 'data-fg-hide-arrows-at-ends' ),
        arrowPrevSvg:             readString( collectionEl, 'data-fg-arrow-prev-svg', '' ),
        arrowNextSvg:             readString( collectionEl, 'data-fg-arrow-next-svg', '' ),
    };
}

function setup( collectionEl ) {
    const containerEl = collectionEl.querySelector( '.fg-viewer-container' );
    const stageEl     = collectionEl.querySelector( '.fg-viewer-stage' );
    const trackEl     = collectionEl.querySelector( '.fg-viewer-track' );
    if ( ! containerEl || ! stageEl || ! trackEl ) return;

    const settings = readSettings( collectionEl );

    const durationMs = settings.transition === 'none'
        ? 0
        : resolveTransitionDurationMs(
            settings.transitionDuration,
            settings.transitionDurationCustom
        );

    // Stamp the resolved duration so the CSS transitions run at the chosen
    // speed (the CSS reads --fg-viewer-duration with a 300ms fallback). The
    // auto-height frame animates at the same pace as the image swap.
    collectionEl.style.setProperty( '--fg-viewer-duration', durationMs + 'ms' );
    collectionEl.style.setProperty( '--fg-viewer-height-duration', durationMs + 'ms' );

    // Fit-to-image auto height applies only when the aspect ratio is "None"
    // (data-fg-natural-ratio="1") and the height mode is auto. In every other
    // combination the frame height is owned entirely by CSS (fixed aspect
    // box, or a fixed pixel height) and JS must not touch it.
    const autoHeightFit =
        collectionEl.getAttribute( 'data-fg-natural-ratio' ) === '1' &&
        collectionEl.getAttribute( 'data-fg-height-mode' ) === 'auto';

    /* Mutable state - chrome rebuilds replace these. */
    let items       = visibleItems( trackEl );
    let total       = 0;
    let indexState  = null;
    let autoplayApi = null;
    let prevIndex   = 0;

    /* Control-bar elements (built once per chrome rebuild). */
    let barEl       = null;
    let prevBtn     = null;
    let nextBtn     = null;
    let counterEl   = null;
    let titleEl     = null;

    const pauseAutoplayBriefly = () => {
        if ( autoplayApi ) autoplayApi.pause();
    };

    const updateArrowDisabled = () => {
        if ( ! prevBtn || ! nextBtn || ! indexState ) return;
        if ( settings.hideArrowsAtEnds && ! settings.loop ) {
            prevBtn.disabled = ! indexState.hasPrev();
            nextBtn.disabled = ! indexState.hasNext();
        }
    };

    const updateCounter = ( index ) => {
        if ( counterEl ) {
            counterEl.textContent = ( index + 1 ) + ' / ' + total;
        }
    };

    /* Reflect the active item's caption title in the bar (right of the
       counter). The PHP item renderer stamps data-fg-caption-title on each
       item when a title is present; items with no title clear the element.
       CSS truncates with an ellipsis when the title is wider than the space
       left between the counter and the next arrow. */
    const updateTitle = ( index ) => {
        if ( ! titleEl ) return;
        const item  = items[ index ];
        const title = item ? ( item.getAttribute( 'data-fg-caption-title' ) || '' ) : '';
        titleEl.textContent = title;
        titleEl.title = title;
        titleEl.classList.toggle( 'fg-viewer-title--empty', title === '' );
    };

    /* Fit-to-image auto height. Measure the active item's media at the current
       track width and stamp the resulting height on --fg-viewer-auto-height so
       the frame fits the image (CSS caps it at the configured max and animates
       the change). Only runs when autoHeightFit is true (None ratio + auto
       mode); otherwise the frame height is owned by CSS. */
    const measureMediaEl = ( item ) => {
        if ( ! item ) return null;
        return item.querySelector( '.fg-item-media img, .fg-item-media .fg-video-poster, .fg-item-media .fg-video' );
    };

    const naturalSize = ( mediaEl ) => {
        if ( ! mediaEl ) return null;
        // <img> exposes naturalWidth/Height; video posters are <img> too. For
        // anything without intrinsic dimensions, fall back to its rendered box.
        const nw = mediaEl.naturalWidth  || mediaEl.offsetWidth  || 0;
        const nh = mediaEl.naturalHeight || mediaEl.offsetHeight || 0;
        return ( nw > 0 && nh > 0 ) ? { w: nw, h: nh } : null;
    };

    // The first height we set should land without animation (the frame just
    // appears at the first image's size); subsequent navigations animate.
    let autoHeightPrimed = false;

    const applyAutoHeight = ( index, animate = true ) => {
        if ( ! autoHeightFit ) return;

        const item    = items[ index ];
        const mediaEl = measureMediaEl( item );
        if ( ! mediaEl ) return;

        // If the image hasn't loaded yet its natural size is 0 - defer the
        // measure until it loads so we don't stamp a collapsed height. A
        // deferred first measure still lands without animation.
        if ( mediaEl.tagName === 'IMG' && ! mediaEl.complete ) {
            mediaEl.addEventListener(
                'load',
                () => { applyAutoHeight( index, animate ); },
                { once: true }
            );
            return;
        }

        const size = naturalSize( mediaEl );
        if ( ! size ) return;

        // Height the image takes when laid out full-width in the track.
        const trackWidth = trackEl.clientWidth;
        if ( trackWidth <= 0 ) return;

        const fitHeight = trackWidth * ( size.h / size.w );

        // Resolve the cap (max-height + viewport ceiling) to a pixel value here
        // and clamp in JS, then set a concrete px height on the elements. A
        // plain length animates cleanly; a CSS min()/calc() that wraps a custom
        // property does NOT transition (the browser treats it as discrete), so
        // doing the clamp in JS is what actually makes the frame slide.
        const capPx    = resolveHeightCapPx();
        const targetPx = Math.round( capPx > 0 ? Math.min( fitHeight, capPx ) : fitHeight );

        const skipAnim = ! animate || ! autoHeightPrimed;
        if ( skipAnim ) {
            // Suppress the transition for this one assignment, then restore it
            // so later navigations animate. Toggling a class avoids clobbering
            // the stylesheet's transition declaration.
            stageEl.classList.add( 'fg-viewer-no-anim' );
            trackEl.classList.add( 'fg-viewer-no-anim' );
        }

        stageEl.style.height = targetPx + 'px';
        trackEl.style.height = targetPx + 'px';

        if ( skipAnim ) {
            // Force a reflow so the no-transition height lands before we drop
            // the class, otherwise the class removal re-enables the transition
            // on this very change.
            void stageEl.offsetHeight;
            stageEl.classList.remove( 'fg-viewer-no-anim' );
            trackEl.classList.remove( 'fg-viewer-no-anim' );
        }

        autoHeightPrimed = true;
    };

    /* Resolve the height ceiling (the smaller of the configured max-height and
       the viewport cap) to a pixel number. --fg-height-max defaults to 100vh
       when the user set no max, so both inputs can be vh - getComputedStyle on
       a probe element converts whatever units to px for us. */
    const resolveHeightCapPx = () => {
        const cs = getComputedStyle( collectionEl );

        const toPx = ( raw ) => {
            const v = ( raw || '' ).trim();
            if ( v === '' ) return 0;
            if ( v.endsWith( 'px' ) ) return parseFloat( v ) || 0;
            // vh / other units: 100vh of the viewport, else fall back to the
            // computed length via a throwaway probe.
            if ( v.endsWith( 'vh' ) ) return ( parseFloat( v ) || 0 ) / 100 * window.innerHeight;
            const probe = document.createElement( 'div' );
            probe.style.cssText = 'position:absolute;visibility:hidden;height:' + v;
            collectionEl.appendChild( probe );
            const px = probe.getBoundingClientRect().height;
            collectionEl.removeChild( probe );
            return px || 0;
        };

        const maxRaw = cs.getPropertyValue( '--fg-height-max' );
        const capRaw = cs.getPropertyValue( '--fg-viewer-height-cap' ) || '100vh';

        const maxPx = toPx( maxRaw );
        const capPx = toPx( capRaw ) || ( window.innerHeight );

        if ( maxPx > 0 && capPx > 0 ) return Math.min( maxPx, capPx );
        return maxPx > 0 ? maxPx : capPx;
    };

    /* Build the control bar beneath the image: prev arrow (inline-start),
       counter (centre), next arrow (inline-end). Always rendered for this
       layout - no bullets, no thumbnails. */
    const buildBar = () => {
        const bar = document.createElement( 'div' );
        bar.className = 'fg-viewer-bar';

        const prev = document.createElement( 'button' );
        prev.type = 'button';
        prev.className = 'fg-viewer-arrow fg-viewer-arrow--prev';
        prev.setAttribute( 'aria-label', 'Previous' );
        prev.innerHTML = settings.arrowPrevSvg || '&lsaquo;';
        prev.addEventListener( 'click', () => { indexState.prev(); pauseAutoplayBriefly(); } );

        // Centre group holds the counter and the caption title side by side so
        // the pair stays centred between the arrows. The title sits to the
        // right of the counter and truncates (CSS) when it overflows.
        const centre = document.createElement( 'div' );
        centre.className = 'fg-viewer-bar-centre';

        const counter = document.createElement( 'span' );
        counter.className = 'fg-viewer-counter';
        if ( ! settings.showCounter ) {
            counter.classList.add( 'fg-viewer-counter--hidden' );
        }

        const title = document.createElement( 'span' );
        title.className = 'fg-viewer-title';

        const next = document.createElement( 'button' );
        next.type = 'button';
        next.className = 'fg-viewer-arrow fg-viewer-arrow--next';
        next.setAttribute( 'aria-label', 'Next' );
        next.innerHTML = settings.arrowNextSvg || '&rsaquo;';
        next.addEventListener( 'click', () => { indexState.next(); pauseAutoplayBriefly(); } );

        centre.appendChild( counter );
        centre.appendChild( title );

        bar.appendChild( prev );
        bar.appendChild( centre );
        bar.appendChild( next );
        containerEl.appendChild( bar );

        return { bar, prev, counter, title, next };
    };

    /* Apply the active item to the DOM. The transition direction
       (data-fg-dir) is derived from whether we moved forward or back so
       the horizontal / vertical slides travel the right way. Looping
       wrap-around is treated as the natural direction of the action. */
    const applyActive = ( next, prev ) => {
        let dir = next >= prev ? 'next' : 'prev';
        // Wrap-around: last → first reads as "next"; first → last as "prev".
        if ( settings.loop && total > 1 ) {
            if ( prev === total - 1 && next === 0 ) dir = 'next';
            else if ( prev === 0 && next === total - 1 ) dir = 'prev';
        }
        collectionEl.setAttribute( 'data-fg-dir', dir );

        for ( let i = 0; i < items.length; i++ ) {
            const el = items[ i ];
            el.classList.remove( 'fg-is-active', 'fg-is-leaving' );
            if ( i === next ) {
                el.classList.add( 'fg-is-active' );
            } else if ( i === prev && prev !== next ) {
                el.classList.add( 'fg-is-leaving' );
            }
        }
    };

    /* Build (or rebuild) the control bar from the current visible items. */
    const buildChrome = () => {
        if ( barEl && barEl.parentNode ) { barEl.parentNode.removeChild( barEl ); }
        barEl = prevBtn = nextBtn = counterEl = titleEl = null;
        if ( autoplayApi ) { autoplayApi.destroy(); autoplayApi = null; }

        items = visibleItems( trackEl );
        total = items.length;
        prevIndex = 0;

        // Drop the PHP-stamped fg-item-hidden now that the stage owns
        // visibility through .fg-is-active / .fg-is-leaving.
        for ( let i = 0; i < items.length; i++ ) {
            items[ i ].classList.remove( 'fg-item-hidden' );
        }

        indexState = createIndexState( {
            total,
            loop: settings.loop,
            initial: 0,
        } );

        // The bar (arrows + counter) always renders for this layout when
        // there's more than one item to move between.
        if ( total > 1 ) {
            const built = buildBar();
            barEl = built.bar;
            prevBtn = built.prev;
            nextBtn = built.next;
            counterEl = built.counter;
            titleEl = built.title;
            updateArrowDisabled();
            updateCounter( 0 );
            updateTitle( 0 );
        }

        indexState.onChange( ( next ) => {
            applyActive( next, prevIndex );
            prevIndex = next;
            updateCounter( next );
            updateTitle( next );
            applyAutoHeight( next );
            updateArrowDisabled();
        } );

        if ( total > 1 && settings.autoplay ) {
            autoplayApi = createAutoplay( {
                delay: settings.autoplayDelay,
                onTick: () => { indexState.next(); },
                pauseOnHover: settings.autoplayPauseOnHover,
                container: collectionEl,
                pauseOnVisibility: true,
                interactionPauseMs: settings.autoplayDelay * 2,
            } );
            autoplayApi.start();
        }

        // Reveal the first item now that chrome is wired, and fit the frame to
        // it (no-op unless None ratio + auto height). The first fit lands
        // without animation so the viewer simply appears at the right size.
        applyActive( 0, 0 );
        applyAutoHeight( 0, false );
    };

    buildChrome();

    /* Re-fit the frame to the active image when the track width changes
       (responsive reflow, sidebar toggle, orientation change). Re-fits are
       instant (no slide) - a width change isn't a navigation. The first
       ResizeObserver callback fires immediately on observe(), which also
       covers the case where the track had no width at initial measure. */
    if ( autoHeightFit && typeof ResizeObserver !== 'undefined' ) {
        const ro = new ResizeObserver( () => { applyAutoHeight( prevIndex, false ); } );
        ro.observe( trackEl );
    }

    /* Keyboard nav - both axes so up/down works for vertical transitions. */

    collectionEl.setAttribute( 'tabindex', '0' );
    createKeyboardNav( collectionEl, {
        orientation: 'both',
        onPrev: () => { if ( indexState ) { indexState.prev(); pauseAutoplayBriefly(); } },
        onNext: () => { if ( indexState ) { indexState.next(); pauseAutoplayBriefly(); } },
        onHome: () => { if ( indexState ) indexState.goTo( 0 ); },
        onEnd:  () => { if ( indexState ) indexState.goTo( indexState.total() - 1 ); },
    } );

    /* Touch swipe - direction matches the transition axis. Horizontal /
       fade respond to left/right; vertical responds to up/down. */

    {
        const lock = settings.transition === 'vertical' ? 'vertical' : 'horizontal';
        createSwipeDetector( stageEl, {
            directionLock: lock,
            onSwipe: ( direction ) => {
                if ( ! indexState ) return;
                if ( direction === 'left' || direction === 'up' ) {
                    indexState.next();
                    pauseAutoplayBriefly();
                } else if ( direction === 'right' || direction === 'down' ) {
                    indexState.prev();
                    pauseAutoplayBriefly();
                }
            },
        } );
    }

    /* Filter changes - rebuild chrome against the new visible-items set. */

    collectionEl.addEventListener( 'fotogrids:filters_changed', () => {
        buildChrome();
    } );
}

function attach( collectionEl ) {
    if ( ! collectionEl.matches( '[data-fg-layout="image-viewer"]' ) ) return;
    if ( collectionEl.dataset.fgViewerReady === '1' ) return;
    collectionEl.dataset.fgViewerReady = '1';
    setup( collectionEl );
}

bootLayout( attach, 10 );
