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
    private static function render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, $source = Request_Source::SHORTCODE, $is_preview = false ) {
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
            $render_context = $context_builder->build_for_public(
                gallery_id: (int) $gallery_id,
                render_settings: $render_settings,
                collection_item_ids: is_array( $item_ids ) ? array_map( 'absint', $item_ids ) : array(),
                source: $source instanceof Request_Source ? $source : Request_Source::SHORTCODE,
                album_id: absint( $atts['album_id'] ?? 0 ) ?: null
            );
        }

        $render_result = Render_Controller::factory()->render( $render_context );
        return (string) $render_result->html;
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
     * Album shortcode handler
     *
     * @param array $atts Shortcode attributes
     * @return string Rendered album HTML
     */
    public static function album_shortcode( $atts ) {
        $atts = shortcode_atts( array(
            'id' => 0,
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

        $galleries = Gallery_Album_Relations::get_galleries_for_album( $album_id, array(
            'orderby' => 'position',
            'order' => 'ASC',
            'include_meta' => true,
        ) );

        if ( empty( $galleries ) ) {
            return '';
        }

        return self::render_album( $album_id, $galleries, $atts );
    }

    /**
     * Enqueue frontend scripts and styles
     */
    public static function enqueue_frontend_scripts() {
        // Only enqueue if we have FotoGrids content on the page
        if ( ! self::has_fotogrids_content() ) {
            return;
        }

        wp_enqueue_script(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/frontend.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-deep-linking',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/deep-linking.js',
            array( 'fotogrids-frontend' ),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_style(
            'fotogrids-fg-tooltip',
            FOTOGRIDS_PLUGIN_URL . 'assets/css/fg-tooltip.css',
            array(),
            FOTOGRIDS_VERSION
        );

        wp_enqueue_script(
            'fotogrids-fg-tooltip',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/fg-tooltip.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_style(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids.css',
            array(),
            FOTOGRIDS_VERSION
        );

        $sharing          = \FotoGrids\Settings\Sharing_Settings_Store::get();
        $default_settings = fotogrids_get_default_gallery_settings();

        // Flat structure so both index.js and lightbox.js can read top-level keys
        // directly (e.g. window.fotogrids.stats_tracking, not .settings.stats_tracking).
        // lazy_load reflects the site-wide default so the global IntersectionObserver
        // activation path in initializeLazyLoading() matches the rendered output.
        wp_localize_script( 'fotogrids-frontend', 'fotogrids', array(
            'restUrl'               => rest_url( 'fotogrids/v1/' ),
            'nonce'                 => wp_create_nonce( 'wp_rest' ),
            'stats_tracking'        => true,
            'lazy_load'             => (bool) ( $default_settings['lazy_load'] ?? true ),
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


    /**
     * Render album HTML
     */
    private static function render_album( $album_id, $galleries, $atts ) {
        $output = '<div class="fotogrids-album" data-album-id="' . esc_attr( $album_id ) . '">';

        foreach ( $galleries as $gallery ) {
            $thumbnail = get_the_post_thumbnail_url( $gallery->ID, 'medium' );
            $item_count = fotogrids_get_gallery_item_count( $gallery->ID );

            $output .= '<div class="fotogrids-album-item">';

            if ( $thumbnail ) {
                $output .= '<div class="album-thumbnail">';
                $output .= '<img src="' . esc_url( $thumbnail ) . '" alt="' . esc_attr( $gallery->post_title ) . '" />';
                $output .= '</div>';
            }

            $output .= '<div class="album-content">';
            $output .= '<h3 class="album-title">' . esc_html( $gallery->post_title ) . '</h3>';

            if ( $gallery->post_content ) {
                $output .= '<div class="album-description">' . wp_kses_post( $gallery->post_content ) . '</div>';
            }

            $output .= '<div class="album-meta">';
            $output .= sprintf( _n( '%d item', '%d items', $item_count, 'fotogrids' ), $item_count );
            $output .= '</div>';

            // Get album settings to check use_ajax_from_album
            $album_settings = fotogrids_get_album_settings( $album_id );
            $use_ajax = ! empty( $album_settings['use_ajax_from_album'] );

            // Pass album context to gallery shortcode
            $gallery_source = $use_ajax ? Request_Source::ALBUM_AJAX->value : Request_Source::SHORTCODE->value;
            $gallery_shortcode = '[fotogrids_gallery id="' . $gallery->ID . '" album_id="' . $album_id . '" _source="' . esc_attr( $gallery_source ) . '"]';

            if ( $use_ajax ) {
                $output .= '<div class="fotogrids-gallery-placeholder" data-gallery-id="' . esc_attr( $gallery->ID ) . '" data-album-id="' . esc_attr( $album_id ) . '" data-source="' . esc_attr( Request_Source::ALBUM_AJAX->value ) . '"></div>';
            } else {
                $output .= do_shortcode( $gallery_shortcode );
            }

            $output .= '</div>';
            $output .= '</div>';
        }

        $output .= '</div>';

        return $output;
    }

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
