/**
 * FotoGrids Lightbox
 *
 * Singleton overlay lightbox for FotoGrids galleries.
 *
 * Architecture
 * ------------
 * One <dialog> element is created lazily on the first open() call and reused
 * for every subsequent gallery on the page. There is no per-gallery DOM
 * element. Settings are read from data-fg-lb-* attributes on the gallery
 * wrapper at open time so each gallery can have independent configuration.
 *
 * CSS variables - no inline styles
 * ---------------------------------
 * Per-gallery settings (theme, duration, colors, spacing) are written once
 * per open() into a <style id="fg-lb-vars"> block that lives inside the
 * <dialog>. All elements read those variables. Zero element.style mutations
 * happen at runtime - JS only toggles classes and updates the single <style>
 * block.
 *
 * Integration
 * -----------
 * The PHP Lightbox feature module writes:
 *   data-fg-click="lightbox"        on the .fotogrids-collection.fotogrids-gallery wrapper
 *   data-fg-lb-*                    per-gallery settings (see below)
 *   data-fg-lightbox-trigger  on the <a> that wraps each item's media
 *   data-fg-caption / data-fg-title on the same <a>
 *
 * Source: src/public/render/lightbox/classic/lightbox.js
 * Webpack entry key: 'lightbox'  →  assets/js/lightbox.js
 *
 * Attribute contract (read from gallery wrapper, all optional with sane defaults)
 * -------------------------------------------------------------------------------
 *   data-fg-lb-theme              "dark" | "light" | "custom"     default: "dark"
 *   data-fg-lb-transition         "fade" | "horizontal" | "vertical" | "none"
 *   data-fg-lb-duration           integer ms string                default: "300"
 *   data-fg-lb-auto-progress      present = enabled
 *   data-fg-lb-auto-delay         integer seconds string           default: "5"
 *   data-fg-lb-fit-media          present = enabled
 *   data-fg-lb-mobile-layout      "mobile_optimized" | "desktop"   default: mobile_optimized
 *   data-fg-lb-show-arrows        present = enabled
 *   data-fg-lb-arrow-icon         "chevron" | "chevron_double" | "arrow" | "arrow_narrow" | "arrow_square" | "arrow_circle" | "arrow_circle_broken" | "arrow_block"  default: "chevron"
 *   data-fg-lb-arrow-size         integer px string                default: "40"
 *   data-fg-lb-show-dots          present = enabled
 *   data-fg-lb-dot-style          "fill"|"stroke"|"square"|"square_stroke"
 *   data-fg-lb-dot-size           integer px string                default: "12"
 *   data-fg-lb-dots-spacing       CSS length string                default: "8px"
 *   data-fg-lb-thumbnail-location "none"|"bottom"|"top"|"left"|"right"
 *   data-fg-lb-thumbnail-size     "small"|"normal"|"large"         default: "normal"
 *   data-fg-lb-overlay-blur         integer px string                default: "2" (attr absent)
 *   data-fg-lb-info-panel           "on_click"|"never"               default: "always" (attr absent)
 *   data-fg-lb-info-location        "left"|"bottom"                  default: "right" (attr absent)
 *   data-fg-lb-no-backdrop-close    present = backdrop click disabled  default: enabled (attr absent)
 *   data-fg-lb-no-loop              present = no-loop mode            default: loop enabled (attr absent)
 *   data-fg-lb-hide-arrows-at-ends  present = hide arrows at first/last slide
 *   data-fg-lb-progress-style       "spinner" | "none"                default: "bar" (attr absent)
 *   data-fg-lb-progress-bar-loc     "top" | "left" | "right"          default: "bottom" (attr absent)
 *   data-fg-lb-progress-pause-on    space-sep "image_hover" "thumbnail_hover" "click"  default: "image_hover" (attr absent)
 *   data-fg-lb-progress-stop        present = stop on interaction
 *   data-fg-lb-progress-controls    present = show play/pause controls
 *   data-fg-lb-thumb-spacing        integer px string                 default: "5"
 *   data-fg-lb-no-thumb-drag        present = drag disabled           default: enabled (attr absent)
 *   data-fg-lb-no-thumb-swipe       present = swipe disabled          default: enabled (attr absent)
 *   data-fg-lb-fullscreen           present = show fullscreen button
 *   data-fg-lb-zoom                 present = zoom enabled
 *   data-fg-lb-zoom-trigger         "double_click" | "click" | "wheel_pinch"   default: "double_click"
 *   data-fg-lb-zoom-icons           present = show zoom +/- icons
 *   data-fg-lb-zoom-beyond          present = allow zoom beyond original size
 *   data-fg-lb-info-blocks          space-sep list of block ids       default: all blocks (attr absent)
 *   data-fg-lb-info-blocks-style    "boxed"|"divided"|"plain"         default: "boxed" (attr absent)
 *   data-fg-lb-credit-source        "exif"                            default: "item_meta" (attr absent)
 *   data-fg-lb-exif-fields          space-sep list of enabled EXIF field keys (absent = EXIF block disabled)
 *   data-fg-lb-thumb-filter         combined CSS filter string for lightbox thumbnail strip images
 *                                   e.g. "grayscale(50%) blur(3px)" - absent when filter disabled/empty
 *   data-fg-lb-thumb-filter-hover   combined CSS filter string applied on thumbnail :hover
 *                                   - absent when filter disabled/empty
 *   data-fg-lb-full-filter          combined CSS filter string for the main lightbox stage image
 *                                   e.g. "sepia(80%)" - absent when filter disabled/empty
 *   data-fg-lb-full-filter-hover    combined CSS filter string applied on main image :hover
 *                                   - absent when filter disabled/empty
 *
 * Dialog state attributes (set by JS on the <dialog> element itself)
 * -------------------------------------------------------------------
 *   data-fg-lb-theme              "dark" | "light" | "custom"
 *   data-fg-lb-transition         "fade" | "horizontal" | "vertical" | "none"
 *   data-fg-lb-mobile             present = mobile layout active
 *   data-fg-lb-info-panel         "on_click" | "never"   (absent = "always" default)
 *   data-fg-lb-no-loop            present = loop disabled
 *   data-fg-lb-zoom               present = zoom enabled
 *   data-fg-lb-zoom-trigger       "double_click" | "click" | "wheel_pinch"
 *   data-fg-lb-zoom-icons         present = zoom buttons shown
 *   data-fg-lb-zoom-beyond        present = zoom beyond original allowed
 *   data-fg-lb-zoom-active        present = currently zoomed in (scale > 1)
 *   data-fg-lb-zoom-dragging      present = pointer drag in progress while zoomed
 *   data-fg-lb-progress-style     "bar" | "spinner"
 *   data-fg-lb-progress-bar-loc   "top" | "bottom" | "left" | "right"
 *   data-fg-lb-progress-controls  present = play/pause controls shown
 *   data-fg-lb-fullscreen-active  present = native fullscreen active
 *
 * Custom events (fired on the gallery element)
 * --------------------------------------------
 *   fotogrids:lightbox:open       { galleryEl, index, item }
 *   fotogrids:lightbox:close      { galleryEl }
 *   fotogrids:lightbox:navigate   { galleryEl, index, item, direction }
 */

/**
 * Reads all lightbox settings from a gallery wrapper element's dataset.
 *
 * @param {HTMLElement} galleryEl
 * @returns {object}
 */
function readSettings( galleryEl ) {
    const d  = galleryEl.dataset;
    const on = ( key ) => galleryEl.hasAttribute( 'data-fg-lb-' + key );

    return {
        theme:              d.fgLbTheme              || 'dark',
        // Per-theme colour overrides - only present when theme=custom (emitted by PHP for all themes now).
        bg:                 d.fgLbBg                 || null,
        toolbarBg:          d.fgLbToolbarBg          || null,
        toolbarBtnColor:    d.fgLbToolbarBtnColor     || null,
        toolbarBtnHover:    d.fgLbToolbarBtnHover     || null,
        toolbarBtnActiveBg: d.fgLbToolbarBtnActiveBg  || null,
        arrowBg:            d.fgLbArrowBg             || null,
        arrowBgHover:       d.fgLbArrowBgHover        || null,
        arrowColor:         d.fgLbArrowColor          || null,
        arrowHoverColor:    d.fgLbArrowHoverColor     || null,
        bulletColor:        d.fgLbBulletColor         || null,
        bulletHoverColor:   d.fgLbBulletHoverColor    || null,
        bulletActiveColor:  d.fgLbBulletActiveColor   || null,
        thumbsBg:           d.fgLbThumbsBg            || null,
        thumbBorderColor:   d.fgLbThumbBorderColor    || null,
        thumbActiveColor:   d.fgLbThumbActiveColor    || null,
        infoBg:             d.fgLbInfoBg              || null,
        infoBlockBg:        d.fgLbInfoBlockBg         || null,
        infoText:           d.fgLbInfoText            || null,
        infoTitle:          d.fgLbInfoTitle           || null,
        spinnerColor:       d.fgLbSpinnerColor        || null,
        imgShadow:          d.fgLbImgShadow           || null,
        progressColor:      d.fgLbProgressColor       || null,
        transition:     d.fgLbTransition        || 'fade',
        duration:       parseInt( d.fgLbDuration, 10 ) || 300,
        autoProgress:   on( 'auto-progress' ),
        autoDelay:      parseInt( d.fgLbAutoDelay, 10 ) || 5,
        fitMedia:       on( 'fit-media' ),
        mobileLayout:   d.fgLbMobileLayout      || 'mobile_optimized',
        showArrows:     on( 'show-arrows' ),
        // SVG strings embedded by PHP from arrow-icons.json - no async icon lookup.
        arrowPrevSvg:   d.fgLbArrowPrev        || '‹',
        arrowNextSvg:   d.fgLbArrowNext        || '›',
        arrowSize:      parseInt( d.fgLbArrowSize, 10 ) || 40,
        showDots:       on( 'show-dots' ),
        showCounter:    on( 'show-counter' ),
        dotStyle:       d.fgLbDotStyle          || 'fill',
        dotSize:        parseInt( d.fgLbDotSize, 10 ) || 12,
        dotsSpacing:    d.fgLbDotsSpacing       || '8px',
        thumbLocation:  d.fgLbThumbnailLocation || 'bottom',
        thumbSize:      d.fgLbThumbnailSize     || 'normal',
        thumbSpacing:   parseInt( d.fgLbThumbSpacing, 10 ) || 5,
        thumbDrag:      ! galleryEl.hasAttribute( 'data-fg-lb-no-thumb-drag' ),
        thumbSwipe:     ! galleryEl.hasAttribute( 'data-fg-lb-no-thumb-swipe' ),
        overlayBlur:    d.fgLbOverlayBlur !== undefined ? parseInt( d.fgLbOverlayBlur, 10 ) : 8,
        preloadSlides:  d.fgLbPreloadSlides !== undefined ? parseInt( d.fgLbPreloadSlides, 10 ) : 2,
        infoPanel:      d.fgLbInfoPanel         || 'always',
        infoLocation:   d.fgLbInfoLocation      || 'right',
        infoBlocks:       d.fgLbInfoBlocks ? d.fgLbInfoBlocks.split( ' ' ).filter( Boolean ) : null,
        infoBlocksStyle:  d.fgLbInfoBlocksStyle || 'boxed',
        infoBlockDivider: d.fgLbInfoBlockDivider || null,
        creditSource:     d.fgLbCreditSource     || 'item_meta',
        galleryId:        parseInt( d.fgGalleryId, 10 ) || 0,
        exifFields:       d.fgLbExifFields ? d.fgLbExifFields.split( ' ' ).filter( Boolean ) : [],
        backdropClose:  ! galleryEl.hasAttribute( 'data-fg-lb-no-backdrop-close' ),
        loop:           ! galleryEl.hasAttribute( 'data-fg-lb-no-loop' ),
        hideArrowsAtEnds: galleryEl.hasAttribute( 'data-fg-lb-hide-arrows-at-ends' ),
        progressStyle:  d.fgLbProgressStyle     || 'bar',
        progressBarLoc: d.fgLbProgressBarLoc    || 'bottom',
        progressPauseOn: d.fgLbProgressPauseOn  ? d.fgLbProgressPauseOn.split( ' ' ).filter( Boolean ) : [ 'image_hover' ],
        progressStop:   galleryEl.hasAttribute( 'data-fg-lb-progress-stop' ),
        progressControls: galleryEl.hasAttribute( 'data-fg-lb-progress-controls' ),
        fullscreen:     galleryEl.hasAttribute( 'data-fg-lb-fullscreen' ),
        zoom:           galleryEl.hasAttribute( 'data-fg-lb-zoom' ),
        zoomTrigger:    d.fgLbZoomTrigger  || 'double_click',
        zoomIcons:      galleryEl.hasAttribute( 'data-fg-lb-zoom-icons' ),
        zoomBeyond:     galleryEl.hasAttribute( 'data-fg-lb-zoom-beyond' ),
        noTooltips:     galleryEl.hasAttribute( 'data-fg-lb-no-tooltips' ),
        // Image filters - desktop-breakpoint CSS filter strings (or null when disabled).
        thumbFilter:      d.fgLbThumbFilter      || null,
        thumbFilterHover: d.fgLbThumbFilterHover || null,
        fullFilter:       d.fgLbFullFilter       || null,
        fullFilterHover:  d.fgLbFullFilterHover  || null,
    };
}

/**
 * Collects item data from a gallery element.
 *
 * @param {HTMLElement} galleryEl
 * @returns {Array<{triggerEl, fullSrc, thumbSrc, alt, caption, title, id}>}
 */
/**
 * Build a slide dict from a single `[data-fg-lightbox-trigger]` element.
 * Mirrors the legacy collectItems() per-item shape so downstream code
 * (renderItem, thumb strip, share bar) works unchanged.
 *
 * @param {Element} triggerEl
 * @returns {object}
 */
function buildSlideFromTrigger( triggerEl ) {
    const img = triggerEl.querySelector( 'img' );
    const figureEl = triggerEl.closest( '.fg-item' );
    const sequenceIndexRaw = figureEl ? figureEl.dataset.fgSequenceIndex : null;
    const sequenceIndex = sequenceIndexRaw !== null && sequenceIndexRaw !== ''
        ? parseInt( sequenceIndexRaw, 10 )
        : null;

    const slide = {
        triggerEl,
        figureEl,
        sequenceIndex,
        fullSrc:  triggerEl.href || ( img ? img.dataset.fgFullSrc || img.src : '' ),
        thumbSrc: img ? img.src : '',
        alt:      img ? img.alt : '',
        caption:  triggerEl.dataset.fgCaption || '',
        title:    triggerEl.dataset.fgTitle   || '',
        id:       triggerEl.dataset.fgItemId  || '',
    };

    // Video items carry their playback data on the .fg-video node rather than
    // an <img>. The poster (an <img class="fg-video-poster"> when present)
    // becomes the slide's thumb so the thumb strip still shows something.
    const videoEl = triggerEl.querySelector( '.fg-video' );
    if ( videoEl ) {
        const posterImg = videoEl.querySelector( '.fg-video-poster' );
        slide.itemType       = videoEl.dataset.fgItemType || '';
        slide.videoSrc       = videoEl.dataset.fgVideoSrc || '';
        slide.embedProvider  = videoEl.dataset.fgEmbedProvider || '';
        slide.embedId        = videoEl.dataset.fgEmbedId || '';
        slide.embedSettings  = parseEmbedSettings( videoEl.dataset.fgEmbedSettings );
        slide.thumbSrc       = posterImg ? posterImg.src : slide.thumbSrc;
        slide.fullSrc        = posterImg ? posterImg.src : '';
        slide.alt            = posterImg ? posterImg.alt : slide.alt;
    }

    return slide;
}

/**
 * Parse the JSON embed-settings dataset attribute, tolerating absence/bad data.
 *
 * @param {string} raw
 * @returns {object}
 */
