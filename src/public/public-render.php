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
        ), $atts, 'fotogrids_gallery' );
        
        $gallery_id = absint( $atts['id'] );
        if ( ! $gallery_id ) {
            return '';
        }
        
        // Get gallery
        $gallery = fotogrids_get_gallery( $gallery_id );
        if ( ! $gallery || $gallery->post_status !== 'publish' ) {
            return '';
        }
        
        // Get gallery settings
        $layout = $atts['template'] ?: (get_post_meta( $gallery_id, 'fotogrids_layout', true ) ?: 'grid');
        $columns = $atts['cols'] ? absint( $atts['cols'] ) : (get_post_meta( $gallery_id, 'fotogrids_columns', true ) ?: 3);
        
        // Get gallery images
        $images = fotogrids_get_gallery_images( $gallery_id );
        if ( empty( $images ) ) {
            return '';
        }
        
        // Enqueue specific template assets
        self::enqueue_template_assets( $layout );
        
        // Render gallery
        return self::render_gallery( $gallery_id, $images, $layout, $atts );
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
    private static function render_gallery( $gallery_id, $images, $layout, $atts ) {
        $classes = array(
            'fotogrids-gallery',
            'fotogrids-layout-' . esc_attr( $layout ),
        );
        
        if ( $atts['lazy'] === 'true' ) {
            $classes[] = 'fotogrids-lazy';
        }
        
        if ( $atts['lightbox'] === 'true' ) {
            $classes[] = 'fotogrids-lightbox';
        }
        
        $output = '<div class="' . esc_attr( implode( ' ', $classes ) ) . '" data-gallery-id="' . esc_attr( $gallery_id ) . '" data-columns="' . esc_attr( $columns ) . '">';
        
        foreach ( $images as $image ) {
            $output .= self::render_gallery_item( $image, $atts );
        }
        
        $output .= '</div>';
        
        return $output;
    }
    
    /**
     * Render individual gallery item
     */
    private static function render_gallery_item( $image, $atts ) {
        $classes = array( 'fotogrids-item' );
        
        $output = '<figure class="' . esc_attr( implode( ' ', $classes ) ) . '">';
        
        // Image tag
        $img_attrs = array(
            'src' => esc_url( $image['medium'] ),
            'alt' => esc_attr( $image['alt'] ? $image['alt'] : $image['title'] ),
            'data-full' => esc_url( $image['full'] ),
            'data-id' => esc_attr( $image['id'] ),
        );
        
        if ( $atts['lazy'] === 'true' ) {
            $img_attrs['loading'] = 'lazy';
        }
        
        $output .= '<img';
        foreach ( $img_attrs as $attr => $value ) {
            $output .= ' ' . $attr . '="' . $value . '"';
        }
        $output .= ' />';
        
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
}
