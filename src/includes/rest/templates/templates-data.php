<?php
namespace FotoGrids\REST\Templates;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Templates Data Handler
 *
 * Handles template data for REST API endpoints.
 *
 * @since 1.0.0
 */
class Templates_Data {
    
    /**
     * Get available templates
     *
     * Returns a list of all available gallery templates, including both free
     * and premium templates. Template availability depends on license status.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object
     * @return \WP_REST_Response Array of available templates with metadata
     */
    public static function get_templates( $request ) {
        $templates = array(
            array(
                'id' => 'grid',
                'name' => __( 'Grid', 'fotogrids' ),
                'description' => __( 'Simple grid layout', 'fotogrids' ),
                'type' => 'free',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/grid.jpg',
            ),
            array(
                'id' => 'masonry',
                'name' => __( 'Masonry', 'fotogrids' ),
                'description' => __( 'Pinterest-style masonry layout', 'fotogrids' ),
                'type' => 'free',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/masonry.jpg',
            ),
            array(
                'id' => 'justified',
                'name' => __( 'Justified', 'fotogrids' ),
                'description' => __( 'Justified grid with equal heights', 'fotogrids' ),
                'type' => 'free',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/justified.jpg',
            ),
        );
        
        $pro_templates = array(
            array(
                'id' => 'slider',
                'name' => __( 'Slider', 'fotogrids' ),
                'description' => __( 'Item slider with navigation', 'fotogrids' ),
                'type' => 'starter',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/slider.jpg',
            ),
            array(
                'id' => 'polaroid',
                'name' => __( 'Polaroid', 'fotogrids' ),
                'description' => __( 'Polaroid-style photo layout', 'fotogrids' ),
                'type' => 'starter',
                'preview' => FOTOGRIDS_PLUGIN_URL . 'public/assets/previews/polaroid.jpg',
            ),
        );
        
        $templates = array_merge( $templates, $pro_templates );
        
        return rest_ensure_response( array( 'templates' => $templates ) );
    }
}