function parseEmbedSettings( raw ) {
    if ( ! raw ) {
        return {};
    }
    try {
        const parsed = JSON.parse( raw );
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch ( err ) {
        return {};
    }
}

/**
 * Build a YouTube embed URL from stored settings.
 *
 * @param {string}  embedId
 * @param {object}  settings
 * @param {boolean} forceAutoplay  When true, autoplay regardless of the setting.
 * @returns {string}
 */
function buildYouTubeEmbedSrc( embedId, settings, forceAutoplay ) {
    const privacy = !! settings.privacy_mode;
    const host = privacy ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
    const params = new URLSearchParams();

    params.set( 'autoplay', ( forceAutoplay || settings.autoplay ) ? '1' : '0' );
    params.set( 'mute', settings.mute ? '1' : '0' );
    params.set( 'controls', settings.controls === false ? '0' : '1' );
    params.set( 'cc_load_policy', settings.captions ? '1' : '0' );
    params.set( 'rel', settings.suggested_videos === 'any' ? '1' : '0' );
    params.set( 'playsinline', '1' );

    if ( settings.loop ) {
        params.set( 'loop', '1' );
        params.set( 'playlist', embedId );
    }
    if ( settings.start_time ) {
        params.set( 'start', String( parseInt( settings.start_time, 10 ) || 0 ) );
    }
    if ( settings.end_time ) {
        params.set( 'end', String( parseInt( settings.end_time, 10 ) || 0 ) );
    }

    return `${ host }/embed/${ encodeURIComponent( embedId ) }?${ params.toString() }`;
}

/**
 * Build a Vimeo embed URL from stored settings.
 *
 * @param {string}  embedId
 * @param {object}  settings
 * @param {boolean} forceAutoplay
 * @returns {string}
 */
function buildVimeoEmbedSrc( embedId, settings, forceAutoplay ) {
    const params = new URLSearchParams();

    params.set( 'autoplay', ( forceAutoplay || settings.autoplay ) ? '1' : '0' );
    params.set( 'muted', settings.mute ? '1' : '0' );
    params.set( 'loop', settings.loop ? '1' : '0' );
    params.set( 'dnt', settings.privacy_mode ? '1' : '0' );
    params.set( 'title', settings.intro_title ? '1' : '0' );
    params.set( 'portrait', settings.intro_portrait ? '1' : '0' );
    params.set( 'byline', settings.intro_byline ? '1' : '0' );
    params.set( 'playsinline', '1' );

    if ( typeof settings.controls_color === 'string'
        && /^#[0-9a-fA-F]{3,6}$/.test( settings.controls_color ) ) {
        params.set( 'color', settings.controls_color.replace( '#', '' ) );
    }

    let hash = '';
    if ( settings.start_time ) {
        hash = `#t=${ parseInt( settings.start_time, 10 ) || 0 }s`;
    }

    return `https://player.vimeo.com/video/${ encodeURIComponent( embedId ) }?${ params.toString() }${ hash }`;
}

/**
 * Legacy collector — kept for non-paginated galleries where the DOM
 * holds the complete slide deck. Returns an array of slides, in DOM
 * order. For paginated galleries the lightbox uses a sparse-cache
 * model (see FotoGridsLightbox.open) and only seeds the cache via
 * buildSlideFromTrigger() per trigger.
 */
function collectItems( galleryEl ) {
    return Array.from(
        galleryEl.querySelectorAll( '[data-fg-lightbox-trigger]' )
    ).map( buildSlideFromTrigger );
}

/**
 * Turn a slide dict returned by /gallery/lightbox/slides into the
 * shape the lightbox internals expect — same field names as
 * buildSlideFromTrigger.
 *
 * The triggerEl + figureEl are intentionally absent (we don't have a
 * DOM reference for unloaded items); the lightbox handles that
 * gracefully (focus restoration on close picks the nearest available
 * trigger).
 *
 * @param {object} apiSlide  Response from /gallery/lightbox/slides
 * @returns {object}
 */
function buildSlideFromApi( apiSlide ) {
    return {
        triggerEl:     null,
        figureEl:      null,
        sequenceIndex: null,
        fullSrc:       apiSlide.full_url  || '',
        thumbSrc:      apiSlide.thumb_url || '',
        alt:           apiSlide.alt       || '',
        caption:       apiSlide.caption   || '',
        title:         apiSlide.title     || '',
        id:            apiSlide.id != null ? String( apiSlide.id ) : '',
        description:   apiSlide.description || '',
        tags:          Array.isArray( apiSlide.tags )     ? apiSlide.tags     : [],
        people:        Array.isArray( apiSlide.people )   ? apiSlide.people   : [],
        location:      Array.isArray( apiSlide.location ) ? apiSlide.location : [],
        exif:          ( apiSlide.exif && typeof apiSlide.exif === 'object' ) ? apiSlide.exif : null,
        externalUrl:   apiSlide.external_url || '',
        itemType:      apiSlide.item_type || '',
        videoSrc:      apiSlide.video_src || '',
        embedProvider: apiSlide.embed_provider || '',
        embedId:       apiSlide.embed_id || '',
        embedSettings: ( apiSlide.embed_settings && typeof apiSlide.embed_settings === 'object' )
            ? apiSlide.embed_settings
            : {},
    };
}

/**
 * Whether the lightbox needs to consult the lightbox-slides REST
 * endpoint for items beyond what's in the DOM. True in two cases:
 *
 *  1. The gallery is paginated (data-fg-paginated) — the visible page
 *     is a subset of the gallery and the lightbox must lazy-fetch the
 *     rest as the user navigates.
 *  2. The gallery uses Single Item layout with lightbox scope "gallery"
 *     (data-fg-lightbox-extended) — only one item is in the DOM but
 *     the user can still navigate the full gallery in the lightbox.
 *
 * Both attributes use the same downstream sparse-cache + REST flow,
 * so a single helper covers both.
 *
 * @param {Element} galleryEl
 * @returns {boolean}
 */
function isGalleryPaginated( galleryEl ) {
    return galleryEl.dataset.fgPaginated === 'true'
        || galleryEl.dataset.fgLightboxExtended === 'true';
}

/**
 * Read the authoritative total filtered+sorted item count from the
 * gallery wrapper. The server stamps data-fg-total-items with the
 * exact filtered+sorted count via Pagination_Common::common_wrapper_attrs.
 *
 * @param {Element} galleryEl
 * @returns {number} The authoritative count, or 0 when unavailable.
 */
function readEstimatedTotal( galleryEl ) {
    const fromAttr = parseInt( galleryEl.dataset.fgTotalItems || '0', 10 );
    if ( fromAttr > 0 ) {
        return fromAttr;
    }
    return 0;
}

/**
 * Compose the filter map currently active for this gallery, by asking
 * the filters module (if loaded). Mirrors what pagination-core sends.
 *
 * @param {Element} galleryEl
 * @returns {Object.<string, string[]>}
 */
function readActiveFilters( galleryEl ) {
    const fmod = window.FotoGrids
        && window.FotoGrids.modules
        && window.FotoGrids.modules.filters;
    if ( ! fmod || typeof fmod.getActive !== 'function' ) return {};
    return fmod.getActive( galleryEl );
}

/**
 * Per-theme colour defaults.
 *
 * These are the baseline values for dark and light themes. The custom theme
 * starts from the dark defaults and then each value is overridden by the
 * per-gallery colour settings emitted by PHP onto data-fg-lb-* attributes.
 *
 * All values are rgba() - no hex literals.
 * Values that reference the global brand token use the CSS var string directly
 * so the cascade resolves it at paint time rather than substituting a literal.
 */
const THEME_VARS = {
    dark: {
        bg:                 'rgba(0, 0, 0, 0.92)',
        toolbarBg:          'rgba(0, 0, 0, 0.35)',
        toolbarBtnColor:    'rgba(255, 255, 255, 0.7)',
        toolbarBtnHover:    'rgba(255, 255, 255, 1)',
        toolbarBtnActiveBg: 'rgba(255, 255, 255, 0.15)',
        arrowBg:            'rgba(0, 0, 0, 0.45)',
        arrowBgHover:       'rgba(0, 0, 0, 0.75)',
        arrowColor:         'rgba(255, 255, 255, 1)',
        arrowHoverColor:    'rgba(255, 255, 255, 1)',
        bulletColor:        'rgba(255, 255, 255, 1)',
        bulletHoverColor:   'rgba(255, 255, 255, 1)',
        bulletActiveColor:  'var(--fg-colors-blue)',
        thumbsBg:           'rgba(0, 0, 0, 0.7)',
        thumbBorderColor:   'rgba(255, 255, 255, 0.45)',
        thumbActiveColor:   'var(--fg-colors-blue)',
        infoBg:             'rgba(0, 0, 0, 0.25)',
        infoBlockBg:        'rgba(255, 255, 255, 0.06)',
        infoText:           'rgba(255, 255, 255, 0.85)',
        infoTitle:          'rgba(255, 255, 255, 1)',
        spinnerColor:       'rgba(255, 255, 255, 0.8)',
        imgShadow:          'rgba(0, 0, 0, 0.3)',
        progressColor:      'var(--fg-colors-blue)',
    },
    light: {
        bg:                 'rgba(255, 255, 255, 0.96)',
        toolbarBg:          'rgba(255, 255, 255, 0.35)',
        toolbarBtnColor:    'rgba(0, 0, 0, 0.6)',
        toolbarBtnHover:    'rgba(0, 0, 0, 0.9)',
        toolbarBtnActiveBg: 'rgba(0, 0, 0, 0.1)',
        arrowBg:            'rgba(255, 255, 255, 0.75)',
        arrowBgHover:       'rgba(255, 255, 255, 1)',
        arrowColor:         'rgba(0, 0, 0, 0.8)',
        arrowHoverColor:    'rgba(0, 0, 0, 1)',
        bulletColor:        'rgba(0, 0, 0, 0.5)',
        bulletHoverColor:   'rgba(0, 0, 0, 0.8)',
        bulletActiveColor:  'var(--fg-colors-blue)',
        thumbsBg:           'rgba(0, 0, 0, 0.08)',
        thumbBorderColor:   'rgba(0, 0, 0, 0.3)',
        thumbActiveColor:   'var(--fg-colors-blue)',
        infoBg:             'rgba(255, 255, 255, 0.25)',
        infoBlockBg:        'rgba(0, 0, 0, 0.04)',
        infoText:           'rgba(0, 0, 0, 0.7)',
        infoTitle:          'rgba(0, 0, 0, 0.9)',
        spinnerColor:       'rgba(0, 0, 0, 0.6)',
        imgShadow:          'rgba(0, 0, 0, 0.15)',
        progressColor:      'var(--fg-colors-blue)',
    },
};

/**
 * Returns the CSS text for the per-gallery <style> block.
 *
 * All per-gallery CSS custom properties are centralised here.
 * No JS code writes to element.style - everything flows through this block.
 *
 * Theme model: for dark/light, colour tokens come from THEME_VARS[theme].
 * For custom, we start from the dark baseline and substitute each value that
 * was explicitly set via the admin UI (present as a non-null field in s).
 * The result is always a complete set of tokens - no theme class needed.
 *
 * @param {object} s  Settings object from readSettings()
 * @returns {string}
 */
function buildVarsCSS( s ) {
    // Resolve colour values: for custom theme, PHP emits per-setting attrs;
    // for dark/light, use the static table. Either way, every token is set.
    const base   = THEME_VARS[ s.theme ] || THEME_VARS.dark;
    const colors = s.theme === 'custom'
        ? {
            bg:                 s.bg                  || base.bg,
            toolbarBg:          s.toolbarBg           || base.toolbarBg,
            toolbarBtnColor:    s.toolbarBtnColor     || base.toolbarBtnColor,
            toolbarBtnHover:    s.toolbarBtnHover     || base.toolbarBtnHover,
            toolbarBtnActiveBg: s.toolbarBtnActiveBg  || base.toolbarBtnActiveBg,
            arrowBg:            s.arrowBg             || base.arrowBg,
            arrowBgHover:       s.arrowBgHover        || base.arrowBgHover,
            arrowColor:         s.arrowColor          || base.arrowColor,
            arrowHoverColor:    s.arrowHoverColor     || base.arrowHoverColor,
            bulletColor:        s.bulletColor         || base.bulletColor,
            bulletHoverColor:   s.bulletHoverColor    || base.bulletHoverColor,
            bulletActiveColor:  s.bulletActiveColor   || base.bulletActiveColor,
            thumbsBg:           s.thumbsBg            || base.thumbsBg,
            thumbBorderColor:   s.thumbBorderColor    || base.thumbBorderColor,
            thumbActiveColor:   s.thumbActiveColor    || base.thumbActiveColor,
            infoBg:             s.infoBg              || base.infoBg,
            infoBlockBg:        s.infoBlockBg         || base.infoBlockBg,
            infoText:           s.infoText            || base.infoText,
            infoTitle:          s.infoTitle           || base.infoTitle,
            spinnerColor:       s.spinnerColor        || base.spinnerColor,
            imgShadow:          s.imgShadow           || base.imgShadow,
            progressColor:      s.progressColor       || base.progressColor,
        }
        : base;

    const lines = [
        '.fg-lightbox {',
        `  --fg-lb-transition-duration:          ${s.duration}ms;`,
        `  --fg-lb-dots-spacing:                 ${s.dotsSpacing};`,
        `  --fg-lb-dot-size:                     ${s.dotSize}px;`,
        `  --fg-lb-arrow-size:                   ${s.arrowSize}px;`,
        `  --fg-lb-thumb-spacing:                ${s.thumbSpacing}px;`,
        `  --fg-lb-overlay-blur:                 ${s.overlayBlur}px;`,
        `  --fg-lb-progress-duration:            ${s.autoDelay * 1000}ms;`,
        `  --fg-lb-color-backdrop:               ${colors.bg};`,
        `  --fg-lb-color-toolbar-bg:             ${colors.toolbarBg};`,
        `  --fg-lb-color-toolbar-icon:           ${colors.toolbarBtnColor};`,
        `  --fg-lb-color-toolbar-icon-hover:     ${colors.toolbarBtnHover};`,
        `  --fg-lb-color-toolbar-btn-active:     ${colors.toolbarBtnActiveBg};`,
        `  --fg-lb-color-nav-bg:                 ${colors.arrowBg};`,
        `  --fg-lb-color-nav-bg-hover:           ${colors.arrowBgHover};`,
        `  --fg-lb-color-nav-icon:               ${colors.arrowColor};`,
        `  --fg-lb-color-nav-icon-hover:         ${colors.arrowHoverColor};`,
        `  --fg-lb-color-dot:                    ${colors.bulletColor};`,
        `  --fg-lb-color-dot-hover:              ${colors.bulletHoverColor};`,
        `  --fg-lb-color-dot-active:             ${colors.bulletActiveColor};`,
        `  --fg-lb-color-thumbs-bg:              ${colors.thumbsBg};`,
        `  --fg-lb-color-thumb-border:           ${colors.thumbBorderColor};`,
        `  --fg-lb-color-thumb-active:           ${colors.thumbActiveColor};`,
        `  --fg-lb-color-info-bg:                ${colors.infoBg};`,
        `  --fg-lb-color-info-block-bg:          ${colors.infoBlockBg};`,
        `  --fg-lb-color-info-text:              ${colors.infoText};`,
        `  --fg-lb-color-info-title:             ${colors.infoTitle};`,
        `  --fg-lb-color-spinner:                ${colors.spinnerColor};`,
        `  --fg-lb-color-img-shadow:             ${colors.imgShadow};`,
        `  --fg-lb-color-progress:               ${colors.progressColor};`,
    ];

    // Info block divider - only emitted when style=divided and the attr was set.
    if ( s.infoBlocksStyle === 'divided' && s.infoBlockDivider ) {
        lines.push( `  --fg-lb-color-info-block-divider:     ${s.infoBlockDivider};` );
    }

    // Image filter vars - only emitted when a filter string is present.
    if ( s.thumbFilter ) {
        lines.push( `  --fg-lb-thumb-filter:                 ${s.thumbFilter};` );
    }
    if ( s.thumbFilterHover ) {
        lines.push( `  --fg-lb-thumb-filter-hover:           ${s.thumbFilterHover};` );
    }
    if ( s.fullFilter ) {
        lines.push( `  --fg-lb-full-filter:                  ${s.fullFilter};` );
    }
    if ( s.fullFilterHover ) {
        lines.push( `  --fg-lb-full-filter-hover:            ${s.fullFilterHover};` );
    }

    lines.push( '}' );

    return lines.join( '\n' );
}

const FGLB_ZOOM_MAX  = 4;     // Maximum zoom multiplier (change here to adjust ceiling)
const FGLB_ZOOM_STEP = 0.25;  // Scale increment per button click or wheel tick
const FGLB_ZOOM_MIN  = 1;     // Never zoom below 1× (fully zoomed-out)

// Paginated-gallery lightbox: when the total filtered count is at or
// below this threshold, open() bulk-fetches the entire sequence's
// slide metadata in one request. Beyond this we fall back to
// lookahead-only fetching around the current index. 200 items × ~500
// bytes/slide = ~100 KB upfront — small enough to be a non-issue,
// large enough to cover virtually every real-world gallery.
const FGLB_PRELOAD_ALL_THRESHOLD = 200;

// Auto-progress controls
const FGLB_ICON_PAUSE        = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="16" rx="1.5" /><rect x="14" y="4" width="6" height="16" rx="1.5" /></svg>';
const FGLB_ICON_PLAY         = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 4.98951C5 4.01835 5 3.53277 5.20249 3.2651C5.37889 3.03191 5.64852 2.88761 5.9404 2.87018C6.27544 2.85017 6.67946 3.11953 7.48752 3.65823L18.0031 10.6686C18.6708 11.1137 19.0046 11.3363 19.1209 11.6168C19.2227 11.8621 19.2227 12.1377 19.1209 12.383C19.0046 12.6635 18.6708 12.886 18.0031 13.3312L7.48752 20.3415C6.67946 20.8802 6.27544 21.1496 5.9404 21.1296C5.64852 21.1122 5.37889 20.9679 5.20249 20.7347C5 20.467 5 19.9814 5 19.0103V4.98951Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Toolbar buttons
const FGLB_ICON_CLOSE        = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 5L5 19M5 5L19 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FGLB_ICON_INFO         = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FGLB_ICON_SHARE        = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M18 8a3 3 0 1 0-2.83-4M18 8a3 3 0 0 1-2.83-2M18 8l-8.5 4.5M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm3-2.5L15.17 16M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Zoom buttons
const FGLB_ICON_ZOOM_IN  = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 21L16.65 16.65M11 8V14M8 11H14M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FGLB_ICON_ZOOM_OUT = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 21L16.65 16.65M8 11H14M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const FGLB_ICON_FS_EXPAND    = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V8M8 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V16M21 8V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H16M21 16V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FGLB_ICON_FS_COLLAPSE  = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2.99988 8H3.19988C4.88004 8 5.72011 8 6.36185 7.67302C6.92634 7.3854 7.38528 6.92646 7.6729 6.36197C7.99988 5.72024 7.99988 4.88016 7.99988 3.2V3M2.99988 16H3.19988C4.88004 16 5.72011 16 6.36185 16.327C6.92634 16.6146 7.38528 17.0735 7.6729 17.638C7.99988 18.2798 7.99988 19.1198 7.99988 20.8V21M15.9999 3V3.2C15.9999 4.88016 15.9999 5.72024 16.3269 6.36197C16.6145 6.92646 17.0734 7.3854 17.6379 7.67302C18.2796 8 19.1197 8 20.7999 8H20.9999M15.9999 21V20.8C15.9999 19.1198 15.9999 18.2798 16.3269 17.638C16.6145 17.0735 17.0734 16.6146 17.6379 16.327C18.2796 16 19.1197 16 20.7999 16H20.9999" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

class FotoGridsLightbox {

    constructor() {
        /** @type {HTMLDialogElement|null} */
        this.dialog    = null;

        /** @type {HTMLStyleElement|null} - per-gallery CSS variables block */
        this._styleEl  = null;

        /** @type {HTMLElement|null} - current gallery */
        this.galleryEl = null;

        /** @type {Array} */
        this.items = [];

        /** @type {number} */
        this.index = 0;

        /** @type {object|null} */
        this.settings = null;

        /** @type {number|null} */
        this._autoTimer = null;

        /** @type {boolean} */
        this._autoPaused = false;

        /** @type {number} - timestamp when the current auto timer was started */
        this._autoStartedAt = 0;

        /** @type {number} - ms remaining when the timer was paused */
        this._autoPauseRemaining = 0;

        /** @type {boolean} */
        this._autoListenersAttached = false;

        /**
         * Set when the user manually navigates (prev/next/dot/thumb) while
         * progressStop is enabled. Blocks _resumeAuto() from resuming on hover-out.
         * Only cleared by the explicit play button or a fresh _startAuto() call.
         *
         * @type {boolean}
         */
        this._autoStoppedByUser = false;

        /** @type {boolean} */
        this._transitioning = false;

        this._swipe = { active: false, startX: 0, startY: 0, dx: 0 };

        // Zoom state - reset on every slide change by _resetZoom().
        /** @type {number} - current zoom scale (1 = not zoomed) */
        this._zoomScale = FGLB_ZOOM_MIN;
        /** @type {{x: number, y: number}} - pan offset in px */
        this._zoomOffset = { x: 0, y: 0 };
        /** @type {boolean} - pointer drag in progress while zoomed */
        this._zoomDragging = false;
        /** @type {boolean} - pointer moved enough during down→up to count as a drag, not a click */
        this._zoomClickMoved = false;
        /** @type {{x: number, y: number}} - pointer position at drag start */
        this._zoomDragStart = { x: 0, y: 0 };
        /** @type {{x: number, y: number}} - zoom offset at drag start */
        this._zoomOffsetAtDragStart = { x: 0, y: 0 };
        /** @type {number} - initial pinch distance (px) */
        this._pinchStartDist = 0;
        /** @type {number} - zoom scale at pinch start */
        this._pinchStartScale = FGLB_ZOOM_MIN;

        /**
         * Cache for per-item REST data fetched from /fotogrids/v1/lightbox/item/{id}.
         * Keys are item IDs (strings). Values are the resolved response objects.
         * A null value means the fetch is in progress.
         * Cleared on close() so stale data doesn't persist between gallery opens.
         *
         * @type {Map<string, object|null>}
         */
        this._itemDataCache = new Map();

        this._onKeydown     = this._onKeydown.bind( this );
        this._onPointerDown = this._onPointerDown.bind( this );
        this._onPointerMove = this._onPointerMove.bind( this );
        this._onPointerUp   = this._onPointerUp.bind( this );
        this._onWheel       = this._onWheel.bind( this );
        this._onTouchStart  = this._onTouchStart.bind( this );
        this._onTouchMove   = this._onTouchMove.bind( this );
    }


    /**
     * Bind a tooltip to a lightbox button, respecting the noTooltips setting.
     * Implements its own show/hide logic (rather than delegating to FgTooltip.bind)
     * so the noTooltips gate is checked at show time, not bind time - this works
     * correctly for both static buttons (created before open()) and dynamic ones.
     *
     * @param {HTMLElement} el
     * @param {object}      [opts]
     * @param {string}      [opts.dir]  Force tooltip direction ('above'|'below'|'left'|'right').
     */
    _bindTooltip( el, opts ) {
        if ( ! window.FgTooltip ) return;

        // Store forced direction so FgTooltip's position() honours it.
        if ( opts?.dir ) el.dataset.fgTooltipDir = opts.dir;

        // Wire aria-describedby once so screen readers announce the tooltip on focus.
        const ttEl = document.getElementById( 'fg-tooltip' );
        if ( ttEl ) el.setAttribute( 'aria-describedby', ttEl.id );

        const getLabel = () => el.getAttribute( 'aria-label' ) || el.getAttribute( 'title' ) || '';

        el.addEventListener( 'mouseenter', () => {
            if ( this.settings?.noTooltips ) return;
            const l = getLabel();
            if ( l ) window.FgTooltip.showImmediately( el, l );
        } );
        el.addEventListener( 'mouseleave', () => window.FgTooltip.hideImmediately() );
        el.addEventListener( 'focus', () => {
            if ( this.settings?.noTooltips ) return;
            const l = getLabel();
            if ( l ) window.FgTooltip.showImmediately( el, l );
        } );
        el.addEventListener( 'blur', () => window.FgTooltip.hideImmediately() );
    }


    _createDialog() {
        const dlg = document.createElement( 'dialog' );
        dlg.className = 'fg-lightbox';
        dlg.setAttribute( 'aria-modal', 'true' );
        dlg.setAttribute( 'aria-label', '' );
        dlg.setAttribute( 'aria-live',  'polite' );

        // <style> block for per-gallery CSS variables - lives inside the
        // dialog so the vars are scoped to it and don't pollute :root.
        const styleEl = document.createElement( 'style' );
        styleEl.id    = 'fg-lb-vars';
        dlg.appendChild( styleEl );
        this._styleEl = styleEl;

        // Focus sentinel - a zero-size, screen-reader-invisible element placed
        // first in the dialog. showModal() and our open() both focus it so the
        // browser's auto-focus never lands on a visible button (which would show
        // a tooltip on open or fire that button's action if Space is pressed).
        const sentinel = document.createElement( 'span' );
        sentinel.className        = 'fg-lb-focus-sentinel';
        sentinel.tabIndex         = -1;         // focusable but not in tab order
        sentinel.setAttribute( 'aria-hidden', 'true' );
        dlg.appendChild( sentinel );
        this._focusSentinel = sentinel;

        // Build the rest of the dialog HTML.
        //
        // Structure:
        //   dialog
        //     span           (focus sentinel)
        //     style          (CSS vars, injected separately)
        //     backdrop
        //     shell
        //       toolbar      (always first in shell → always at top)
        //       content      (flex row or column depending on info location)
        //         stage      (image area + navigation chrome)
        //           media-wrap  (image, spinner, prev, next, dots - all overlaid)
        //             img
        //             spinner
        //             prev / next
        //             dots
        //           thumbs   (strip - flex sibling of media-wrap)
        //         info
        //           info-panel
        //           caption
        //           title
        const fragment = document.createRange().createContextualFragment( `
            <div class="fg-lb-backdrop" aria-hidden="true"></div>
            <div class="fg-lb-shell">
                <div class="fg-lb-toolbar" role="toolbar" aria-label="Lightbox controls">
                    <div class="fg-lb-toolbar-start"></div>
                    <div class="fg-lb-toolbar-end">
                        <button class="fg-lb-close" aria-label="Close lightbox" type="button">
                            ${ FGLB_ICON_CLOSE }
                        </button>
                    </div>
                </div>

                <div class="fg-lb-content">
                    <div class="fg-lb-stage">
                        <div class="fg-lb-media-wrap">
                            <img class="fg-lb-img" src="" alt="" draggable="false" />
                            <div class="fg-lb-spinner" aria-hidden="true"></div>
                            <button class="fg-lb-prev" aria-label="Previous item" type="button" hidden></button>
                            <button class="fg-lb-next" aria-label="Next item"     type="button" hidden></button>
                            <div class="fg-lb-dots" role="tablist" aria-label="Item navigation" hidden></div>
                        </div>
                        <div class="fg-lb-thumbs" hidden></div>
                    </div>
                </div>
            </div>
        ` );
        dlg.appendChild( fragment );

        // Populate the image-loading spinner with the selected gallery icon.
        //
        // window.fotogridsLoadingIcon is injected by the Loading_Icon PHP feature
        // module as a small inline script before this file runs. It carries the
        // SVG string for exactly the one icon the gallery owner chose, so we never
        // ship the full 38-icon library to the frontend.
        //
        // __FG_ID__ in the SVG's SMIL animation IDs must be replaced with a
        // unique suffix each time we create a new dialog instance so multiple
        // lightboxes on the same page (unlikely but possible) don't share IDs.
        // We use a simple incrementing counter - enough for uniqueness here.
        const spinnerEl = dlg.querySelector( '.fg-lb-spinner' );
        if ( spinnerEl && window.fotogridsLoadingIcon?.svg ) {
            const uid = 'fglbs' + ( FotoGridsLightbox._spinnerIdCounter = ( FotoGridsLightbox._spinnerIdCounter || 0 ) + 1 );
            spinnerEl.innerHTML = window.fotogridsLoadingIcon.svg.replace( /__FG_ID__/g, uid );
        }

        // Close on backdrop click - honoured only when the setting allows it.
        // The backdrop div sits behind the shell; clicking it or the bare dialog
        // edge (which also shows through) should close when enabled.
        dlg.addEventListener( 'click', ( e ) => {
            if ( this.settings?.backdropClose &&
                 ( e.target === dlg || e.target.classList.contains( 'fg-lb-backdrop' ) ) ) {
                this.close();
            }
        } );

        const closeBtn = dlg.querySelector( '.fg-lb-close' );
        const prevBtn  = dlg.querySelector( '.fg-lb-prev' );
        const nextBtn  = dlg.querySelector( '.fg-lb-next' );

        closeBtn.addEventListener( 'click', () => this.close() );
        prevBtn.addEventListener(  'click', () => this.navigate( -1 ) );
        nextBtn.addEventListener(  'click', () => this.navigate( +1 ) );

        // Bind tooltips to static toolbar / nav buttons.
        // _bindTooltip() gates on this.settings.noTooltips at show-time so it is
        // safe to call here before settings are loaded (dialog is created lazily).
        this._bindTooltip( closeBtn, { dir: 'below' } );
        this._bindTooltip( prevBtn );
        this._bindTooltip( nextBtn );

        dlg.querySelector( '.fg-lb-dots' ).addEventListener( 'click', ( e ) => {
            const btn = e.target.closest( '[data-lb-index]' );
            if ( btn ) this.goTo( parseInt( btn.dataset.lbIndex, 10 ) );
        } );

        dlg.querySelector( '.fg-lb-thumbs' ).addEventListener( 'click', ( e ) => {
            const btn = e.target.closest( '[data-lb-index]' );
            if ( btn ) this.goTo( parseInt( btn.dataset.lbIndex, 10 ) );
        } );

        dlg.addEventListener( 'pointerdown',   this._onPointerDown );
        dlg.addEventListener( 'pointermove',   this._onPointerMove );
        dlg.addEventListener( 'pointerup',     this._onPointerUp   );
        dlg.addEventListener( 'pointercancel', this._onPointerUp   );

        // Zoom - wheel, touch-pinch, and click listeners on the media-wrap.
        // { passive: false } needed so wheel/touchmove can call preventDefault().
        const mediaWrap = dlg.querySelector( '.fg-lb-media-wrap' );
        mediaWrap.addEventListener( 'wheel',      this._onWheel,       { passive: false } );
        mediaWrap.addEventListener( 'touchstart',  this._onTouchStart,  { passive: true  } );
        mediaWrap.addEventListener( 'touchmove',   this._onTouchMove,   { passive: false } );
        mediaWrap.addEventListener( 'dblclick',    ( e ) => this._onZoomClick( e, true  ) );
        mediaWrap.addEventListener( 'click',       ( e ) => this._onZoomClick( e, false ) );

        // Native <dialog> dispatches its own 'close' event when the user
        // presses Escape (the browser handles Escape natively under
        // showModal). Without this listener, our close() method never
        // runs on ESC — so our custom fotogrids:lightbox:close event
        // never fires, and deep-linking (which listens for it) never
        // gets the cue to clear the URL. The _closeInProgress flag
        // guards against the reentrancy that would otherwise occur
        // when our close() also calls dialog.close().
        dlg.addEventListener( 'close', () => {
            if ( this._closeInProgress ) return;
            this.close();
        } );

        document.body.appendChild( dlg );
        this.dialog = dlg;
    }


    /**
     * Open the lightbox for a given gallery + item index.
     *
     * @param {HTMLElement} galleryEl
     * @param {number}      index
     */
    open( galleryEl, index ) {
        if ( ! this.dialog ) this._createDialog();

        this.galleryEl    = galleryEl;
        this.settings     = readSettings( galleryEl );
        this._preloadCache = new Set();

        // Re-attach auto listeners for the new gallery's settings.
        this._teardownAutoListeners();

        // Slide sourcing: paginated galleries use a sparse-cache model
        // backed by /gallery/lightbox/slides; non-paginated galleries
        // continue using the legacy "DOM is the source of truth"
        // model. The detection is wrapper-attribute driven so any
        // future surface (e.g. a fullscreen tour) that emits
        // data-fg-paginated reuses the same path.
        const visibleSlides = collectItems( galleryEl );

        if ( isGalleryPaginated( galleryEl ) ) {
            // Seed the sparse cache from the visible slides at their
            // global sequence indices. Other slots will be null until
            // fetched.
            const estimatedTotal = Math.max(
                readEstimatedTotal( galleryEl ),
                visibleSlides.length
            );
            this._total = estimatedTotal;
            this.items  = new Array( estimatedTotal ).fill( null );
            visibleSlides.forEach( ( slide ) => {
                const i = slide.sequenceIndex;
                if ( i != null && i >= 0 && i < estimatedTotal ) {
                    this.items[ i ] = slide;
                }
            } );

            // The `index` argument is interpreted as the index INTO
            // visibleSlides (the legacy contract from the click
            // handler). Translate it to the global sequence index of
            // the actual clicked item.
            const clickedSlide = visibleSlides[ Math.max( 0, Math.min( index, visibleSlides.length - 1 ) ) ];
            const startIndex   = clickedSlide && clickedSlide.sequenceIndex != null
                ? clickedSlide.sequenceIndex
                : 0;
            this.index = Math.max( 0, Math.min( startIndex, this._total - 1 ) );
        } else {
            // Non-paginated: classic flat list.
            this.items = visibleSlides;
            this._total = visibleSlides.length;
            this.index  = Math.max( 0, Math.min( index, Math.max( 0, this._total - 1 ) ) );
        }

        if ( this._total === 0 ) return;

        this._applySettings();
        this._renderNav();
        this._renderDots();
        this._renderThumbs();

        // Kick off slide fetching. Two strategies:
        //
        //  - Small galleries (<= FGLB_PRELOAD_ALL_THRESHOLD items) get
        //    a single bulk fetch of the entire sequence on open. Slide
        //    metadata is small (~500 bytes/item × 200 = 100 KB max),
        //    so we trade a tiny upfront payload for a smooth navigation
        //    experience: every thumb and every slide is ready before
        //    the user can scroll/click.
        //
        //  - Larger galleries fall back to lookahead-only fetching
        //    around this.index. Thumbs beyond the lookahead stay
        //    pending until the user navigates near them.
        //
        // Without this, when the starting index falls within the
        // already-seeded page-1 range (the common case), no fetch fires
        // and thumbs 8..(total-1) never load.
        if ( this._total <= FGLB_PRELOAD_ALL_THRESHOLD ) {
            this._ensureSlides(
                Math.floor( this._total / 2 ),  // centre of range
                this._total                      // covers the whole list
            );
        } else {
            this._ensureSlides( this.index, this._lookahead() );
        }

        this._showItem( this.index, false );

        if ( typeof this.dialog.showModal === 'function' ) {
            this.dialog.showModal();
        } else {
            this.dialog.setAttribute( 'open', '' );
        }

        // Focus the sentinel - a zero-size aria-hidden element - so the browser's
        // auto-focus doesn't land on a real button (which would show a tooltip or
        // fire on Space/Enter before the user has interacted).
        this._focusSentinel?.focus( { preventScroll: true } );

        document.body.style.overflow = 'hidden';
        document.addEventListener( 'keydown', this._onKeydown );

        if ( this.settings.autoProgress && this.items.length > 1 ) {
            this._startAuto();
        }

        this._trackView( this.items[ this.index ] );
        this._fire( 'open', { index: this.index, item: this.items[ this.index ] } );
    }

    /**
     * Open the lightbox over an explicit, externally-supplied flat slide
     * array rather than sourcing slides from the gallery DOM.
     *
     * Used by LightboxGrid: the grid shows every item, but the gallery
     * wrapper only contains the inline (featured + grid) items, so the
     * normal collectItems() path would see a partial list. This bypasses
     * collectItems() and treats the supplied slides as the full,
     * non-paginated set. Settings (colours, transition, info panel, etc.)
     * are still read from galleryEl so the overlay matches the gallery.
     *
     * @param {HTMLElement} galleryEl Gallery wrapper (settings source).
     * @param {Array<object>} slides  Flat slide dicts (see buildSlideFromTrigger shape).
     * @param {number} index          Start index into slides.
     */
    openSlides( galleryEl, slides, index ) {
        if ( ! Array.isArray( slides ) || slides.length === 0 ) return;
        if ( ! this.dialog ) this._createDialog();

        this.galleryEl     = galleryEl;
        this.settings      = readSettings( galleryEl );
        this._preloadCache = new Set();

        this._teardownAutoListeners();

        // Treat the supplied slides as the full, non-paginated flat list.
        this.items  = slides;
        this._total = slides.length;
        this.index  = Math.max( 0, Math.min( index | 0, this._total - 1 ) );

        this._applySettings();
        this._renderNav();
        this._renderDots();
        this._renderThumbs();

        this._showItem( this.index, false );

        if ( typeof this.dialog.showModal === 'function' ) {
            this.dialog.showModal();
        } else {
            this.dialog.setAttribute( 'open', '' );
        }

        this._focusSentinel?.focus( { preventScroll: true } );

        document.body.style.overflow = 'hidden';
        document.addEventListener( 'keydown', this._onKeydown );

        if ( this.settings.autoProgress && this.items.length > 1 ) {
            this._startAuto();
        }

        this._trackView( this.items[ this.index ] );
        this._fire( 'open', { index: this.index, item: this.items[ this.index ] } );
    }

    close() {
        if ( ! this.dialog ) return;
        if ( this._closeInProgress ) return;
        this._closeInProgress = true;

        // Stop any playing video before the dialog closes.
        this._clearVideoPane();

        this._stopAuto();
        this._teardownAutoListeners();
        document.removeEventListener( 'keydown', this._onKeydown );
        document.body.style.overflow = '';

        // Exit fullscreen before closing so the browser restores the viewport cleanly.
        if ( document.fullscreenElement && document.exitFullscreen ) {
            document.exitFullscreen();
        }

        if ( typeof this.dialog.close === 'function' ) {
            this.dialog.close();
        } else {
            this.dialog.removeAttribute( 'open' );
        }

        const item = this.items[ this.index ];
        if ( item && item.triggerEl ) {
            item.triggerEl.focus( { preventScroll: true } );
        } else if ( this.galleryEl ) {
            // The current slide was loaded via the REST endpoint (no
            // triggerEl). Restore focus to the nearest visible item
            // whose data-fg-sequence-index is closest to this.index.
            const candidates = this.galleryEl.querySelectorAll( '[data-fg-lightbox-trigger]' );
            let best = null;
            let bestDelta = Infinity;
            const target = this.index;
            candidates.forEach( ( el ) => {
                const figure = el.closest( '.fg-item' );
                const seqStr = figure ? figure.dataset.fgSequenceIndex : null;
                if ( seqStr === null || seqStr === '' ) return;
                const seq = parseInt( seqStr, 10 );
                const d = Math.abs( seq - target );
                if ( d < bestDelta ) { bestDelta = d; best = el; }
            } );
            if ( best ) best.focus( { preventScroll: true } );
        }

        this._itemDataCache.clear();
        this._fire( 'close', {} );
        this.galleryEl = null;
        this._closeInProgress = false;
    }

    // -----------------------------------------------------------------
    // Sparse-cache slide fetching (paginated galleries)
    //
    // For paginated galleries the lightbox holds a sparse this.items
    // array of length `this._total`. Slots are null until fetched. The
    // methods below fetch contiguous gaps from the
    // /gallery/lightbox/slides REST endpoint and re-render whenever
    // the current slot becomes available.
    // -----------------------------------------------------------------

    /**
     * Lookahead radius — how many slides on either side of the current
     * index to keep loaded. Sourced from the lightbox_preload_slides
     * setting (Pro Starter). Defaults to 2 if unset.
     *
     * @returns {number}
     */
    _lookahead() {
        const raw = this.settings && this.settings.preloadSlides;
        if ( typeof raw === 'number' && isFinite( raw ) && raw >= 0 ) {
            return Math.floor( raw );
        }
        return 2;
    }

    /**
     * Find the longest contiguous range starting at `from` (inclusive)
     * of null slots in this.items, capped at this._total - 1 and at
     * `maxLen` entries. Returns null if `from` is already filled.
     *
     * @param {number} from
     * @param {number} maxLen
     * @returns {{offset:number, limit:number}|null}
     */
    _findGap( from, maxLen ) {
        if ( from < 0 || from >= this._total ) return null;
        if ( this.items[ from ] != null ) return null;
        let end = from;
        while ( end < this._total && this.items[ end ] == null && ( end - from ) < maxLen ) {
            end++;
        }
        return { offset: from, limit: end - from };
    }

    /**
     * Ensure slides around `centerIndex` are loaded. Walks the desired
     * range, finds each contiguous gap, and issues one fetch per gap.
     * Resolves when all in-flight fetches have settled.
     *
     * Quietly no-ops for non-paginated galleries (this.items has no
     * nulls, all gaps are empty).
     *
     * @param {number} centerIndex
     * @param {number} lookahead
     * @returns {Promise<void>}
     */
    _ensureSlides( centerIndex, lookahead ) {
        if ( ! isGalleryPaginated( this.galleryEl ) ) return Promise.resolve();

        const start = Math.max( 0, centerIndex - lookahead );
        const end   = Math.min( this._total - 1, centerIndex + lookahead );

        const fetches = [];
        let cursor = start;
        while ( cursor <= end ) {
            const gap = this._findGap( cursor, end - cursor + 1 );
            if ( ! gap ) {
                // No gap starting at cursor — advance past any filled
                // slot.
                cursor++;
                continue;
            }
            fetches.push( this._fetchSlideRange( gap.offset, gap.limit ) );
            cursor = gap.offset + gap.limit;
        }
        return Promise.all( fetches ).then( () => undefined );
    }

    /**
     * Fetch a [offset, offset+limit) range of slides from the REST
     * endpoint. Populates this.items in place and triggers a re-render
     * of any UI bound to indices in that range.
     *
     * Deduplicates concurrent fetches of overlapping ranges via
     * this._inFlightFetches.
     *
     * @param {number} offset
     * @param {number} limit
     * @returns {Promise<void>}
     */
    _fetchSlideRange( offset, limit ) {
        const gEl = this.galleryEl;
        if ( ! gEl ) return Promise.resolve();

        const key = `${offset}:${limit}`;
        if ( ! this._inFlightFetches ) this._inFlightFetches = new Map();
        if ( this._inFlightFetches.has( key ) ) {
            return this._inFlightFetches.get( key );
        }

        const url   = ( window.fotogrids && window.fotogrids.restUrl )
            ? ( window.fotogrids.restUrl + 'fotogrids/v1/gallery/lightbox/slides' )
            : '/wp-json/fotogrids/v1/gallery/lightbox/slides';
        const nonce = gEl.dataset.fgRenderNonce
            || ( window.fotogrids && window.fotogrids.renderNonce )
            || '';
        const galleryId  = parseInt( gEl.dataset.fgGalleryId || '0', 10 );
        const randomSeed = parseInt( gEl.dataset.fgRandomSeed || '0', 10 );
        const filters    = readActiveFilters( gEl );

        const promise = fetch( url, {
            method:      'POST',
            headers:     {
                'Content-Type': 'application/json',
                'X-WP-Nonce':   nonce,
            },
            credentials: 'same-origin',
            body: JSON.stringify( {
                gallery_id:  galleryId,
                offset:      offset,
                limit:       limit,
                random_seed: randomSeed,
                filters:     filters,
            } ),
        } )
            .then( ( response ) => {
                if ( ! response.ok ) {
                    throw new Error( 'lightbox-slides/http-' + response.status );
                }
                return response.json();
            } )
            .then( ( data ) => {
                if ( ! data || ! Array.isArray( data.slides ) ) return;

                // The server's `total` is authoritative — fix our
                // sparse array length if our wrapper estimate was off.
                if ( typeof data.total === 'number' && data.total !== this._total ) {
                    if ( data.total > this._total ) {
                        // Grow the array; older indices stay null.
                        this.items.length = data.total;
                    } else {
                        // Shrink — truncate.
                        this.items.length = data.total;
                    }
                    this._total = data.total;
                }

                // Populate slots.
                data.slides.forEach( ( apiSlide, i ) => {
                    const slot = offset + i;
                    if ( slot < 0 || slot >= this._total ) return;
                    if ( this.items[ slot ] == null ) {
                        this.items[ slot ] = buildSlideFromApi( apiSlide );
                    }
                } );

                // If the current index just became available, re-render
                // it; also refresh counter / dots / thumbs because the
                // total may have changed.
                if ( this.items[ this.index ] != null ) {
                    this._showItem( this.index, false );
                }
                this._refreshChrome();
            } )
            .catch( () => { /* silent — manual nav still works on cache miss */ } )
            .then( () => {
                this._inFlightFetches.delete( key );
            } );

        this._inFlightFetches.set( key, promise );
        return promise;
    }

    /**
     * Re-render the bits of chrome whose contents depend on the total
     * count or the slide at the current index — counter, dots, thumbs.
     * Called after a fetch resolves so newly-arrived data shows up.
     */
    _refreshChrome() {
        if ( ! this.dialog ) return;
        try {
            this._renderDots();
            this._renderThumbs();
            // _showItem(false) above already updates the counter for the
            // current slide; but if the slot is still null we want the
            // chrome to reflect the latest total anyway.
            this._updateCounter && this._updateCounter();
        } catch ( e ) {
            // Defensive: a partial re-render after fetch should never
            // bring down the lightbox.
        }
    }

    /**
     * Navigate by delta (-1 = prev, +1 = next).
     *
     * @param {number} delta
     */
    navigate( delta ) {
        if ( this._transitioning ) return;

        const len  = this._total;
        let next;

        if ( this.settings.loop ) {
            next = ( ( this.index + delta ) % len + len ) % len;
        } else {
            next = Math.max( 0, Math.min( this.index + delta, len - 1 ) );
            if ( next === this.index ) return;
        }

        // Kick off any required fetches around the new index so the
        // slide data is on its way (or already arrived) by the time
        // _showItem cares about it.
        this._ensureSlides( next, this._lookahead() );

        this._showItem( next, true );
        this._updateNavEnds();

        this._fire( 'navigate', {
            index:     next,
            item:      this.items[ next ],
            direction: delta > 0 ? 'next' : 'prev',
        } );

        if ( this.settings.autoProgress ) {
            if ( this.settings.progressStop ) {
                // Manual navigation: stop and lock. Only the play button can restart.
                this._autoStoppedByUser = true;
                this._stopAuto();
            } else {
                // New slide - always restart from zero regardless of pause state.
                this._autoPaused = false;
                this._startAuto();
            }
        }
    }

    /**
     * Jump directly to index.
     *
     * @param {number} index
     */
    goTo( index ) {
        if ( index === this.index || this._transitioning ) return;
        const delta = index > this.index ? 1 : -1;
        this._ensureSlides( index, this._lookahead() );
        this._showItem( index, true );
        this._fire( 'navigate', { index, item: this.items[ index ], direction: delta > 0 ? 'next' : 'prev' } );
        if ( this.settings.autoProgress ) {
            if ( this.settings.progressStop ) {
                // Manual navigation: stop and lock. Only the play button can restart.
                this._autoStoppedByUser = true;
                this._stopAuto();
            } else {
                // New slide - always restart from zero regardless of pause state.
                this._autoPaused = false;
                this._startAuto();
            }
        }
    }


    /**
     * Reset zoom state to 1× and flush to DOM.
     * Called on every slide change.
     */
    _resetZoom() {
        this._zoomScale  = FGLB_ZOOM_MIN;
        this._zoomOffset = { x: 0, y: 0 };
        this._zoomDragging = false;
        this._applyZoom();
    }

    /**
     * Clamp _zoomOffset so the image never shows empty space around it.
     * Must be called after _zoomScale is already set to the new value.
     */
    _clampZoomOffset() {
        const imgEl = this.dialog?.querySelector( '.fg-lb-img' );
        if ( ! imgEl ) return;

        const wrap   = imgEl.parentElement;
        const wW     = wrap.clientWidth;
        const wH     = wrap.clientHeight;
        const iW     = imgEl.offsetWidth  * this._zoomScale;
        const iH     = imgEl.offsetHeight * this._zoomScale;

        // Maximum pan so image edge never goes past wrap edge.
        const maxX = Math.max( 0, ( iW - wW ) / 2 );
        const maxY = Math.max( 0, ( iH - wH ) / 2 );

        this._zoomOffset.x = Math.max( -maxX, Math.min( maxX, this._zoomOffset.x ) );
        this._zoomOffset.y = Math.max( -maxY, Math.min( maxY, this._zoomOffset.y ) );
    }

    /**
     * Write current zoom state into the per-gallery <style> block as CSS variables,
     * and update data-fg-lb-zoom-active / data-fg-lb-zoom-dragging on the dialog.
     *
     * Zero element.style mutations - consistent with the overall architecture.
     *
     * @param {boolean} [byUser=false] - true when triggered by a user gesture
     *                                   (button click, wheel, pinch, drag).
     *                                   Stops auto-progress when progressStop is on.
     */
    _applyZoom( byUser = false ) {
        if ( ! this.dialog ) return;

        // If this zoom was triggered by the user and progressStop is enabled, stop auto.
        if ( byUser && this.settings?.progressStop && this.settings?.autoProgress ) {
            this._autoStoppedByUser = true;
            this._stopAuto();
        }

        const dlg    = this.dialog;
        const zoomed = this._zoomScale > FGLB_ZOOM_MIN;

        // Append zoom vars to the per-gallery <style> block.
        // buildVarsCSS() owns the block; we append a scoped .fg-lightbox rule.
        const existing = this._styleEl.textContent;
        const zoomVars = [
            '.fg-lb-img {',
            `  --fg-lb-zoom-scale: ${this._zoomScale};`,
            `  --fg-lb-zoom-tx: ${this._zoomOffset.x}px;`,
            `  --fg-lb-zoom-ty: ${this._zoomOffset.y}px;`,
            '}',
        ].join( '\n' );

        // Replace the zoom block if already present, otherwise append.
        if ( existing.includes( '.fg-lb-img {' ) ) {
            this._styleEl.textContent = existing.replace(
                /\.fg-lb-img \{[\s\S]*?\}/,
                zoomVars
            );
        } else {
            this._styleEl.textContent = existing + '\n' + zoomVars;
        }

        dlg.toggleAttribute( 'data-fg-lb-zoom-active',   zoomed );
        dlg.toggleAttribute( 'data-fg-lb-zoom-dragging', this._zoomDragging );
    }

    /**
     * Compute the effective maximum zoom for the current image.
     *
     * When zoomBeyond is disabled, cap at the image's natural pixel density
     * (1× at original resolution). Falls back to FGLB_ZOOM_MAX if the image
     * hasn't loaded yet or its natural size is unknown.
     */
    _effectiveZoomMax() {
        if ( this.settings?.zoomBeyond ) return FGLB_ZOOM_MAX;

        const imgEl = this.dialog?.querySelector( '.fg-lb-img' );
        if ( imgEl && imgEl.naturalWidth && imgEl.offsetWidth ) {
            // Clamp: at least 1×, at most FGLB_ZOOM_MAX
            return Math.min(
                FGLB_ZOOM_MAX,
                Math.max( FGLB_ZOOM_MIN, imgEl.naturalWidth / imgEl.offsetWidth )
            );
        }
        return FGLB_ZOOM_MAX;
    }


    /**
     * Applies per-gallery settings to the dialog.
     *
     * CSS variables go into the <style id="fg-lb-vars"> block via buildVarsCSS().
     * State classes (theme, transition, layout) go onto dlg.className.
     * Zero element.style calls.
     */
    _applySettings() {
        const dlg = this.dialog;
        const s   = this.settings;

        this._styleEl.textContent = buildVarsCSS( s );

        // Reset class (keep only the base) and clear all per-gallery data attributes.
        dlg.className = 'fg-lightbox';
        dlg.removeAttribute( 'data-fg-lb-theme' );
        dlg.removeAttribute( 'data-fg-lb-transition' );
        dlg.removeAttribute( 'data-fg-lb-mobile' );
        dlg.removeAttribute( 'data-fg-lb-no-loop' );
        dlg.removeAttribute( 'data-fg-lb-zoom' );
        dlg.removeAttribute( 'data-fg-lb-zoom-trigger' );
        dlg.removeAttribute( 'data-fg-lb-zoom-icons' );
        dlg.removeAttribute( 'data-fg-lb-zoom-beyond' );
        dlg.removeAttribute( 'data-fg-lb-zoom-active' );
        dlg.removeAttribute( 'data-fg-lb-zoom-dragging' );
        dlg.removeAttribute( 'data-fg-lb-info-panel' );
        dlg.removeAttribute( 'data-fg-lb-progress-style' );
        dlg.removeAttribute( 'data-fg-lb-progress-bar-loc' );
        dlg.removeAttribute( 'data-fg-lb-progress-controls' );

        dlg.setAttribute( 'data-fg-lb-theme',      s.theme );
        dlg.setAttribute( 'data-fg-lb-transition', s.transition );

        if ( s.mobileLayout === 'mobile_optimized' ) {
            dlg.setAttribute( 'data-fg-lb-mobile', '' );
        }

        // Thumbnail strip location drives stage flex-direction.
        const stageEl = dlg.querySelector( '.fg-lb-stage' );
        stageEl.className = 'fg-lb-stage';
        if ( s.thumbLocation !== 'none' ) {
            stageEl.classList.add( `fg-lb-thumbs-${s.thumbLocation}` );
        }

        // Info panel visibility mode - data attribute on dialog, location class on content.
        const contentEl = dlg.querySelector( '.fg-lb-content' );
        contentEl.className = 'fg-lb-content';
        if ( s.infoPanel !== 'always' ) {
            dlg.setAttribute( 'data-fg-lb-info-panel', s.infoPanel );
        }
        if ( s.infoPanel !== 'never' ) {
            contentEl.classList.add( `fg-lb-info-loc-${s.infoLocation}` );
        }

        // Fit-media is a class, not a style.
        dlg.querySelector( '.fg-lb-media-wrap' )
           .classList.toggle( 'fg-lb-fit-media', s.fitMedia );

        // Arrow SVGs are embedded by PHP directly in the data attributes.
        dlg.querySelector( '.fg-lb-prev' ).innerHTML = s.arrowPrevSvg;
        dlg.querySelector( '.fg-lb-next' ).innerHTML = s.arrowNextSvg;

        // Loop mode - data attribute presence drives SCSS nav-end hiding.
        if ( ! s.loop ) {
            dlg.setAttribute( 'data-fg-lb-no-loop', '' );
        }

        // Dynamic DOM - info panel, toolbar buttons - all created/removed per open().
        this._applyDynamicDOM( s );

        // Zoom - data attribute presence drives CSS cursor and JS zoom handler.
        if ( s.zoom ) {
            dlg.setAttribute( 'data-fg-lb-zoom',         '' );
            dlg.setAttribute( 'data-fg-lb-zoom-trigger', s.zoomTrigger );
            if ( s.zoomIcons )  dlg.setAttribute( 'data-fg-lb-zoom-icons',  '' );
            if ( s.zoomBeyond ) dlg.setAttribute( 'data-fg-lb-zoom-beyond', '' );
        }

        // Auto-progress indicator style + bar location.
        if ( s.progressStyle === 'bar' || s.progressStyle === 'spinner' ) {
            dlg.setAttribute( 'data-fg-lb-progress-style', s.progressStyle );
        }
        if ( s.progressStyle === 'bar' ) {
            dlg.setAttribute( 'data-fg-lb-progress-bar-loc', s.progressBarLoc );
        }

        if ( s.progressControls ) {
            dlg.setAttribute( 'data-fg-lb-progress-controls', '' );
        }

        dlg.setAttribute( 'aria-label',
            `Gallery lightbox - ${this.items.length} item${this.items.length === 1 ? '' : 's'}` );
    }

    /**
     * Creates or removes dynamic DOM nodes (info panel, toolbar buttons) on each open().
     *
     * The dialog is a singleton reused across galleries, so anything that depends on
     * per-gallery settings must be created/removed here rather than baked into the
     * static template. Every node managed here is either added when needed or removed
     * when not - no hidden-but-present elements.
     *
     * @param {object} s Settings from readSettings()
     */
    _applyDynamicDOM( s ) {
        const dlg          = this.dialog;
        const toolbar      = dlg.querySelector( '.fg-lb-toolbar' );
        const toolbarStart = dlg.querySelector( '.fg-lb-toolbar-start' );
        const toolbarEnd   = dlg.querySelector( '.fg-lb-toolbar-end' );
        const content      = dlg.querySelector( '.fg-lb-content' );
        if ( ! toolbar || ! toolbarStart || ! toolbarEnd || ! content ) return;

        // Info panel + info-toggle button
        // Removed when infoPanel === 'never'; created otherwise.
        let infoEl     = content.querySelector( '.fg-lb-info' );
        let toggleBtn  = toolbar.querySelector( '.fg-lb-info-toggle' );

        if ( s.infoPanel === 'never' ) {
            infoEl?.remove();
            toggleBtn?.remove();
        } else {
            // Ensure the info panel element exists.
            if ( ! infoEl ) {
                infoEl = document.createElement( 'div' );
                infoEl.className = 'fg-lb-info';
                infoEl.setAttribute( 'aria-live', 'polite' );
                content.appendChild( infoEl );
            }

            // Apply info-blocks-style attribute so CSS can scope block appearance.
            infoEl.dataset.fgLbInfoBlocksStyle = s.infoBlocksStyle || 'boxed';

            if ( s.infoPanel === 'always' ) {
                infoEl.hidden = false;
                toggleBtn?.remove();
            } else {
                // on_click - info starts hidden, toggle button is visible.
                infoEl.hidden = true;

                if ( ! toggleBtn ) {
                    toggleBtn = document.createElement( 'button' );
                    toggleBtn.className = 'fg-lb-info-toggle';
                    toggleBtn.type = 'button';
                    toggleBtn.setAttribute( 'aria-label', 'Show info panel' );
                    toggleBtn.setAttribute( 'aria-pressed', 'false' );
                    toggleBtn.innerHTML = FGLB_ICON_INFO;
                    toggleBtn.addEventListener( 'click', () => {
                        const nowHidden = ! infoEl.hidden;
                        infoEl.hidden = nowHidden;
                        toggleBtn.setAttribute( 'aria-pressed', nowHidden ? 'false' : 'true' );
                        toggleBtn.setAttribute( 'aria-label', nowHidden ? 'Show info panel' : 'Hide info panel' );
                        toggleBtn.classList.toggle( 'fg-lb-btn--active', ! nowHidden );
                        window.FgTooltip?.refresh( toggleBtn );
                    } );
                    // Insert before the close button.
                    const closeBtn = toolbarEnd.querySelector( '.fg-lb-close' );
                    toolbarEnd.insertBefore( toggleBtn, closeBtn );
                    this._bindTooltip( toggleBtn, { dir: 'below' } );
                } else {
                    // Button already exists (same gallery reopened) - reset state.
                    toggleBtn.setAttribute( 'aria-pressed', 'false' );
                    toggleBtn.setAttribute( 'aria-label', 'Show info panel' );
                    toggleBtn.classList.remove( 'fg-lb-btn--active' );
                }
            }
        }

        // Share button - shown when sharing is enabled for the collection and the
        // 'lightbox' placement applies. Opens a popover share menu.
        let shareBtn = toolbar.querySelector( '.fg-lb-share' );
        if ( this._sharingConfig() ) {
            if ( ! shareBtn ) {
                shareBtn = document.createElement( 'button' );
                shareBtn.className = 'fg-lb-share';
                shareBtn.type = 'button';
                shareBtn.setAttribute( 'aria-label', 'Share' );
                shareBtn.setAttribute( 'aria-expanded', 'false' );
                shareBtn.innerHTML = FGLB_ICON_SHARE;
                shareBtn.addEventListener( 'click', () => this._toggleShareMenu( shareBtn ) );
                const closeBtn = toolbarEnd.querySelector( '.fg-lb-close' );
                toolbarEnd.insertBefore( shareBtn, closeBtn );
                this._bindTooltip( shareBtn, { dir: 'below' } );
            }
        } else {
            shareBtn?.remove();
        }

        // Fullscreen button - FGLB_ICON_FS_EXPAND / FGLB_ICON_FS_COLLAPSE defined at module level.
        let fsBtn = toolbar.querySelector( '.fg-lb-fullscreen' );
        if ( s.fullscreen ) {
            if ( ! fsBtn ) {
                fsBtn = document.createElement( 'button' );
                fsBtn.className = 'fg-lb-fullscreen';
                fsBtn.type = 'button';
                fsBtn.setAttribute( 'aria-label', 'Enter fullscreen' );
                fsBtn.setAttribute( 'aria-pressed', 'false' );
                fsBtn.innerHTML = FGLB_ICON_FS_EXPAND;
                fsBtn.addEventListener( 'click', () => {
                    if ( document.fullscreenElement ) {
                        document.exitFullscreen().catch( () => {} );
                    } else {
                        const shell = this.dialog.querySelector( '.fg-lb-shell' );
                        ( shell || this.dialog ).requestFullscreen().catch( () => {} );
                    }
                } );
                // Sync icon, aria-pressed, active class and aria-label with native fullscreen state.
                document.addEventListener( 'fullscreenchange', () => {
                    const active = !! document.fullscreenElement;
                    fsBtn.setAttribute( 'aria-pressed', active ? 'true' : 'false' );
                    fsBtn.setAttribute( 'aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen' );
                    fsBtn.innerHTML = active ? FGLB_ICON_FS_COLLAPSE : FGLB_ICON_FS_EXPAND;
                    fsBtn.classList.toggle( 'fg-lb-btn--active', active );
                    this.dialog.toggleAttribute( 'data-fg-lb-fullscreen-active', active );
                    window.FgTooltip?.refresh( fsBtn );
                } );
                const closeBtn = toolbarEnd.querySelector( '.fg-lb-close' );
                toolbarEnd.insertBefore( fsBtn, closeBtn );
                this._bindTooltip( fsBtn, { dir: 'below' } );
            }
        } else if ( fsBtn ) {
            fsBtn.remove();
        }

        // Zoom buttons - zoom-out and zoom-in, shown only when s.zoom && s.zoomIcons.
        // Both live in toolbarEnd; zoom-out is inserted before zoom-in (left-to-right: − +).
        let zoomInBtn  = toolbar.querySelector( '.fg-lb-zoom-in' );
        let zoomOutBtn = toolbar.querySelector( '.fg-lb-zoom-out' );
        if ( s.zoom && s.zoomIcons ) {
            if ( ! zoomInBtn ) {
                zoomInBtn = document.createElement( 'button' );
                zoomInBtn.className = 'fg-lb-zoom-in';
                zoomInBtn.type = 'button';
                zoomInBtn.setAttribute( 'aria-label', 'Zoom in' );
                zoomInBtn.innerHTML = FGLB_ICON_ZOOM_IN;
                zoomInBtn.addEventListener( 'click', () => {
                    const max = this._effectiveZoomMax();
                    this._zoomScale = Math.min( max, this._zoomScale + FGLB_ZOOM_STEP );
                    this._clampZoomOffset();
                    this._applyZoom( true );
                } );
                const closeBtn = toolbarEnd.querySelector( '.fg-lb-close' );
                toolbarEnd.insertBefore( zoomInBtn, closeBtn );
                this._bindTooltip( zoomInBtn, { dir: 'below' } );
            }
            if ( ! zoomOutBtn ) {
                zoomOutBtn = document.createElement( 'button' );
                zoomOutBtn.className = 'fg-lb-zoom-out';
                zoomOutBtn.type = 'button';
                zoomOutBtn.setAttribute( 'aria-label', 'Zoom out' );
                zoomOutBtn.innerHTML = FGLB_ICON_ZOOM_OUT;
                zoomOutBtn.addEventListener( 'click', () => {
                    this._zoomScale = Math.max( FGLB_ZOOM_MIN, this._zoomScale - FGLB_ZOOM_STEP );
                    if ( this._zoomScale === FGLB_ZOOM_MIN ) this._zoomOffset = { x: 0, y: 0 };
                    else this._clampZoomOffset();
                    this._applyZoom( true );
                } );
                // Insert before zoom-in so order is: … | − | + | close
                toolbarEnd.insertBefore( zoomOutBtn, zoomInBtn );
                this._bindTooltip( zoomOutBtn, { dir: 'below' } );
            }
        } else {
            zoomInBtn?.remove();
            zoomOutBtn?.remove();
        }

        // Progress bar - absolute stripe inside .fg-lb-shell.
        // Created once and kept; visibility driven by CSS mode classes on .fg-lightbox.
        let progressBar = dlg.querySelector( '.fg-lb-progress-bar' );
        if ( s.progressStyle === 'bar' && s.autoProgress ) {
            if ( ! progressBar ) {
                progressBar = document.createElement( 'div' );
                progressBar.className    = 'fg-lb-progress-bar';
                progressBar.setAttribute( 'aria-hidden', 'true' );
                // Insert at the start of .fg-lb-shell so it sits above all siblings.
                const shell = dlg.querySelector( '.fg-lb-shell' );
                shell.insertBefore( progressBar, shell.firstChild );
            }
        } else if ( progressBar ) {
            progressBar.remove();
        }

        // Progress spinner - SVG progress ring at the left end of the toolbar.
        // Uses stroke-dashoffset animation on a <circle> - reliable fill from 0°
        // to 360° with CSS animation, pauseable via class on .fg-lightbox.
        let progressSpinner = toolbar.querySelector( '.fg-lb-progress-spinner' );
        if ( s.progressStyle === 'spinner' && s.autoProgress ) {
            if ( ! progressSpinner ) {
                progressSpinner = document.createElement( 'div' );
                progressSpinner.className = 'fg-lb-progress-spinner';
                progressSpinner.setAttribute( 'aria-hidden', 'true' );
                // The SVG viewBox is 32×32. The circle r=13 gives circumference ≈ 81.68.
                // stroke-dasharray is set to that circumference via CSS var so SCSS can
                // control the radius without keeping it in sync here.
                progressSpinner.innerHTML = `
                    <svg class="fg-lb-progress-ring" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                        <circle class="fg-lb-progress-ring-track" cx="16" cy="16" r="13"/>
                        <circle class="fg-lb-progress-ring-fill"  cx="16" cy="16" r="13"/>
                    </svg>
                `;
                toolbarStart.appendChild( progressSpinner );
            }
        } else if ( progressSpinner ) {
            progressSpinner.remove();
        }

        // Item counter - "1 / N" text shown in toolbar-start.
        let counterEl = toolbar.querySelector( '.fg-lb-counter' );
        if ( s.showCounter && this.items.length > 1 ) {
            if ( ! counterEl ) {
                counterEl = document.createElement( 'span' );
                counterEl.className = 'fg-lb-counter';
                counterEl.setAttribute( 'aria-live', 'polite' );
                counterEl.setAttribute( 'aria-atomic', 'true' );
                toolbarStart.appendChild( counterEl );
            }
            counterEl.textContent = `${ this.index + 1 } / ${ this.items.length }`;
        } else if ( counterEl ) {
            counterEl.remove();
        }

        // Play/pause button - shown when progressControls is enabled.
        // FGLB_ICON_PAUSE / FGLB_ICON_PLAY are module-level constants defined above the class.

        let playPauseBtn = toolbar.querySelector( '.fg-lb-play-pause' );
        if ( s.autoProgress && s.progressControls ) {
            if ( ! playPauseBtn ) {
                playPauseBtn = document.createElement( 'button' );
                playPauseBtn.className = 'fg-lb-play-pause';
                playPauseBtn.type = 'button';
                playPauseBtn.setAttribute( 'aria-label', 'Pause auto-advance' );
                playPauseBtn.setAttribute( 'aria-pressed', 'false' );
                playPauseBtn.innerHTML = FGLB_ICON_PAUSE;  // playing on open → show pause bars
                playPauseBtn.addEventListener( 'click', ( e ) => {
                    e.stopPropagation();
                    if ( this._autoPaused || this._autoStoppedByUser ) {
                        this._playBtnResume();
                    } else {
                        this._pauseAuto();
                    }
                } );
                // Insert before the close button.
                const closeBtn = toolbarEnd.querySelector( '.fg-lb-close' );
                toolbarEnd.insertBefore( playPauseBtn, closeBtn );
                this._bindTooltip( playPauseBtn, { dir: 'below' } );
            }
        } else if ( playPauseBtn ) {
            playPauseBtn.remove();
        }
    }

    /**
     * Syncs the play/pause toolbar button icon and aria attributes.
     *
     * @param {boolean} paused
     */
    _syncPlayPauseBtn( paused ) {
        const btn = this.dialog?.querySelector( '.fg-lb-play-pause' );
        if ( ! btn ) return;

        // FGLB_ICON_PAUSE / FGLB_ICON_PLAY are module-level constants defined above the class.

        if ( paused ) {
            // Currently paused → show play triangle so user can resume
            btn.innerHTML = FGLB_ICON_PLAY;
            btn.setAttribute( 'aria-label', 'Resume auto-advance' );
            btn.setAttribute( 'aria-pressed', 'true' );
            btn.classList.add( 'fg-lb-btn--active' );
        } else {
            // Currently playing → show pause bars so user can pause
            btn.innerHTML = FGLB_ICON_PAUSE;
            btn.setAttribute( 'aria-label', 'Pause auto-advance' );
            btn.setAttribute( 'aria-pressed', 'false' );
            btn.classList.remove( 'fg-lb-btn--active' );
        }
        window.FgTooltip?.refresh( btn );
    }


    _renderNav() {
        const s         = this.settings;
        const multiItem = this.items.length > 1;
        const dlg       = this.dialog;

        const show = s.showArrows && multiItem;
        dlg.querySelector( '.fg-lb-prev' ).hidden = ! show;
        dlg.querySelector( '.fg-lb-next' ).hidden = ! show;

        if ( show ) this._updateNavEnds();
    }

    /**
     * Hides/shows prev/next arrows at the first/last slide when loop is off
     * and hideArrowsAtEnds is enabled. No-op when looping.
     */
    _updateNavEnds() {
        const s   = this.settings;
        if ( ! s.showArrows || this.items.length <= 1 ) return;

        const dlg     = this.dialog;
        const prevBtn = dlg.querySelector( '.fg-lb-prev' );
        const nextBtn = dlg.querySelector( '.fg-lb-next' );

        if ( ! s.loop && s.hideArrowsAtEnds ) {
            prevBtn.hidden = this.index === 0;
            nextBtn.hidden = this.index === this.items.length - 1;
        } else {
            prevBtn.hidden = false;
            nextBtn.hidden = false;
        }
    }

    _renderDots() {
        const container = this.dialog.querySelector( '.fg-lb-dots' );
        const s         = this.settings;

        if ( ! s.showDots || this.items.length <= 1 ) {
            container.hidden = true;
            return;
        }

        container.hidden    = false;
        container.innerHTML = '';

        this.items.forEach( ( _, i ) => {
            const btn = document.createElement( 'button' );
            btn.type            = 'button';
            btn.className       = `fg-lb-dot fg-lb-dot-${s.dotStyle}`;
            btn.dataset.lbIndex = i;
            btn.setAttribute( 'role',       'tab' );
            btn.setAttribute( 'aria-label', `Item ${i + 1} of ${this.items.length}` );
            // Colors flow from --fg-lb-dot-color / --fg-lb-dot-active-color
            // declared in the <style> block - no inline styles needed.
            container.appendChild( btn );
        } );

        this._updateDots();
    }

    _updateDots() {
        if ( ! this.settings.showDots ) return;
        this.dialog.querySelectorAll( '.fg-lb-dot' ).forEach( ( btn, i ) => {
            const active = i === this.index;
            btn.classList.toggle( 'fg-lb-dot--active', active );
            btn.setAttribute( 'aria-selected', active ? 'true' : 'false' );
        } );
    }

    _updateCounter() {
        const el = this.dialog?.querySelector( '.fg-lb-counter' );
        if ( ! el ) return;
        el.textContent = `${ this.index + 1 } / ${ this.items.length }`;
    }

    _renderThumbs() {
        const container = this.dialog.querySelector( '.fg-lb-thumbs' );
        const s         = this.settings;

        if ( s.thumbLocation === 'none' || this.items.length <= 1 ) {
            container.hidden = true;
            return;
        }

        container.hidden    = false;
        container.className = `fg-lb-thumbs fg-lb-thumbs--${s.thumbLocation} fg-lb-thumbs--${s.thumbSize}`;
        container.classList.toggle( 'fg-lb-thumbs--no-drag',  ! s.thumbDrag );
        container.classList.toggle( 'fg-lb-thumbs--no-swipe', ! s.thumbSwipe );
        // Thumb spacing flows through a CSS variable set in buildVarsCSS.
        container.innerHTML = '';

        // Inner track wrapper. The track holds the flex layout while
        // the outer container handles overflow scrolling. See lightbox.scss
        // for why this split exists (flexbox + centred + overflow gotcha).
        const track = document.createElement( 'div' );
        track.className = 'fg-lb-thumbs__track';

        this.items.forEach( ( item, i ) => {
            const btn = document.createElement( 'button' );
            btn.type            = 'button';
            btn.className       = 'fg-lb-thumb';
            btn.dataset.lbIndex = i;
            btn.setAttribute( 'aria-label', `Go to item ${i + 1}` );

            const isVideo = !! item && typeof item.itemType === 'string'
                && item.itemType.indexOf( 'video' ) === 0;
            const thumbSrc = item && item.thumbSrc ? item.thumbSrc : '';

            if ( thumbSrc ) {
                const img    = document.createElement( 'img' );
                // Empty slot in the sparse cache — render a placeholder
                // <img> so the strip's layout stays stable. _refreshChrome
                // re-renders the strip once fetches resolve, filling in
                // the real thumbSrc.
                img.src      = thumbSrc;
                img.alt      = '';
                img.loading  = 'lazy';
                img.decoding = 'async';
                btn.appendChild( img );
            } else if ( isVideo ) {
                // Video with no resolvable poster — show the styled placeholder
                // instead of a broken image.
                const ph = document.createElement( 'span' );
                ph.className = 'fg-lb-thumb-placeholder';
                btn.appendChild( ph );
            } else {
                const img    = document.createElement( 'img' );
                img.src      = '';
                img.alt      = '';
                img.loading  = 'lazy';
                img.decoding = 'async';
                btn.appendChild( img );
            }

            // Play badge on video thumbs so they read as videos in the strip.
            if ( isVideo ) {
                btn.classList.add( 'fg-lb-thumb--video' );
                const badge = document.createElement( 'span' );
                badge.className = 'fg-lb-thumb-badge';
                badge.setAttribute( 'aria-hidden', 'true' );
                btn.appendChild( badge );
            }

            if ( ! item ) {
                btn.classList.add( 'fg-lb-thumb--pending' );
            }

            track.appendChild( btn );
        } );

        container.appendChild( track );

        this._updateThumbs();
    }

    _updateThumbs() {
        if ( this.settings.thumbLocation === 'none' ) return;
        this.dialog.querySelectorAll( '.fg-lb-thumb' ).forEach( ( btn, i ) => {
            btn.classList.toggle( 'fg-lb-thumb--active', i === this.index );
            btn.setAttribute( 'aria-pressed', i === this.index ? 'true' : 'false' );
        } );

        const activeThumb = this.dialog.querySelector( '.fg-lb-thumb--active' );
        if ( activeThumb ) {
            activeThumb.scrollIntoView( { block: 'nearest', inline: 'nearest', behavior: 'smooth' } );
        }
    }


    _showItem( index, animated ) {
        this.index = index;
        const item  = this.items[ index ];
        const dlg   = this.dialog;
        const s     = this.settings;

        // Reset zoom on every slide change so the new image starts at 1×.
        if ( s.zoom ) this._resetZoom();

        dlg.setAttribute( 'aria-label', `Item ${index + 1} of ${this._total}` );

        // Slide not yet loaded — show the lightbox spinner, update
        // chrome to reflect the new index, and bail. Once the fetch
        // resolves and populates this.items[index], _fetchSlideRange's
        // success path re-invokes _showItem.
        if ( ! item ) {
            const imgElPending  = dlg.querySelector( '.fg-lb-img' );
            const spinnerPending = dlg.querySelector( '.fg-lb-spinner' );
            if ( imgElPending ) {
                imgElPending.removeAttribute( 'src' );
                imgElPending.alt = '';
                imgElPending.classList.add( 'fg-lb-img--loading' );
            }
            if ( spinnerPending ) {
                spinnerPending.hidden = false;
            }
            this._renderInfoBlocks( null );
            this._updateDots();
            this._updateCounter();
            this._updateThumbs();
            this._updateNavEnds();
            return;
        }

        this._renderInfoBlocks( item );

        this._updateDots();
        this._updateCounter();
        this._updateThumbs();
        this._updateNavEnds();

        // Always tear down a previous video pane before painting the new slide,
        // which stops playback when navigating away from a video.
        this._clearVideoPane();

        if ( this._isVideoSlide( item ) ) {
            this._showVideoSlide( item );
            this._preloadAdjacentSlides( index );
            return;
        }

        const imgEl  = dlg.querySelector( '.fg-lb-img' );
        const spinner = dlg.querySelector( '.fg-lb-spinner' );

        const doSwap = () => {
            this._transitioning = true;
            spinner.hidden = false;

            const onLoad = () => {
                spinner.hidden = true;
                imgEl.classList.remove( 'fg-lb-img--loading' );
                if ( animated && s.transition !== 'none' ) {
                    imgEl.classList.add( 'fg-lb-img--in' );
                    imgEl.addEventListener( 'transitionend', () => {
                        imgEl.classList.remove( 'fg-lb-img--in' );
                        this._transitioning = false;
                    }, { once: true } );
                } else {
                    this._transitioning = false;
                }
            };

            if ( imgEl.complete && imgEl.src === item.fullSrc ) {
                onLoad();
                return;
            }

            imgEl.classList.add( 'fg-lb-img--loading' );
            imgEl.alt = item.alt;
            imgEl.src = item.fullSrc;
            imgEl.addEventListener( 'load',  onLoad, { once: true } );
            imgEl.addEventListener( 'error', onLoad, { once: true } );
        };

        if ( animated && s.transition !== 'none' ) {
            imgEl.classList.add( 'fg-lb-img--out' );
            const dur = Math.min( s.duration / 2, 200 );
            setTimeout( () => {
                imgEl.classList.remove( 'fg-lb-img--out' );
                doSwap();
            }, dur );
        } else {
            doSwap();
        }

        this._preloadAdjacentSlides( index );
    }

    /**
     * Whether a slide represents a video item.
     *
     * @param {object} item
     * @returns {boolean}
     */
    _isVideoSlide( item ) {
        return !! item && typeof item.itemType === 'string'
            && item.itemType.indexOf( 'video' ) === 0;
    }

    /**
     * Render a video player into the media wrap for a video slide. The image
     * element is hidden while a video plays; _clearVideoPane restores it.
     *
     * @param {object} item
     */
    _showVideoSlide( item ) {
        const dlg = this.dialog;
        const wrap = dlg.querySelector( '.fg-lb-media-wrap' );
        const imgEl = dlg.querySelector( '.fg-lb-img' );
        const spinner = dlg.querySelector( '.fg-lb-spinner' );

        if ( ! wrap ) return;

        if ( spinner ) spinner.hidden = true;
        if ( imgEl ) {
            imgEl.classList.remove( 'fg-lb-img--loading' );
            imgEl.classList.add( 'fg-lb-img--hidden' );
        }

        const player = this._buildVideoPlayer( item );
        if ( ! player ) {
            // Fall back to showing the poster if we couldn't build a player.
            if ( imgEl ) {
                imgEl.classList.remove( 'fg-lb-img--hidden' );
                imgEl.src = item.fullSrc || item.thumbSrc || '';
            }
            return;
        }

        const pane = document.createElement( 'div' );
        pane.className = 'fg-lb-video';
        pane.appendChild( player );
        wrap.appendChild( pane );
        this._videoPane = pane;
    }

    /**
     * Remove the active video pane (stopping playback) and restore the image
     * element for the next image slide.
     */
    _clearVideoPane() {
        if ( this._videoPane ) {
            // Pausing the <video> (or removing the <iframe>) halts playback and
            // audio; removing the node is enough for both.
            this._videoPane.remove();
            this._videoPane = null;
        }
        const imgEl = this.dialog?.querySelector( '.fg-lb-img' );
        if ( imgEl ) {
            imgEl.classList.remove( 'fg-lb-img--hidden' );
        }
    }

    /**
     * Build the <video> or <iframe> element for a video slide. Autoplays on
     * open (muted where required by browser policy is the caller's concern).
     *
     * @param {object} item
     * @returns {HTMLElement|null}
     */
    _buildVideoPlayer( item ) {
        const settings = item.embedSettings || {};

        if ( item.itemType === 'video_file' ) {
            if ( ! item.videoSrc ) return null;
            const video = document.createElement( 'video' );
            video.className = 'fg-lb-video-player';
            video.src = item.videoSrc;
            video.controls = settings.controls === false ? false : true;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = !! settings.mute;
            video.loop = !! settings.loop;
            if ( item.fullSrc ) {
                video.poster = item.fullSrc;
            }
            return video;
        }

        if ( ! item.embedId ) return null;
        const src = item.itemType === 'video_vimeo'
            ? buildVimeoEmbedSrc( item.embedId, settings, true )
            : buildYouTubeEmbedSrc( item.embedId, settings, true );
        if ( ! src ) return null;

        const iframe = document.createElement( 'iframe' );
        iframe.className = 'fg-lb-video-player';
        iframe.src = src;
        iframe.setAttribute( 'frameborder', '0' );
        iframe.setAttribute( 'allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share' );
        iframe.setAttribute( 'allowfullscreen', '' );
        iframe.setAttribute( 'title', item.title || item.alt || 'Video' );
        return iframe;
    }

    _preloadAdjacentSlides( index ) {
        const count = this.settings.preloadSlides;
        if ( ! count || this.items.length <= 1 ) return;

        const len  = this.items.length;
        const loop = this.settings.loop;

        for ( let offset = 1; offset <= count; offset++ ) {
            const candidates = [
                loop ? ( index + offset ) % len : index + offset,
                loop ? ( ( index - offset ) % len + len ) % len : index - offset,
            ];

            candidates.forEach( i => {
                if ( i < 0 || i >= len ) return;
                const src = this.items[ i ]?.fullSrc;
                if ( ! src || this._preloadCache.has( src ) ) return;
                this._preloadCache.add( src );
                ( new Image() ).src = src;
            } );
        }
    }


    /**
     * EXIF field key → human-readable label.
     * Keep in sync with the field keys stored by TabEXIF.
     */
    static get EXIF_LABELS() {
        return {
            camera:        'Camera',
            aperture:      'Aperture',
            shutter_speed: 'Shutter Speed',
            iso:           'ISO',
            lens:          'Lens',
            focal_length:  'Focal Length',
            date_taken:    'Date Taken',
            copyright:     'Copyright',
            orientation:   'Orientation',
            flash:         'Flash',
            white_balance: 'White Balance',
            exposure_mode: 'Exposure Mode',
        };
    }

    /**
     * SVG icon markup for block headers (tags, people, location).
     * Each value is a string of SVG path content - the outer <svg> wrapper
     * is added by _makeBlockHeader so size/class attrs are consistent.
     */
    static get BLOCK_ICONS() {
        return {
            tags:     '<path d="M8 8H8.01M4.56274 2.93726L2.93726 4.56274C2.59136 4.90864 2.4184 5.0816 2.29472 5.28343C2.18506 5.46237 2.10425 5.65746 2.05526 5.86154C2 6.09171 2 6.3363 2 6.82548L2 9.67452C2 10.1637 2 10.4083 2.05526 10.6385C2.10425 10.8425 2.18506 11.0376 2.29472 11.2166C2.4184 11.4184 2.59135 11.5914 2.93726 11.9373L10.6059 19.6059C11.7939 20.7939 12.388 21.388 13.0729 21.6105C13.6755 21.8063 14.3245 21.8063 14.927 21.6105C15.612 21.388 16.2061 20.7939 17.3941 19.6059L19.6059 17.3941C20.7939 16.2061 21.388 15.612 21.6105 14.927C21.8063 14.3245 21.8063 13.6755 21.6105 13.0729C21.388 12.388 20.7939 11.7939 19.6059 10.6059L11.9373 2.93726C11.5914 2.59136 11.4184 2.4184 11.2166 2.29472C11.0376 2.18506 10.8425 2.10425 10.6385 2.05526C10.4083 2 10.1637 2 9.67452 2L6.82548 2C6.3363 2 6.09171 2 5.86154 2.05526C5.65746 2.10425 5.46237 2.18506 5.28343 2.29472C5.0816 2.4184 4.90865 2.59135 4.56274 2.93726ZM8.5 8C8.5 8.27614 8.27614 8.5 8 8.5C7.72386 8.5 7.5 8.27614 7.5 8C7.5 7.72386 7.72386 7.5 8 7.5C8.27614 7.5 8.5 7.72386 8.5 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
            people:   '<path d="M12 15C8.8299 15 6.01077 16.5306 4.21597 18.906C3.82968 19.4172 3.63653 19.6728 3.64285 20.0183C3.64773 20.2852 3.81533 20.6219 4.02534 20.7867C4.29716 21 4.67384 21 5.4272 21H18.5727C19.3261 21 19.7028 21 19.9746 20.7867C20.1846 20.6219 20.3522 20.2852 20.3571 20.0183C20.3634 19.6728 20.1703 19.4172 19.784 18.906C17.9892 16.5306 15.17 15 12 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12C14.4853 12 16.5 9.98528 16.5 7.5C16.5 5.01472 14.4853 3 12 3C9.51469 3 7.49997 5.01472 7.49997 7.5C7.49997 9.98528 9.51469 12 12 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
            location: '<path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22C16 18 20 14.4183 20 10C20 5.58172 16.4183 2 12 2C7.58172 2 4 5.58172 4 10C4 14.4183 8 18 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        };
    }

    /**
     * Build a block header element: icon + label.
     *
     * @param {string} label     Visible text label.
     * @param {string} iconPaths SVG path markup (inner content of the <svg>).
     * @returns {HTMLElement}
     */
    static _makeBlockHeader( label, iconPaths ) {
        const header = document.createElement( 'div' );
        header.className = 'fg-lb-info-block-header';
        header.innerHTML = `<svg class="fg-lb-info-block-header-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${ iconPaths }</svg>`;
        const labelEl = document.createElement( 'span' );
        labelEl.textContent = label;
        header.appendChild( labelEl );
        return header;
    }

    /**
     * Render the info panel blocks for the given item.
     *
     * Called from _showItem() on every slide change. Clears and rebuilds
     * .fg-lb-info based on this.settings.infoBlocks. Blocks that only need
     * data from the item object (caption, share) are rendered immediately.
     * Blocks that need REST data (description, credit, file_info, exif, tags,
     * people, location) show a skeleton while the fetch is in progress, then
     * fill in on resolve.
     *
     * @param {{caption: string, title: string, id: string}} item
     */
    /**
     * Resolve the sharing config for the current gallery, gated on the
     * 'lightbox' placement. Returns null when sharing does not apply.
     *
     * @returns {Object|null}
     */
    _sharingConfig() {
        if ( ! this.galleryEl || ! window.FotoGridsSharing ) return null;

        const raw = this.galleryEl.dataset.fgSharing;
        if ( ! raw ) return null;

        let config;
        try {
            config = JSON.parse( raw );
        } catch ( e ) {
            return null;
        }

        if ( ! config.enabled || ! Array.isArray( config.placements ) || ! config.placements.includes( 'lightbox' ) ) {
            return null;
        }
        return config;
    }

    /**
     * Build the share bar for the lightbox, from the resolved sharing config
     * the decorator wrote onto the gallery wrapper. Returns null when sharing
     * does not apply for the collection.
     *
     * @param {Object}  item             The current lightbox item.
     * @param {Object}  [overrides]      Per-render overrides to the resolved config.
     * @param {string}  [overrides.button_size]   'small' | 'medium' | 'large'.
     * @param {string}  [overrides.button_style]  'icons_only' | 'labels_only' | 'icons_and_labels'.
     * @returns {HTMLElement|null}
     */
    _buildLightboxShareBar( item, overrides ) {
        const config = this._sharingConfig();
        if ( ! config ) return null;

        // Apply overrides without mutating the resolved config the rest of the
        // sharing pipeline reads.
        const effectiveConfig = overrides
            ? Object.assign( {}, config, overrides )
            : config;

        // Both lightbox usages (info-panel block and the toolbar popover) want
        // the 2-column grid layout. The popover later adds its own
        // --lightbox-popover class which overrides the grid to a 3-up compact
        // grid, so requesting 'grid' here is safe for both.
        const bar = window.FotoGridsSharing.renderShareBar(
            effectiveConfig,
            {
                id:        item.id || '',
                fullUrl:   item.fullSrc || '',
                caption:   item.caption || item.alt || '',
                galleryEl: this.galleryEl,
                // Pipeline writes data-fg-gallery-id on the wrapper.
                galleryId: this.galleryEl.dataset.fgGalleryId || '',
            },
            { layout: 'grid' }
        );

        if ( bar ) {
            bar.classList.add( 'fotogrids-share-bar--lightbox' );
        }

        return bar;
    }

    /**
     * Toggle the lightbox toolbar share popover.
     *
     * Visually this is the fg-tooltip element switched into interactive
     * mode — same chrome (rounded pill, arrow), positioned above the share
     * toolbar button, but with the share grid inside instead of plain text.
     * Dismissal: click outside, Escape, or click the share button again
     * (showInteractive handles toggle for us).
     *
     * @param {HTMLElement} btn  The toolbar share button.
     * @returns {void}
     */
    _toggleShareMenu( btn ) {
        if ( ! window.FgTooltip || typeof window.FgTooltip.showInteractive !== 'function' ) {
            return;
        }

        // Smaller everything inside the tooltip — the toolbar popover should
        // feel proportional to the toolbar button, not the full-size view
        // page footer bar.
        const bar = this._buildLightboxShareBar( this.items[ this.index ] || {}, {
            button_size:  'small',
            button_style: 'icons_only',
        } );
        if ( ! bar ) return;

        bar.classList.add( 'fotogrids-share-bar--lightbox-popover' );

        const opened = window.FgTooltip.showInteractive( btn, bar, { dir: 'below' } );
        btn.classList.toggle( 'fg-lb-btn--active', opened );
    }

    _renderInfoBlocks( item ) {
        const infoEl = this.dialog?.querySelector( '.fg-lb-info' );
        if ( ! infoEl ) return;

        const s = this.settings;
        if ( s.infoPanel === 'never' ) return;

        // No item yet (sparse slide cache still fetching) — clear and
        // leave empty. We'll be invoked again when the slide arrives.
        if ( ! item ) {
            infoEl.innerHTML = '';
            return;
        }

        const ALL_BLOCKS = [ 'caption', 'description', 'credit', 'file_info', 'exif', 'tags', 'people', 'location', 'share', 'rating', 'download' ];
        const blocks = s.infoBlocks || ALL_BLOCKS;

        infoEl.innerHTML = '';

        const restBlocks = new Set( [ 'description', 'credit', 'file_info', 'exif', 'tags', 'people', 'location' ] );

        const needsRest = blocks.some( ( b ) => restBlocks.has( b ) );

        // caption + description are combined into a single block if both enabled.
        for ( let i = 0; i < blocks.length; i++ ) {
            const blockId = blocks[ i ];

            // Skip description here if we'll merge it with caption.
            if ( blockId === 'description' && blocks.includes( 'caption' ) ) {
                continue; // Will be handled inside the caption block.
            }

            const blockEl = document.createElement( 'div' );
            blockEl.className = 'fg-lb-info-block';
            blockEl.dataset.fgLbBlock = blockId;

            if ( blockId === 'caption' ) {
                // Caption is immediate. Description (if enabled) fills in
                // when REST resolves. We deliberately do NOT render a
                // skeleton placeholder for description — when the fetch
                // is fast, the skeleton flash reads as a layout glitch.
                // _fillInfoBlocksFromData creates the description <p>
                // from scratch if needed.
                const hasCaption     = item.caption !== '';
                const hasDescription = blocks.includes( 'description' );

                if ( hasCaption ) {
                    const captionEl = document.createElement( 'p' );
                    captionEl.className   = 'fg-lb-info-caption';
                    captionEl.textContent = item.caption;
                    blockEl.appendChild( captionEl );
                }

                // Skip the block entirely when there's neither caption
                // nor description-coming. When the fetch resolves and
                // description IS present, _fillInfoBlocksFromData
                // creates a fresh standalone description block on its
                // own (it already handles the "no caption block found"
                // path).
                if ( ! hasCaption && ! hasDescription ) {
                    continue;
                }
                // When only description is expected (no caption yet) we
                // still skip rendering an empty block; the description
                // arrives via the standalone path. This avoids an empty
                // grey box flashing in the info panel.
                if ( ! hasCaption ) {
                    continue;
                }

                infoEl.appendChild( blockEl );

            } else if ( blockId === 'share' ) {
                const shareBar = this._buildLightboxShareBar( item );
                if ( ! shareBar ) {
                    continue;
                }
                blockEl.appendChild( shareBar );
                infoEl.appendChild( blockEl );

            } else if ( blockId === 'rating' || blockId === 'download' ) {
                // Pro-only blocks - not available in Free, skip entirely.
                continue;

            } else if ( restBlocks.has( blockId ) ) {
                // REST-fetched block — render nothing until data arrives.
                // The empty container stays in the DOM (with data-fg-lb-block)
                // so _fillInfoBlocksFromData can find it by selector,
                // but it has no visible children so users don't see a
                // skeleton flash on fast fetches. If the block ends up
                // having no data, _fillInfoBlocksFromData removes it
                // (and _fillInfoBlocksNoData handles the no-id case).
                infoEl.appendChild( blockEl );
            }
        }

        if ( ! needsRest ) return;

        const itemId = item.id ? String( item.id ) : '';
        if ( ! itemId ) {
            this._fillInfoBlocksNoData( infoEl, blocks );
            return;
        }

        if ( this._itemDataCache.has( itemId ) ) {
            const cached = this._itemDataCache.get( itemId );
            if ( cached !== null ) {
                this._fillInfoBlocksFromData( infoEl, blocks, cached );
            }
            // If null: fetch is in progress - a previous _renderInfoBlocks call for
            // the same item is already waiting; we won't get the result here.
            // This can happen if the user navigates away and back before the fetch
            // resolves. We accept the skeleton stays and will be filled if the user
            // is still on this item when the fetch completes.
            return;
        }

        this._itemDataCache.set( itemId, null );

        const creditSource = s.creditSource === 'exif' ? 'exif' : 'item_meta';
        const galleryId   = s.galleryId || 0;
        const url = ( window.wpApiSettings?.root || '/wp-json/' )
            + `fotogrids/v1/lightbox/item/${ itemId }?credit_source=${ creditSource }`
            + ( galleryId ? `&gallery_id=${ galleryId }` : '' );

        fetch( url, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        } )
            .then( ( res ) => res.ok ? res.json() : Promise.reject( res.status ) )
            .then( ( data ) => {
                this._itemDataCache.set( itemId, data );
                // Only fill if the user is still looking at this item.
                if ( this.items[ this.index ]?.id === item.id ) {
                    this._fillInfoBlocksFromData( infoEl, blocks, data );
                }
            } )
            .catch( ( err ) => {
                this._itemDataCache.set( itemId, {} ); // Don't retry.
                if ( this.items[ this.index ]?.id === item.id ) {
                    this._fillInfoBlocksNoData( infoEl, blocks );
                }
            } );
    }

    /**
     * Fill REST-fetched info blocks once data is available.
     *
     * @param {HTMLElement} infoEl
     * @param {string[]}    blocks
     * @param {object}      data
     */
    _fillInfoBlocksFromData( infoEl, blocks, data ) {
        const s = this.settings;

        blocks.forEach( ( blockId ) => {
            // Description: merged into caption block when caption is also enabled,
            // otherwise rendered as its own block (via the restBlocks skeleton path).
            if ( blockId === 'description' ) {
                const captionBlockEl = infoEl.querySelector( '[data-fg-lb-block="caption"]' );
                const desc = ( data.description || '' ).trim();
                if ( captionBlockEl ) {
                    // Merged path — caption block already in DOM (has a
                    // caption); append the description <p> to it when
                    // there's a description, otherwise leave the block
                    // alone (caption-only is fine).
                    if ( desc !== '' ) {
                        let target = captionBlockEl.querySelector( '.fg-lb-info-description' );
                        if ( ! target ) {
                            target = document.createElement( 'p' );
                            target.className = 'fg-lb-info-description';
                            captionBlockEl.appendChild( target );
                        }
                        target.textContent = desc;
                    }
                } else {
                    // Standalone path — no caption block exists. We
                    // never pre-render an empty description placeholder
                    // any more (avoid skeleton flash), so if description
                    // arrives, create the block fresh and append.
                    if ( desc !== '' ) {
                        const blockEl = document.createElement( 'div' );
                        blockEl.className = 'fg-lb-info-block';
                        blockEl.dataset.fgLbBlock = 'description';
                        const descEl = document.createElement( 'p' );
                        descEl.className   = 'fg-lb-info-description';
                        descEl.textContent = desc;
                        blockEl.appendChild( descEl );
                        // Insert in the position dictated by block order:
                        // find the next block in `blocks` that's already
                        // in the DOM, insert before it.
                        const idx = blocks.indexOf( 'description' );
                        let insertedBefore = null;
                        for ( let k = idx + 1; k < blocks.length; k++ ) {
                            const nextEl = infoEl.querySelector( '[data-fg-lb-block="' + blocks[ k ] + '"]' );
                            if ( nextEl ) { insertedBefore = nextEl; break; }
                        }
                        if ( insertedBefore ) {
                            infoEl.insertBefore( blockEl, insertedBefore );
                        } else {
                            infoEl.appendChild( blockEl );
                        }
                    }
                }
                return;
            }

            const blockEl = infoEl.querySelector( `[data-fg-lb-block="${ blockId }"]` );
            if ( ! blockEl ) return;

            blockEl.classList.remove( 'fg-lb-info-block--loading' );

            if ( blockId === 'credit' ) {
                const credit = ( data.credit || '' ).trim();
                if ( credit === '' ) {
                    blockEl.remove();
                    return;
                }
                const creditEl = document.createElement( 'p' );
                creditEl.className   = 'fg-lb-info-credit';
                creditEl.textContent = credit;
                blockEl.innerHTML    = '';
                blockEl.appendChild( creditEl );
                return;
            }

            if ( blockId === 'file_info' ) {
                const fi = data.file_info;
                if ( ! fi ) { blockEl.remove(); return; }
                const rows = [];
                if ( fi.filename  ) rows.push( [ 'File',       fi.filename ] );
                if ( fi.filesize  ) rows.push( [ 'Size',       fi.filesize ] );
                if ( fi.width && fi.height ) rows.push( [ 'Dimensions', `${ fi.width } × ${ fi.height }` ] );
                if ( fi.mime_type ) rows.push( [ 'Type',       fi.mime_type ] );
                if ( rows.length === 0 ) { blockEl.remove(); return; }
                const dl = document.createElement( 'dl' );
                dl.className = 'fg-lb-info-dl';
                rows.forEach( ( [ label, value ] ) => {
                    const dt = document.createElement( 'dt' );
                    dt.textContent = label;
                    const dd = document.createElement( 'dd' );
                    dd.textContent = value;
                    dl.appendChild( dt );
                    dl.appendChild( dd );
                } );
                blockEl.innerHTML = '';
                blockEl.appendChild( dl );
                return;
            }

            if ( blockId === 'exif' ) {
                const exif   = data.exif;
                const fields = s.exifFields; // ordered list from PHP
                if ( ! exif || ! fields || fields.length === 0 ) { blockEl.remove(); return; }
                const labels = FotoGridsLightbox.EXIF_LABELS;
                const dl = document.createElement( 'dl' );
                dl.className = 'fg-lb-info-dl fg-lb-info-exif';
                let hasAny = false;
                fields.forEach( ( key ) => {
                    const val = exif[ key ];
                    if ( val === undefined || val === null || val === '' ) return;
                    hasAny = true;
                    const dt = document.createElement( 'dt' );
                    dt.textContent = labels[ key ] || key;
                    const dd = document.createElement( 'dd' );
                    dd.textContent = String( val );
                    dl.appendChild( dt );
                    dl.appendChild( dd );
                } );
                if ( ! hasAny ) { blockEl.remove(); return; }
                blockEl.innerHTML = '';
                blockEl.appendChild( dl );
                return;
            }

            if ( blockId === 'tags' ) {
                const tags = data.tags;
                if ( ! tags || tags.length === 0 ) { blockEl.remove(); return; }
                const listEl = document.createElement( 'div' );
                listEl.className = 'fg-lb-info-chips';
                tags.forEach( ( name ) => {
                    const chip = document.createElement( 'span' );
                    chip.className   = 'fg-lb-info-chip';
                    chip.textContent = name;
                    listEl.appendChild( chip );
                } );
                blockEl.innerHTML = '';
                blockEl.appendChild( FotoGridsLightbox._makeBlockHeader( 'Tags',    FotoGridsLightbox.BLOCK_ICONS.tags ) );
                blockEl.appendChild( listEl );
                return;
            }

            if ( blockId === 'people' ) {
                const people = data.people;
                if ( ! people || people.length === 0 ) { blockEl.remove(); return; }
                const listEl = document.createElement( 'div' );
                listEl.className = 'fg-lb-info-chips fg-lb-info-chips--people';
                people.forEach( ( name ) => {
                    const chip = document.createElement( 'span' );
                    chip.className   = 'fg-lb-info-chip';
                    chip.textContent = name;
                    listEl.appendChild( chip );
                } );
                blockEl.innerHTML = '';
                blockEl.appendChild( FotoGridsLightbox._makeBlockHeader( 'People', FotoGridsLightbox.BLOCK_ICONS.people ) );
                blockEl.appendChild( listEl );
                return;
            }

            if ( blockId === 'location' ) {
                const loc = data.location;
                if ( ! loc || ! loc.name ) { blockEl.remove(); return; }
                const locText = document.createElement( 'p' );
                locText.className   = 'fg-lb-info-location';
                locText.textContent = loc.name;
                blockEl.innerHTML = '';
                blockEl.appendChild( FotoGridsLightbox._makeBlockHeader( 'Location', FotoGridsLightbox.BLOCK_ICONS.location ) );
                blockEl.appendChild( locText );
                return;
            }
        } );
    }

    /**
     * Clear skeletons when no REST data is available (fetch failed or no item ID).
     *
     * @param {HTMLElement} infoEl
     * @param {string[]}    blocks
     */
    _fillInfoBlocksNoData( infoEl, blocks ) {
        const REST_BLOCKS = [ 'description', 'credit', 'file_info', 'exif', 'tags', 'people', 'location' ];
        blocks.forEach( ( blockId ) => {
            if ( ! REST_BLOCKS.includes( blockId ) ) return;

            // Description lives inside the caption block - remove the skeleton
            // placeholder; the caption block stays if it has caption text.
            if ( blockId === 'description' ) {
                const captionBlockEl = infoEl.querySelector( '[data-fg-lb-block="caption"]' );
                const descEl = captionBlockEl
                    ? captionBlockEl.querySelector( '.fg-lb-info-description' )
                    : null;
                if ( descEl ) {
                    descEl.remove();
                    // If caption block now has no content at all, remove it too.
                    const captionEl = captionBlockEl?.querySelector( '.fg-lb-info-caption' );
                    if ( ! captionEl || captionEl.textContent === '' ) {
                        captionBlockEl?.remove();
                    }
                }
                return;
            }

            const blockEl = infoEl.querySelector( `[data-fg-lb-block="${ blockId }"]` );
            if ( blockEl ) {
                blockEl.remove();
            }
        } );
    }


    /**
     * Start (or restart) the auto-advance timer from scratch.
     *
     * Always clears any running timer first. Restarts the progress indicator
     * animation from zero. Attaches pause listeners on the first call for this
     * gallery open; subsequent calls (after navigation) reuse the same listeners.
     *
     * Call this: on open(), after navigating to a new slide.
     */
    _startAuto() {
        this._clearAutoTimer();
        const s = this.settings;

        this._autoPaused        = false;
        this._autoStoppedByUser = false;
        this._autoStartedAt      = Date.now();
        this._autoPauseRemaining = 0;

        this._autoTimer = setTimeout( () => {
            if ( this.dialog && this.dialog.open ) {
                // Auto-advance: bypass progressStop (that only applies to manual nav).
                this._autoAdvance();
            }
        }, s.autoDelay * 1000 );

        this._restartProgressIndicator();
        this._syncPlayPauseBtn( false );

        // Attach pause listeners once per open(). _teardownAutoListeners() is
        // called at the start of open() so this always runs with a clean slate.
        if ( ! this._autoListenersAttached ) {
            this._attachAutoListeners( s );
            this._autoListenersAttached = true;
        }
    }

    /**
     * Advance one slide due to the auto-progress timer expiring.
     *
     * Different from manual navigate() - progressStop does not apply here;
     * auto-advance always restarts the timer on the next slide.
     */
    _autoAdvance() {
        const len = this.items.length;
        let next;
        if ( this.settings.loop ) {
            next = ( ( this.index + 1 ) % len + len ) % len;
        } else {
            next = Math.min( this.index + 1, len - 1 );
            if ( next === this.index ) {
                // At the end with no loop - stop.
                this._stopAuto();
                return;
            }
        }
        this._showItem( next, true );
        this._updateNavEnds();
        this._fire( 'navigate', { index: next, item: this.items[ next ], direction: 'next' } );
        // Always restart - this is automatic advancement, not user interaction.
        this._autoPaused = false;
        this._startAuto();
    }

    /**
     * Pause auto-advance (user-initiated: hover, caption hover, or click).
     *
     * Records how much time was remaining so _resumeAuto() can pick up exactly
     * where we left off. Freezes the progress indicator in place.
     */
    _pauseAuto() {
        if ( this._autoPaused ) return;
        this._autoPaused = true;

        if ( this._autoTimer !== null ) {
            this._autoPauseRemaining = ( this.settings.autoDelay * 1000 ) - ( Date.now() - this._autoStartedAt );
            this._clearAutoTimer();
        }

        this._pauseProgressIndicator();
        this._syncPlayPauseBtn( true );
    }

    /**
     * Resume from a paused state, continuing from exactly where we left off.
     *
     * Restarts the timer with the remaining duration and resumes the indicator
     * animation (does not restart it from zero - progress is preserved).
     */
    _resumeAuto() {
        // Hover-out and other automatic triggers are blocked when the user has
        // manually navigated with progressStop on. The play button calls
        // _playBtnResume() instead, which bypasses this guard.
        if ( this._autoStoppedByUser ) return;
        if ( ! this._autoPaused ) return;
        this._autoPaused = false;

        const remaining = this._autoPauseRemaining > 0
            ? this._autoPauseRemaining
            : this.settings.autoDelay * 1000;

        this._autoStartedAt = Date.now() - ( this.settings.autoDelay * 1000 - remaining );

        this._autoTimer = setTimeout( () => {
            if ( this.dialog && this.dialog.open ) {
                this._autoAdvance();
            }
        }, remaining );

        this._resumeProgressIndicator();
        this._syncPlayPauseBtn( false );
    }

    /**
     * Resume triggered explicitly by the play button.
     *
     * Unlike _resumeAuto(), this clears the _autoStoppedByUser flag so it works
     * even after the user stopped auto-advance via manual navigation. If the
     * timer was paused (hover), it resumes from where it left off. If it was
     * stopped entirely (progressStop), it restarts fresh from the current slide.
     */
    _playBtnResume() {
        this._autoStoppedByUser = false;

        if ( this._autoPaused ) {
            this._resumeAuto();
        } else {
            this._startAuto();
        }
    }

    /**
     * Internal: clear the timer only, no indicator side-effects.
     * Use before starting a fresh timer (navigation, open).
     */
    _clearAutoTimer() {
        if ( this._autoTimer !== null ) {
            clearTimeout( this._autoTimer );
            this._autoTimer = null;
        }
    }

    /**
     * Stop auto-advance entirely (e.g. on close, or when progressStop is set).
     * Clears the timer, resets the indicator to 0, and shows the play icon.
     */
    _stopAuto() {
        this._clearAutoTimer();
        this._resetProgressIndicator();
        this._syncPlayPauseBtn( true );  // show play icon - auto is stopped
        this._autoPaused = false;
    }

    /**
     * Attaches the correct pause/resume listeners based on progressPauseOn setting.
     *
     * Listeners are stored as instance properties so _teardownAutoListeners() can
     * remove them precisely (no anonymous handler leaks). They are created fresh
     * each open() - _teardownAutoListeners() nulls them first.
     *
     * Targets:
     *   image_hover     → .fg-lb-img    (the main image)
     *   thumbnail_hover → .fg-lb-thumbs (the thumbnail strip)
     *
     * @param {object} s Settings object
     */
    _attachAutoListeners( s ) {
        const pauseOn = s.progressPauseOn;

        if ( pauseOn.includes( 'image_hover' ) ) {
            const imgEl = this.dialog.querySelector( '.fg-lb-img' );
            if ( imgEl ) {
                this._onImgMouseEnter = () => this._pauseAuto();
                this._onImgMouseLeave = () => this._resumeAuto();
                imgEl.addEventListener( 'mouseenter', this._onImgMouseEnter );
                imgEl.addEventListener( 'mouseleave', this._onImgMouseLeave );
                this._pauseOnImgEl = imgEl;
            }
        }

        if ( pauseOn.includes( 'thumbnail_hover' ) ) {
            const thumbsEl = this.dialog.querySelector( '.fg-lb-thumbs' );
            if ( thumbsEl ) {
                this._onThumbsMouseEnter = () => this._pauseAuto();
                this._onThumbsMouseLeave = () => this._resumeAuto();
                thumbsEl.addEventListener( 'mouseenter', this._onThumbsMouseEnter );
                thumbsEl.addEventListener( 'mouseleave', this._onThumbsMouseLeave );
                this._pauseOnThumbsEl = thumbsEl;
            }
        }
    }

    _teardownAutoListeners() {
        if ( this._onImgMouseEnter && this._pauseOnImgEl ) {
            this._pauseOnImgEl.removeEventListener( 'mouseenter', this._onImgMouseEnter );
            this._pauseOnImgEl.removeEventListener( 'mouseleave', this._onImgMouseLeave );
            this._pauseOnImgEl    = null;
            this._onImgMouseEnter = null;
            this._onImgMouseLeave = null;
        }
        if ( this._onThumbsMouseEnter && this._pauseOnThumbsEl ) {
            this._pauseOnThumbsEl.removeEventListener( 'mouseenter', this._onThumbsMouseEnter );
            this._pauseOnThumbsEl.removeEventListener( 'mouseleave', this._onThumbsMouseLeave );
            this._pauseOnThumbsEl    = null;
            this._onThumbsMouseEnter = null;
            this._onThumbsMouseLeave = null;
        }
        if ( this._onAutoClick ) {
            this.dialog?.removeEventListener( 'click', this._onAutoClick );
            this._onAutoClick = null;
        }
        this._autoListenersAttached = false;
        this._autoPaused = false;
    }

    /* Animation duration is set once in buildVarsCSS() as --fg-lb-progress-duration
       and read by SCSS. No inline styles here - only class/attribute toggles.

       Class model on .fg-lightbox:
         (no class)                  → animation not started
         .fg-lb-progress--active     → animation running
         .fg-lb-progress--paused     → animation paused (both classes present)

       Restart sequence: remove --active (kills animation), force reflow,
       re-add --active. The reflow between removal and addition is what makes
       the browser treat it as a brand-new animation rather than a continuation. */

    _restartProgressIndicator() {
        const s = this.settings;
        if ( ! s.autoProgress || s.progressStyle === 'none' ) return;

        const el = this._progressAnimEl();
        if ( ! el ) return;

        // Remove both state classes - this strips animation-name entirely,
        // cutting the animation. The reflow confirms the cleared state on THIS
        // element before --running is added, so the browser starts fresh from 0.
        el.classList.remove( 'fg-lb-progress--running', 'fg-lb-progress--paused' );

        // offsetWidth returns 0 for SVG children, so use getBoundingClientRect()
        // which forces a full geometry recalculation on both HTML and SVG elements.
        // eslint-disable-next-line no-unused-expressions
        el.getBoundingClientRect();

        el.classList.add( 'fg-lb-progress--running' );
    }

    _pauseProgressIndicator() {
        const el = this._progressAnimEl();
        if ( ! el ) return;
        // Swap --running for --paused: animation-name stays, play-state becomes paused.
        el.classList.remove( 'fg-lb-progress--running' );
        el.classList.add( 'fg-lb-progress--paused' );
    }

    _resumeProgressIndicator() {
        const el = this._progressAnimEl();
        if ( ! el ) return;
        // Swap --paused for --running: same animation-name, play-state becomes running.
        el.classList.remove( 'fg-lb-progress--paused' );
        el.classList.add( 'fg-lb-progress--running' );
    }

    _resetProgressIndicator() {
        const el = this._progressAnimEl();
        if ( ! el ) return;
        // Strip all state classes - no animation-name → element snaps to its
        // CSS default (bar width: 0; ring stroke-dashoffset: 81.68 = empty).
        el.classList.remove( 'fg-lb-progress--running', 'fg-lb-progress--paused' );
    }

    /**
     * Returns the element that owns the animation-name for the current progress style.
     * Bar mode  → .fg-lb-progress-bar
     * Spinner   → .fg-lb-progress-ring-fill  (the SVG circle inside the spinner)
     *
     * @returns {Element|null}
     */
    _progressAnimEl() {
        if ( ! this.dialog || ! this.settings ) return null;
        if ( this.settings.progressStyle === 'bar' ) {
            return this.dialog.querySelector( '.fg-lb-progress-bar' );
        }
        if ( this.settings.progressStyle === 'spinner' ) {
            return this.dialog.querySelector( '.fg-lb-progress-ring-fill' );
        }
        return null;
    }


    _onKeydown( e ) {
        if ( ! this.dialog || ! this.dialog.open ) return;

        switch ( e.key ) {
            case 'Escape':
                // <dialog> handles Escape natively via showModal(); this fallback
                // covers polyfilled environments only.
                if ( typeof this.dialog.showModal !== 'function' ) this.close();
                break;
            case 'ArrowLeft':
                if ( this.settings.showArrows ) { e.preventDefault(); this.navigate( -1 ); }
                break;
            case 'ArrowRight':
                if ( this.settings.showArrows ) { e.preventDefault(); this.navigate( +1 ); }
                break;
            case 'Home':
                e.preventDefault();
                this.goTo( 0 );
                break;
            case 'End':
                e.preventDefault();
                this.goTo( this.items.length - 1 );
                break;
        }
    }


    _onPointerDown( e ) {
        if ( e.button !== 0 ) return;
        if ( e.target.closest( 'button, a' ) ) return;

        // When zoomed in, initiate a pan drag instead of a swipe.
        // Reset click-moved flag on every new pointer-down.
        this._zoomClickMoved = false;

        if ( this.settings?.zoom && this._zoomScale > FGLB_ZOOM_MIN ) {
            this._zoomDragging          = true;
            this._zoomDragStart         = { x: e.clientX, y: e.clientY };
            this._zoomOffsetAtDragStart = { x: this._zoomOffset.x, y: this._zoomOffset.y };
            // No setPointerCapture - same reason as swipe: capturing on the dialog
            // redirects synthesised click/dblclick to the dialog, breaking zoom exit.
            this._applyZoom( true );   // sets data-fg-lb-zoom-dragging → cursor:grabbing
            return;
        }

        this._swipe = { active: true, startX: e.clientX, startY: e.clientY, dx: 0 };
        // No setPointerCapture here - capturing on the dialog redirects synthesised
        // click events to the dialog element instead of the hit-tested child (e.g. the
        // image), breaking click/dblclick zoom. Swipe tracking doesn't need capture
        // because the lightbox is fullscreen and the pointer stays within it.
    }

    _onPointerMove( e ) {
        if ( this._zoomDragging ) {
            const dx = e.clientX - this._zoomDragStart.x;
            const dy = e.clientY - this._zoomDragStart.y;
            // Mark as moved if pointer travelled more than 5px - suppresses click handler.
            if ( ! this._zoomClickMoved && Math.hypot( dx, dy ) > 5 ) {
                this._zoomClickMoved = true;
            }
            this._zoomOffset.x = this._zoomOffsetAtDragStart.x + dx;
            this._zoomOffset.y = this._zoomOffsetAtDragStart.y + dy;
            this._clampZoomOffset();
            this._applyZoom();
            return;
        }

        if ( ! this._swipe.active ) return;
        const sdx = e.clientX - this._swipe.startX;
        const sdy = e.clientY - this._swipe.startY;
        if ( ! this._zoomClickMoved && Math.hypot( sdx, sdy ) > 5 ) {
            this._zoomClickMoved = true;
        }
        this._swipe.dx = sdx;
    }

    _onPointerUp( e ) {
        if ( this._zoomDragging ) {
            this._zoomDragging = false;
            this._applyZoom();   // clears data-fg-lb-zoom-dragging → cursor:grab
            return;
        }

        if ( ! this._swipe.active ) return;
        this._swipe.active = false;

        const dx = this._swipe.dx;
        const dy = Math.abs( e.clientY - this._swipe.startY );

        // Require horizontal dominance and a minimum threshold.
        if ( Math.abs( dx ) > 50 && Math.abs( dx ) > dy * 1.5 ) {
            this.navigate( dx < 0 ? +1 : -1 );
        }
    }


    _onWheel( e ) {
        if ( ! this.settings?.zoom ) return;

        e.preventDefault();

        // Normalise delta: some devices report deltaMode LINE (1) or PAGE (2).
        let delta = e.deltaY;
        if ( e.deltaMode === 1 ) delta *= 20;
        if ( e.deltaMode === 2 ) delta *= 400;

        // Convert to a scale multiplier: 100px scroll ≈ one FGLB_ZOOM_STEP.
        const factor = 1 - ( delta / 400 ) * FGLB_ZOOM_STEP * 4;
        const max    = this._effectiveZoomMax();
        const prev   = this._zoomScale;
        const next   = Math.max( FGLB_ZOOM_MIN, Math.min( max, prev * factor ) );

        if ( next === prev ) return;

        // Zoom toward the cursor position (relative to media-wrap centre).
        const wrap   = e.currentTarget;
        const rect   = wrap.getBoundingClientRect();
        const cx     = e.clientX - rect.left - rect.width  / 2;
        const cy     = e.clientY - rect.top  - rect.height / 2;

        // Adjust offset so the focal point stays under the cursor.
        const ratio = next / prev;
        this._zoomOffset.x = cx + ( this._zoomOffset.x - cx ) * ratio;
        this._zoomOffset.y = cy + ( this._zoomOffset.y - cy ) * ratio;

        this._zoomScale = next;
        if ( this._zoomScale === FGLB_ZOOM_MIN ) {
            this._zoomOffset = { x: 0, y: 0 };
        } else {
            this._clampZoomOffset();
        }
        this._applyZoom( true );
    }

    _onTouchStart( e ) {
        if ( ! this.settings?.zoom ) return;
        if ( e.touches.length !== 2 ) return;

        const t0 = e.touches[ 0 ];
        const t1 = e.touches[ 1 ];
        this._pinchStartDist  = Math.hypot( t1.clientX - t0.clientX, t1.clientY - t0.clientY );
        this._pinchStartScale = this._zoomScale;
    }

    _onTouchMove( e ) {
        if ( ! this.settings?.zoom ) return;
        if ( e.touches.length !== 2 ) return;

        e.preventDefault();

        const t0   = e.touches[ 0 ];
        const t1   = e.touches[ 1 ];
        const dist = Math.hypot( t1.clientX - t0.clientX, t1.clientY - t0.clientY );
        if ( this._pinchStartDist === 0 ) return;

        const max  = this._effectiveZoomMax();
        const next = Math.max( FGLB_ZOOM_MIN, Math.min( max, this._pinchStartScale * ( dist / this._pinchStartDist ) ) );

        // Zoom toward the midpoint between the two fingers.
        const wrap  = this.dialog.querySelector( '.fg-lb-media-wrap' );
        const rect  = wrap.getBoundingClientRect();
        const mx    = ( t0.clientX + t1.clientX ) / 2 - rect.left - rect.width  / 2;
        const my    = ( t0.clientY + t1.clientY ) / 2 - rect.top  - rect.height / 2;

        const ratio = next / this._zoomScale;
        this._zoomOffset.x = mx + ( this._zoomOffset.x - mx ) * ratio;
        this._zoomOffset.y = my + ( this._zoomOffset.y - my ) * ratio;

        this._zoomScale = next;
        if ( this._zoomScale === FGLB_ZOOM_MIN ) {
            this._zoomOffset = { x: 0, y: 0 };
        } else {
            this._clampZoomOffset();
        }
        this._applyZoom( true );
    }

    /**
     * Handles click and double-click on the image area for zoom toggle.
     *
     * Called for both events; `isDbl` distinguishes them.
     *
     * - double_click mode: only fires on dblclick.
     * - click mode:        only fires on click; suppressed if the pointer moved
     *                      more than 5px (pan drag), or if the click was the
     *                      second half of a dblclick (browser fires both).
     * - wheel_pinch mode:  never fires.
     *
     * Behaviour: if not zoomed → zoom to 2× centred on cursor; if zoomed → reset.
     *
     * @param {MouseEvent} e
     * @param {boolean}    isDbl  true when called from dblclick event
     */
    _onZoomClick( e, isDbl ) {
        const s = this.settings;
        if ( ! s?.zoom ) return;
        if ( e.target.closest( 'button, a' ) ) return;

        const trigger = s.zoomTrigger;

        if ( trigger === 'wheel_pinch' ) return;
        if ( trigger === 'double_click' && ! isDbl ) return;
        if ( trigger === 'click' && isDbl ) return;  // dblclick also fires click - ignore the click half

        // In click mode, suppress if the pointer moved (it was a pan drag, not a tap).
        if ( trigger === 'click' && this._zoomClickMoved ) return;

        if ( this._zoomScale > FGLB_ZOOM_MIN ) {
            // Already zoomed - reset.
            this._resetZoom();
            // Reset still counts as a user interaction for progressStop.
            if ( s.progressStop && s.autoProgress ) {
                this._autoStoppedByUser = true;
                this._stopAuto();
            }
        } else {
            // Zoom to 2× centred on the click position.
            const wrap  = e.currentTarget;
            const rect  = wrap.getBoundingClientRect();
            const cx    = e.clientX - rect.left - rect.width  / 2;
            const cy    = e.clientY - rect.top  - rect.height / 2;
            const next  = Math.min( this._effectiveZoomMax(), 2 );

            // Shift offset so the clicked point stays under the cursor.
            this._zoomOffset.x = cx - cx * next;
            this._zoomOffset.y = cy - cy * next;
            this._zoomScale    = next;
            this._clampZoomOffset();
            this._applyZoom( true );
        }
    }


    _trackView( item ) {
        const cfg = window.fotogrids || {};
        if ( ! cfg.stats_tracking || ! item || ! item.id ) return;

        fetch( `${cfg.restUrl}stats/view`, {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce':   cfg.nonce,
            },
            body: JSON.stringify( {
                object_type: 'item',
                object_id:   parseInt( item.id, 10 ),
            } ),
        } ).catch( ( err ) => {
            console.warn( 'FotoGrids: Error tracking item view:', err );
        } );
    }


    _fire( name, detail ) {
        if ( ! this.galleryEl ) return;
        this.galleryEl.dispatchEvent(
            new CustomEvent( `fotogrids:lightbox:${name}`, {
                bubbles:    true,
                cancelable: false,
                detail:     { galleryEl: this.galleryEl, ...detail },
            } )
        );
    }
}

