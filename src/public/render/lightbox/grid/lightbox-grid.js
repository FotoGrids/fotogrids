/**
 * FotoGrids - LightboxGrid
 *
 * A "show all" overlay distinct from the classic Lightbox slideshow: a
 * scrollable, Airbnb-style grid of every item (one full-width image, then
 * two side-by-side, repeating) with a minimal toolbar (Back + Share).
 *
 * Clicking a grid tile zooms it in place: the grid fades out, the clicked
 * image transitions to the centre of the screen at full size, the toolbar
 * swaps Share for a counter + close button, and previous / next arrows fade
 * in. Closing the zoom returns to the grid.
 *
 * Opened by the Featured Item layout's "Show all" button, and by clicking any
 * item on Featured or a variant-eligible grid gallery.
 *
 * Exposed as window.FotoGrids.modules.lightboxGrid.{ open, close }.
 */

import { bootLayout } from '../../layouts/_helpers/layout-helpers.js';

let overlay = null;
let keyHandler = null;
let lastFocus = null;
let view = null;

function svgIcon( paths ) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}

/**
 * Build a scoped <style> element carrying the per-gallery max content width
 * (responsive) and tile aspect ratio. Keeping these in real CSS (rather than
 * inline custom properties) keeps the responsive breakpoints declarative.
 *
 * @param {string} scope  Unique scope token (matches data-fg-scope).
 * @param {object} config
 * @return {HTMLStyleElement}
 */
function buildScopeStyle( scope, config ) {
    const sel = '.fg-lb-grid[data-fg-scope="' + scope + '"]';
    const mw = config.maxWidth || {};
    const aspect = config.aspect ? config.aspect.replace( '/', ' / ' ) : '';

    const lines = [
        sel + ' { --fg-lb-grid-max-width: ' + ( mw.desktop || '60vw' ) + '; }',
    ];
    if ( aspect ) {
        lines.push( sel + ' { --fg-lb-grid-aspect: ' + aspect + '; }' );
    }
    lines.push(
        '@media (max-width: 1024px) { ' + sel + ' { --fg-lb-grid-max-width: ' + ( mw.tablet || '80vw' ) + '; } }'
    );
    lines.push(
        '@media (max-width: 600px) { ' + sel + ' { --fg-lb-grid-max-width: ' + ( mw.mobile || '90vw' ) + '; } }'
    );

    const style = document.createElement( 'style' );
    style.textContent = lines.join( '\n' );
    return style;
}

/**
 * The toolbar button colour custom properties, keyed by the config field that
 * carries each value. Mirrors the data-fg-grid-btn-* attributes stamped by the
 * Lightbox_Grid feature.
 */
const BUTTON_COLOR_VARS = {
    bg:                '--fg-lb-toolbar-btn-bg',
    color:             '--fg-lb-toolbar-btn-color',
    borderColor:       '--fg-lb-toolbar-btn-border-color',
    hoverBg:           '--fg-lb-toolbar-btn-hover-bg',
    hoverColor:        '--fg-lb-toolbar-btn-hover',
    hoverBorderColor:  '--fg-lb-toolbar-btn-hover-border-color',
    focusBg:           '--fg-lb-toolbar-btn-focus-bg',
    focusColor:        '--fg-lb-toolbar-btn-focus-color',
    focusBorderColor:  '--fg-lb-toolbar-btn-focus-border-color',
};

/**
 * Write the custom toolbar button colours onto the overlay as inline custom
 * properties. Unset values are skipped, leaving the theme palette in place.
 *
 * @param {HTMLElement} el     The overlay element.
 * @param {object}      colors Map of config field -> colour string.
 */
function applyButtonColors( el, colors ) {
    if ( ! colors ) return;
    Object.keys( BUTTON_COLOR_VARS ).forEach( ( field ) => {
        const value = colors[ field ];
        if ( value ) {
            el.style.setProperty( BUTTON_COLOR_VARS[ field ], value );
        }
    } );
}

