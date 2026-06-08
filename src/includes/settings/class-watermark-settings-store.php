<?php
/**
 * Global watermark settings store.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */

namespace FotoGrids\Settings;

use FotoGrids\Hooks\Filters_Watermark;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Reads and writes the site-wide watermark configuration.
 *
 * Watermarking is global: one configuration is burned into the FotoGrids
 * image sub-sizes at generation time. Per-collection overrides layer on top
 * of this baseline elsewhere. Stored as a single option, following the
 * Plugin_Settings_Store pattern.
 *
 * @since 1.0.0
 */
final class Watermark_Settings_Store {

    const OPTION = 'fotogrids_watermark_settings';

    /**
     * Recognised watermark types.
     *
     * @var string[]
     */
    const TYPES = array( 'text', 'image' );

    /**
     * Recognised placement positions.
     *
     * @var string[]
     */
    const POSITIONS = array(
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'center',
        'center-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
    );

    /**
     * Recognised text-colour presets.
     *
     * @var string[]
     */
    const TEXT_COLORS = array( 'light', 'dark', 'custom' );

    /**
     * Recognised font-size presets. Sizes are proportional to the image at
     * render time, not absolute pixels.
     *
     * @var string[]
     */
    const FONT_SIZES = array( 'small', 'regular', 'large' );

    /**
     * Bundled font registry: font key => [ file, family ].
     *
     * `file` is the TTF filename under assets/fonts/; `family` is the CSS
     * font-family name used for the @font-face rule and the admin preview.
     * All faces are SIL OFL or Apache-2.0 licensed and redistributable under
     * the plugin's GPL licence. An unknown key falls back to the default font.
     *
     * @var array<string, array{file: string, family: string}>
     */
    const FONTS = array(
        'inter'            => array( 'file' => 'Inter-SemiBold.ttf',          'family' => 'FG Inter' ),
        'roboto'           => array( 'file' => 'Roboto-SemiBold.ttf',         'family' => 'FG Roboto' ),
        'open-sans'        => array( 'file' => 'OpenSans-SemiBold.ttf',       'family' => 'FG Open Sans' ),
        'montserrat'       => array( 'file' => 'Montserrat-SemiBold.ttf',     'family' => 'FG Montserrat' ),
        'oswald'           => array( 'file' => 'Oswald-SemiBold.ttf',         'family' => 'FG Oswald' ),
        'lora'             => array( 'file' => 'Lora-SemiBold.ttf',           'family' => 'FG Lora' ),
        'playfair-display' => array( 'file' => 'PlayfairDisplay-SemiBold.ttf','family' => 'FG Playfair Display' ),
        'merriweather'     => array( 'file' => 'Merriweather-SemiBold.ttf',   'family' => 'FG Merriweather' ),
        'jetbrains-mono'   => array( 'file' => 'JetBrainsMono-SemiBold.ttf',  'family' => 'FG JetBrains Mono' ),
        'dancing-script'   => array( 'file' => 'DancingScript-SemiBold.ttf',  'family' => 'FG Dancing Script' ),
    );

    /**
     * Recognised apply-to targets.
     *
     * @var string[]
     */
    const APPLY_TO = array( 'full', 'thumbnails', 'both' );

    /**
     * Default values for every watermark setting.
     *
     * @since 1.0.0
     * @return array<string, mixed>
     */
    public static function defaults(): array {
        $defaults = array(
            'enable_watermark'      => false,
            'watermark_type'        => 'text',

            // Image watermark (pro_starter).
            'watermark_image_url'   => '',
            'watermark_image_size'  => 20,

            // Text watermark (free).
            'watermark_text'        => '© Your Name',
            'watermark_font_family' => 'inter',
            'watermark_font_size'   => 'regular',
            'watermark_text_color'  => 'light',

            // Custom colour (pro_starter).
            'watermark_custom_text_color' => '#ffffff',

            // Position & styling.
            'watermark_position'    => 'bottom-right',
            'watermark_opacity'     => 70,
            'watermark_margin'      => 20,

            // Advanced.
            'watermark_apply_to'    => 'full',
            'watermark_repeat'      => false,
            'watermark_repeat_spacing' => 200,
        );

        /**
         * Filter the default watermark settings.
         *
         * @since 1.0.0
         * @param array<string,mixed> $defaults
         */
        return apply_filters( Filters_Watermark::DEFAULTS, $defaults );
    }

