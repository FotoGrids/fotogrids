<?php
/**
 * Settings defaults / sanitisation filter hooks.
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
 * Settings filter hooks.
 */
final class Filters_Settings {

    /**
     * Default base settings shared by galleries and albums.
     *
     * @since 1.0.0
     * @param array $defaults          The default settings array.
     * @param bool  $is_defaults_page  Whether being read for the defaults page.
     */
    public const DEFAULTS_BASE = 'fotogrids/settings/defaults/base';

    /**
     * Default gallery settings (extends base).
     *
     * @since 1.0.0
     * @param array $defaults          Gallery default settings.
     * @param bool  $is_defaults_page  Whether being read for the defaults page.
     */
    public const DEFAULTS_GALLERY = 'fotogrids/settings/defaults/gallery';

    /**
     * Default album settings (extends base).
     *
     * @since 1.0.0
     * @param array $defaults          Album default settings.
     * @param bool  $is_defaults_page  Whether being read for the defaults page.
     */
    public const DEFAULTS_ALBUM = 'fotogrids/settings/defaults/album';

    /**
     * Per-key sanitisation override for collection settings.
     *
     * @since 1.0.0
     * @param array $sanitized The sanitised settings array.
     * @param array $settings  The raw settings array.
     */
    public const SANITIZE = 'fotogrids/settings/sanitize';

    /**
     * Number of days to retain statistics rows.
     *
     * @since 1.0.0
     * @param int $days_to_keep Retention window in days. Default 365.
     */
    public const STATS_RETENTION_DAYS = 'fotogrids/settings/stats/retention_days';
}