const BACK_ICON  = svgIcon( '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>' );
const SHARE_ICON = svgIcon( '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>'
    + '<circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>' );
const PREV_ICON  = svgIcon( '<path d="M15 18l-6-6 6-6"/>' );
const NEXT_ICON  = svgIcon( '<path d="M9 18l6-6-6-6"/>' );
const CLOSE_ICON = svgIcon( '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>' );

function close() {
    if ( ! overlay ) return;
    const el = overlay;
    overlay = null;
    view = null;
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    if ( keyHandler ) {
        document.removeEventListener( 'keydown', keyHandler );
        keyHandler = null;
    }

    // Fade the overlay out, then remove it.
    el.classList.remove( 'fg-is-open' );
    let removed = false;
    const remove = () => {
        if ( removed ) return;
        removed = true;
        el.removeEventListener( 'transitionend', onEnd );
        el.remove();
    };
    const onEnd = ( e ) => {
        if ( e.target === el && e.propertyName === 'opacity' ) remove();
    };
    el.addEventListener( 'transitionend', onEnd );
    setTimeout( remove, 350 );

    if ( lastFocus && typeof lastFocus.focus === 'function' ) {
        lastFocus.focus( { preventScroll: true } );
    }
    lastFocus = null;
}

/**
 * Group items into rows: 1 full-width, then 2 side-by-side, repeating.
 *
 * @param {Array} items
 * @return {Array<{type: string, items: Array, indices: Array}>}
 */
function groupRows( items ) {
    const rows = [];
    let i = 0;
    while ( i < items.length ) {
        rows.push( { type: 'single', items: [ items[ i ] ], indices: [ i ] } );
        i += 1;
        if ( i < items.length ) {
            const pair = [ items[ i ] ];
            const pairIdx = [ i ];
            i += 1;
            if ( i < items.length ) {
                pair.push( items[ i ] );
                pairIdx.push( i );
                i += 1;
            }
            rows.push( { type: 'pair', items: pair, indices: pairIdx } );
        }
    }
    return rows;
}

/**
 * Resolve a caption string for the chosen source.
 *
 * @param {object} it     Stamped grid item.
 * @param {string} source 'caption' | 'title' | 'description'.
 * @return {string}
 */
function captionTextFor( it, source ) {
    if ( source === 'title' ) return it.title || '';
    if ( source === 'description' ) return it.description || '';
    return it.caption || '';
}

/**
 * Open the LightboxGrid overlay.
 *
 * @param {object} config
 *   items, galleryEl, clickMode, sharing, label, captions, fullCaptions,
 *   captionSource, openAt, maxWidth { desktop, tablet, mobile }.
 */
