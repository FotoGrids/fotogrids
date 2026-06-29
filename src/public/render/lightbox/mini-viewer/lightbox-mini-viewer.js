/**
 * FotoGrids - Lightbox Mini viewer
 *
 * The "mini" lightbox variant: a single image centred over a dimmed backdrop,
 * with previous / next arrows, optional bullets, and a close button. It reads
 * the lightbox_mini_* appearance settings stamped on the gallery wrapper and
 * opens when a [data-fg-lightbox-trigger] item is clicked.
 *
 * Exposed as window.FotoGrids.modules.lightboxMiniViewer.{ open, close }.
 */

let overlay = null;
let keyHandler = null;
let lastFocus = null;
let state = null;

function svgIcon( paths ) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}

const PREV_ICON  = svgIcon( '<path d="M15 18l-6-6 6-6"/>' );
const NEXT_ICON  = svgIcon( '<path d="M9 18l6-6-6-6"/>' );
const CLOSE_ICON = svgIcon( '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>' );

/**
 * Build a scoped <style> carrying the per-gallery padding, so the value lives
 * in real CSS rather than an inline style on the overlay.
 *
 * @param {string} scope   Unique scope token (matches data-fg-scope).
 * @param {string} padding CSS length, e.g. "24px".
 * @return {HTMLStyleElement}
 */
function buildScopeStyle( scope, padding ) {
    const sel = '.fg-lb-mv[data-fg-scope="' + scope + '"]';
    const style = document.createElement( 'style' );
    style.textContent = sel + ' { --fg-lb-mv-padding: ' + ( padding || '24px' ) + '; }';
    return style;
}

function close() {
    if ( ! overlay ) return;
    overlay.remove();
    overlay = null;
    state = null;
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    if ( keyHandler ) {
        document.removeEventListener( 'keydown', keyHandler );
        keyHandler = null;
    }
    if ( lastFocus && typeof lastFocus.focus === 'function' ) {
        lastFocus.focus( { preventScroll: true } );
    }
    lastFocus = null;
}

function captionTextFor( it, source ) {
    if ( source === 'title' ) return it.title || '';
    if ( source === 'description' ) return it.description || '';
    return it.caption || '';
}

function render() {
    if ( ! state || ! overlay ) return;
    const { items, index, config } = state;
    const it = items[ index ];

    const img = overlay.querySelector( '.fg-lb-mv-image' );
    img.src = it.full || it.thumb || '';
    img.alt = it.alt || '';

    const cap = overlay.querySelector( '.fg-lb-mv-caption' );
    if ( cap ) {
        const text = config.captions ? captionTextFor( it, config.captionSource ) : '';
        cap.textContent = text;
        cap.style.display = text ? '' : 'none';
    }

    const bullets = overlay.querySelector( '.fg-lb-mv-bullets' );
    if ( bullets ) {
        bullets.querySelectorAll( '.fg-lb-mv-bullet' ).forEach( ( b, i ) => {
            b.setAttribute( 'aria-current', i === index ? 'true' : 'false' );
        } );
    }

    if ( ! config.loop ) {
        const prev = overlay.querySelector( '.fg-lb-mv-prev' );
        const next = overlay.querySelector( '.fg-lb-mv-next' );
        if ( prev ) prev.disabled = index <= 0;
        if ( next ) next.disabled = index >= items.length - 1;
    }
}

function navigate( delta ) {
    if ( ! state ) return;
    const { items, config } = state;
    let next = state.index + delta;
    if ( config.loop ) {
        next = ( next + items.length ) % items.length;
    } else {
        next = Math.max( 0, Math.min( items.length - 1, next ) );
    }
    state.index = next;
    render();
}

/**
 * Open the mini viewer.
 *
 * @param {object} config
 *   items, index, galleryEl, theme, close, arrows, bullets, overlay (backdrop),
 *   blur, border, shadow, radius, captions, captionSource, loop.
 */
