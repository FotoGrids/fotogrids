<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Resolves font-family and font-weight setting values into CSS strings.
 *
 * Acts as the single authoritative translator between raw admin setting values
 * ('Poppins', '700', 'default') and the CSS strings emitted as inline custom
 * properties by decorators and features.
 *
 * Key responsibilities:
 *  - Normalise 'default' / empty / null values to '' (do not emit the var).
 *  - Wrap Google Font names in quotes and append a generic fallback.
 *  - Collect all non-system Google Fonts encountered across every gallery on
 *    the current page render and enqueue a single combined stylesheet once,
 *    before wp_head fires. Deduplicates across multiple galleries on the same
 *    page by keeping state in the singleton instance.
 *  - Fire filterable hooks so Pro (and 3rd parties) can intercept resolution -
 *    for example to expand a typography-set reference like 'typography:big_title'
 *    into the correct CSS value.
 *
 * Usage in a decorator's style_vars():
 *
 *   $resolver = Font_Resolver::instance();
 *   $family   = $resolver->resolve_font_family( $settings['caption_title_font_family'] ?? null, $render_context );
 *   $weight   = $resolver->resolve_font_weight( $settings['caption_title_font_weight'] ?? null, $render_context );
 *   // Both return '' when the setting is 'default' or unset - skip emitting the var in that case.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Font_Resolver {

    /**
     * System font names that ship with every major OS.
     *
     * Anything in this list does not need a Google Fonts stylesheet.
     * Must stay in sync with FOTOGRIDS_SYSTEM_FONT_OPTIONS in renderFontFamily.js.
     *
     * @var array<string>
     */
    private const SYSTEM_FONTS = [
        'Arial',
        'Helvetica',
        'Times New Roman',
        'Georgia',
        'Courier New',
    ];

    /**
     * Google Font names collected during this page render, deduplicated.
     *
     * @var array<string, true>
     */
    private array $google_fonts_seen = [];

    /**
     * Whether the wp_enqueue_scripts hook has already been registered.
     *
     * @var bool
     */
    private bool $enqueue_hook_registered = false;

    /**
     * Returns the request-scoped singleton instance.
     *
     * One instance per PHP request ensures Google Font names are collected
     * across all galleries on the same page before wp_head fires.
     *
     * @since  1.0.0
     * @return self
     */
    public static function instance(): self {
        static $instance = null;

        if ( $instance === null ) {
            $instance = new self();
        }

        return $instance;
    }

    /**
     * Private constructor - use Font_Resolver::instance().
     */
    private function __construct() {}

    /**
     * Resolves a raw font-family setting value to a CSS string.
     *
     * Returns '' when the value is 'default', null, or empty - callers should
     * skip emitting the CSS custom property in that case.
     *
     * For non-system fonts the name is collected for Google Fonts loading and
     * the value is returned as a quoted family name with a sans-serif fallback.
     *
     * The resolved value is passed through the filter
     * 'fotogrids/render/font/resolve_family' so Pro and 3rd parties can
     * override the result - for example to expand a 'typography:*' reference.
     *
     * @since  1.0.0
     * @param  mixed               $raw    Raw setting value from the settings array.
     * @param  Render_Context|null $render Render context, passed to filter callbacks.
     * @return string  CSS value string, or '' to skip emitting the variable.
     */
    public function resolve_font_family( mixed $raw, ?Render_Context $render = null ): string {
        $normalized = $this->normalize_scalar( $raw );

        // Let Pro / 3rd parties intercept before default resolution.
        // A non-empty string returned by the filter short-circuits local logic.
        $filtered = (string) apply_filters( 'fotogrids/render/font/resolve_family', '', $normalized, $render );
        if ( $filtered !== '' ) {
            return $filtered;
        }

        if ( $normalized === '' ) {
            return '';
        }

        // System fonts: pass through as-is (no Google Fonts needed).
        if ( in_array( $normalized, self::SYSTEM_FONTS, true ) ) {
            return $normalized . ', sans-serif';
        }

        // Non-system font: collect for Google Fonts loading and quote the name.
        $this->collect_google_font( $normalized );

        return '"' . $normalized . '", sans-serif';
    }

    /**
     * Resolves a raw font-weight setting value to a CSS string.
     *
     * Returns '' when the value is 'default', null, or empty.
     *
     * The resolved value is passed through the filter
     * 'fotogrids/render/font/resolve_weight' so Pro and 3rd parties can
     * override the result.
     *
     * @since  1.0.0
     * @param  mixed               $raw    Raw setting value from the settings array.
     * @param  Render_Context|null $render Render context, passed to filter callbacks.
     * @return string  CSS value string ('400', '700', etc.), or '' to skip emitting.
     */
    public function resolve_font_weight( mixed $raw, ?Render_Context $render = null ): string {
        $normalized = $this->normalize_scalar( $raw );

        // Let Pro / 3rd parties intercept before default resolution.
        $filtered = (string) apply_filters( 'fotogrids/render/font/resolve_weight', '', $normalized, $render );
        if ( $filtered !== '' ) {
            return $filtered;
        }

        if ( $normalized === '' ) {
            return '';
        }

        // Accept numeric weight strings only ('100'–'900').
        if ( preg_match( '/^[1-9]00$/', $normalized ) ) {
            return $normalized;
        }

        return '';
    }

    /**
     * Registers the wp_enqueue_scripts hook for Google Fonts loading.
     *
     * Called from boot.php once per request. Safe to call multiple times -
     * the hook is only registered on the first call.
     *
     * @since  1.0.0
     * @return void
     */
    public function register_enqueue_hook(): void {
        if ( $this->enqueue_hook_registered ) {
            return;
        }

        $this->enqueue_hook_registered = true;

        // Priority 20: runs after shortcodes / blocks have processed during
        // the_content (priority 10–11), so all galleries on the page have
        // had a chance to call resolve_font_family() and register their fonts.
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_google_fonts' ], 20 );
    }

    /**
     * Enqueues a single combined Google Fonts stylesheet for all collected fonts.
     *
     * Called automatically via the wp_enqueue_scripts hook registered in
     * register_enqueue_hook(). Skips silently when no Google Fonts were used
     * or when wp_head has already fired (e.g. AJAX / REST renders - the font
     * will already be loaded from the initial page HTML).
     *
     * @since  1.0.0
     * @return void
     */
    public function enqueue_google_fonts(): void {
        if ( empty( $this->google_fonts_seen ) ) {
            return;
        }

        $url = $this->build_google_fonts_url( array_keys( $this->google_fonts_seen ) );
        if ( $url === '' ) {
            return;
        }

        wp_enqueue_style(
            'fotogrids-google-fonts',
            $url,
            [],
            null // No version - Google Fonts URLs are self-versioning.
        );
    }

    /**
     * Collects a Google Font name and ensures the enqueue hook is registered.
     *
     * @since  1.0.0
     * @param  string $family Font family name.
     * @return void
     */
    private function collect_google_font( string $family ): void {
        $this->google_fonts_seen[ $family ] = true;
        $this->register_enqueue_hook();
    }

    /**
     * Builds a combined Google Fonts API v2 URL for the given font families.
     *
     * Requests regular (400) weight for all fonts - individual weight loading
     * is handled by the inline CSS custom property, not the stylesheet URL.
     *
     * @since  1.0.0
     * @param  array<string> $families Font family names.
     * @return string
     */
    private function build_google_fonts_url( array $families ): string {
        if ( empty( $families ) ) {
            return '';
        }

        $params = array_map(
            static function ( string $family ): string {
                return 'family=' . rawurlencode( $family ) . ':wght@100;200;300;400;500;600;700;800;900';
            },
            $families
        );

        return 'https://fonts.googleapis.com/css2?' . implode( '&', $params ) . '&display=swap';
    }

    /**
     * Normalises a raw setting value to a plain string, treating 'default' as empty.
     *
     * @since  1.0.0
     * @param  mixed $raw Raw setting value.
     * @return string
     */
    private function normalize_scalar( mixed $raw ): string {
        if ( $raw === null || $raw === '' || $raw === 'default' ) {
            return '';
        }

        if ( ! is_string( $raw ) ) {
            return '';
        }

        return trim( $raw );
    }
}
