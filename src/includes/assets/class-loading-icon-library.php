<?php
/**
 * Loading-icon JSON library reader.
 *
 * @package FotoGrids\Assets
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Assets;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Reads `config/loading-icons.json` and `config/loading-icons-waapi.json`
 * (both built from `loading-icons.yaml`) and returns SVG markup or WAAPI
 * animate-function source for a named icon.
 *
 * Caches both JSON files in-memory on first read so repeated lookups during
 * a single request are free.
 *
 * @since 1.0.0
 */
final class Loading_Icon_Library {

    /**
     * Cached icon SVG map (name => svg-template).
     *
     * @var array<string, string>|null
     */
    private static ?array $icons_cache = null;

    /**
     * Cached WAAPI animate-fn source map (name => js-function-source).
     *
     * @var array<string, string>|null
     */
    private static ?array $waapi_cache = null;

    /**
     * Get a loading-icon SVG by name.
     *
     * Returns only the selected icon's SVG for optimal frontend performance.
     * SVG templates contain `__FG_ID__`; pass `$instance_id` to avoid duplicate
     * IDs when multiple loaders are on the page (e.g. PHP: `uniqid()`, React:
     * `useId()`, vanilla: `bin2hex(random_bytes(4))`).
     *
     * @since 1.0.0
     * @param string $icon_name   Icon name (e.g. 'spinner', '12-dots').
     * @param string $instance_id Optional. Unique id for this instance;
     *                            replaces __FG_ID__ in the SVG. If empty,
     *                            __FG_ID__ is left as-is (single loader).
     * @return string SVG markup, or default spinner if not found.
     */
    public static function svg( string $icon_name = 'spinner', string $instance_id = '' ): string {
        $icons = self::load_icons();

        $svg = '';
        if ( isset( $icons[ $icon_name ] ) ) {
            $svg = $icons[ $icon_name ];
        } elseif ( isset( $icons['spinner'] ) ) {
            $svg = $icons['spinner'];
        }

        if ( $svg !== '' && $instance_id !== '' ) {
            $svg = str_replace( '__FG_ID__', $instance_id, $svg );
        }

        return $svg;
    }

    /**
     * Get the WAAPI animate function source for a loading icon by name.
     *
     * Returns a raw JS function string: `function animate(svg) { ... }`.
     *
     * Emitted verbatim by Loading_Icon into the inline script global so the
     * browser receives a fully pre-built function - no eval, no `new Function`,
     * no runtime code generation. The helpers (`fgCubicBezier`, `fgAnimAttr`,
     * etc.) are inlined inside the function by the build-time converter.
     *
     * @since 1.0.0
     * @param string $icon_name Icon name (e.g. 'spinner', '12-dots').
     * @return string Raw JS function source, or empty string if not found.
     */
    public static function animate_fn( string $icon_name = 'spinner' ): string {
        $waapi = self::load_waapi();

        if ( isset( $waapi[ $icon_name ] ) ) {
            return $waapi[ $icon_name ];
        }

        if ( isset( $waapi['spinner'] ) ) {
            return $waapi['spinner'];
        }

        return '';
    }

    /**
     * Lazy-load the SVG icon map.
     *
     * @return array<string, string>
     */
    private static function load_icons(): array {
        if ( self::$icons_cache !== null ) {
            return self::$icons_cache;
        }

        $file = FOTOGRIDS_PLUGIN_DIR . 'config/loading-icons.json';
        self::$icons_cache = self::read_json_map( $file );

        return self::$icons_cache;
    }

    /**
     * Lazy-load the WAAPI animate-fn source map.
     *
     * @return array<string, string>
     */
    private static function load_waapi(): array {
        if ( self::$waapi_cache !== null ) {
            return self::$waapi_cache;
        }

        $file = FOTOGRIDS_PLUGIN_DIR . 'config/loading-icons-waapi.json';
        self::$waapi_cache = self::read_json_map( $file );

        return self::$waapi_cache;
    }

    /**
     * Read a name => string JSON map from disk. Returns empty array on any
     * failure so callers can rely on the return type.
     *
     * @param string $file Absolute path to a JSON file.
     * @return array<string, string>
     */
    private static function read_json_map( string $file ): array {
        if ( ! file_exists( $file ) ) {
            return [];
        }

        $contents = file_get_contents( $file );
        if ( ! is_string( $contents ) ) {
            return [];
        }

        $decoded = json_decode( $contents, true );
        return is_array( $decoded ) ? $decoded : [];
    }
}
