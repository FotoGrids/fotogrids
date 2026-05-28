<?php
/**
 * SEO settings store — plugin-wide defaults plus per-collection overrides.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */

namespace FotoGrids\Settings;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Reads and writes the site-wide SEO configuration and resolves the
 * effective per-collection settings.
 *
 * Mirrors `Sharing_Settings_Store`: one global option holds the plugin-wide
 * defaults; collection settings layer overrides on top via the `resolve()`
 * helper. Consumers (the view-page renderer, the future embedded-gallery
 * scanner, the conflict guard) read through `resolve($collection_id)` and
 * never touch the option directly.
 *
 * Inherit-by-default model: when a per-collection override field is empty
 * or its source is set to "inherit", the global default wins. Site owners
 * configure once; per-collection tuning is for the exceptions.
 *
 * @since 1.0.0
 */
final class SEO_Settings_Store {

    const OPTION = 'fotogrids_seo_settings';

    /**
     * Allowed values for the `og_image_source` per-collection setting.
     *
     * - 'featured' — use the Featured Item (gallery) / Featured Gallery
     *   (album) cover, as resolved by
     *   `fotogrids_get_collection_cover_attachment_id()`.
     * - 'custom'   — use the per-collection custom image (`og_image_custom`).
     *
     * @var string[]
     */
    const IMAGE_SOURCES = array( 'featured', 'custom' );

    /**
     * Allowed values for the plugin-wide `og_type_default`.
     *
     * Most FotoGrids view pages are published content with a timestamp and
     * author, so `article` is the sensible default. `website` is offered for
     * sites that treat galleries as evergreen marketing pages.
     *
     * @var string[]
     */
    const OG_TYPES = array( 'article', 'website' );

    /**
     * Default plugin-wide SEO settings.
     *
     * @since 1.0.0
     * @return array<string, mixed>
     */
    public static function defaults(): array {
        $defaults = array(
            'enable_open_graph'    => true,
            'enable_twitter_card'  => true,
            'og_type_default'      => 'article',
            'defer_to_seo_plugins' => false,
            'default_og_image_id'  => 0,
            'facebook_app_id'      => '',
            'twitter_handle'       => '',
        );

        /**
         * Filter the default plugin-wide SEO settings.
         *
         * @since 1.0.0
         * @param array<string, mixed> $defaults
         */
        return apply_filters( 'fotogrids/seo/defaults', $defaults );
    }

    /**
     * Stored SEO settings merged over the defaults.
     *
     * @since 1.0.0
     * @return array<string, mixed>
     */
    public static function get(): array {
        $defaults = self::defaults();
        $stored   = get_option( self::OPTION, array() );

        if ( ! is_array( $stored ) ) {
            $stored = array();
        }

        $settings = wp_parse_args( $stored, $defaults );

        /**
         * Filter the resolved global SEO settings.
         *
         * @since 1.0.0
         * @param array<string, mixed> $settings
         */
        return apply_filters( 'fotogrids/seo/settings', $settings );
    }

    /**
     * Sanitise a raw SEO settings map (from REST or admin POST).
     *
     * @since 1.0.0
     * @param mixed $value
     * @return array<string, mixed>
     */
    public static function sanitize( $value ): array {
        $defaults = self::defaults();
        $input    = is_array( $value ) ? $value : array();

        $og_type = sanitize_key( (string) ( $input['og_type_default'] ?? $defaults['og_type_default'] ) );
        if ( ! in_array( $og_type, self::OG_TYPES, true ) ) {
            $og_type = $defaults['og_type_default'];
        }

        $default_image_id = isset( $input['default_og_image_id'] ) ? absint( $input['default_og_image_id'] ) : 0;
        if ( $default_image_id > 0 ) {
            $attachment = get_post( $default_image_id );
            if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
                $default_image_id = 0;
            }
        }

        $sanitized = array(
            'enable_open_graph'    => self::truthy( $input['enable_open_graph']    ?? $defaults['enable_open_graph'] ),
            'enable_twitter_card'  => self::truthy( $input['enable_twitter_card']  ?? $defaults['enable_twitter_card'] ),
            'og_type_default'      => $og_type,
            'defer_to_seo_plugins' => self::truthy( $input['defer_to_seo_plugins'] ?? $defaults['defer_to_seo_plugins'] ),
            'default_og_image_id'  => $default_image_id,
            'facebook_app_id'      => sanitize_text_field( (string) ( $input['facebook_app_id'] ?? $defaults['facebook_app_id'] ) ),
            'twitter_handle'       => self::normalise_handle( (string) ( $input['twitter_handle'] ?? $defaults['twitter_handle'] ) ),
        );

