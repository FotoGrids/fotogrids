<?php
namespace FotoGrids\REST\Lightbox;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Lightbox REST Permissions
 *
 * All lightbox endpoints are publicly readable — the frontend renders
 * galleries without authentication and must be able to fetch item data.
 *
 * @since 1.0.0
 */
class Lightbox_Permissions {

    /**
     * Public read — no authentication required.
     *
     * @return true
     */
    public static function check_lightbox_read(): bool {
        return true;
    }
}
