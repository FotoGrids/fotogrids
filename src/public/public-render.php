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
        $defaults = fotogrids_get_default_gallery_settings();
        
        // Start with defaults
        $settings = $defaults;
        
        // Load all saved settings from post meta
        foreach ( $defaults as $key => $default_value ) {
            $saved_value = get_post_meta( $gallery_id, 'fotogrids_' . $key, true );
            
            if ( $saved_value !== '' ) {
                // Try to decode JSON for responsive/complex settings
                if ( is_string( $saved_value ) ) {
                    $decoded = json_decode( $saved_value, true );
                    if ( is_array( $decoded ) ) {
                        // For responsive settings, merge with defaults
                        if ( is_array( $default_value ) ) {
                            $settings[$key] = array_merge( $default_value, $decoded );
                        } else {
                            $settings[$key] = $decoded;
                        }
                    } else {
                        $settings[$key] = $saved_value;
                    }
                } else {
                    $settings[$key] = $saved_value;
                }
            }
        }
        
        return $settings;
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
        ), $atts, 'fotogrids_gallery' );
        
        // Test mode - return a simple test gallery
        if ( $atts['test'] === 'true' ) {
            return self::render_test_gallery( $atts );
        }
        
        $gallery_id = absint( $atts['id'] );
        if ( ! $gallery_id ) {
            return '<div class="fotogrids-error">FotoGrids: No gallery ID specified. Usage: [fotogrids_gallery id="1"] or [fotogrids_gallery test="true"]</div>';
        }
        
        // Get gallery
        $gallery = fotogrids_get_gallery( $gallery_id );
        if ( ! $gallery ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' not found.</div>';
        }
        
        if ( $gallery->post_status !== 'publish' ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' is not published (status: ' . $gallery->post_status . ').</div>';
        }
        
        // Get gallery settings
        $settings = self::get_gallery_settings( $gallery_id );
        
        // Override with shortcode attributes if provided
        $layout = $atts['template'] ?: $settings['layout'];
        $responsive_columns = $atts['cols'] ? 
            array('desktop' => absint($atts['cols']), 'tablet' => absint($atts['cols']), 'mobile' => absint($atts['cols'])) : 
            $settings['columns'];
        $responsive_spacing = $settings['image_spacing'];

        // Get gallery images
        $images = fotogrids_get_gallery_images( $gallery_id );
        if ( empty( $images ) ) {
            return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . $gallery_id . ' exists but has no images.</div>';
        }
        
        // Enqueue specific template assets
        self::enqueue_template_assets( $layout );
        
        // Enqueue lightbox assets if needed
        self::enqueue_lightbox_assets( $settings );
        
        // Render gallery
        return self::render_gallery( $gallery_id, $images, $layout, $responsive_columns, $responsive_spacing, $settings, $atts );
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
        
        // Get album
        $album = fotogrids_get_album( $album_id );
        if ( ! $album || $album->post_status !== 'publish' ) {
            return '';
        }
        
        // Get galleries in album
        $galleries = get_posts( array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => 'publish',
            'numberposts' => -1,
            'meta_query' => array(
                array(
                    'key' => 'fotogrids_album_id',
                    'value' => $album_id,
                    'compare' => '=',
                ),
            ),
        ) );
        
        if ( empty( $galleries ) ) {
            return '';
        }
        
        // Render album
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
        
        // Enqueue main frontend script
        wp_enqueue_script(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/frontend.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );
        
        // Enqueue main frontend styles
        wp_enqueue_style(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids.css',
            array(),
            FOTOGRIDS_VERSION
        );
        
        // Localize script with data
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
        
        // Register gallery block
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
     * Render gallery HTML
     */
    private static function render_gallery( $gallery_id, $images, $layout, $responsive_columns, $responsive_spacing, $settings, $atts ) {
        $classes = array(
            'fotogrids-gallery',
            'fotogrids-layout-' . esc_attr( $layout ),
        );
        
        if ( $atts['lazy'] === 'true' ) {
            $classes[] = 'fotogrids-lazy';
        }
        
        // Add interaction-specific classes
        $click_behavior = $settings['image_click_behavior'] ?? 'lightbox';
        $classes[] = 'fotogrids-click-' . esc_attr( $click_behavior );
        
        if ( $click_behavior === 'lightbox' || $atts['lightbox'] === 'true' ) {
            $classes[] = 'fotogrids-lightbox';
            $classes[] = 'fotogrids-lightbox-theme-' . esc_attr( $settings['lightbox_theme'] ?? 'dark' );
            $classes[] = 'fotogrids-lightbox-transition-' . esc_attr( $settings['lightbox_transition'] ?? 'fade' );
        }
        
        // Generate unique ID for this gallery instance
        $gallery_instance_id = 'fotogrids-gallery-' . $gallery_id . '-' . wp_rand( 1000, 9999 );
        
        // Generate responsive CSS
        $responsive_css = self::generate_responsive_css( $gallery_instance_id, $responsive_columns, $responsive_spacing );
        
        // Prepare data attributes for JavaScript
        $data_attrs = array(
            'data-gallery-id' => esc_attr( $gallery_id ),
            'data-click-behavior' => esc_attr( $click_behavior ),
        );
        
        // Add lightbox-specific data attributes
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
            
            // Handle dots spacing (which can be an array with value and unit)
            $dots_spacing = $settings['lightbox_dots_spacing'] ?? array( 'value' => 8, 'unit' => 'px' );
            if ( is_array( $dots_spacing ) ) {
                $data_attrs['data-lightbox-dots-spacing'] = esc_attr( $dots_spacing['value'] . $dots_spacing['unit'] );
            } else {
                $data_attrs['data-lightbox-dots-spacing'] = esc_attr( $dots_spacing . 'px' );
            }
            
            // Handle custom theme color
            if ( isset( $settings['lightbox_custom_color'] ) && $settings['lightbox_theme'] === 'custom' ) {
                $data_attrs['data-lightbox-custom-color'] = esc_attr( $settings['lightbox_custom_color'] );
            }
        }
        
        // Build data attributes string
        $data_attrs_string = '';
        foreach ( $data_attrs as $attr => $value ) {
            $data_attrs_string .= ' ' . $attr . '="' . $value . '"';
        }
        
        $output = '<style>' . $responsive_css . '</style>';
        $output .= '<div id="' . esc_attr( $gallery_instance_id ) . '" class="' . esc_attr( implode( ' ', $classes ) ) . '"' . $data_attrs_string . '>';
        
        if ( empty( $images ) ) {
            $output .= '<p class="fotogrids-no-images">' . __( 'No images found in this gallery.', 'fotogrids' ) . '</p>';
        } else {
            foreach ( $images as $image ) {
                $output .= self::render_gallery_item( $image, $settings, $atts );
            }
        }
        
        $output .= '</div>';
        
        return $output;
    }
    
    /**
     * Generate responsive CSS for gallery
     * 
     * @param string $gallery_id Gallery instance ID
     * @param array $columns Responsive columns settings
     * @param array $spacing Responsive spacing settings
     * @return string Generated CSS
     */
    private static function generate_responsive_css( $gallery_id, $columns, $spacing ) {
        $css = '';
        
        // Desktop styles (default)
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid { 
            display: grid; 
            grid-template-columns: repeat({$columns['desktop']}, 1fr); 
            gap: {$spacing['desktop']}px; 
        }";
        
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry { 
            column-count: {$columns['desktop']}; 
            column-gap: {$spacing['desktop']}px; 
        }";
        
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-justified { 
            display: flex; 
            flex-wrap: wrap; 
            gap: {$spacing['desktop']}px; 
        }";
        
        // Tablet styles
        $css .= "@media (max-width: 782px) {";
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid { 
            grid-template-columns: repeat({$columns['tablet']}, 1fr); 
            gap: {$spacing['tablet']}px; 
        }";
        
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry { 
            column-count: {$columns['tablet']}; 
            column-gap: {$spacing['tablet']}px; 
        }";
        
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-justified { 
            gap: {$spacing['tablet']}px; 
        }";
        $css .= "}";
        
        // Mobile styles
        $css .= "@media (max-width: 480px) {";
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-grid { 
            grid-template-columns: repeat({$columns['mobile']}, 1fr); 
            gap: {$spacing['mobile']}px; 
        }";
        
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-masonry { 
            column-count: {$columns['mobile']}; 
            column-gap: {$spacing['mobile']}px; 
        }";
        
        $css .= "#{$gallery_id}.fotogrids-gallery.fotogrids-layout-justified { 
            gap: {$spacing['mobile']}px; 
        }";
        $css .= "}";
        
        // Add masonry item styles
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
    private static function render_gallery_item( $image, $settings, $atts ) {
        $classes = array( 'fotogrids-item' );
        $click_behavior = $settings['image_click_behavior'] ?? 'lightbox';
        $classes[] = 'fotogrids-item-' . esc_attr( $click_behavior );
        
        $output = '<figure class="' . esc_attr( implode( ' ', $classes ) ) . '">';
        
        // Image tag
        $img_attrs = array(
            'src' => esc_url( $image['medium'] ),
            'alt' => esc_attr( $image['alt'] ? $image['alt'] : $image['title'] ),
            'data-full' => esc_url( $image['full'] ),
            'data-id' => esc_attr( $image['id'] ),
            'data-click-behavior' => esc_attr( $click_behavior ),
        );
        
        if ( $atts['lazy'] === 'true' ) {
            $img_attrs['loading'] = 'lazy';
        }
        
        // Add click behavior specific attributes
        if ( $click_behavior === 'external' && isset( $image['external_url'] ) ) {
            $img_attrs['data-external-url'] = esc_url( $image['external_url'] );
        }
        
        // Wrap image with appropriate element based on click behavior
        $img_html = '<img';
        foreach ( $img_attrs as $attr => $value ) {
            $img_html .= ' ' . $attr . '="' . $value . '"';
        }
        $img_html .= ' />';
        
        // Handle different click behaviors
        switch ( $click_behavior ) {
            case 'nothing':
                $output .= $img_html;
                break;
                
            case 'direct':
                $output .= '<a href="' . esc_url( $image['full'] ) . '" target="_blank" rel="noopener" class="fotogrids-direct-link">';
                $output .= $img_html;
                $output .= '</a>';
                break;
                
            case 'external':
                if ( isset( $image['external_url'] ) && ! empty( $image['external_url'] ) ) {
                    // Determine target - use image-specific target, then global default, then fallback
                    $target = '_self'; // Default fallback
                    if ( ! empty( $image['link_target'] ) && $image['link_target'] !== 'global' ) {
                        $target = $image['link_target'];
                    } elseif ( isset( $settings['external_link_target'] ) ) {
                        $target = $settings['external_link_target'];
                    }
                    
                    $rel_attr = $target === '_blank' ? ' rel="noopener noreferrer"' : '';
                    $output .= '<a href="' . esc_url( $image['external_url'] ) . '" target="' . esc_attr( $target ) . '"' . $rel_attr . ' class="fotogrids-external-link">';
                    $output .= $img_html;
                    $output .= '</a>';
                } else {
                    // Fallback - do nothing (no click action)
                    $output .= $img_html;
                }
                break;
                
            case 'lightbox':
            default:
                $output .= '<a href="' . esc_url( $image['full'] ) . '" class="fotogrids-lightbox-trigger" data-fotogrids-lightbox>';
                $output .= $img_html;
                $output .= '</a>';
                break;
        }
        
        // Caption
        if ( $atts['captions'] === 'true' && ! empty( $image['caption'] ) ) {
            $output .= '<figcaption class="fotogrids-caption">' . esc_html( $image['caption'] ) . '</figcaption>';
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
            $image_count = fotogrids_get_gallery_image_count( $gallery->ID );
            
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
            $output .= sprintf( _n( '%d image', '%d images', $image_count, 'fotogrids' ), $image_count );
            $output .= '</div>';
            
            // Embed gallery shortcode
            $output .= do_shortcode( '[fotogrids_gallery id="' . $gallery->ID . '"]' );
            
            $output .= '</div>'; // .album-content
            $output .= '</div>'; // .fotogrids-album-item
        }
        
        $output .= '</div>'; // .fotogrids-album
        
        return $output;
    }
    
    /**
     * Enqueue template-specific assets
     */
    private static function enqueue_template_assets( $layout ) {
        // Template-specific CSS
        $template_css = FOTOGRIDS_PLUGIN_URL . 'public/assets/templates/' . $layout . '.css';
        if ( file_exists( FOTOGRIDS_PLUGIN_DIR . 'public/assets/templates/' . $layout . '.css' ) ) {
            wp_enqueue_style(
                'fotogrids-template-' . $layout,
                $template_css,
                array( 'fotogrids-frontend' ),
                FOTOGRIDS_VERSION
            );
        }
        
        // Template-specific JS
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
        $click_behavior = $settings['image_click_behavior'] ?? 'lightbox';
        
        // Only enqueue lightbox assets if this gallery uses lightbox
        if ( $click_behavior === 'lightbox' ) {
            // Enqueue lightbox CSS (compiled by webpack)
            wp_enqueue_style(
                'fotogrids-lightbox',
                FOTOGRIDS_PLUGIN_URL . 'assets/css/lightbox-styles.css',
                array( 'fotogrids-frontend' ),
                FOTOGRIDS_VERSION
            );
            
            // Enqueue lightbox JS (compiled by webpack)
            wp_enqueue_script(
                'fotogrids-lightbox',
                FOTOGRIDS_PLUGIN_URL . 'assets/js/lightbox.js',
                array(),  // No dependencies to avoid loading order issues
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
        
        // Check for shortcodes in content
        if ( has_shortcode( $post->post_content, 'fotogrids_gallery' ) || 
             has_shortcode( $post->post_content, 'fotogrids_album' ) ) {
            return true;
        }
        
        // Check for Gutenberg blocks
        if ( function_exists( 'has_block' ) ) {
            if ( has_block( 'fotogrids/gallery', $post ) ) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Render test gallery with placeholder images
     */
    private static function render_test_gallery( $atts ) {
        $columns = $atts['cols'] ? absint( $atts['cols'] ) : 3;
        
        // Create test images
        $test_images = array(
            array(
                'id' => 1,
                'title' => 'Test Image 1',
                'alt' => 'Test image 1',
                'caption' => 'This is a test caption',
                'medium' => 'https://picsum.photos/400/400?random=1',
                'full' => 'https://picsum.photos/800/800?random=1',
            ),
            array(
                'id' => 2,
                'title' => 'Test Image 2',
                'alt' => 'Test image 2',
                'caption' => 'Another test caption',
                'medium' => 'https://picsum.photos/400/400?random=2',
                'full' => 'https://picsum.photos/800/800?random=2',
            ),
            array(
                'id' => 3,
                'title' => 'Test Image 3',
                'alt' => 'Test image 3',
                'caption' => 'Third test caption',
                'medium' => 'https://picsum.photos/400/400?random=3',
                'full' => 'https://picsum.photos/800/800?random=3',
            ),
        );
        
        // Enqueue assets
        self::enqueue_template_assets( 'grid' );
        
        // Get default settings for test gallery
        $test_settings = fotogrids_get_default_gallery_settings();
        $test_responsive_columns = array( 'desktop' => $columns, 'tablet' => $columns, 'mobile' => $columns );
        $test_responsive_spacing = $test_settings['image_spacing'];
        
        // Enqueue lightbox assets for test gallery
        self::enqueue_lightbox_assets( $test_settings );
        
        return self::render_gallery( 0, $test_images, 'grid', $test_responsive_columns, $test_responsive_spacing, $test_settings, $atts );
    }
}