        /**
         * Filter the sanitised plugin-wide SEO settings. Pro adds
         * sanitisation for its own keys here.
         *
         * @since 1.0.0
         * @param array<string, mixed> $sanitized
         * @param array<string, mixed> $input
         */
        return apply_filters( 'fotogrids/seo/sanitize', $sanitized, $input );
    }

    /**
     * Sanitise and persist plugin-wide SEO settings.
     *
     * @since 1.0.0
     * @param mixed $value Raw input.
     * @return array<string, mixed> The stored, merged settings.
     */
    public static function save( $value ): array {
        update_option( self::OPTION, self::sanitize( $value ) );
        return self::get();
    }

    /**
     * Resolve the effective SEO configuration for one collection.
     *
     * Returns the merged view that the renderer consumes. Shape:
     *
     *   array{
     *     enable_open_graph:   bool,   // false = emit nothing
     *     enable_twitter_card: bool,
     *     og_type:             string, // 'article' | 'website'
     *     defer_to_seo_plugins: bool,  // also suppresses conflict guard
     *     facebook_app_id:     string,
     *     twitter_handle:      string,
     *     og_title_override:       string, // '' = inherit
     *     og_description_override: string, // '' = inherit
     *     og_image_source:     string, // 'featured' | 'custom'
     *     og_image_custom_id:  int,    // 0 = none
     *     og_image_fallback_id: int,   // plugin-wide default
     *     noindex:             bool,
     *     canonical_override:  string, // '' = use permalink
     *   }
     *
     * @since 1.0.0
     * @param int $collection_id Gallery or album post ID.
     * @return array<string, mixed>
     */
    public static function resolve( int $collection_id ): array {
        $global = self::get();

        $resolved = array(
            'enable_open_graph'       => (bool) $global['enable_open_graph'],
            'enable_twitter_card'     => (bool) $global['enable_twitter_card'],
            'og_type'                 => (string) $global['og_type_default'],
            'defer_to_seo_plugins'    => (bool) $global['defer_to_seo_plugins'],
            'facebook_app_id'         => (string) $global['facebook_app_id'],
            'twitter_handle'          => (string) $global['twitter_handle'],
            'og_title_override'       => '',
            'og_description_override' => '',
            'og_image_source'         => 'featured',
            'og_image_custom_id'      => 0,
            'og_image_fallback_id'    => (int) $global['default_og_image_id'],
            'noindex'                 => false,
            'canonical_override'      => '',
        );

        if ( $collection_id > 0 ) {
            $resolved['og_title_override']       = sanitize_text_field( (string) get_post_meta( $collection_id, 'fotogrids_og_title', true ) );
            $resolved['og_description_override'] = wp_strip_all_tags( (string) get_post_meta( $collection_id, 'fotogrids_og_description', true ) );

            $source = sanitize_key( (string) get_post_meta( $collection_id, 'fotogrids_og_image_source', true ) );
            if ( in_array( $source, self::IMAGE_SOURCES, true ) ) {
                $resolved['og_image_source'] = $source;
            }
            $resolved['og_image_custom_id'] = absint( get_post_meta( $collection_id, 'fotogrids_og_image_custom_id', true ) );

            $noindex_raw = get_post_meta( $collection_id, 'fotogrids_noindex', true );
            if ( $noindex_raw !== '' && $noindex_raw !== null ) {
                $resolved['noindex'] = self::truthy( $noindex_raw );
            }

            $resolved['canonical_override'] = esc_url_raw( (string) get_post_meta( $collection_id, 'fotogrids_canonical_override', true ) );
        }

        /**
         * Filter the resolved SEO configuration for a collection.
         *
         * @since 1.0.0
         * @param array<string, mixed> $resolved
         * @param int                  $collection_id
         */
        return apply_filters( 'fotogrids/seo/resolved', $resolved, $collection_id );
    }

    /**
     * Normalise a Twitter / X handle into the leading-@ form.
     *
     * @since 1.0.0
     * @param string $raw
     * @return string
     */
    private static function normalise_handle( string $raw ): string {
        $raw = trim( $raw );
        if ( $raw === '' ) {
            return '';
        }
        $raw = ltrim( $raw, '@' );
        $raw = preg_replace( '/[^A-Za-z0-9_]/', '', $raw );
        if ( $raw === '' ) {
            return '';
        }
        return '@' . $raw;
    }

    /**
     * Coerce any truthy form posted by the UI into a strict bool.
     *
     * @since 1.0.0
     * @param mixed $value
     * @return bool
     */
    public static function truthy( $value ): bool {
        return $value === true
            || $value === 1
            || $value === '1'
            || $value === 'true'
            || $value === 'on';
    }
}
