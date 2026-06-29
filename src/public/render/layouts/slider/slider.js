/**
 * FotoGrids - Slider Layout
 *
 * Horizontal scroll-snap slider. CSS owns layout (track flex + per-item
 * scroll-snap-align). JS owns chrome (arrows, bullets, counter,
 * autoplay, keyboard, swipe, thumbnails) and custom-duration scroll
 * animation for arrow/bullet/keyboard nav.
 */

import {
    visibleItems,
    bootLayout,
} from '../_helpers/layout-helpers.js';

import {
    createIndexState,
    createAutoplay,
    createKeyboardNav,
    createPointerDrag,
    renderArrows,
    renderBullets,
    renderCounter,
    resolveEasingFn,
    resolveTransitionDurationMs,
    resolveVisibilityClasses,
    scrollToDuration,
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
 * Read all slider settings from data attributes the PHP layout wrote.
 */
function readSettings( collectionEl ) {
    return {
        loop:                  readBool(   collectionEl, 'data-fg-loop' ),
        showCounter:           readBool(   collectionEl, 'data-fg-show-counter' ),
        autoplay:              readBool(   collectionEl, 'data-fg-autoplay' ),
        autoplayDelay:         readInt(    collectionEl, 'data-fg-autoplay-delay', 4000 ),
        autoplayPauseOnHover:  readBool(   collectionEl, 'data-fg-autoplay-pause-on-hover' ),
        transition:            readString( collectionEl, 'data-fg-transition', 'fade' ),
        transitionDuration:    readString( collectionEl, 'data-fg-transition-duration', 'normal' ),
        transitionDurationCustom: readInt( collectionEl, 'data-fg-transition-duration-custom', 300 ),
        easing:                readString( collectionEl, 'data-fg-easing', 'ease' ),
        showArrows:            readBool(   collectionEl, 'data-fg-show-arrows' ),
        arrowsVisibility:      readString( collectionEl, 'data-fg-arrows-visibility', 'always' ),
        hideArrowsAtEnds:      readBool(   collectionEl, 'data-fg-hide-arrows-at-ends' ),
        arrowsAtEndsMode:      readString( collectionEl, 'data-fg-arrows-at-ends-mode', 'hide' ),
        arrowPrevSvg:          readString( collectionEl, 'data-fg-arrow-prev-svg', '' ),
        arrowNextSvg:          readString( collectionEl, 'data-fg-arrow-next-svg', '' ),
        showBullets:           readBool(   collectionEl, 'data-fg-show-bullets' ),
        bulletsLocation:       readString( collectionEl, 'data-fg-bullets-location', 'bottom' ),
        bulletsVisibility:     readString( collectionEl, 'data-fg-bullets-visibility', 'always' ),
        thumbsShow:            readBool(   collectionEl, 'data-fg-thumbs-show' ),
        thumbsLocation:        readString( collectionEl, 'data-fg-thumbs-location', 'bottom' ),
    };
}

/**
 * Read the per-breakpoint items-per-view value from the resolved CSS
 * variable. Falls back to 3.
 */
function readItemsPerView( collectionEl ) {
    const raw = window.getComputedStyle( collectionEl ).getPropertyValue( '--fg-items-per-view' );
    const n = parseInt( raw, 10 );
    return ( isNaN( n ) || n < 1 ) ? 3 : n;
}

/**
 * Compute the page count. With items per view N and total T, the slider
 * has ceil(T / N) pages - each next() advances by one viewport-width.
 */
function pageCount( total, itemsPerView ) {
    if ( total <= 0 || itemsPerView <= 0 ) return 0;
    return Math.ceil( total / itemsPerView );
}

/**
 * The largest scrollLeft the wrapper can reach. The final page is often
 * a partial viewport, so this is less than pageCount * clientWidth.
 *
 * @param {Element} scrollerEl
 * @return {number}
 */
function maxScrollLeft( scrollerEl ) {
    return Math.max( 0, scrollerEl.scrollWidth - scrollerEl.clientWidth );
}

/**
 * Scroll the wrapper viewport to the given page index. The target is
 * clamped to the real maximum scroll so the final partial page lands at
 * the track end rather than overshooting and being silently clamped by
 * the browser (which would desync the page index from the scroll).
 *
 * @param {Element} scrollerEl
 * @param {number}  page
 * @param {number}  durationMs
 * @param {(t: number) => number} [easing]
 * @param {() => void} [onComplete]
 * @return {() => void} Cancel.
 */
function scrollToPage( scrollerEl, page, durationMs, easing, onComplete ) {
    const target = Math.min( page * scrollerEl.clientWidth, maxScrollLeft( scrollerEl ) );
    return scrollToDuration( scrollerEl, target, durationMs, { easing, onComplete } );
}

/**
 * Compute which page is currently visible based on scrollLeft. When the
 * wrapper is scrolled to (or within a pixel of) its maximum, the last
 * page is returned directly so a partial final page is always reachable.
 *
 * @param {Element} scrollerEl
 * @param {number}  pageTotal
 * @return {number}
 */
function currentPageFromScroll( scrollerEl, pageTotal ) {
    const w = scrollerEl.clientWidth;
    if ( w <= 0 ) return 0;
    if ( pageTotal > 0 && scrollerEl.scrollLeft >= maxScrollLeft( scrollerEl ) - 1 ) {
        return pageTotal - 1;
    }
    return Math.round( scrollerEl.scrollLeft / w );
}

function setup( collectionEl ) {
    const containerEl    = collectionEl.querySelector( '.fg-carousel-container' );
    const viewportEl     = collectionEl.querySelector( '.fg-carousel-viewport' );
    const trackWrapperEl = collectionEl.querySelector( '.fg-carousel-track-wrapper' );
    const trackEl        = collectionEl.querySelector( '.fg-carousel-track' );
    if ( ! containerEl || ! viewportEl || ! trackWrapperEl || ! trackEl ) return;

    const settings = readSettings( collectionEl );

    // Effective transition: Slider only supports horizontal-native and
    // none. Fade/vertical (image-viewer-only) fall back to horizontal.
    const transitionEffective = settings.transition === 'none' ? 'none' : 'horizontal';
    const durationMs = transitionEffective === 'none'
        ? 0
        : resolveTransitionDurationMs(
            settings.transitionDuration,
            settings.transitionDurationCustom
        );
    const easingFn = resolveEasingFn( settings.easing );

    /* Mutable state - chrome rebuilds replace these. */
    let items       = visibleItems( trackEl );
    let total       = 0;
    let indexState  = null;
    let arrowsApi   = null;
    let bulletsApi  = null;
    let counterApi  = null;
    let thumbsApi   = null;
    let autoplayApi = null;
    let cancelScroll = () => {};
    let suppressScrollListener = false;
    let suppressFallbackTimer = 0;

    const pauseAutoplayBriefly = () => {
        if ( autoplayApi ) autoplayApi.pause();
    };

    const goToPage = ( page ) => {
        cancelScroll();
        // Suppress the native scroll → index sync for the whole animation so an
        // intermediate scroll position can't yank the index to a half-page and
        // start a competing scroll. Cleared on natural completion; a re-entrant
        // goToPage cancels this one (no onComplete fires) and re-arms it. A
        // safety timer covers the rare case where the rAF completion is missed.
        suppressScrollListener = true;
        clearTimeout( suppressFallbackTimer );
        const clearSuppress = () => { suppressScrollListener = false; };
        cancelScroll = scrollToPage( trackWrapperEl, page, durationMs, easingFn, clearSuppress );
        suppressFallbackTimer = window.setTimeout( clearSuppress, durationMs + 100 );
    };

    const updateArrowDisabled = () => {
        if ( ! arrowsApi || ! indexState ) return;
        if ( settings.hideArrowsAtEnds && ! settings.loop ) {
            const prevInactive = ! indexState.hasPrev();
            const nextInactive = ! indexState.hasNext();
            const hide = settings.arrowsAtEndsMode === 'hide';
            arrowsApi.prev.disabled = prevInactive;
            arrowsApi.next.disabled = nextInactive;
            arrowsApi.prev.classList.toggle( 'fg-carousel-arrow--at-end-hidden', hide && prevInactive );
            arrowsApi.next.classList.toggle( 'fg-carousel-arrow--at-end-hidden', hide && nextInactive );
        }
    };

    /* Build (or rebuild) all chrome from current visible items. */
    const buildChrome = () => {
        if ( arrowsApi   ) { arrowsApi.destroy();   arrowsApi   = null; }
        if ( bulletsApi  ) { bulletsApi.destroy();  bulletsApi  = null; }
        if ( counterApi  ) { counterApi.destroy();  counterApi  = null; }
        if ( thumbsApi   ) { thumbsApi.destroy();   thumbsApi   = null; }
        if ( autoplayApi ) { autoplayApi.destroy(); autoplayApi = null; }

        items = visibleItems( trackEl );
        const itemsPerView = readItemsPerView( collectionEl );
        total = pageCount( items.length, itemsPerView );

        indexState = createIndexState( {
            total,
            loop: settings.loop,
            initial: 0,
        } );

        if ( total > 1 && settings.showArrows ) {
            arrowsApi = renderArrows( {
                container: viewportEl,
                prevSvg:   settings.arrowPrevSvg,
                nextSvg:   settings.arrowNextSvg,
                prevLabel: 'Previous',
                nextLabel: 'Next',
                onPrev: () => { indexState.prev(); pauseAutoplayBriefly(); },
                onNext: () => { indexState.next(); pauseAutoplayBriefly(); },
                classNames: { wrap: resolveVisibilityClasses( settings.arrowsVisibility ) },
            } );
            updateArrowDisabled();
        }

        if ( total > 1 && settings.showBullets ) {
            bulletsApi = renderBullets( {
                container: containerEl,
                count: total,
                initial: 0,
                onSelect: ( i ) => { indexState.goTo( i ); pauseAutoplayBriefly(); },
                classNames: { wrap: resolveVisibilityClasses( settings.bulletsVisibility ) },
            } );
        }

        if ( total > 1 && settings.showCounter ) {
            counterApi = renderCounter( {
                container: viewportEl,
                total,
                initial: 0,
            } );
        }

        if ( total > 1 && settings.thumbsShow ) {
            thumbsApi = renderThumbnails( containerEl, collectionEl, items, indexState );
        }

        indexState.onChange( ( next ) => {
            goToPage( next );
            if ( bulletsApi ) bulletsApi.setCurrent( next );
            if ( counterApi ) counterApi.setCurrent( next );
            if ( thumbsApi )  thumbsApi.setCurrent( next );
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
    };

    buildChrome();

    /* Native scroll (user drag/swipe) → index sync. */

    let scrollSyncTimer = 0;
    trackWrapperEl.addEventListener( 'scroll', () => {
        if ( suppressScrollListener ) return;
        if ( ! indexState ) return;
        clearTimeout( scrollSyncTimer );
        scrollSyncTimer = window.setTimeout( () => {
            const page = currentPageFromScroll( trackWrapperEl, indexState.total() );
            if ( page !== indexState.current() ) {
                indexState.goTo( page );
            }
        }, 16 );
    }, { passive: true } );

    /* Keyboard nav - attached once; reads current indexState dynamically. */

    collectionEl.setAttribute( 'tabindex', '0' );
    createKeyboardNav( collectionEl, {
        onPrev: () => { if ( indexState ) { indexState.prev(); pauseAutoplayBriefly(); } },
        onNext: () => { if ( indexState ) { indexState.next(); pauseAutoplayBriefly(); } },
        onHome: () => { if ( indexState ) indexState.goTo( 0 ); },
        onEnd:  () => { if ( indexState ) indexState.goTo( indexState.total() - 1 ); },
    } );

    /* Pointer drag-to-scroll (mouse / pen). Touch is left to native
       scroll-snap. After drag releases, the native snap settles to the
       nearest slide; the scroll listener picks up the new index. */

    createPointerDrag( trackWrapperEl, {
        onDragStart: pauseAutoplayBriefly,
        onDragEnd:   pauseAutoplayBriefly,
        ignoreClickSelector: '.fg-video[data-fg-playback-mode="inline"]',
    } );

    /* Reveal items now that initial layout is ready. */

    revealAllItems( trackEl );

    /* Resize - items per view may change at breakpoint. */

    let resizeTimer = 0;
    let lastItemsPerView = readItemsPerView( collectionEl );
    const onResize = () => {
        clearTimeout( resizeTimer );
        resizeTimer = window.setTimeout( () => {
            const newItemsPerView = readItemsPerView( collectionEl );
            if ( newItemsPerView !== lastItemsPerView ) {
                lastItemsPerView = newItemsPerView;
                buildChrome();
                goToPage( 0 );
            } else if ( indexState ) {
                goToPage( indexState.current() );
            }
        }, 100 );
    };

    if ( typeof window.ResizeObserver === 'function' ) {
        const ro = new ResizeObserver( onResize );
        ro.observe( trackWrapperEl );
    } else {
        window.addEventListener( 'resize', onResize );
    }

    /* Filter changes - rebuild chrome against the new visible-items set. */

    collectionEl.addEventListener( 'fotogrids:filters_changed', () => {
        buildChrome();
        goToPage( 0 );
    } );
}

/**
 * Resolve the thumbnail image source for a slider item. Plain image items
 * expose their source on the item <img>; video items expose it on the
 * .fg-video-poster <img>. Posterless videos render a placeholder span
 * instead of an <img>, so this returns an empty string for them.
 *
 * @param {Element} itemEl
 * @return {string}
 */
function thumbSrcFor( itemEl ) {
    const img = itemEl.querySelector( 'img' );
    if ( ! img ) return '';
    return img.dataset.fgThumbSrc || img.getAttribute( 'src' ) || '';
}

function revealAllItems( trackEl ) {
    const all = Array.prototype.slice.call(
        trackEl.querySelectorAll( ':scope > .fg-item' )
    );
    for ( let i = 0; i < all.length; i++ ) {
        all[ i ].classList.remove( 'fg-item-hidden' );
    }
}

/**
 * Build the thumbnail strip (mini-image navigators). Each thumb scrolls
 * the main carousel to that item's PAGE when clicked. When the active
 * page changes, the strip auto-scrolls the active thumb toward its
 * center.
 *
 * @param {Element} containerEl  Where to append the strip (.fg-carousel-container).
 * @param {Element} collectionEl Outer collection, used for items-per-view lookups.
 * @param {Element[]} items
 * @param {{ current: () => number, total: () => number, goTo: (i: number) => void }} indexState
 */
function renderThumbnails( containerEl, collectionEl, items, indexState ) {
    const wrap = document.createElement( 'div' );
    wrap.className = 'fg-carousel-thumbs';

    const thumbs = [];

    for ( let i = 0; i < items.length; i++ ) {
        const btn = document.createElement( 'button' );
        btn.type = 'button';
        btn.className = 'fg-carousel-thumb';
        btn.setAttribute( 'aria-label', 'Go to slide ' + ( i + 1 ) );

        const isVideo = !! items[ i ].querySelector( '.fg-video' );
        if ( isVideo ) {
            btn.classList.add( 'fg-carousel-thumb--video' );
        }

        const thumbSrc = thumbSrcFor( items[ i ] );
        if ( thumbSrc ) {
            const t = document.createElement( 'img' );
            t.src = thumbSrc;
            t.alt = '';
            t.loading = 'lazy';
            btn.appendChild( t );
        } else {
            const placeholder = document.createElement( 'span' );
            placeholder.className = 'fg-carousel-thumb-placeholder';
            placeholder.setAttribute( 'aria-hidden', 'true' );
            btn.appendChild( placeholder );
        }

        if ( isVideo ) {
            const badge = document.createElement( 'span' );
            badge.className = 'fg-carousel-thumb-badge';
            badge.setAttribute( 'aria-hidden', 'true' );
            btn.appendChild( badge );
        }

        const itemIndex = i;
        btn.addEventListener( 'click', ( e ) => {
            e.preventDefault();
            const itemsPerView = readItemsPerView( collectionEl );
            const page = Math.floor( itemIndex / itemsPerView );
            indexState.goTo( page );
        } );

        thumbs.push( btn );
        wrap.appendChild( btn );
    }

    containerEl.appendChild( wrap );

    const reduceMotion = window.matchMedia
        && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

    const centerOnActive = ( activeBtn ) => {
        if ( ! activeBtn ) return;
        const isVertical = wrap.scrollHeight > wrap.clientHeight
            && wrap.scrollWidth <= wrap.clientWidth;

        if ( isVertical ) {
            const target = activeBtn.offsetTop
                - ( wrap.clientHeight - activeBtn.offsetHeight ) / 2;
            wrap.scrollTo( {
                top:      Math.max( 0, target ),
                behavior: reduceMotion ? 'auto' : 'smooth',
            } );
        } else {
            const target = activeBtn.offsetLeft
                - ( wrap.clientWidth - activeBtn.offsetWidth ) / 2;
            wrap.scrollTo( {
                left:     Math.max( 0, target ),
                behavior: reduceMotion ? 'auto' : 'smooth',
            } );
        }
    };

    const updateActive = ( pageIndex ) => {
        const itemsPerView = readItemsPerView( collectionEl );
        const firstItemInPage = pageIndex * itemsPerView;
        const lastItemInPage  = firstItemInPage + itemsPerView - 1;
        let activeBtn = null;
        for ( let i = 0; i < thumbs.length; i++ ) {
            if ( i >= firstItemInPage && i <= lastItemInPage ) {
                thumbs[ i ].classList.add( 'fg-is-active' );
                if ( activeBtn === null ) {
                    activeBtn = thumbs[ i ];
                }
            } else {
                thumbs[ i ].classList.remove( 'fg-is-active' );
            }
        }
        centerOnActive( activeBtn );
    };

    updateActive( 0 );

    return {
        setCurrent: updateActive,
        destroy: () => {
            if ( wrap.parentNode ) wrap.parentNode.removeChild( wrap );
        },
    };
}

function attach( collectionEl ) {
    if ( ! collectionEl.matches( '[data-fg-layout="slider"]' ) ) return;
    if ( collectionEl.dataset.fgCarouselReady === '1' ) return;
    collectionEl.dataset.fgCarouselReady = '1';
    setup( collectionEl );
}

bootLayout( attach, 10 );
