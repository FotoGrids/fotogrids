<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Module_Assets;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Collects and flushes module asset declarations.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Asset_Resolver {

    /**
     * @var array<string, string>
     */
    private static array $plugin_render_urls = [];

    /**
     * @var array<string, string>
     */
    private static array $plugin_versions = [];

    /**
     * @var array<string, array{handle: string, src: string, deps: array<int, string>, version: string}>
     */
    private array $css_queue = [];

    /**
     * @var array<string, array{handle: string, src: string, deps: array<int, string>, version: string, in_footer: bool}>
     */
    private array $js_queue = [];

    private static ?self $instance = null;

    /**
     * Handles enqueued in any flush this request, mapped to their resolved URL.
     *
     * Because the Asset_Resolver is a request-scoped singleton, multiple galleries
     * on the same page each call flush() after their own render. This map prevents
     * re-registering and re-printing a handle that a previous gallery already sent
     * to WordPress — without blocking later galleries from flushing their own assets.
     * It also serves as the source of truth for get_css_asset_urls(), which the
     * preview endpoint reads after flush() has cleared the per-render queue.
     *
     * @var array<string, string>  handle => resolved URL
     */
    private array $enqueued_css_handles = [];

    /**
     * @var array<string, true>
     */
    private array $enqueued_js_handles = [];

    /**
     * Returns the request-scoped singleton resolver.
     *
     * @since   1.0.0
     * @return  self
     */
    public static function instance(): self {
        return self::$instance ??= new self();
    }

    /**
     * Registers plugin URL and version metadata by origin slug.
     *
     * @since   1.0.0
     * @param   string $origin Origin slug.
     * @param   string $plugin_url Plugin base URL.
     * @param   string $version Version string.
     * @return  void
     */
    public static function register_plugin( string $origin, string $plugin_url, string $version ): void {
        self::$plugin_render_urls[ $origin ] = rtrim( $plugin_url, '/' ) . '/public/render/';
        self::$plugin_versions[ $origin ] = $version;
    }

    /**
     * Collects module assets for deferred enqueueing.
     *
     * @since   1.0.0
     * @param   Module_Assets $module_assets Module assets.
     * @param   string        $module_origin Module origin slug.
     * @return  void
     */
    public function collect( Module_Assets $module_assets, string $module_origin ): void {
        foreach ( $module_assets->css as $asset_handle => $asset_declaration ) {
            if ( isset( $this->css_queue[ $asset_handle ] ) ) {
                continue;
            }

            $asset_origin = $asset_declaration->plugin_origin ?? $module_origin;
            $this->css_queue[ $asset_handle ] = [
                'handle' => $asset_handle,
                'src' => $this->resolve_url( $asset_origin, $asset_declaration->path ),
                'deps' => $asset_declaration->deps,
                'version' => $this->resolve_version( $asset_origin ),
            ];
        }

        foreach ( $module_assets->js as $asset_handle => $asset_declaration ) {
            if ( isset( $this->js_queue[ $asset_handle ] ) ) {
                continue;
            }

            $asset_origin = $asset_declaration->plugin_origin ?? $module_origin;
            $this->js_queue[ $asset_handle ] = [
                'handle' => $asset_handle,
                'src' => $this->resolve_url( $asset_origin, $asset_declaration->path ),
                'deps' => $asset_declaration->deps,
                'version' => $this->resolve_version( $asset_origin ),
                'in_footer' => $asset_declaration->in_footer,
            ];
        }
    }

    /**
     * Enqueues collected assets and clears the queue for the next render.
     *
     * Called once per gallery render (including gated renders that return early).
     * Because multiple galleries on the same page each call flush(), this method
     * must be repeatable: after processing, it clears the per-render queues so
     * the next gallery starts fresh. Handles already sent to WordPress in a prior
     * flush are tracked in $enqueued_css_handles / $enqueued_js_handles and
     * skipped, preventing duplicate registration or redundant wp_print_styles()
     * calls while still allowing each gallery to flush its own new assets.
     *
     * @since   1.0.0
     * @return  void
     */
    public function flush(): void {
        $new_css_handles = [];

        foreach ( $this->css_queue as $css_asset ) {
            $handle = $css_asset['handle'];

            if ( isset( $this->enqueued_css_handles[ $handle ] ) ) {
                continue;
            }

            wp_register_style( $handle, $css_asset['src'], $css_asset['deps'], $css_asset['version'] );
            wp_enqueue_style( $handle );
            $this->enqueued_css_handles[ $handle ] = $css_asset['src'];
            $new_css_handles[] = $handle;
        }

        // wp_head has already fired (shortcode / block rendered in content) —
        // print new styles inline so they arrive before their HTML.
        if ( ! empty( $new_css_handles ) && ( did_action( 'wp_head' ) > 0 || did_action( 'admin_head' ) > 0 ) ) {
            wp_print_styles( $new_css_handles );
        }

        foreach ( $this->js_queue as $js_asset ) {
            $handle = $js_asset['handle'];

            if ( isset( $this->enqueued_js_handles[ $handle ] ) ) {
                continue;
            }

            wp_register_script(
                $handle,
                $js_asset['src'],
                $js_asset['deps'],
                $js_asset['version'],
                $js_asset['in_footer']
            );
            wp_enqueue_script( $handle );
            $this->enqueued_js_handles[ $handle ] = true;
        }

        // Clear the per-render queues so the next gallery render starts fresh.
        $this->css_queue = [];
        $this->js_queue  = [];
    }

    /**
     * Returns CSS asset URLs keyed by handle for all assets enqueued this request.
     *
     * Reads from $enqueued_css_handles rather than $css_queue, because the queue
     * is cleared after each flush(). This ensures callers (e.g. the preview REST
     * endpoint) receive the correct URLs even when called after flush().
     *
     * @since   1.0.0
     * @return  array<string, string>
     */
    public function get_css_asset_urls(): array {
        return $this->enqueued_css_handles;
    }

    /**
     * Resets singleton and queues for tests.
     *
     * @since   1.0.0
     * @return  void
     */
    public static function reset_for_tests(): void {
        self::$instance           = null;
        self::$plugin_render_urls = [];
        self::$plugin_versions    = [];
    }

    /**
     * Resolves asset URL by origin and relative path.
     *
     * @since   1.0.0
     * @param   string $origin Origin slug.
     * @param   string $relative_path Relative path.
     * @return  string
     */
    private function resolve_url( string $origin, string $relative_path ): string {
        if ( ! isset( self::$plugin_render_urls[ $origin ] ) ) {
            throw new \RuntimeException( sprintf( "Asset origin '%s' is not registered", $origin ) );
        }

        return self::$plugin_render_urls[ $origin ] . ltrim( $relative_path, '/' );
    }

    /**
     * Resolves asset version by origin.
     *
     * @since   1.0.0
     * @param   string $origin Origin slug.
     * @return  string
     */
    private function resolve_version( string $origin ): string {
        if ( ! isset( self::$plugin_versions[ $origin ] ) ) {
            throw new \RuntimeException( sprintf( "Asset version for origin '%s' is not registered", $origin ) );
        }

        return self::$plugin_versions[ $origin ];
    }
}