class FotoGridsLightboxInit {

    constructor() {
        /** @type {FotoGridsLightbox} */
        this._lightbox = new FotoGridsLightbox();

        /** @type {WeakSet<HTMLElement>} */
        this._wired = new WeakSet();

        this._init();
    }

    _init() {
        document.querySelectorAll( '.fotogrids-collection.fotogrids-gallery[data-fg-click="lightbox"]' )
            .forEach( ( el ) => this._activateGallery( el ) );

        if ( 'MutationObserver' in window ) {
            this._observer = new MutationObserver( ( mutations ) => {
                for ( const mutation of mutations ) {
                    for ( const node of mutation.addedNodes ) {
                        if ( ! ( node instanceof Element ) ) continue;

                        const candidates = [];
                        if ( node.matches( '.fotogrids-collection.fotogrids-gallery[data-fg-click="lightbox"]' ) ) {
                            candidates.push( node );
                        }
                        node.querySelectorAll( '.fotogrids-collection.fotogrids-gallery[data-fg-click="lightbox"]' )
                            .forEach( ( el ) => candidates.push( el ) );

                        candidates.forEach( ( el ) => this._activateGallery( el ) );
                    }
                }
            } );
            this._observer.observe( document.body, { childList: true, subtree: true } );
        }

        document.addEventListener( 'fotogrids:gallery_inserted', ( e ) => {
            const el = e.detail?.galleryElement;
            if ( el && el.dataset.fgClick === 'lightbox' ) {
                this._activateGallery( el );
            }
        } );
    }

