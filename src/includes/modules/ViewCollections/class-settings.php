<?php
/**
 * Per-collection view page settings.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections;

use FotoGrids\Hooks\Filters_View;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Resolves the view page settings for a single gallery or album.
 *
 * Phase 1 returns the filtered defaults for every collection - there is no
 * per-collection persistence yet. The read API (get_defaults / get) is the
 * stable surface Pro extends when it adds stored settings.
 *
 * @since 1.0.0
 */
class Settings {

    /**
     * Default view page settings shared by every collection.
     *
     * @since 1.0.0
     * @return array<string,mixed>
     */
    public static function get_defaults(): array {
        $appearance = \FotoGrids\Settings\View_Settings_Store::get();

        $defaults = array_merge(
            array(
                'index'   => true,
                'noindex' => false,
            ),
            $appearance
        );

        /**
         * Filter the default view page settings.
         *
         * @since 1.0.0
         * @param array<string,mixed> $defaults
         */
        return apply_filters( Filters_View::SETTINGS_DEFAULTS, $defaults );
    }

    /**
     * Resolved view page settings for one collection.
     *
     * @since 1.0.0
     * @param int $post_id Gallery or album ID.
     * @return array<string,mixed>
     */
    public static function get( int $post_id ): array {
        $settings = self::get_defaults();

        /**
         * Filter the resolved view page settings for a single collection.
         *
         * Pro overlays stored per-collection values here.
         *
         * @since 1.0.0
         * @param array<string,mixed> $settings
         * @param int                 $post_id
         */
        return apply_filters( Filters_View::SETTINGS, $settings, $post_id );
    }
}