function open( config ) {
    const items = Array.isArray( config.items ) ? config.items : [];
    if ( items.length === 0 ) return;
    close();

    lastFocus = document.activeElement;

    overlay = document.createElement( 'div' );
    overlay.className = 'fg-lb-grid';
    overlay.setAttribute( 'role', 'dialog' );
    overlay.setAttribute( 'aria-modal', 'true' );
    overlay.setAttribute( 'aria-label', config.label || 'All photos' );

    // Theme: a single attribute drives the chrome palette; the CSS assigns the
    // --fg-lb-* variables per theme.
    overlay.setAttribute( 'data-fg-lb-theme', config.theme === 'light' ? 'light' : 'dark' );

    // Optional per-state custom toolbar button colours override the theme
    // palette via inline custom properties on the overlay.
    applyButtonColors( overlay, config.buttonColors );

    // Per-gallery sizing (max content width + tile aspect) is scoped through a
    // generated id so the values live in real CSS rather than inline styles.
    const scope = 'fg-lb-grid-' + ( Math.random().toString( 36 ).slice( 2, 9 ) );
    overlay.setAttribute( 'data-fg-scope', scope );
    overlay.appendChild( buildScopeStyle( scope, config ) );

    /* Toolbar */
    const toolbar = document.createElement( 'div' );
    toolbar.className = 'fg-lb-grid-toolbar';

    const start = document.createElement( 'div' );
    start.className = 'fg-lb-grid-toolbar-start';
    const backBtn = document.createElement( 'button' );
    backBtn.type = 'button';
    backBtn.className = 'fg-lb-grid-btn fg-lb-grid-back';
    backBtn.innerHTML = BACK_ICON + '<span>' + ( config.backLabel || 'Back' ) + '</span>';
    backBtn.addEventListener( 'click', close );
    start.appendChild( backBtn );

    const end = document.createElement( 'div' );
    end.className = 'fg-lb-grid-toolbar-end';

    // Grid-mode toolbar end: the share button (when sharing is enabled).
    const gridChrome = document.createElement( 'div' );
    gridChrome.className = 'fg-lb-grid-chrome fg-lb-grid-chrome--grid';
    if ( config.sharing && config.sharing.enabled ) {
        gridChrome.appendChild( buildShareButton( config ) );
    }

    // Zoom-mode toolbar end: counter + close. Hidden until a tile is zoomed.
    const zoomChrome = document.createElement( 'div' );
    zoomChrome.className = 'fg-lb-grid-chrome fg-lb-grid-chrome--zoom';
    const counter = document.createElement( 'span' );
    counter.className = 'fg-lb-grid-counter';
    const closeZoomBtn = document.createElement( 'button' );
    closeZoomBtn.type = 'button';
    closeZoomBtn.className = 'fg-lb-grid-btn fg-lb-grid-zoom-close';
    closeZoomBtn.setAttribute( 'aria-label', 'Close image' );
    closeZoomBtn.innerHTML = CLOSE_ICON;
    closeZoomBtn.addEventListener( 'click', closeZoom );
    zoomChrome.appendChild( counter );
    zoomChrome.appendChild( closeZoomBtn );

    end.appendChild( gridChrome );
    end.appendChild( zoomChrome );
    toolbar.appendChild( start );
    toolbar.appendChild( end );

    /* Content */
    const content = document.createElement( 'div' );
    content.className = 'fg-lb-grid-content';
    const inner = document.createElement( 'div' );
    inner.className = 'fg-lb-grid-inner';

    const showCaptions = config.captions === true;
    const captionSource = config.captionSource || 'caption';
    const tilesByIndex = [];

    const rows = groupRows( items );
    rows.forEach( ( row ) => {
        const rowEl = document.createElement( 'div' );
        rowEl.className = 'fg-lb-grid-row fg-lb-grid-row--' + row.type;
        row.items.forEach( ( it, n ) => {
            const idx = row.indices[ n ];
            const tile = document.createElement( 'button' );
            tile.type = 'button';
            tile.className = 'fg-lb-grid-tile fg-lb-grid-tile--' + row.type
                + ( it.video ? ' fg-lb-grid-tile--video' : '' );
            tile.setAttribute( 'aria-label', it.title || it.caption || ( 'Item ' + ( idx + 1 ) ) );

            // The image lives inside an aspect-ratio frame that owns the
            // rounding + clipping, so the hover zoom scales the image within
            // its frame rather than growing the whole tile.
            const media = document.createElement( 'span' );
            media.className = 'fg-lb-grid-tile-media';
            const img = document.createElement( 'img' );
            img.src = it.full || it.thumb || '';
            img.alt = it.alt || '';
            img.loading = 'lazy';
            media.appendChild( img );
            tile.appendChild( media );

            if ( showCaptions ) {
                const text = captionTextFor( it, captionSource );
                if ( text ) {
                    const cap = document.createElement( 'span' );
                    cap.className = 'fg-lb-grid-tile-caption';
                    cap.textContent = text;
                    tile.appendChild( cap );
                }
            }

            tile.addEventListener( 'click', () => openZoom( idx ) );
            rowEl.appendChild( tile );
            tilesByIndex[ idx ] = media;
        } );
        inner.appendChild( rowEl );
    } );

    content.appendChild( inner );

    /* Zoom stage (built once, populated on demand) */
    const stage = document.createElement( 'div' );
    stage.className = 'fg-lb-grid-stage';

    const prevBtn = document.createElement( 'button' );
    prevBtn.type = 'button';
    prevBtn.className = 'fg-lb-grid-nav fg-lb-grid-prev';
    prevBtn.setAttribute( 'aria-label', 'Previous' );
    prevBtn.innerHTML = PREV_ICON;
    prevBtn.addEventListener( 'click', () => zoomBy( -1 ) );

    const nextBtn = document.createElement( 'button' );
    nextBtn.type = 'button';
    nextBtn.className = 'fg-lb-grid-nav fg-lb-grid-next';
    nextBtn.setAttribute( 'aria-label', 'Next' );
    nextBtn.innerHTML = NEXT_ICON;
    nextBtn.addEventListener( 'click', () => zoomBy( 1 ) );

    const figure = document.createElement( 'div' );
    figure.className = 'fg-lb-grid-zoom-figure';
    const clip = document.createElement( 'div' );
    clip.className = 'fg-lb-grid-zoom-clip';
    const zoomImg = document.createElement( 'img' );
    clip.appendChild( zoomImg );
    figure.appendChild( clip );
    const zoomCap = document.createElement( 'div' );
    zoomCap.className = 'fg-lb-grid-zoom-caption';
    figure.appendChild( zoomCap );

    stage.appendChild( prevBtn );
    stage.appendChild( figure );
    stage.appendChild( nextBtn );

    overlay.appendChild( toolbar );
    overlay.appendChild( content );
    overlay.appendChild( stage );
    document.body.appendChild( overlay );
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Fade the overlay in on the next frame.
    requestAnimationFrame( () => {
        if ( overlay ) overlay.classList.add( 'fg-is-open' );
    } );

    view = {
        config, items, content, stage, toolbar, counter, figure, clip,
        zoomImg, zoomCap, prevBtn, nextBtn, tilesByIndex,
        zoomIndex: -1,
        sourceTile: null,
        animating: false,
        fullCaptions: config.fullCaptions === true,
        captionSource,
    };

    keyHandler = ( e ) => {
        if ( e.key === 'Escape' ) {
            if ( view && view.zoomIndex >= 0 ) closeZoom();
            else close();
        } else if ( view && view.zoomIndex >= 0 ) {
            if ( e.key === 'ArrowLeft' ) zoomBy( -1 );
            else if ( e.key === 'ArrowRight' ) zoomBy( 1 );
        }
    };
    document.addEventListener( 'keydown', keyHandler );

    const openAt = config.openAt;
    if ( typeof openAt === 'number' && tilesByIndex[ openAt ] ) {
        tilesByIndex[ openAt ].scrollIntoView( { block: 'center' } );
    }

    backBtn.focus();
}

