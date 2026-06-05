<?php
/**
 * Lightbox JS CustomEvent name constants.
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Lightbox JS events.
 */
final class JsEvents_Lightbox {

    /**
     * Fired on `document` when the lightbox opens.
     *
     * @since 1.0.0
     * @event-detail { galleryEl: HTMLElement, index: number, item: object }
     */
    public const OPEN = 'fotogrids:lightbox:open';

    /**
     * Fired on `document` when the lightbox closes.
     *
     * @since 1.0.0
     * @event-detail { galleryEl: HTMLElement }
     */
    public const CLOSE = 'fotogrids:lightbox:close';

    /**
     * Fired on `document` when the lightbox navigates to a different slide.
     *
     * @since 1.0.0
     * @event-detail { galleryEl: HTMLElement, index: number, item: object,
     *                 direction: 'next'|'prev' }
     */
    public const NAVIGATE = 'fotogrids:lightbox:navigate';
}
