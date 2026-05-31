<?php
namespace FotoGrids;

use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Render_Controller;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Public Render Class
 *
 * Handles frontend rendering for FotoGrids
 */
class Public_Render {

    /**
     * Thread-local flag: when true, every gallery/album shortcode call made
     * during this request lands in Render_Meta with `view_page=true`.
     * Set by ViewCollections\Renderer::gallery_html() around its call to
     * gallery_shortcode() / album_shortcode() so the Collection_Header
     * feature can gate its "view_pages" placement.
     *
     * @var bool
     * @since 1.0.0
     */
    private static bool $view_page_context = false;

    /**
     * Toggle the view-page context flag. ViewCollections wraps its
     * shortcode call in `set_view_page_context(true)` … `set_view_page_context(false)`
     * so a single page render can have view-page chrome on the gallery and
     * still rely on plain `gallery_shortcode()` for normal embeds (which
     * stay context-free).
     *
     * @since 1.0.0
     * @param bool $is_view_page
     * @return void
     */
    public static function set_view_page_context( bool $is_view_page ): void {
        self::$view_page_context = $is_view_page;
    }

    /**
     * @since 1.0.0
     * @return bool
     */
    public static function is_view_page_context(): bool {
        return self::$view_page_context;
    }

    /**
     * Initialize the public rendering
     */
    public static function init() {
        add_shortcode( 'fotogrids_gallery', array( __CLASS__, 'gallery_shortcode' ) );
        add_shortcode( 'fotogrids_album', array( __CLASS__, 'album_shortcode' ) );

        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_frontend_scripts' ) );
        add_action( 'init', array( __CLASS__, 'register_gutenberg_blocks' ) );
    }

    /**
     * Get gallery settings with defaults
     *
     * @param int $gallery_id Gallery ID
     * @return array Gallery settings
     */
    private static function get_gallery_settings( $gallery_id ) {
        return fotogrids_get_gallery_settings( $gallery_id );
    }

    /**
     * Re-enqueue the CSS and JS assets that were collected during the original render.
     *
     * On a cache hit the render pipeline never runs, so Asset_Resolver never
     * collects module assets. This method replays both stored maps directly,
     * mirroring Asset_Resolver::flush() for both sides.
     *
     * @since  1.0.0
     * @param  array<string, string>                             $css Handle → URL map.
     * @param  array<string, array{src: string, in_footer: bool}> $js  Handle → metadata map.
     * @return void
     */
    private static function replay_cached_assets( array $css, array $js ): void {
        $resolver        = \FotoGrids\Render\Internal\Asset_Resolver::instance();
        $already_css     = $resolver->get_css_asset_urls();
        $already_js      = $resolver->get_js_asset_data();
        $new_css_handles = [];

        foreach ( $css as $handle => $src ) {
            if ( isset( $already_css[ $handle ] ) ) {
                continue;
            }
            wp_register_style( $handle, $src, [], false );
            wp_enqueue_style( $handle );
            $new_css_handles[] = $handle;
        }

        if ( ! empty( $new_css_handles ) && ( did_action( 'wp_head' ) > 0 || did_action( 'admin_head' ) > 0 ) ) {
            wp_print_styles( $new_css_handles );
        }

        foreach ( $js as $handle => $meta ) {
            if ( isset( $already_js[ $handle ] ) ) {
                continue;
            }
            wp_register_script( $handle, $meta['src'], [], false, $meta['in_footer'] );
            wp_enqueue_script( $handle );
        }
    }