/**
 * Build the share button + popover for the grid toolbar.
 *
 * @param {object} config
 * @return {HTMLElement}
 */
function buildShareButton( config ) {
    const shareWrap = document.createElement( 'div' );
    shareWrap.className = 'fg-lb-grid-share-wrap';

    const shareBtn = document.createElement( 'button' );
    shareBtn.type = 'button';
    shareBtn.className = 'fg-lb-grid-btn fg-lb-grid-share';
    shareBtn.setAttribute( 'aria-expanded', 'false' );
    shareBtn.innerHTML = SHARE_ICON + '<span>' + ( config.shareLabel || 'Share' ) + '</span>';

    let popover = null;
    const buildPopover = () => {
        const sharingMod = window.FotoGrids
            && window.FotoGrids.modules
            && window.FotoGrids.modules.sharing;
        if ( ! sharingMod || typeof sharingMod.renderShareBar !== 'function' ) {
            return null;
        }
        const bar = sharingMod.renderShareBar(
            config.sharing,
            {
                id:        '',
                fullUrl:   window.location.href,
                caption:   '',
                galleryId: config.galleryEl ? config.galleryEl.getAttribute( 'data-fg-gallery-id' ) : '',
                galleryEl: config.galleryEl || null,
            },
            { layout: 'grid' }
        );
        if ( ! bar ) return null;
        const pop = document.createElement( 'div' );
        pop.className = 'fg-lb-grid-share-popover';
        pop.appendChild( bar );
        return pop;
    };

    shareBtn.addEventListener( 'click', ( e ) => {
        e.stopPropagation();
        if ( popover ) {
            popover.remove();
            popover = null;
            shareBtn.setAttribute( 'aria-expanded', 'false' );
            return;
        }
        popover = buildPopover();
        if ( popover ) {
            shareWrap.appendChild( popover );
            shareBtn.setAttribute( 'aria-expanded', 'true' );
        } else if ( navigator.share ) {
            navigator.share( { url: window.location.href } ).catch( () => {} );
        }
    } );

    document.addEventListener( 'click', ( e ) => {
        if ( popover && ! shareWrap.contains( e.target ) ) {
            popover.remove();
            popover = null;
            shareBtn.setAttribute( 'aria-expanded', 'false' );
        }
    } );

    shareWrap.appendChild( shareBtn );
    return shareWrap;
}

