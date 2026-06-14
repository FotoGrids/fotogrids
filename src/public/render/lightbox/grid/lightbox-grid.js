/**
 * FotoGrids — LightboxGrid
 *
 * A "show all" overlay distinct from the classic Lightbox slideshow: a
 * scrollable, Airbnb-style grid of every item (one full-width image, then
 * two side-by-side, repeating) with a minimal toolbar (Back + Share).
 *
 * It is opened only by the Featured Item layout's auto "Show all" button
 * (the [data-fg-show-all] element inside the gallery wrapper). Clicking an
 * item inside the grid runs the gallery's own click behaviour:
 *   - lightbox → opens the classic Lightbox over the full item set
 *     (via FotoGridsLightbox.instance.openSlides, when available).
 *   - any link behaviour → navigates the item's link.
 *
 * Exposed as window.FotoGrids.modules.lightboxGrid.{ open, close }.
 */

import { bootLayout } from '../../layouts/_helpers/layout-helpers.js';

const COLOR_ATTR_TO_VAR = {
    'data-fg-lb-bg':                 '--fg-lb-bg',
    'data-fg-lb-toolbar-bg':         '--fg-lb-toolbar-bg',
    'data-fg-lb-toolbar-btn-color':  '--fg-lb-toolbar-btn-color',
    'data-fg-lb-toolbar-btn-hover':  '--fg-lb-toolbar-btn-hover',
    'data-fg-lb-toolbar-btn-active-bg': '--fg-lb-toolbar-btn-active-bg',
    'data-fg-lb-info-text':          '--fg-lb-info-text',
};

let overlay = null;
let keyHandler = null;
let lastFocus = null;

function close() {
    if ( ! overlay ) return;
    overlay.remove();
    overlay = null;
    document.body.style.overflow = '';
    if ( keyHandler ) {
        document.removeEventListener( 'keydown', keyHandler );
        keyHandler = null;
    }
    if ( lastFocus && typeof lastFocus.focus === 'function' ) {
        lastFocus.focus( { preventScroll: true } );
    }
    lastFocus = null;
}

function svgIcon( paths ) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}

const BACK_ICON  = svgIcon( '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>' );
const SHARE_ICON = svgIcon( '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>'
    + '<circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>' );

/**
 * Group items into rows: 1 full-width, then 2 side-by-side, repeating.
 *
 * @param {Array} items
 * @return {Array<{type: string, items: Array}>}
 */
function groupRows( items ) {
    const rows = [];
    let i = 0;
    while ( i < items.length ) {
        rows.push( { type: 'single', items: [ items[ i ] ] } );
        i += 1;
        if ( i < items.length ) {
            const pair = [ items[ i ] ];
            i += 1;
            if ( i < items.length ) {
                pair.push( items[ i ] );
                i += 1;
            }
            rows.push( { type: 'pair', items: pair } );
        }
    }
    return rows;
}

/**
 * Build a classic-lightbox slide dict from a stamped grid item, matching
 * the shape buildSlideFromTrigger() produces.
 *
 * @param {object} it
 * @return {object}
 */
function slideFromItem( it ) {
    return {
        triggerEl: null,
        figureEl:  null,
        sequenceIndex: null,
        fullSrc:  it.full || it.thumb || '',
        thumbSrc: it.thumb || '',
        alt:      it.alt || '',
        caption:  it.caption || '',
        title:    it.title || '',
        id:       String( it.id || '' ),
    };
}

