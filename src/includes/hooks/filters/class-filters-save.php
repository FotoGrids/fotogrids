<?php
/**
 * REST item-save pipeline filter hooks.
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
 * Save filter hooks.
 */
final class Filters_Save {

    /**
     * Meta-save results pipeline for the REST item save endpoint.
     *
     * @since 1.0.0
     * @param array            $meta_results Result map.
     * @param int              $item_id      Item ID being saved.
     * @param \WP_REST_Request $request      The REST request.
     */
    public const ITEM_METADATA = 'fotogrids/save/item/metadata';
}
