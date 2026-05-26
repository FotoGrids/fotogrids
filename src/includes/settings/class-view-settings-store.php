<?php
/**
 * Global view page appearance settings store.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */

namespace FotoGrids\Settings;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Reads and writes the site-wide view page appearance configuration.
 *
 * One configuration styles every gallery and album view page. Stored as a
 * single option, following the Plugin_Settings_Store pattern.
 *
 * @since 1.0.0
 */
final class View_Settings_Store {

    const OPTION = 'fotogrids_view_settings';

    /**
     * Default values for every view page appearance setting.
     *
     * @since 1.0.0
     * @return array<string, mixed>
     */
    public static function defaults(): array {
        $defaults = array(
            'accent_color' => '#3c46f0',
            'theme'        => 'light',
            'max_width'    => 1200,
            'show_header'  => true,
        );

        /**
         * Filter the default view page appearance settings.
         *
         * @since 1.0.0
         * @param array<string,mixed> $defaults
         */
        return apply_filters( 'fotogrids/view/appearance/defaults', $defaults );
    }

    /**
     * Stored view page settings merged over the defaults.
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
         * Filter the resolved global view page appearance settings.
         *
         * @since 1.0.0
         * @param array<string,mixed> $settings
         */
        return apply_filters( 'fotogrids/view/appearance', $settings );
    }

    /**
     * Sanitise a raw view page settings map.
     *
     * @since 1.0.0
     * @param mixed $value Raw input (REST params or POST).
     * @return array<string, mixed>
     */
    public static function sanitize( $value ): array {
        $defaults = self::defaults();
        $input    = is_array( $value ) ? $value : array();

        $theme = sanitize_key( $input['theme'] ?? $defaults['theme'] );
        if ( ! in_array( $theme, array( 'light', 'dark' ), true ) ) {
            $theme = $defaults['theme'];
        }

        $max_width = isset( $input['max_width'] ) ? absint( $input['max_width'] ) : $defaults['max_width'];
        if ( $max_width < 320 ) {
            $max_width = 320;
        } elseif ( $max_width > 3000 ) {
            $max_width = 3000;
        }

        $accent = sanitize_text_field( $input['accent_color'] ?? $defaults['accent_color'] );
        if ( ! preg_match( '/^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6,8})|rgba?\([0-9.,\s]+\))$/', $accent ) ) {
            $accent = $defaults['accent_color'];
        }

        $sanitized = array(
            'accent_color' => $accent,
            'theme'        => $theme,
            'max_width'    => $max_width,
            'show_header'  => self::truthy( $input['show_header'] ?? $defaults['show_header'] ),
        );

        /**
         * Filter the sanitised view page appearance settings. Pro adds
         * sanitisation for its own keys here.
         *
         * @since 1.0.0
         * @param array<string,mixed> $sanitized
         * @param array<string,mixed> $input
         */
        return apply_filters( 'fotogrids/view/appearance/sanitize', $sanitized, $input );
    }

    /**
     * Sanitise and persist view page settings.
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