/**
 * The on-screen rect of an item's grid tile image frame, or null when the
 * tile isn't laid out.
 *
 * @param {number} index
 * @return {DOMRect|null}
 */
function tileRect( index ) {
    const media = view && view.tilesByIndex[ index ];
    if ( ! media ) return null;
    const r = media.getBoundingClientRect();
    return ( r.width > 0 && r.height > 0 ) ? r : null;
}

/**
 * The viewport-relative full-preview box for an image of the given natural
 * aspect. The image is contain-fitted into the area under the toolbar and
 * pinned so its top edge sits at the toolbar's bottom; it is centred
 * horizontally. The clip fills this box (cover) to show the whole picture.
 *
 * @param {number} natW Natural image width.
 * @param {number} natH Natural image height.
 * @return {{left:number, top:number, width:number, height:number}}
 */
function fullBox( natW, natH ) {
    const toolbarBottom = view.toolbar.getBoundingClientRect().bottom;
    const padX = Math.min( 0.04 * window.innerWidth, 48 );
    const padBottom = 64; // room for the caption + arrows.
    const availW = window.innerWidth - 2 * padX;
    const availH = window.innerHeight - toolbarBottom - padBottom;
    const ratio = ( natW > 0 && natH > 0 ) ? natW / natH : 16 / 9;

    let w = availW;
    let h = w / ratio;
    if ( h > availH ) {
        h = availH;
        w = h * ratio;
    }
    return {
        left: Math.round( ( window.innerWidth - w ) / 2 ),
        top: Math.round( toolbarBottom ),
        width: Math.round( w ),
        height: Math.round( h ),
    };
}

/**
 * Set the fixed clip box to an explicit viewport rect (no transition).
 *
 * @param {{left:number, top:number, width:number, height:number}} box
 */
function setClipBox( box ) {
    const clip = view.clip;
    clip.style.position = 'fixed';
    clip.style.left = box.left + 'px';
    clip.style.top = box.top + 'px';
    clip.style.width = box.width + 'px';
    clip.style.height = box.height + 'px';
    clip.style.margin = '0';
}

/**
 * Pin the full-image caption just below a box.
 *
 * @param {{left:number, top:number, width:number, height:number}} box
 */
function positionCaption( box ) {
    const cap = view.zoomCap;
    cap.style.left = '0';
    cap.style.top = ( box.top + box.height + 12 ) + 'px';
}

/**
 * Zoom a grid tile: the clip box morphs from the clicked tile's exact rect to
 * the centred full-preview box, re-cropping the cover image from cropped
 * (thumbnail) to whole (full). The toolbar swaps to counter + close and the
 * prev/next arrows fade in.
 *
 * @param {number} index
 */
