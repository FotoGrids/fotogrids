<?php
/**
 * Security / permission filter hooks.
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
 * Security filter hooks.
 */
final class Filters_Security {

    /**
     * Whether the current user can view a gallery's saved password.
     *
     * @since 1.0.0
     * @param bool $default_allowed Default decision.
     * @param int  $gallery_id      Gallery ID.
     */
    public const CAN_VIEW_GALLERY_PASSWORD = 'fotogrids/security/can_view_gallery_password';
}