    /**
     * Registers a single delegated click handler on a gallery element.
     *
     * @param {HTMLElement} galleryEl
     */
    _activateGallery( galleryEl ) {
        if ( this._wired.has( galleryEl ) ) return;
        this._wired.add( galleryEl );

        const lb = this._lightbox;

        galleryEl.addEventListener( 'click', ( e ) => {
            // The trigger <a> only wraps the media, but the whole .fg-item
            // (including the caption) should open the lightbox.
            const figure = e.target.closest( '.fg-item' );
            if ( ! figure ) return;

            const trigger = figure.querySelector( '[data-fg-lightbox-trigger]' );
            if ( ! trigger ) return;

            e.preventDefault();

            const items = collectItems( galleryEl );
            const index = items.findIndex( ( item ) => item.triggerEl === trigger );
            lb.open( galleryEl, index >= 0 ? index : 0 );
        } );

        galleryEl.addEventListener( 'keydown', ( e ) => {
            if ( e.key !== 'Enter' && e.key !== ' ' ) return;
            const figure = e.target.closest( '.fg-item' );
            if ( ! figure ) return;

            const trigger = figure.querySelector( '[data-fg-lightbox-trigger]' );
            if ( ! trigger ) return;

            e.preventDefault();
            const items = collectItems( galleryEl );
            const index = items.findIndex( ( item ) => item.triggerEl === trigger );
            lb.open( galleryEl, index >= 0 ? index : 0 );
        } );

        galleryEl.querySelectorAll( '.fg-item' ).forEach( ( figure ) => {
            if ( ! figure.hasAttribute( 'tabindex' ) ) {
                figure.setAttribute( 'tabindex', '0' );
            }
        } );
    }
}

let _manager;

function initFotoGridsLightbox() {
    if ( _manager ) return;
    _manager = new FotoGridsLightboxInit();
    // Expose the manager's shared lightbox so deep-linking and other
    // integrations reuse the same instance instead of constructing a new one.
    FotoGridsLightbox.instance = _manager._lightbox;
}

if ( document.readyState === 'loading' ) {
    document.addEventListener( 'DOMContentLoaded', initFotoGridsLightbox );
} else {
    initFotoGridsLightbox();
}

window.FotoGridsLightbox     = FotoGridsLightbox;
window.FotoGridsLightboxInit = FotoGridsLightboxInit;