function openZoom( index ) {
    if ( ! view || view.animating ) return;
    const from = tileRect( index );
    if ( ! from ) return;

    view.zoomIndex = index;
    view.sourceTile = view.tilesByIndex[ index ];
    paintZoom();
    overlay.classList.add( 'fg-is-zooming' );
    // Hide the originating tile image so it doesn't peek behind the morph.
    const tileEl = view.sourceTile && view.sourceTile.closest( '.fg-lb-grid-tile' );
    if ( tileEl ) tileEl.classList.add( 'fg-is-source' );

    const clip = view.clip;
    const start = () => {
        if ( ! view ) return;
        const natW = view.zoomImg.naturalWidth || from.width;
        const natH = view.zoomImg.naturalHeight || from.height;
        const target = fullBox( natW, natH );
        positionCaption( target );

        // Start at the tile rect with no transition...
        clip.style.transition = 'none';
        setClipBox( { left: from.left, top: from.top, width: from.width, height: from.height } );
        // ...force layout, then animate the real box to the full preview.
        void clip.offsetWidth;
        view.animating = true;
        clip.style.transition = 'left var(--fg-lb-grid-morph) var(--fg-lb-grid-morph-ease),'
            + 'top var(--fg-lb-grid-morph) var(--fg-lb-grid-morph-ease),'
            + 'width var(--fg-lb-grid-morph) var(--fg-lb-grid-morph-ease),'
            + 'height var(--fg-lb-grid-morph) var(--fg-lb-grid-morph-ease)';
        setClipBox( target );

        let done = false;
        const onEnd = () => {
            if ( done ) return;
            done = true;
            clip.removeEventListener( 'transitionend', onEnd );
            if ( view ) view.animating = false;
        };
        clip.addEventListener( 'transitionend', onEnd );
        setTimeout( onEnd, 500 );
    };

    if ( view.zoomImg.complete && view.zoomImg.naturalWidth > 0 ) {
        start();
    } else {
        let ran = false;
        const run = () => { if ( ! ran ) { ran = true; start(); } };
        view.zoomImg.addEventListener( 'load', run, { once: true } );
        requestAnimationFrame( run );
    }
}

/**
 * Restore the grid: the clip box morphs back to its tile rect, then the grid
 * view is shown.
 */
function closeZoom() {
    if ( ! view || view.zoomIndex < 0 || view.animating ) return;
    const media = view.tilesByIndex[ view.zoomIndex ];
    if ( media && typeof media.scrollIntoView === 'function' ) {
        media.scrollIntoView( { block: 'nearest' } );
    }
    const to = tileRect( view.zoomIndex );
    const clip = view.clip;
    const tileEl = media && media.closest( '.fg-lb-grid-tile' );

    // The caption disappears instantly on the way out.
    view.zoomCap.style.display = 'none';

    const teardown = () => {
        if ( ! view ) return;
        view.animating = false;
        view.zoomIndex = -1;
        view.sourceTile = null;
        // 1) Reveal the destination tile image while the clip still covers it.
        if ( tileEl ) tileEl.classList.remove( 'fg-is-source' );
        // 2) Next frame, once the tile image has painted, drop the clip and the
        //    zoom state together - so the hand-off never shows a gap (no flash).
        requestAnimationFrame( () => {
            overlay.classList.remove( 'fg-is-zooming', 'fg-is-closing' );
            clip.removeAttribute( 'style' );
            overlay.querySelectorAll( '.fg-lb-grid-tile.fg-is-source' )
                .forEach( ( el ) => el.classList.remove( 'fg-is-source' ) );
        } );
    };

    if ( ! to ) {
        teardown();
        return;
    }

    view.animating = true;

    // Closing keeps the clip + arrows in the zoom layer while fading the grid
    // back in underneath (fg-is-closing), then hands off at the end.
    overlay.classList.add( 'fg-is-closing' );

    // Animate the real box from the current full preview to the tile rect.
    clip.style.transition = 'left var(--fg-lb-grid-morph) var(--fg-lb-grid-morph-ease),'
        + 'top var(--fg-lb-grid-morph) var(--fg-lb-grid-morph-ease),'
        + 'width var(--fg-lb-grid-morph) var(--fg-lb-grid-morph-ease),'
        + 'height var(--fg-lb-grid-morph) var(--fg-lb-grid-morph-ease)';
    requestAnimationFrame( () => {
        setClipBox( { left: to.left, top: to.top, width: to.width, height: to.height } );

        let done = false;
        const onEnd = () => {
            if ( done ) return;
            done = true;
            clip.removeEventListener( 'transitionend', onEnd );
            teardown();
        };
        clip.addEventListener( 'transitionend', onEnd );
        setTimeout( onEnd, 500 );
    } );
}