/**
 * Open the LightboxGrid overlay.
 *
 * @param {object} config
 *   items      — array of { id, full, thumb, alt, title, caption, video }.
 *   galleryEl  — the originating gallery wrapper (for colour vars + click replay).
 *   clickMode  — the gallery's click behaviour ('lightbox' | 'direct' | ...).
 *   sharing    — parsed data-fg-sharing payload or null.
 *   label      — accessible dialog label.
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

    // Map the gallery's lightbox colours onto the overlay so the chrome
    // matches the gallery's lightbox theme.
    if ( config.galleryEl ) {
        Object.keys( COLOR_ATTR_TO_VAR ).forEach( ( attr ) => {
            const v = config.galleryEl.getAttribute( attr );
            if ( v ) overlay.style.setProperty( COLOR_ATTR_TO_VAR[ attr ], v );
        } );
    }

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
    const sharingEnabled = config.sharing && config.sharing.enabled;
    if ( sharingEnabled ) {
        const shareWrap = document.createElement( 'div' );
        shareWrap.className = 'fg-lb-grid-share-wrap';

        const shareBtn = document.createElement( 'button' );
        shareBtn.type = 'button';
        shareBtn.className = 'fg-lb-grid-btn fg-lb-grid-share';
        shareBtn.setAttribute( 'aria-expanded', 'false' );
        shareBtn.innerHTML = SHARE_ICON + '<span>' + ( config.shareLabel || 'Share' ) + '</span>';

        // Build the share bar once via the gallery's sharing runtime
        // (renderShareBar) and toggle it as a small popover under the button.
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
                    // No single item context — share the gallery's page URL.
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

        // Close the popover on outside click.
        document.addEventListener( 'click', ( e ) => {
            if ( popover && ! shareWrap.contains( e.target ) ) {
                popover.remove();
                popover = null;
                shareBtn.setAttribute( 'aria-expanded', 'false' );
            }
        } );

        shareWrap.appendChild( shareBtn );
        end.appendChild( shareWrap );
    }

    toolbar.appendChild( start );
    toolbar.appendChild( end );

    /* Content */
    const content = document.createElement( 'div' );
    content.className = 'fg-lb-grid-content';
    const inner = document.createElement( 'div' );
    inner.className = 'fg-lb-grid-inner';

    const rows = groupRows( items );
    let flatIndex = 0;
    rows.forEach( ( row ) => {
        const rowEl = document.createElement( 'div' );
        rowEl.className = 'fg-lb-grid-row fg-lb-grid-row--' + row.type;
        row.items.forEach( ( it ) => {
            const idx = flatIndex;
            flatIndex += 1;
            const tile = document.createElement( 'button' );
            tile.type = 'button';
            tile.className = 'fg-lb-grid-tile' + ( it.video ? ' fg-lb-grid-tile--video' : '' );
            tile.setAttribute( 'aria-label', it.title || it.caption || ( 'Item ' + ( idx + 1 ) ) );
            const img = document.createElement( 'img' );
            // The grid is a high-resolution browse view (big tiles), so use the
            // full-size source; fall back to the thumb only when no full exists.
            img.src = it.full || it.thumb || '';
            img.alt = it.alt || '';
            img.loading = 'lazy';
            tile.appendChild( img );
            tile.addEventListener( 'click', () => onTileClick( config, items, idx ) );
            rowEl.appendChild( tile );
        } );
        inner.appendChild( rowEl );
    } );

    content.appendChild( inner );
    overlay.appendChild( toolbar );
    overlay.appendChild( content );
    document.body.appendChild( overlay );
    document.body.style.overflow = 'hidden';

    keyHandler = ( e ) => { if ( e.key === 'Escape' ) close(); };
    document.addEventListener( 'keydown', keyHandler );

    backBtn.focus();
}

/**
 * Replay the gallery's click action for the clicked grid item.
 *
 * @param {object} config
 * @param {Array}  items
 * @param {number} index
 */
function onTileClick( config, items, index ) {
    if ( config.clickMode === 'lightbox' ) {
        const lb = window.FotoGridsLightbox && window.FotoGridsLightbox.instance;
        if ( lb && typeof lb.openSlides === 'function' && config.galleryEl ) {
            const slides = items.map( slideFromItem );
            close();
            lb.openSlides( config.galleryEl, slides, index );
            return;
        }
        // Fallback: drop a single image into the mini overlay.
        const mini = window.FotoGrids && window.FotoGrids.modules && window.FotoGrids.modules.lightboxMini;
        if ( mini && typeof mini.open === 'function' ) {
            const img = document.createElement( 'img' );
            img.src = items[ index ].full || items[ index ].thumb || '';
            img.alt = items[ index ].alt || '';
            mini.open( img, { label: items[ index ].title || 'Image' } );
            return;
        }
    }

    // Link behaviours: navigate to the item's link when present.
    const link = items[ index ] && items[ index ].link;
    if ( link ) {
        window.location.href = link;
    }
}

/**
 * Wire the Show all button inside a gallery wrapper.
 *
 * @param {HTMLElement} galleryEl
 */
function attach( galleryEl ) {
    if ( ! galleryEl.matches( '[data-fg-layout="featured-item"]' ) ) return;
    const btn = galleryEl.querySelector( '[data-fg-show-all]' );
    if ( ! btn ) return;
    if ( btn.dataset.fgGridReady === '1' ) return;
    btn.dataset.fgGridReady = '1';

    btn.addEventListener( 'click', ( e ) => {
        e.preventDefault();
        let items = [];
        try {
            items = JSON.parse( galleryEl.getAttribute( 'data-fg-grid-items' ) || '[]' );
        } catch ( err ) {
            items = [];
        }
        let sharing = null;
        try {
            sharing = JSON.parse( galleryEl.getAttribute( 'data-fg-sharing' ) || 'null' );
        } catch ( err ) {
            sharing = null;
        }
        open( {
            items,
            galleryEl,
            clickMode:  galleryEl.getAttribute( 'data-fg-grid-click' ) || '',
            sharing,
            label:      btn.getAttribute( 'data-fg-show-all-label' ) || 'All photos',
        } );
    } );
}

function init() {
    window.FotoGrids = window.FotoGrids || {};
    window.FotoGrids.modules = window.FotoGrids.modules || {};
    window.FotoGrids.modules.lightboxGrid = { open, close };
}

init();
bootLayout( attach, 10 );