function open( config ) {
    const items = Array.isArray( config.items ) ? config.items : [];
    if ( items.length === 0 ) return;
    close();

    lastFocus = document.activeElement;
    state = { items, index: Math.max( 0, config.index || 0 ), config };

    overlay = document.createElement( 'div' );
    overlay.className = 'fg-lb-mv';
    overlay.setAttribute( 'role', 'dialog' );
    overlay.setAttribute( 'aria-modal', 'true' );
    overlay.setAttribute( 'aria-label', 'Image viewer' );

    // Theme drives the palette in CSS; blur level maps to a px value in CSS.
    overlay.setAttribute( 'data-fg-mv-theme', config.theme === 'light' ? 'light' : 'dark' );
    overlay.setAttribute( 'data-fg-mv-blur', config.blur || 'light' );

    // Per-gallery padding via a scoped style block (no inline style).
    const scope = 'fg-lb-mv-' + ( Math.random().toString( 36 ).slice( 2, 9 ) );
    overlay.setAttribute( 'data-fg-scope', scope );
    overlay.appendChild( buildScopeStyle( scope, config.padding ) );

    if ( config.overlay !== false ) {
        const backdrop = document.createElement( 'div' );
        backdrop.className = 'fg-lb-mv-backdrop';
        backdrop.addEventListener( 'click', close );
        overlay.appendChild( backdrop );
    }

    const stage = document.createElement( 'div' );
    stage.className = 'fg-lb-mv-stage';

    const figure = document.createElement( 'div' );
    let figureClass = 'fg-lb-mv-figure';
    if ( config.border ) figureClass += ' fg-lb-mv-figure--border';
    if ( config.shadow ) figureClass += ' fg-lb-mv-figure--shadow';
    if ( config.radius ) figureClass += ' fg-lb-mv-figure--radius';
    figure.className = figureClass;

    const img = document.createElement( 'img' );
    img.className = 'fg-lb-mv-image';
    figure.appendChild( img );

    stage.appendChild( figure );

    // The caption sits below the image frame, not inside the clipped/bordered
    // figure.
    if ( config.captions ) {
        const cap = document.createElement( 'div' );
        cap.className = 'fg-lb-mv-caption';
        stage.appendChild( cap );
    }

    if ( config.arrows && items.length > 1 ) {
        const prev = document.createElement( 'button' );
        prev.type = 'button';
        prev.className = 'fg-lb-mv-nav fg-lb-mv-prev';
        prev.setAttribute( 'aria-label', 'Previous' );
        prev.innerHTML = PREV_ICON;
        prev.addEventListener( 'click', () => navigate( -1 ) );

        const next = document.createElement( 'button' );
        next.type = 'button';
        next.className = 'fg-lb-mv-nav fg-lb-mv-next';
        next.setAttribute( 'aria-label', 'Next' );
        next.innerHTML = NEXT_ICON;
        next.addEventListener( 'click', () => navigate( 1 ) );

        stage.appendChild( prev );
        stage.appendChild( next );
    }

    if ( config.close !== false ) {
        const closeBtn = document.createElement( 'button' );
        closeBtn.type = 'button';
        closeBtn.className = 'fg-lb-mv-close';
        closeBtn.setAttribute( 'aria-label', 'Close' );
        closeBtn.innerHTML = CLOSE_ICON;
        closeBtn.addEventListener( 'click', close );
        stage.appendChild( closeBtn );
    }

    if ( config.bullets && items.length > 1 ) {
        const bullets = document.createElement( 'div' );
        bullets.className = 'fg-lb-mv-bullets';
        items.forEach( ( it, i ) => {
            const b = document.createElement( 'button' );
            b.type = 'button';
            b.className = 'fg-lb-mv-bullet';
            b.setAttribute( 'aria-label', 'Go to image ' + ( i + 1 ) );
            b.addEventListener( 'click', () => { state.index = i; render(); } );
            bullets.appendChild( b );
        } );
        stage.appendChild( bullets );
    }

    overlay.appendChild( stage );
    document.body.appendChild( overlay );
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    keyHandler = ( e ) => {
        if ( e.key === 'Escape' ) close();
        else if ( e.key === 'ArrowLeft' && config.arrows ) navigate( -1 );
        else if ( e.key === 'ArrowRight' && config.arrows ) navigate( 1 );
    };
    document.addEventListener( 'keydown', keyHandler );

    render();
}

function readItems( galleryEl ) {
    try {
        return JSON.parse( galleryEl.getAttribute( 'data-fg-mini-items' ) || '[]' );
    } catch ( err ) {
        return [];
    }
}

function configFor( galleryEl, index ) {
    return {
        items:         readItems( galleryEl ),
        index,
        galleryEl,
        theme:         galleryEl.getAttribute( 'data-fg-mini-theme' ) || 'dark',
        padding:       galleryEl.getAttribute( 'data-fg-mini-padding' ) || '24px',
        close:         galleryEl.getAttribute( 'data-fg-mini-close' ) !== '0',
        arrows:        galleryEl.getAttribute( 'data-fg-mini-arrows' ) === '1',
        bullets:       galleryEl.getAttribute( 'data-fg-mini-bullets' ) === '1',
        overlay:       galleryEl.getAttribute( 'data-fg-mini-overlay' ) !== '0',
        blur:          galleryEl.getAttribute( 'data-fg-mini-blur' ) || 'light',
        border:        galleryEl.getAttribute( 'data-fg-mini-border' ) === '1',
        shadow:        galleryEl.getAttribute( 'data-fg-mini-shadow' ) === '1',
        radius:        galleryEl.getAttribute( 'data-fg-mini-radius' ) === '1',
        captions:      galleryEl.getAttribute( 'data-fg-mini-captions' ) === '1',
        captionSource: galleryEl.getAttribute( 'data-fg-mini-caption-source' ) || 'caption',
        loop:          true,
    };
}

function attach( galleryEl ) {
    if ( galleryEl.dataset.fgMiniReady === '1' ) return;
    if ( galleryEl.dataset.fgLightboxVariant !== 'mini' ) return;
    galleryEl.dataset.fgMiniReady = '1';

    galleryEl.addEventListener( 'click', ( e ) => {
        const figure = e.target.closest( '.fg-item' );
        if ( ! figure || ! galleryEl.contains( figure ) ) return;
        const trigger = figure.querySelector( '[data-fg-lightbox-trigger]' );
        if ( ! trigger ) return;
        e.preventDefault();

        const items = readItems( galleryEl );
        const id = figure.getAttribute( 'data-fg-item-id' )
            || trigger.getAttribute( 'data-fg-item-id' );
        let idx = items.findIndex( ( it ) => String( it.id ) === String( id ) );
        if ( idx < 0 ) idx = 0;
        open( configFor( galleryEl, idx ) );
    } );
}

function init() {
    window.FotoGrids = window.FotoGrids || {};
    window.FotoGrids.modules = window.FotoGrids.modules || {};
    window.FotoGrids.modules.lightboxMiniViewer = { open, close };

    if ( typeof window.FotoGrids.onGallery === 'function' ) {
        window.FotoGrids.onGallery( attach, 10 );
    }
}

init();