    /**
     * Render one gallery through the render controller pipeline.
     *
     * @param int   $gallery_id Gallery ID.
     * @param array $settings Gallery settings.
     * @param array $item_ids Ordered gallery item IDs.
     * @param array $atts Shortcode attributes.
     * @return string
     */
    private static function render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, $source = Request_Source::SHORTCODE, $is_preview = false, $meta_overrides = array() ) {
        if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
            return '';
        }

        $settings_overlay = array();
        if ( ! empty( $atts['template'] ) && is_string( $atts['template'] ) ) {
            $settings_overlay['layout'] = sanitize_text_field( $atts['template'] );
        }

        if ( ! empty( $atts['cols'] ) ) {
            $cols = absint( $atts['cols'] );
            if ( $cols > 0 ) {
                $settings_overlay['columns'] = array(
                    'desktop' => $cols,
                    'tablet'  => $cols,
                    'mobile'  => $cols,
                );
            }
        }

        if ( isset( $atts['captions'] ) ) {
            $settings_overlay['captions'] = $atts['captions'] === 'true';
        }

        if ( isset( $atts['lightbox'] ) ) {
            $settings_overlay['lightbox'] = $atts['lightbox'] === 'true';
        }

        $settings_overlay['_show_render_errors'] = current_user_can( 'edit_posts' );

        $context_builder = $is_preview ? Context_Builder::for_preview() : Context_Builder::for_public();
        if ( $is_preview ) {
            $render_context = $context_builder->build_for_preview(
                gallery_id: (int) $gallery_id,
                base_settings: is_array( $settings ) ? $settings : array(),
                settings_overlay: $settings_overlay,
                collection_item_ids: is_array( $item_ids ) ? array_map( 'absint', $item_ids ) : array(),
                item_overrides: array(),
                source: $source instanceof Request_Source ? $source : Request_Source::PREVIEW_UNSAVED,
                simulate_state: null
            );
        } else {
            $render_settings = array_replace_recursive( is_array( $settings ) ? $settings : array(), $settings_overlay );
            $effective_meta_overrides = is_array( $meta_overrides ) ? $meta_overrides : array();
            // Promote the request-scoped view-page flag into the per-render
            // meta overrides so downstream features (Collection_Header) can
            // gate behaviour on it. Caller-supplied overrides win.
            if ( self::is_view_page_context() && ! array_key_exists( 'view_page', $effective_meta_overrides ) ) {
                $effective_meta_overrides['view_page'] = true;
            }
            $render_context = $context_builder->build_for_public(
                gallery_id: (int) $gallery_id,
                render_settings: $render_settings,
                collection_item_ids: is_array( $item_ids ) ? array_map( 'absint', $item_ids ) : array(),
                source: $source instanceof Request_Source ? $source : Request_Source::SHORTCODE,
                album_id: absint( $atts['album_id'] ?? 0 ) ?: null,
                meta_overrides: $effective_meta_overrides
            );
        }

        $render_result = Render_Controller::factory()->render( $render_context );
        self::$last_render_meta = $render_context->meta;
        return (string) $render_result->html;
    }

    /**
     * Holds the Render_Meta of the most recent render_gallery_with_pipeline()
     * call within this request. REST handlers read it to surface
     * pagination metadata (snap-aware page size and total page count)
     * that Context_Builder resolved during the render.
     *
     * @since 1.0.0
     * @var \FotoGrids\Render\Api\Render_Meta|null
     */
    private static ?\FotoGrids\Render\Api\Render_Meta $last_render_meta = null;

    /**
     * Returns the Render_Meta from the most recent gallery render in this
     * request, or null when no render has run yet.
     *
     * @since  1.0.0
     */
    public static function last_render_meta(): ?\FotoGrids\Render\Api\Render_Meta {
        return self::$last_render_meta;
    }

    /**
     * REST entry point for rendering a gallery with pagination + partial
     * options.
     *
     * Used by the /fotogrids/v1/gallery/render REST endpoint. Unlike the
     * shortcode path, this bypasses caching (per-(gallery, page, breakpoint)
     * cache keys are a v2 concern — see PLAN.md §8.5) and never re-enters
     * the shortcode atts parser. Returns the raw rendered HTML — the REST
     * handler still owns the CSS-handle map and the pagination metadata
     * envelope.
     *
     * @since 1.0.0
     * @param int                  $gallery_id     Gallery ID.
     * @param array<string, mixed> $meta_overrides Optional Render_Meta overrides:
     *                                             requested_page, requested_per_page,
     *                                             breakpoint, partial.
     * @param Request_Source       $source         Request source (defaults to ALBUM_AJAX
     *                                             because the existing /gallery/render
     *                                             callers use it that way; the REST handler
     *                                             can override).
     * @return string Rendered HTML (or empty string when the gallery cannot be rendered).
     */
    public static function render_gallery_for_rest( int $gallery_id, array $meta_overrides = array(), Request_Source $source = Request_Source::ALBUM_AJAX ): string {
        $gallery = fotogrids_get_gallery( $gallery_id );
        if ( ! $gallery || $gallery->post_status !== 'publish' ) {
            return '';
        }

        $settings = self::get_gallery_settings( $gallery_id );
        $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );
        if ( empty( $item_ids ) ) {
            return '';
        }

        // Synthetic atts mirroring what the shortcode produces — the
        // pipeline reads a small subset and the rest are inert.
        $atts = array(
            'id'       => $gallery_id,
            'album_id' => 0,
            'template' => '',
            'cols'     => 0,
            'captions' => 'true',
            'lightbox' => 'true',
        );

        return (string) self::render_gallery_with_pipeline(
            $gallery_id,
            $settings,
            $item_ids,
            $atts,
            $source,
            false,
            $meta_overrides
        );
    }

    /**
     * Gallery shortcode handler
     *
     * @param array $atts Shortcode attributes
     * @return string Rendered gallery HTML
     */
    public static function gallery_shortcode( $atts ) {
        $atts = shortcode_atts( array(
            'id' => 0,
            'template' => '',
            'cols' => 0,
            'lazy' => 'true',
            'lightbox' => 'true',
            'captions' => 'true',
            'test' => 'false', // Debug test mode
            'template_preview' => 'false', // Template preview mode
            'template_settings' => '', // JSON-encoded template settings
            'template_items' => '', // JSON-encoded template items
            'album_id' => 0, // Album ID if gallery is accessed from album context
            '_source' => '', // Internal source discriminator
        ), $atts, 'fotogrids_gallery' );

        // Template preview mode - use provided settings and items
        if ( $atts['template_preview'] === 'true' ) {
            $settings = array();
            if ( ! empty( $atts['template_settings'] ) ) {
                $decoded = json_decode( $atts['template_settings'], true );
                if ( is_array( $decoded ) ) {
                    $defaults = fotogrids_get_default_gallery_settings();
                    $settings = array_merge( $defaults, $decoded );
                }
            } else {
                $settings = fotogrids_get_default_gallery_settings();
            }

            $items = array();
            if ( ! empty( $atts['template_items'] ) ) {
                $decoded = json_decode( $atts['template_items'], true );
                if ( is_array( $decoded ) ) {
                    $items = $decoded;
                }
            }

            return self::render_template_preview( $items, '', array(), array(), $settings, $atts );
        }

        if ( $atts['test'] === 'true' ) {
            return self::render_test_gallery( $atts );
        }

        $gallery_id = absint( $atts['id'] );
        if ( ! $gallery_id ) {
            return '<div class="fotogrids-error">FotoGrids: No gallery ID specified. Usage: [fotogrids_gallery id="1"] or [fotogrids_gallery test="true"]</div>';
        }

        $gallery = fotogrids_get_gallery( $gallery_id );
        if ( ! $gallery ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' not found.</div>';
        }

        if ( $gallery->post_status !== 'publish' ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' is not published (status: ' . $gallery->post_status . ').</div>';
        }

        $settings = self::get_gallery_settings( $gallery_id );

        $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );
        if ( empty( $item_ids ) ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' exists but has no items.</div>';
        }

        $source = Request_Source::SHORTCODE;
        if ( $atts['_source'] === Request_Source::BLOCK->value ) {
            $source = Request_Source::BLOCK;
        }
        if ( $atts['_source'] === Request_Source::ALBUM_AJAX->value ) {
            $source = Request_Source::ALBUM_AJAX;
        }
        if ( absint( $atts['album_id'] ) > 0 ) {
            $source = Request_Source::ALBUM_AJAX;
        }

        $cache_key = null;
        if ( \FotoGrids\FotoGrids_Cache::should_cache( $settings, $gallery_id ) ) {
            $cache_key = \FotoGrids\FotoGrids_Cache::make_key( $gallery_id, $settings, $item_ids, $atts );
            $cached    = \FotoGrids\FotoGrids_Cache::get( $gallery_id, $cache_key );
            if ( $cached !== false ) {
                self::replay_cached_assets( $cached['css'], $cached['js'] );
                do_action( 'fotogrids/cache/hit', $gallery_id, $cache_key );
                return $cached['html'];
            }
        }

        $html = self::render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, $source, false );

        if ( $cache_key !== null ) {
            $duration = max( 1, absint( $settings['cache_duration'] ?? 24 ) );
            $resolver = \FotoGrids\Render\Internal\Asset_Resolver::instance();
            $css      = $resolver->get_css_asset_urls();
            $js       = $resolver->get_js_asset_data();
            \FotoGrids\FotoGrids_Cache::put( $gallery_id, $cache_key, $html, $css, $js, $duration );
            do_action( 'fotogrids/cache/written', $gallery_id, $cache_key );
        }

        return $html;
    }

    /**
     * Album shortcode handler.
     *
     * Albums render through the same Render_Controller pipeline as
     * galleries, with collection_kind = ALBUM. Each "item" in the render
     * context is a child gallery summary (Album_Item_Loader). The same
     * Grid / Justified / Masonry layouts and the visual decorators
     * (Captions, Border, Shadow, Hover_Effects, Image_Filters) apply
     * uniformly. Click behaviour is supplied by Album_To_View_Page or
     * Album_To_Gallery_Ajax depending on the use_ajax_from_album setting.
     *
     * @param array $atts Shortcode attributes.
     * @return string Rendered album HTML.
     */
    public static function album_shortcode( $atts ) {
        $atts = shortcode_atts( array(
            'id'       => 0,
            'template' => 'grid',
        ), $atts, 'fotogrids_album' );

        $album_id = absint( $atts['id'] );
        if ( ! $album_id ) {
            return '';
        }

        $album = fotogrids_get_album( $album_id );
        if ( ! $album || $album->post_status !== 'publish' ) {
            return '';
        }

        $child_galleries = Gallery_Album_Relations::get_galleries_for_album( $album_id, array(
            'orderby' => 'position',
            'order'   => 'ASC',
        ) );

        if ( empty( $child_galleries ) ) {
            return '';
        }

        // Reduce to bare IDs in album-stored order.
        $child_gallery_ids = array_values( array_filter( array_map(
            static fn ( $gallery_post ) => (int) ( is_object( $gallery_post ) ? $gallery_post->ID : 0 ),
            $child_galleries
        ) ) );

        if ( empty( $child_gallery_ids ) ) {
            return '';
        }

        if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
            return '';
        }

        $album_settings = fotogrids_get_album_settings( $album_id );

        // Allow the shortcode's `template` attribute to override the
        // layout (e.g. [fotogrids_album id=42 template=masonry]).
        if ( ! empty( $atts['template'] ) && is_string( $atts['template'] ) ) {
            $album_settings['layout'] = $atts['template'];
        }

        $context = Context_Builder::for_public()->build_for_album(
            album_id:          $album_id,
            render_settings:   $album_settings,
            child_gallery_ids: $child_gallery_ids,
        );

        $result = Render_Controller::factory()->render( $context );

        return $result->html;
    }

    /**
     * Enqueue frontend scripts and styles.
     *
     * After the frontend refactor, almost everything reaches the page via
     * the render pipeline (Asset_Resolver). The only assets enqueued here
     * are:
     *
     *   • fg-tooltip JS/CSS — still globally enqueued because multiple
     *     modules (sharing, filter UI, lightbox) bind tooltips and
     *     fg-tooltip is not yet wrapped as a render module dependency.
     *     Task 15 of the refactor will move this.
     *   • fotogrids-errors.css — tiny always-on stylesheet for the
     *     `.fotogrids-error` block. Lives outside the render pipeline
     *     because error markup can be emitted before any layout module
     *     runs (e.g. "gallery not found"), so collection-base.css is
     *     never enqueued for those paths.
     *
     * The window.fotogrids localize payload is pre-registered against the
     * `fotogrids-runtime` handle here, even though the runtime asset
     * itself is enqueued by Asset_Resolver from Runtime_Bootstrap during
     * the render. wp_register_script() at this stage means the localize
     * data is associated with the handle so it prints when the script is
     * enqueued later in wp_footer.
     */
    public static function enqueue_frontend_scripts() {
        if ( ! self::has_fotogrids_content() ) {
            return;
        }

        // Pre-register the runtime handle so wp_localize_script can attach
        // its payload. Asset_Resolver will later call wp_register_script
        // for the same handle; WordPress treats a duplicate registration
        // as a no-op, so this is safe.
        wp_register_script(
            'fotogrids-runtime',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/fotogrids-runtime.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        // fg-tooltip and deep-linking are NOT enqueued here anymore.
        // • fg-tooltip is declared as a dep by Sharing_Decorator and
        //   Lightbox features; Asset_Resolver pulls it in when either is
        //   active on the page.
        // • deep-linking is declared by Sharing_Decorator (task 16). On
        //   the View Page it's pulled in directly by Renderer::enqueue_assets
        //   because a ?fg-item URL can arrive even when sharing is off.

        wp_enqueue_style(
            'fotogrids-errors',
            FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids-errors.css',
            array(),
            FOTOGRIDS_VERSION
        );

        $sharing = \FotoGrids\Settings\Sharing_Settings_Store::get();

        // window.fotogrids carries only the sharing-related deep-link
        // settings now. REST URLs and nonces are per-render: Stats and
        // Album_To_Gallery_Ajax write their own URL/nonce into per-element
        // data attributes. Lazy-load is gated by the per-gallery
        // data-fg-lazy attribute, not a global.
        wp_localize_script( 'fotogrids-runtime', 'fotogrids', array(
            'deep_linking_enabled'  => (bool) $sharing['deep_linking_enabled'],
            'embedded_share_target' => $sharing['embedded_share_target'],
        ) );
    }

    /**
     * Register Gutenberg blocks
     */
    public static function register_gutenberg_blocks() {
        if ( ! function_exists( 'register_block_type' ) ) {
            return;
        }

        register_block_type( 'fotogrids/gallery', array(
            'editor_script' => 'fotogrids-admin',
            'render_callback' => array( __CLASS__, 'render_gallery_block' ),
            'attributes' => array(
                'galleryId' => array(
                    'type' => 'number',
                    'default' => 0,
                ),
                'template' => array(
                    'type' => 'string',
                    'default' => 'grid',
                ),
                'columns' => array(
                    'type' => 'number',
                    'default' => 3,
                ),
                'showCaptions' => array(
                    'type' => 'boolean',
                    'default' => true,
                ),
                'lightbox' => array(
                    'type' => 'boolean',
                    'default' => true,
                ),
            ),
        ) );
    }

    /**
     * Render gallery block
     */
    public static function render_gallery_block( $attributes ) {
        if ( empty( $attributes['galleryId'] ) ) {
            return '';
        }

        return self::gallery_shortcode( array(
            'id' => $attributes['galleryId'],
            'template' => $attributes['template'],
            'cols' => $attributes['columns'],
            'captions' => $attributes['showCaptions'] ? 'true' : 'false',
            'lightbox' => $attributes['lightbox'] ? 'true' : 'false',
            '_source' => Request_Source::BLOCK->value,
        ) );
    }

    /**
     * Render gallery preview (for admin)
     *
     * Similar to gallery_shortcode but allows previewing unpublished galleries
     *
     * @param int $gallery_id Gallery ID
     * @param array $atts Optional attributes to override settings
     * @return string Rendered gallery HTML
     */
    public static function render_gallery_preview( $gallery_id, $atts = array() ) {
        $gallery_id = absint( $gallery_id );
        if ( ! $gallery_id ) {
            return '<div class="fotogrids-error">FotoGrids: No gallery ID specified.</div>';
        }

        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' not found.</div>';
        }

        $settings = self::get_gallery_settings( $gallery_id );

        $atts = shortcode_atts( array(
            'lazy' => 'true',
            'lightbox' => 'true',
            'captions' => 'true',
        ), $atts, 'fotogrids_gallery' );

        $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );
        if ( empty( $item_ids ) ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' exists but has no items.</div>';
        }

        return self::render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, Request_Source::PREVIEW_SAVED, true );
    }

    /**
     * Render template preview
     *
     * Public method to render a gallery preview with custom items and settings
     * Used for template previews in admin
     *
     * @param array $items Gallery items
     * @param string $layout Layout type
     * @param array $columns Responsive columns
     * @param array $spacing Responsive spacing
     * @param array $settings Gallery settings
     * @param array $atts Shortcode attributes
     * @return string Rendered gallery HTML
     */
    public static function render_template_preview( $items, $layout, $columns, $spacing, $settings, $atts = array() ) {
        if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
            return '';
        }

        $atts = shortcode_atts( array(
            'template' => '',
            'cols' => 0,
            'captions' => 'true',
            'lightbox' => 'true',
            'album_id' => 0,
        ), $atts, 'fotogrids_gallery' );

        $settings_overlay = array();
        if ( ! empty( $layout ) && is_string( $layout ) ) {
            $settings_overlay['layout'] = sanitize_text_field( $layout );
        } elseif ( ! empty( $atts['template'] ) && is_string( $atts['template'] ) ) {
            $settings_overlay['layout'] = sanitize_text_field( $atts['template'] );
        }
        if ( ! empty( $columns ) && is_array( $columns ) ) {
            $settings_overlay['columns'] = $columns;
        }
        if ( ! empty( $spacing ) && is_array( $spacing ) ) {
            $settings_overlay['item_spacing'] = $spacing;
        }
        if ( ! empty( $atts['cols'] ) ) {
            $col_count = absint( $atts['cols'] );
            if ( $col_count > 0 ) {
                $settings_overlay['columns'] = array(
                    'desktop' => $col_count,
                    'tablet'  => $col_count,
                    'mobile'  => $col_count,
                );
            }
        }
        if ( isset( $atts['captions'] ) ) {
            $settings_overlay['captions'] = $atts['captions'] === 'true';
        }
        if ( isset( $atts['lightbox'] ) ) {
            $settings_overlay['lightbox'] = $atts['lightbox'] === 'true';
        }
        $settings_overlay['_show_render_errors'] = current_user_can( 'edit_posts' );

        $render_settings = array_replace_recursive( is_array( $settings ) ? $settings : array(), $settings_overlay );
        $render_context = Context_Builder::for_preview()->build_for_preview(
            gallery_id: 0,
            base_settings: $render_settings,
            settings_overlay: array(),
            collection_item_ids: array(),
            item_overrides: array(),
            source: Request_Source::TEMPLATE_PREVIEW,
            simulate_state: null
        );

        $render_context = $render_context->with(
            array(
                'items' => self::build_template_item_views( is_array( $items ) ? $items : array() ),
            )
        );

        return (string) Render_Controller::factory()->render( $render_context )->html;
    }

    /**
     * Convert template preview payload to item value objects.
     *
     * @param array $items Template preview items.
     * @return array
     */
    private static function build_template_item_views( $items ) {
        $item_views = array();

        foreach ( $items as $index => $item ) {
            if ( ! is_array( $item ) ) {
                continue;
            }

            $item_id = absint( $item['id'] ?? 0 );
            if ( $item_id <= 0 ) {
                $item_id = $index + 1;
            }

            $item_views[] = new Item_View(
                id: $item_id,
                thumb_url: (string) ( $item['medium'] ?? $item['thumb'] ?? $item['full'] ?? '' ),
                full_url: (string) ( $item['full'] ?? $item['medium'] ?? '' ),
                alt: (string) ( $item['alt'] ?? '' ),
                title: (string) ( $item['title'] ?? '' ),
                caption: (string) ( $item['caption'] ?? '' ),
                description: (string) ( $item['description'] ?? '' ),
                meta: array()
            );
        }

        return $item_views;
    }


    // render_album() removed — album rendering now goes through the
    // standard Render_Controller pipeline. See album_shortcode() above.

    /**
     * Check if current page has FotoGrids content
     */
    private static function has_fotogrids_content() {
        global $post;

        if ( ! $post ) {
            return false;
        }

        if ( has_shortcode( $post->post_content, 'fotogrids_gallery' ) ||
             has_shortcode( $post->post_content, 'fotogrids_album' ) ) {
            return true;
        }

        if ( function_exists( 'has_block' ) ) {
            if ( has_block( 'fotogrids/gallery', $post ) ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Render test gallery with placeholder items
     */
    private static function render_test_gallery( $atts ) {
        $columns = $atts['cols'] ? absint( $atts['cols'] ) : 3;

        $test_items = array(
            array(
                'id' => 1,
                'title' => 'Test Item 1',
                'alt' => 'Test item 1',
                'caption' => 'This is a test caption',
                'medium' => 'https://picsum.photos/400/400?random=1',
                'full' => 'https://picsum.photos/800/800?random=1',
            ),
            array(
                'id' => 2,
                'title' => 'Test Item 2',
                'alt' => 'Test item 2',
                'caption' => 'Another test caption',
                'medium' => 'https://picsum.photos/400/400?random=2',
                'full' => 'https://picsum.photos/800/800?random=2',
            ),
            array(
                'id' => 3,
                'title' => 'Test Item 3',
                'alt' => 'Test item 3',
                'caption' => 'Third test caption',
                'medium' => 'https://picsum.photos/400/400?random=3',
                'full' => 'https://picsum.photos/800/800?random=3',
            ),
        );

        $test_settings = fotogrids_get_default_gallery_settings();
        $test_responsive_columns = array( 'desktop' => $columns, 'tablet' => $columns, 'mobile' => $columns );
        $test_responsive_spacing = $test_settings['item_spacing'];

        return self::render_template_preview(
            $test_items,
            'grid',
            $test_responsive_columns,
            $test_responsive_spacing,
            $test_settings,
            $atts
        );
    }
}