    /**
     * Stored watermark settings merged over the defaults.
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
         * Filter the resolved global watermark settings.
         *
         * @since 1.0.0
         * @param array<string,mixed> $settings
         */
        return apply_filters( Filters_Watermark::SETTINGS, $settings );
    }

    /**
     * Sanitise a raw watermark settings map.
     *
     * @since 1.0.0
     * @param mixed $value Raw input (REST params or POST).
     * @return array<string, mixed>
     */
    public static function sanitize( $value ): array {
        $defaults = self::defaults();
        $input    = is_array( $value ) ? $value : array();

        $type = sanitize_key( $input['watermark_type'] ?? $defaults['watermark_type'] );
        if ( ! in_array( $type, self::TYPES, true ) ) {
            $type = $defaults['watermark_type'];
        }

        $position = sanitize_key( $input['watermark_position'] ?? $defaults['watermark_position'] );
        $position = str_replace( '_', '-', $position );
        if ( ! in_array( $position, self::POSITIONS, true ) ) {
            $position = $defaults['watermark_position'];
        }

        $text_color = sanitize_key( $input['watermark_text_color'] ?? $defaults['watermark_text_color'] );
        if ( ! in_array( $text_color, self::TEXT_COLORS, true ) ) {
            $text_color = $defaults['watermark_text_color'];
        }

        $apply_to = sanitize_key( $input['watermark_apply_to'] ?? $defaults['watermark_apply_to'] );
        if ( ! in_array( $apply_to, self::APPLY_TO, true ) ) {
            $apply_to = $defaults['watermark_apply_to'];
        }

        $font_family = sanitize_key( $input['watermark_font_family'] ?? $defaults['watermark_font_family'] );
        if ( ! array_key_exists( $font_family, self::FONTS ) ) {
            $font_family = $defaults['watermark_font_family'];
        }

        $font_size = sanitize_key( $input['watermark_font_size'] ?? $defaults['watermark_font_size'] );
        if ( ! in_array( $font_size, self::FONT_SIZES, true ) ) {
            $font_size = $defaults['watermark_font_size'];
        }

        $sanitized = array(
            'enable_watermark'      => self::truthy( $input['enable_watermark'] ?? $defaults['enable_watermark'] ),
            'watermark_type'        => $type,
            'watermark_image_url'   => esc_url_raw( (string) ( $input['watermark_image_url'] ?? $defaults['watermark_image_url'] ) ),
            'watermark_image_size'  => self::clamp_int( $input['watermark_image_size'] ?? $defaults['watermark_image_size'], 5, 50, $defaults['watermark_image_size'] ),
            'watermark_text'        => sanitize_text_field( (string) ( $input['watermark_text'] ?? $defaults['watermark_text'] ) ),
            'watermark_font_family' => $font_family,
            'watermark_font_size'   => $font_size,
            'watermark_text_color'  => $text_color,
            'watermark_custom_text_color' => self::sanitize_hex( $input['watermark_custom_text_color'] ?? $defaults['watermark_custom_text_color'], $defaults['watermark_custom_text_color'] ),
            'watermark_position'    => $position,
            'watermark_opacity'     => self::clamp_int( $input['watermark_opacity'] ?? $defaults['watermark_opacity'], 10, 100, $defaults['watermark_opacity'] ),
            'watermark_margin'      => self::clamp_int( $input['watermark_margin'] ?? $defaults['watermark_margin'], 0, 100, $defaults['watermark_margin'] ),
            'watermark_apply_to'    => $apply_to,
            'watermark_repeat'      => self::truthy( $input['watermark_repeat'] ?? $defaults['watermark_repeat'] ),
            'watermark_repeat_spacing' => self::clamp_int( $input['watermark_repeat_spacing'] ?? $defaults['watermark_repeat_spacing'], 50, 500, $defaults['watermark_repeat_spacing'] ),
        );

        /**
         * Filter the sanitised watermark settings. Pro adds sanitisation for
         * its own keys here.
         *
         * @since 1.0.0
         * @param array<string,mixed> $sanitized
         * @param array<string,mixed> $input
         */
        return apply_filters( Filters_Watermark::SANITIZE, $sanitized, $input );
    }

    /**
     * Option holding the current global drawing-config hash, refreshed on each
     * save so callers can detect variant drift without recomputing it.
     *
     * @var string
     */
    const OPTION_CONFIG_HASH = 'fotogrids_watermark_config_hash';

    /**
     * Sanitise and persist watermark settings.
     *
     * Also refreshes the global config-hash option so stale-variant detection
     * stays cheap.
     *
     * @since 1.0.0
     * @param mixed $value Raw input.
     * @return array<string, mixed> The stored, merged settings.
     */
    public static function save( $value ): array {
        $sanitized = self::sanitize( $value );
        update_option( self::OPTION, $sanitized );
        update_option( self::OPTION_CONFIG_HASH, self::config_hash( $sanitized ) );
        return self::get();
    }

    /**
     * The current global drawing-config hash, recomputing and caching it if the
     * option has not been written yet.
     *
     * @since 1.0.0
     * @return string
     */
    public static function current_config_hash(): string {
        $stored = get_option( self::OPTION_CONFIG_HASH, '' );

        if ( is_string( $stored ) && $stored !== '' ) {
            return $stored;
        }

        $hash = self::config_hash();
        update_option( self::OPTION_CONFIG_HASH, $hash );

        return $hash;
    }

    /**
     * Resolve the effective watermark configuration for one collection.
     *
     * Starts from the global configuration and adds an `enabled` flag: the
     * site watermark is applied to a collection only when it is enabled
     * site-wide AND the collection has not opted out via the
     * fotogrids_watermark_apply_to_collection meta. The watermark itself is
     * configured globally; a collection can only opt out, not redefine it.
     * Richer per-collection overrides are a Pro extension point exposed via
     * the RESOLVED filter.
     *
     * @since 1.0.0
     * @param int $collection_id Gallery or album ID.
     * @return array<string, mixed>
     */
    public static function resolve( int $collection_id ): array {
        $resolved = self::get();

        $enabled = (bool) $resolved['enable_watermark'];

        if ( $enabled && $collection_id > 0 ) {
            $meta = get_post_meta( $collection_id, 'fotogrids_watermark_apply_to_collection', true );

            // Absent meta means the collection inherits the default (apply).
            // Only an explicit opt-out switches the watermark off here.
            if ( $meta !== '' && ! self::truthy( $meta ) ) {
                $enabled = false;
            }
        }

        $resolved['enabled'] = $enabled;

        /**
         * Filter the resolved watermark configuration for a collection.
         *
         * @since 1.0.0
         * @param array<string,mixed> $resolved
         * @param int                 $collection_id
         */
        return apply_filters( Filters_Watermark::RESOLVED, $resolved, $collection_id );
    }

    /**
     * Resolve a bundled font key to its absolute TTF path under assets/fonts/.
     *
     * Returns the default font's path when the key is unknown. The file is not
     * guaranteed to exist on disk until the bundled fonts are shipped; callers
     * that composite text must verify the path before use.
     *
     * @since 1.0.0
     * @param string $font_key Font key from the FONTS registry.
     * @return string Absolute filesystem path to the TTF.
     */
    public static function font_path( string $font_key ): string {
        $defaults = self::defaults();
        $font     = self::FONTS[ $font_key ] ?? self::FONTS[ $defaults['watermark_font_family'] ];

        return FOTOGRIDS_PLUGIN_DIR . 'assets/fonts/' . $font['file'];
    }

    /**
     * Keys that affect the rendered watermark pixels.
     *
     * The enable flag and the apply-to target are deliberately excluded:
     * toggling the watermark on/off or changing scope does not change how an
     * already-generated variant looks, so it should not mark variants stale.
     *
     * @var string[]
     */
    const HASHED_KEYS = array(
        'watermark_type',
        'watermark_image_url',
        'watermark_image_size',
        'watermark_text',
        'watermark_font_family',
        'watermark_font_size',
        'watermark_text_color',
        'watermark_custom_text_color',
        'watermark_position',
        'watermark_opacity',
        'watermark_margin',
        'watermark_repeat',
        'watermark_repeat_spacing',
    );

    /**
     * Hash of the drawing-relevant watermark settings.
     *
     * Used to detect when a stored variant is out of date relative to the
     * current configuration. Accepts an explicit config (e.g. resolved
     * settings); defaults to the current global settings.
     *
     * @since 1.0.0
     * @param array<string, mixed>|null $config Optional settings to hash.
     * @return string Short hex digest.
     */
    public static function config_hash( ?array $config = null ): string {
        $config = $config ?? self::get();

        $subset = array();
        foreach ( self::HASHED_KEYS as $key ) {
            $subset[ $key ] = $config[ $key ] ?? null;
        }

        return substr( md5( wp_json_encode( $subset ) ), 0, 12 );
    }

    /**
     * Build the @font-face CSS for every bundled watermark font.
     *
     * Each rule points at the TTF under assets/fonts/ via the plugin URL and
     * uses font-display: swap, so the admin font-family preview degrades to a
     * system font until the bundled files are present on disk.
     *
     * @since 1.0.0
     * @return string CSS containing one @font-face rule per bundled font.
     */
    public static function font_face_css(): string {
        $base = FOTOGRIDS_PLUGIN_URL . 'assets/fonts/';
        $css  = '';

        foreach ( self::FONTS as $font ) {
            $url    = esc_url( $base . $font['file'] );
            $family = $font['family'];

            $css .= "@font-face{font-family:'{$family}';font-style:normal;font-weight:600;font-display:swap;src:url('{$url}') format('truetype');}";
        }

        return $css;
    }

    /**
     * Clamp a numeric input to an inclusive range, falling back on a default
     * when the value is not numeric.
     *
     * @since 1.0.0
     * @param mixed $value
     * @param int   $min
     * @param int   $max
     * @param int   $fallback
     * @return int
     */
    private static function clamp_int( $value, int $min, int $max, int $fallback ): int {
        if ( ! is_numeric( $value ) ) {
            return $fallback;
        }
        return (int) max( $min, min( $max, (int) $value ) );
    }

    /**
     * Sanitise a hex colour, falling back when the value is not a valid hex.
     *
     * @since 1.0.0
     * @param mixed  $value
     * @param string $fallback
     * @return string
     */
    private static function sanitize_hex( $value, string $fallback ): string {
        $color = sanitize_hex_color( is_string( $value ) ? $value : '' );
        return $color ?: $fallback;
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
