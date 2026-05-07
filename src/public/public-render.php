<?php
namespace FotoGrids;

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

            $layout = $atts['template'] ?: ( $settings['layout'] ?? 'grid' );
            $responsive_columns = $settings['columns'] ?? array( 'desktop' => 3, 'tablet' => 2, 'mobile' => 1 );
            $responsive_spacing = $settings['item_spacing'] ?? array( 'desktop' => 10, 'tablet' => 8, 'mobile' => 5 );

            if ( ! is_array( $responsive_columns ) ) {
                $responsive_columns = array( 'desktop' => absint( $responsive_columns ), 'tablet' => absint( $responsive_columns ), 'mobile' => absint( $responsive_columns ) );
            }
            if ( ! is_array( $responsive_spacing ) ) {
                $responsive_spacing = array( 'desktop' => absint( $responsive_spacing ), 'tablet' => absint( $responsive_spacing ), 'mobile' => absint( $responsive_spacing ) );
            }

            return self::render_gallery( 0, $items, $layout, $responsive_columns, $responsive_spacing, $settings, $atts );
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

        $layout = $atts['template'] ?: $settings['layout'];
        $responsive_columns = $atts['cols'] ?
            array('desktop' => absint($atts['cols']), 'tablet' => absint($atts['cols']), 'mobile' => absint($atts['cols'])) :
            $settings['columns'];
        $responsive_spacing = $settings['item_spacing'];

        $items = fotogrids_get_gallery_items( $gallery_id );
        if ( empty( $items ) ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' exists but has no items.</div>';
        }

        self::enqueue_template_assets( $layout );

        self::enqueue_lightbox_assets( $settings );

        return self::render_gallery( $gallery_id, $items, $layout, $responsive_columns, $responsive_spacing, $settings, $atts );
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

        wp_enqueue_style(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids.css',
            array(),
            FOTOGRIDS_VERSION
        );

        wp_localize_script( 'fotogrids-frontend', 'fotogrids', array(
            'restUrl' => rest_url( 'fotogrids/v1/' ),
            'nonce' => wp_create_nonce( 'wp_rest' ),
            'settings' => array(
                'lightbox' => true,
                'lazy_load' => true,
                'stats_tracking' => true,
            ),
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

        $layout = isset( $atts['template'] ) && $atts['template'] ? $atts['template'] : $settings['layout'];
        $responsive_columns = isset( $atts['cols'] ) && $atts['cols'] ?
            array('desktop' => absint($atts['cols']), 'tablet' => absint($atts['cols']), 'mobile' => absint($atts['cols'])) :
            $settings['columns'];
        $responsive_spacing = $settings['item_spacing'];

        $atts = shortcode_atts( array(
            'lazy' => 'true',
            'lightbox' => 'true',
            'captions' => 'true',
        ), $atts, 'fotogrids_gallery' );

        $items = fotogrids_get_gallery_items( $gallery_id );
        if ( empty( $items ) ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' exists but has no items.</div>';
        }

        return self::render_gallery( $gallery_id, $items, $layout, $responsive_columns, $responsive_spacing, $settings, $atts );
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
        return self::render_gallery( 0, $items, $layout, $columns, $spacing, $settings, $atts );
    }

    /**
     * Render gallery HTML
     */
    private static function render_gallery( $gallery_id, $items, $layout, $responsive_columns, $responsive_spacing, $settings, $atts ) {
        $classes = array(
            'fotogrids-gallery',
            'fotogrids-layout-' . esc_attr( $layout ),
        );

        if ( $atts['lazy'] === 'true' ) {
            $classes[] = 'fotogrids-lazy';
        }

        $click_behavior = $settings['item_click_behavior'] ?? 'lightbox';
        $classes[] = 'fotogrids-click-' . esc_attr( $click_behavior );

        if ( $click_behavior === 'lightbox' || $atts['lightbox'] === 'true' ) {
            $classes[] = 'fotogrids-lightbox';
            $classes[] = 'fotogrids-lightbox-theme-' . esc_attr( $settings['lightbox_theme'] ?? 'dark' );
            $classes[] = 'fotogrids-lightbox-transition-' . esc_attr( $settings['lightbox_transition'] ?? 'fade' );
        }

        $gallery_instance_id = 'fotogrids-gallery-' . $gallery_id . '-' . wp_rand( 1000, 9999 );

        $columns_mode = $settings['columns_mode'] ?? 'fixed';

        // Get auto columns range settings with units support
        $default_auto_range = array(
            'desktop' => array(
                'min' => array('value' => 200, 'unit' => 'px'),
                'max' => array('value' => 400, 'unit' => 'px')
            ),
            'tablet' => array(
                'min' => array('value' => 180, 'unit' => 'px'),
                'max' => array('value' => 350, 'unit' => 'px')
            ),
            'mobile' => array(
                'min' => array('value' => 100, 'unit' => 'px'),
                'max' => array('value' => 300, 'unit' => 'px')
            )
        );

        $columns_auto_range = $settings['columns_auto_range'] ?? $default_auto_range;

        // Normalize auto columns range
        $columns_auto_range = self::normalize_auto_columns_range( $columns_auto_range, $default_auto_range );

        $responsive_css = self::generate_responsive_css( $gallery_instance_id, $layout, $responsive_columns, $responsive_spacing, $columns_mode, $columns_auto_range );

        $hover_effect = $settings['hover_effect'] ?? 'none';
        $hover_effect_css = '';
        if ( $hover_effect && $hover_effect !== 'none' ) {
            $hover_effect_css = Hover_Effects_CSS::get_effect_css( $gallery_instance_id, $hover_effect, $settings );
        }

        $pagination_type = $settings['pagination_type'] ?? 'show_all';
        $pagination_method = $settings['pagination_method'] ?? 'load_more';
        $items_per_page = absint( $settings['items_per_page'] ?? 12 );
        $total_items = count( $items );
        $total_pages = 1;
        $displayed_items = $items;

        if ( $pagination_type === 'paginated' && $items_per_page > 0 ) {
            $total_pages = ceil( $total_items / $items_per_page );
            $displayed_items = array_slice( $items, 0, $items_per_page );

            $classes[] = 'fotogrids-paginated';
            $classes[] = 'fotogrids-pagination-' . esc_attr( $pagination_method );
        }

        // Prepare data attributes for JavaScript
        $data_attrs = array(
            'data-gallery-id' => esc_attr( $gallery_id ),
            'data-click-behavior' => esc_attr( $click_behavior ),
            'data-hover-cursor' => esc_attr( $settings['hover_cursor_icon'] ?? 'pointer' ),
        );

        if ( $pagination_type === 'paginated' ) {
            $data_attrs['data-pagination-type'] = esc_attr( $pagination_type );
            $data_attrs['data-pagination-method'] = esc_attr( $pagination_method );
            $data_attrs['data-items-per-page'] = esc_attr( $items_per_page );
            $data_attrs['data-total-items'] = esc_attr( $total_items );
            $data_attrs['data-total-pages'] = esc_attr( $total_pages );
            $data_attrs['data-current-page'] = '1';
        }

        if ( $click_behavior === 'lightbox' || $atts['lightbox'] === 'true' ) {
            $data_attrs['data-lightbox-theme'] = esc_attr( $settings['lightbox_theme'] ?? 'dark' );
            $data_attrs['data-lightbox-transition'] = esc_attr( $settings['lightbox_transition'] ?? 'fade' );
            $data_attrs['data-lightbox-duration'] = esc_attr( $settings['lightbox_transition_duration'] ?? 300 );
            $data_attrs['data-lightbox-auto-progress'] = esc_attr( $settings['lightbox_auto_progress'] ? 'true' : 'false' );
            $data_attrs['data-lightbox-auto-delay'] = esc_attr( $settings['lightbox_auto_progress_delay'] ?? 5 );
            $data_attrs['data-lightbox-fit-media'] = esc_attr( $settings['lightbox_fit_media'] ? 'true' : 'false' );
            $data_attrs['data-lightbox-mobile-layout'] = esc_attr( $settings['lightbox_mobile_layout'] ?? 'mobile_optimized' );
            $data_attrs['data-lightbox-show-arrows'] = esc_attr( $settings['lightbox_show_arrows'] ? 'true' : 'false' );
            $data_attrs['data-lightbox-arrow-icon'] = esc_attr( $settings['lightbox_arrow_icon'] ?? 'chevron' );
            $data_attrs['data-lightbox-arrow-size'] = esc_attr( $settings['lightbox_arrow_size'] ?? 40 );
            $data_attrs['data-lightbox-arrow-color'] = esc_attr( $settings['lightbox_arrow_color'] ?? '#ffffff' );
            $data_attrs['data-lightbox-show-dots'] = esc_attr( $settings['lightbox_show_dots'] ? 'true' : 'false' );
            $data_attrs['data-lightbox-dot-style'] = esc_attr( $settings['lightbox_dot_style'] ?? 'fill' );
            $data_attrs['data-lightbox-dot-color'] = esc_attr( $settings['lightbox_dot_color'] ?? '#ffffff' );
            $data_attrs['data-lightbox-active-dot-color'] = esc_attr( $settings['lightbox_active_dot_color'] ?? '#007cba' );

            $dots_spacing = $settings['lightbox_dots_spacing'] ?? array( 'value' => 8, 'unit' => 'px' );
            if ( is_array( $dots_spacing ) ) {
                $data_attrs['data-lightbox-dots-spacing'] = esc_attr( $dots_spacing['value'] . $dots_spacing['unit'] );
            } else {
                $data_attrs['data-lightbox-dots-spacing'] = esc_attr( $dots_spacing . 'px' );
            }

            if ( isset( $settings['lightbox_custom_color'] ) && $settings['lightbox_theme'] === 'custom' ) {
                $data_attrs['data-lightbox-custom-color'] = esc_attr( $settings['lightbox_custom_color'] );
            }

            $data_attrs['data-lightbox-thumbnail-strip-location'] = esc_attr( $settings['lightbox_thumbnail_strip_location'] ?? 'bottom' );
            $data_attrs['data-lightbox-thumbnail-size'] = esc_attr( $settings['lightbox_thumbnail_size'] ?? 'normal' );
        }

        // Build data attributes string
        $data_attrs_string = '';
        foreach ( $data_attrs as $attr => $value ) {
            $data_attrs_string .= ' ' . $attr . '="' . $value . '"';
        }

        $hover_cursor = $settings['hover_cursor_icon'] ?? 'pointer';
        $cursor_css = self::generate_cursor_css( $gallery_instance_id, $hover_cursor );

        $output = '<style>' . $responsive_css . $hover_effect_css . $cursor_css . '</style>';
        $output .= '<div id="' . esc_attr( $gallery_instance_id ) . '" class="' . esc_attr( implode( ' ', $classes ) ) . '"' . $data_attrs_string . '>';

        $output .= '<div class="fotogrids-gallery-items">';

        if ( empty( $displayed_items ) ) {
            $output .= '<p class="fotogrids-no-items">' . __( 'No items found in this gallery.', 'fotogrids' ) . '</p>';
        } else {
            foreach ( $displayed_items as $item ) {
                $output .= self::render_gallery_item( $item, $settings, $atts );
            }
        }

        $output .= '</div>';

        if ( $pagination_type === 'paginated' && $total_pages > 1 ) {
            $output .= self::render_pagination_controls( $gallery_instance_id, $pagination_method, $total_pages, 1 );
        }

        $output .= '</div>';

        return $output;
    }

    /**
     * Render pagination controls
     *
     * @param string $gallery_instance_id Gallery instance ID
     * @param string $method Pagination method (load_more, endless_scroll, pages)
     * @param int $total_pages Total number of pages
     * @param int $current_page Current page number
     * @return string HTML for pagination controls
     */
    private static function render_pagination_controls( $gallery_instance_id, $method, $total_pages, $current_page = 1 ) {
        $output = '';

        switch ( $method ) {
            case 'load_more':
                if ( $current_page < $total_pages ) {
                    $output .= '<div class="fotogrids-pagination fotogrids-pagination-load-more">';
                    $output .= '<button type="button" class="fotogrids-load-more-button" data-gallery-instance="' . esc_attr( $gallery_instance_id ) . '">';
                    $output .= '<span class="fotogrids-load-more-text">' . esc_html__( 'Load More', 'fotogrids' ) . '</span>';
                    $output .= '<span class="fotogrids-load-more-loading" style="display: none;">' . esc_html__( 'Loading...', 'fotogrids' ) . '</span>';
                    $output .= '</button>';
                    $output .= '</div>';
                }
                break;

            case 'pages':
                $output .= '<div class="fotogrids-pagination fotogrids-pagination-pages">';
                $output .= '<nav class="fotogrids-page-navigation" role="navigation" aria-label="' . esc_attr__( 'Gallery Pagination', 'fotogrids' ) . '">';

                if ( $current_page > 1 ) {
                    $output .= '<button type="button" class="fotogrids-page-button fotogrids-page-prev" data-page="' . esc_attr( $current_page - 1 ) . '" data-gallery-instance="' . esc_attr( $gallery_instance_id ) . '">';
                    $output .= '<span class="fotogrids-page-button-text">' . esc_html__( 'Previous', 'fotogrids' ) . '</span>';
                    $output .= '</button>';
                }

                $output .= '<div class="fotogrids-page-numbers">';
                $max_pages_to_show = 7;
                $half_range = floor( $max_pages_to_show / 2 );

                $start_page = max( 1, $current_page - $half_range );
                $end_page = min( $total_pages, $current_page + $half_range );

                if ( $start_page > 1 ) {
                    $output .= '<button type="button" class="fotogrids-page-button fotogrids-page-number' . ( 1 === $current_page ? ' fg-is-active' : '' ) . '" data-page="1" data-gallery-instance="' . esc_attr( $gallery_instance_id ) . '">1</button>';
                    if ( $start_page > 2 ) {
                        $output .= '<span class="fotogrids-page-ellipsis">...</span>';
                    }
                }

                for ( $i = $start_page; $i <= $end_page; $i++ ) {
                    $output .= '<button type="button" class="fotogrids-page-button fotogrids-page-number' . ( $i === $current_page ? ' fg-is-active' : '' ) . '" data-page="' . esc_attr( $i ) . '" data-gallery-instance="' . esc_attr( $gallery_instance_id ) . '">' . esc_html( $i ) . '</button>';
                }

                if ( $end_page < $total_pages ) {
                    if ( $end_page < $total_pages - 1 ) {
                        $output .= '<span class="fotogrids-page-ellipsis">...</span>';
                    }
                    $output .= '<button type="button" class="fotogrids-page-button fotogrids-page-number' . ( $total_pages === $current_page ? ' fg-is-active' : '' ) . '" data-page="' . esc_attr( $total_pages ) . '" data-gallery-instance="' . esc_attr( $gallery_instance_id ) . '">' . esc_html( $total_pages ) . '</button>';
                }

                $output .= '</div>';

                if ( $current_page < $total_pages ) {
                    $output .= '<button type="button" class="fotogrids-page-button fotogrids-page-next" data-page="' . esc_attr( $current_page + 1 ) . '" data-gallery-instance="' . esc_attr( $gallery_instance_id ) . '">';
                    $output .= '<span class="fotogrids-page-button-text">' . esc_html__( 'Next', 'fotogrids' ) . '</span>';
                    $output .= '</button>';
                }

                $output .= '</nav>';
                $output .= '</div>';
                break;

            case 'endless_scroll':
                if ( $current_page < $total_pages ) {
                    $output .= '<div class="fotogrids-pagination fotogrids-pagination-endless-scroll">';
                    $output .= '<div class="fotogrids-endless-scroll-loader" style="display: none;">';
                    $output .= '<span class="fotogrids-loading-spinner"></span>';
                    $output .= '<span class="fotogrids-loading-text">' . esc_html__( 'Loading more items...', 'fotogrids' ) . '</span>';
                    $output .= '</div>';
                    $output .= '</div>';
                }
                break;
        }

        return $output;
    }

    /**
     * Normalize responsive value with units
     * Handles both old format (plain numbers) and new format (objects with value/unit)
     *
     * @param array $value The value to normalize
     * @param array $defaults Default values with units
     * @return array Normalized values with units
     */
    private static function normalize_responsive_value_with_units( $value, $defaults ) {
        $normalized = array();
        foreach ( array( 'desktop', 'tablet', 'mobile' ) as $device ) {
            $device_value = $value[ $device ] ?? $defaults[ $device ];

            // If it's already an object with value and unit, use it
            if ( is_array( $device_value ) && isset( $device_value['value'] ) && isset( $device_value['unit'] ) ) {
                $normalized[ $device ] = $device_value;
            } else {
                // Old format - plain number, convert to object with default unit
                $normalized[ $device ] = array(
                    'value' => is_numeric( $device_value ) ? $device_value : $defaults[ $device ]['value'],
                    'unit' => $defaults[ $device ]['unit']
                );
            }
        }
        return $normalized;
    }

    /**
     * Normalize auto columns range
     *
     * @param array $value The value to normalize
     * @param array $defaults Default values
     * @return array Normalized range with min/max
     */
    private static function normalize_auto_columns_range( $value, $defaults ) {
        $normalized = array();
        foreach ( array( 'desktop', 'tablet', 'mobile' ) as $device ) {
            $device_value = $value[ $device ] ?? $defaults[ $device ];

            // Normalize min
            if ( isset( $device_value['min'] ) && is_array( $device_value['min'] ) && isset( $device_value['min']['value'] ) && isset( $device_value['min']['unit'] ) ) {
                $normalized[ $device ]['min'] = $device_value['min'];
            } else {
                $normalized[ $device ]['min'] = $defaults[ $device ]['min'];
            }

            // Normalize max
            if ( isset( $device_value['max'] ) && is_array( $device_value['max'] ) && isset( $device_value['max']['value'] ) && isset( $device_value['max']['unit'] ) ) {
                $normalized[ $device ]['max'] = $device_value['max'];
            } else {
                $normalized[ $device ]['max'] = $defaults[ $device ]['max'];
            }
        }
        return $normalized;
    }

    /**
     * Get value with unit as string
     *
     * @param array|string|int $value Value (object with value/unit, or plain number/string)
     * @return string Value with unit (e.g., "200px", "1.5em")
     */
    private static function get_value_with_unit( $value ) {
        if ( is_array( $value ) && isset( $value['value'] ) && isset( $value['unit'] ) ) {
            return $value['value'] . $value['unit'];
        } elseif ( is_numeric( $value ) ) {
            return $value . 'px';
        } else {
            return '200px';
        }
    }

    /**
     * Generate CSS for hover cursor icon
     *
     * @param string $gallery_id Gallery instance ID
     * @param string $cursor_type Cursor type (default, pointer, alias, zoom-in, crosshair)
     * @return string CSS for cursor
     */
    private static function generate_cursor_css( $gallery_id, $cursor_type ) {
        $cursor_map = array(
            'default' => 'default',
            'pointer' => 'pointer',
            'alias' => 'alias',
            'zoom-in' => 'zoom-in',
            'crosshair' => 'crosshair',
        );

        $cursor_value = isset( $cursor_map[ $cursor_type ] ) ? $cursor_map[ $cursor_type ] : 'pointer';

        return '#' . esc_attr( $gallery_id ) . ' .fotogrids-item { cursor: ' . esc_attr( $cursor_value ) . '; }';
    }

    /**
     * Generate responsive CSS for gallery
     *
     * @param string $gallery_id Gallery instance ID
     * @param string $layout Layout type
     * @param array $columns Responsive columns settings
     * @param array $spacing Responsive spacing settings
     * @param string $columns_mode Columns mode ('fixed' or 'auto')
     * @param array $columns_auto_range Auto columns range (min/max) with units
     * @return string Generated CSS
     */
    private static function generate_responsive_css( $gallery_id, $layout, $columns, $spacing, $columns_mode = 'fixed', $columns_auto_range = array() ) {
        $css = '';

        // Grid layout
        if ( $layout === 'grid' ) {
            if ( $columns_mode === 'auto' ) {
                // Auto columns mode - use CSS Grid auto-fit with minmax
                // Extract value and unit for each device from the range
                $default_range = array(
                    'desktop' => array('min' => array('value' => 200, 'unit' => 'px'), 'max' => array('value' => 400, 'unit' => 'px')),
                    'tablet' => array('min' => array('value' => 180, 'unit' => 'px'), 'max' => array('value' => 350, 'unit' => 'px')),
                    'mobile' => array('min' => array('value' => 100, 'unit' => 'px'), 'max' => array('value' => 300, 'unit' => 'px'))
                );

                $range = ! empty( $columns_auto_range ) ? $columns_auto_range : $default_range;

                $min_desktop = self::get_value_with_unit( $range['desktop']['min'] ?? $default_range['desktop']['min'] );
                $max_desktop = self::get_value_with_unit( $range['desktop']['max'] ?? $default_range['desktop']['max'] );
                $min_tablet = self::get_value_with_unit( $range['tablet']['min'] ?? $default_range['tablet']['min'] );
                $max_tablet = self::get_value_with_unit( $range['tablet']['max'] ?? $default_range['tablet']['max'] );

                $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax({$min_desktop}, {$max_desktop}));
                    gap: {$spacing['desktop']}px;
                    justify-content: center;
                }";

                $css .= "@media (max-width: 782px) {";
                $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid {
                    grid-template-columns: repeat(auto-fit, minmax({$min_tablet}, {$max_tablet}));
                    gap: {$spacing['tablet']}px;
                }";
                $css .= "}";

                $css .= "@media (max-width: 480px) {";
                $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid {
                    grid-template-columns: 1fr;
                    gap: {$spacing['mobile']}px;
                }";
                $css .= "}";
            } else {
                // Fixed columns mode - original behavior
                $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid {
                    display: grid;
                    grid-template-columns: repeat({$columns['desktop']}, 1fr);
                    gap: {$spacing['desktop']}px;
                }";

                $css .= "@media (max-width: 782px) {";
                $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid {
                    grid-template-columns: repeat({$columns['tablet']}, 1fr);
                    gap: {$spacing['tablet']}px;
                }";
                $css .= "}";

                $css .= "@media (max-width: 480px) {";
                $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid {
                    grid-template-columns: repeat({$columns['mobile']}, 1fr);
                    gap: {$spacing['mobile']}px;
                }";
                $css .= "}";
            }
        }

        // Masonry layout (columns still used for column-count)
        if ( $layout === 'masonry' ) {
            $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry {
                column-count: {$columns['desktop']};
                column-gap: {$spacing['desktop']}px;
            }";

            $css .= "@media (max-width: 782px) {";
            $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry {
                column-count: {$columns['tablet']};
                column-gap: {$spacing['tablet']}px;
            }";
            $css .= "}";

            $css .= "@media (max-width: 480px) {";
            $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry {
                column-count: {$columns['mobile']};
                column-gap: {$spacing['mobile']}px;
            }";
            $css .= "}";
        }

        // Justified layout (columns not used)
        if ( $layout === 'justified' ) {
            $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-justified {
                display: flex;
                flex-wrap: wrap;
                gap: {$spacing['desktop']}px;
            }";

            $css .= "@media (max-width: 782px) {";
            $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-justified {
                gap: {$spacing['tablet']}px;
            }";
            $css .= "}";

            $css .= "@media (max-width: 480px) {";
            $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-justified {
                gap: {$spacing['mobile']}px;
            }";
            $css .= "}";
        }

        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry .fotogrids-gallery-item {
            break-inside: avoid;
            margin-bottom: {$spacing['desktop']}px;
        }";

        $css .= "@media (max-width: 782px) {";
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry .fotogrids-gallery-item {
            margin-bottom: {$spacing['tablet']}px;
        }";
        $css .= "}";

        $css .= "@media (max-width: 480px) {";
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry .fotogrids-gallery-item {
            margin-bottom: {$spacing['mobile']}px;
        }";
        $css .= "}";

        return $css;
    }

    /**
     * Render individual gallery item
     */
    private static function render_gallery_item( $item, $settings, $atts ) {
        $classes = array( 'fotogrids-item', 'fotogrids-gallery-item' );
        $click_behavior = $settings['item_click_behavior'] ?? 'lightbox';
        $classes[] = 'fotogrids-item-' . esc_attr( $click_behavior );

        $hover_effect = $settings['hover_effect'] ?? 'none';
        if ( $hover_effect && $hover_effect !== 'none' ) {
            $effect_map = array(
                'slide-up' => 'fotogrids-hover-slide-up',
                'fade-both' => 'fotogrids-hover-fade-both',
                'slide-left' => 'fotogrids-hover-slide-left',
                'scale' => 'fotogrids-hover-scale',
                'rotate' => 'fotogrids-hover-rotate',
                'slide-right' => 'fotogrids-hover-slide-right',
                'bounce' => 'fotogrids-hover-bounce',
                'slide-down' => 'fotogrids-hover-slide-down',
                'opacity' => 'fotogrids-hover-opacity',
                'blur' => 'fotogrids-hover-blur',
                'slide-diagonal' => 'fotogrids-hover-slide-diagonal',
                'pulse' => 'fotogrids-hover-pulse',
                'zoom' => 'fotogrids-hover-zoom',
                'flip' => 'fotogrids-hover-flip',
                '3d' => 'fotogrids-hover-3d',
                'gradient' => 'fotogrids-hover-gradient',
                'shine' => 'fotogrids-hover-shine',
                'morph' => 'fotogrids-hover-morph',
                'glitch' => 'fotogrids-hover-glitch',
                'ripple' => 'fotogrids-hover-ripple',
                'shadow' => 'fotogrids-hover-shadow',
                'border' => 'fotogrids-hover-border',
                'glow' => 'fotogrids-hover-glow',
                'split' => 'fotogrids-hover-split',
                'reveal' => 'fotogrids-hover-reveal',
                'slide-rotate' => 'fotogrids-hover-slide-rotate',
                'elastic' => 'fotogrids-hover-elastic',
                'wobble' => 'fotogrids-hover-wobble',
                'shake' => 'fotogrids-hover-shake',
                'spin' => 'fotogrids-hover-spin',
                'flash' => 'fotogrids-hover-flash',
                'wave' => 'fotogrids-hover-wave',
                'spiral' => 'fotogrids-hover-spiral',
                'matrix' => 'fotogrids-hover-matrix',
                'neon' => 'fotogrids-hover-neon',
                'hologram' => 'fotogrids-hover-hologram',
            );

            if ( isset( $effect_map[ $hover_effect ] ) ) {
                $classes[] = $effect_map[ $hover_effect ];
            }
        }

        $output = '<figure class="' . esc_attr( implode( ' ', $classes ) ) . '">';

        $img_attrs = array(
            'src' => esc_url( $item['medium'] ),
            'alt' => esc_attr( $item['alt'] ? $item['alt'] : $item['title'] ),
            'data-full' => esc_url( $item['full'] ),
            'data-id' => esc_attr( $item['id'] ),
            'data-click-behavior' => esc_attr( $click_behavior ),
        );

        if ( $atts['lazy'] === 'true' ) {
            $img_attrs['loading'] = 'lazy';
        }

        if ( $click_behavior === 'external' && isset( $item['external_url'] ) ) {
            $img_attrs['data-external-url'] = esc_url( $item['external_url'] );
        }

        $img_html = '<img';
        foreach ( $img_attrs as $attr => $value ) {
            $img_html .= ' ' . $attr . '="' . $value . '"';
        }
        $img_html .= ' />';

        switch ( $click_behavior ) {
            case 'nothing':
                $output .= $img_html;
                break;

            case 'direct':
                $output .= '<a href="' . esc_url( $item['full'] ) . '" target="_blank" rel="noopener" class="fotogrids-direct-link">';
                $output .= $img_html;
                $output .= '</a>';
                break;

            case 'external':
                if ( isset( $item['external_url'] ) && ! empty( $item['external_url'] ) ) {
                    $target = '_self';
                    if ( ! empty( $item['link_target'] ) && $item['link_target'] !== 'global' ) {
                        $target = $item['link_target'];
                    } elseif ( isset( $settings['external_link_target'] ) ) {
                        $target = $settings['external_link_target'];
                    }

                    $rel_attr = $target === '_blank' ? ' rel="noopener noreferrer"' : '';
                    $output .= '<a href="' . esc_url( $item['external_url'] ) . '" target="' . esc_attr( $target ) . '"' . $rel_attr . ' class="fotogrids-external-link">';
                    $output .= $img_html;
                    $output .= '</a>';
                } else {
                    $output .= $img_html;
                }
                break;

            case 'lightbox':
            default:
                $output .= '<a href="' . esc_url( $item['full'] ) . '" class="fotogrids-lightbox-trigger" data-fotogrids-lightbox>';
                $output .= $img_html;
                $output .= '</a>';
                break;
        }

        if ( $atts['captions'] === 'true' && ! empty( $item['caption'] ) ) {
            $output .= '<figcaption class="fotogrids-caption">' . esc_html( $item['caption'] ) . '</figcaption>';
        }

        $output .= '</figure>';

        return $output;
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
            $gallery_shortcode = '[fotogrids_gallery id="' . $gallery->ID . '" album_id="' . $album_id . '"]';

            if ( $use_ajax ) {
                // If AJAX is enabled, render a placeholder that will be loaded via AJAX
                $output .= '<div class="fotogrids-gallery-placeholder" data-gallery-id="' . esc_attr( $gallery->ID ) . '" data-album-id="' . esc_attr( $album_id ) . '"></div>';
            } else {
                // Render gallery directly
                $output .= do_shortcode( $gallery_shortcode );
            }

            $output .= '</div>';
            $output .= '</div>';
        }

        $output .= '</div>';

        return $output;
    }

    /**
     * Enqueue template-specific assets
     */
    private static function enqueue_template_assets( $layout ) {
        $template_css = FOTOGRIDS_PLUGIN_URL . 'public/assets/templates/' . $layout . '.css';
        if ( file_exists( FOTOGRIDS_PLUGIN_DIR . 'public/assets/templates/' . $layout . '.css' ) ) {
            wp_enqueue_style(
                'fotogrids-template-' . $layout,
                $template_css,
                array( 'fotogrids-frontend' ),
                FOTOGRIDS_VERSION
            );
        }

        $template_js = FOTOGRIDS_PLUGIN_URL . 'public/assets/templates/' . $layout . '.js';
        if ( file_exists( FOTOGRIDS_PLUGIN_DIR . 'public/assets/templates/' . $layout . '.js' ) ) {
            wp_enqueue_script(
                'fotogrids-template-' . $layout,
                $template_js,
                array( 'fotogrids-frontend' ),
                FOTOGRIDS_VERSION,
                true
            );
        }
    }

    /**
     * Enqueue lightbox assets if needed
     *
     * @param array $settings Gallery settings
     */
    private static function enqueue_lightbox_assets( $settings ) {
        $click_behavior = $settings['item_click_behavior'] ?? 'lightbox';

        if ( $click_behavior === 'lightbox' ) {
            wp_enqueue_style(
                'fotogrids-lightbox',
                FOTOGRIDS_PLUGIN_URL . 'assets/css/lightbox-styles.css',
                array( 'fotogrids-frontend' ),
                FOTOGRIDS_VERSION
            );

            wp_enqueue_script(
                'fotogrids-lightbox',
                FOTOGRIDS_PLUGIN_URL . 'assets/js/lightbox.js',
                array(),
                FOTOGRIDS_VERSION,
                true
            );
        }
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

        self::enqueue_template_assets( 'grid' );

        $test_settings = fotogrids_get_default_gallery_settings();
        $test_responsive_columns = array( 'desktop' => $columns, 'tablet' => $columns, 'mobile' => $columns );
        $test_responsive_spacing = $test_settings['item_spacing'];

        self::enqueue_lightbox_assets( $test_settings );

        return self::render_gallery( 0, $test_items, 'grid', $test_responsive_columns, $test_responsive_spacing, $test_settings, $atts );
    }
}