/**
 * Move the zoom to a sibling item (wrapping), cross-fading the image and
 * resizing the clip to the new image's full box.
 *
 * @param {number} delta
 */
function zoomBy( delta ) {
    if ( ! view || view.zoomIndex < 0 || view.animating ) return;
    const n = view.items.length;
    view.zoomIndex = ( view.zoomIndex + delta + n ) % n;

    const fig = view.figure;
    fig.classList.add( 'fg-is-swapping' );
    const swap = () => {
        if ( ! view ) return;
        paintZoom();
        const apply = () => {
            const natW = view.zoomImg.naturalWidth || 16;
            const natH = view.zoomImg.naturalHeight || 9;
            const box = fullBox( natW, natH );
            view.clip.style.transition = 'none';
            setClipBox( box );
            positionCaption( box );
            requestAnimationFrame( () => fig.classList.remove( 'fg-is-swapping' ) );
        };
        if ( view.zoomImg.complete && view.zoomImg.naturalWidth > 0 ) {
            apply();
        } else {
            view.zoomImg.addEventListener( 'load', apply, { once: true } );
        }
    };
    setTimeout( swap, 150 );
}

/** Paint the current zoom item into the clip + counter (no morph). */
function paintZoom() {
    if ( ! view || view.zoomIndex < 0 ) return;
    const it = view.items[ view.zoomIndex ];
    view.zoomImg.src = it.full || it.thumb || '';
    view.zoomImg.alt = it.alt || '';

    const text = view.fullCaptions ? captionTextFor( it, view.captionSource ) : '';
    view.zoomCap.textContent = text;
    view.zoomCap.style.display = text ? '' : 'none';

    view.counter.textContent = ( view.zoomIndex + 1 ) + ' of ' + view.items.length;

    const single = view.items.length <= 1;
    view.prevBtn.style.display = single ? 'none' : '';
    view.nextBtn.style.display = single ? 'none' : '';
}

function readItems( galleryEl ) {
    try {
        return JSON.parse( galleryEl.getAttribute( 'data-fg-grid-items' ) || '[]' );
    } catch ( err ) {
        return [];
    }
}

function readSharing( galleryEl ) {
    try {
        return JSON.parse( galleryEl.getAttribute( 'data-fg-sharing' ) || 'null' );
    } catch ( err ) {
        return null;
    }
}

/**
 * Read the optional custom toolbar button colours stamped on the gallery
 * wrapper. Returns null when none are set.
 *
 * @param {HTMLElement} galleryEl
 * @return {object|null}
 */
function readButtonColors( galleryEl ) {
    const attrs = {
        bg:               'data-fg-grid-btn-bg',
        color:            'data-fg-grid-btn-color',
        borderColor:      'data-fg-grid-btn-border-color',
        hoverBg:          'data-fg-grid-btn-hover-bg',
        hoverColor:       'data-fg-grid-btn-hover-color',
        hoverBorderColor: 'data-fg-grid-btn-hover-border-color',
        focusBg:          'data-fg-grid-btn-focus-bg',
        focusColor:       'data-fg-grid-btn-focus-color',
        focusBorderColor: 'data-fg-grid-btn-focus-border-color',
    };

    const colors = {};
    let found = false;
    Object.keys( attrs ).forEach( ( field ) => {
        const value = galleryEl.getAttribute( attrs[ field ] );
        if ( value ) {
            colors[ field ] = value;
            found = true;
        }
    } );

    return found ? colors : null;
}

