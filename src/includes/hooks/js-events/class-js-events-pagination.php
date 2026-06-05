<?php
/**
 * Pagination / filter JS CustomEvent name constants.
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
 * Pagination + filter JS events.
 */
final class JsEvents_Pagination {

    /**
     * Fired on the gallery element when new items have been inserted
     * (pagination).
     *
     * @since 1.0.0
     * @event-detail { newItems: HTMLElement[] }
     */
    public const ITEMS_INSERTED = 'fotogrids:items_inserted';

    /**
     * Fired on the gallery element when the active filter set has changed.
     *
     * @since 1.0.0
     */
    public const FILTERS_CHANGED = 'fotogrids:filters_changed';

    /**
     * Fired on the gallery element when the current pagination page changes.
     *
     * @since 1.0.0
     * @event-detail { page: number }
     */
    public const PAGE_CHANGED = 'fotogrids:page_changed';
}