function openForGallery( galleryEl, label, openAt ) {
    open( {
        items:         readItems( galleryEl ),
        galleryEl,
        clickMode:     galleryEl.getAttribute( 'data-fg-grid-click' ) || '',
        sharing:       readSharing( galleryEl ),
        label,
        captions:      galleryEl.getAttribute( 'data-fg-grid-captions' ) === '1',
        fullCaptions:  galleryEl.getAttribute( 'data-fg-grid-full-captions' ) === '1',
        captionSource: galleryEl.getAttribute( 'data-fg-grid-caption-source' ) || 'caption',
        openAt:        typeof openAt === 'number' ? openAt : null,
        theme:         galleryEl.getAttribute( 'data-fg-lb-theme' ) || 'dark',
        buttonColors:  readButtonColors( galleryEl ),
        aspect:        galleryEl.getAttribute( 'data-fg-grid-aspect' ) || '',
        maxWidth: {
            desktop: galleryEl.getAttribute( 'data-fg-grid-maxw-desktop' ) || '60vw',
            tablet:  galleryEl.getAttribute( 'data-fg-grid-maxw-tablet' ) || '80vw',
            mobile:  galleryEl.getAttribute( 'data-fg-grid-maxw-mobile' ) || '90vw',
        },
    } );
}

/**
 * Find the flat item index for a clicked .fg-item.
 *
 * @param {HTMLElement} galleryEl
 * @param {HTMLElement} figure
 * @return {number}
 */
function itemIndexFor( galleryEl, figure ) {
    const items = readItems( galleryEl );

    const trigger = figure.querySelector( '[data-fg-lightbox-trigger]' );
    const id = figure.getAttribute( 'data-fg-item-id' )
        || ( trigger && trigger.getAttribute( 'data-fg-item-id' ) );
    if ( id ) {
        const byId = items.findIndex( ( it ) => String( it.id ) === String( id ) );
        if ( byId >= 0 ) return byId;
    }

    const seq = figure.getAttribute( 'data-fg-sequence-index' );
    if ( seq !== null && seq !== '' ) {
        const n = parseInt( seq, 10 );
        if ( ! Number.isNaN( n ) && n >= 0 && n < items.length ) return n;
    }

    return 0;
}

function attach( galleryEl ) {
    if ( galleryEl.dataset.fgGridReady === '1' ) return;

    const isFeatured = galleryEl.matches( '[data-fg-layout="featured-item"]' );
    const openOnItem = galleryEl.getAttribute( 'data-fg-grid-open-on-item' ) === '1';

    if ( ! isFeatured && ! openOnItem ) return;

    galleryEl.dataset.fgGridReady = '1';

    if ( isFeatured ) {
        const btn = galleryEl.querySelector( '[data-fg-show-all]' );
        if ( btn ) {
            btn.addEventListener( 'click', ( e ) => {
                e.preventDefault();
                openForGallery(
                    galleryEl,
                    btn.getAttribute( 'data-fg-show-all-label' ) || 'All photos'
                );
            } );
        }
    }

    galleryEl.addEventListener( 'click', ( e ) => {
        const figure = e.target.closest( '.fg-item' );
        if ( ! figure || ! galleryEl.contains( figure ) ) return;
        if ( e.target.closest( '[data-fg-show-all]' ) ) return;
        e.preventDefault();
        openForGallery( galleryEl, 'All photos', itemIndexFor( galleryEl, figure ) );
    }, true );
}

function init() {
    window.FotoGrids = window.FotoGrids || {};
    window.FotoGrids.modules = window.FotoGrids.modules || {};
    window.FotoGrids.modules.lightboxGrid = { open, close };
}

init();
bootLayout( attach, 10 );
