<?php
/**
 * Helper Functions for FotoGrids
 * 
 * Global utility functions that can be used throughout the plugin
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Check if FotoGrids is active and properly initialized
 * 
 * @return bool
 */
function fotogrids_is_active() {
    return defined( 'FOTOGRIDS_VERSION' );
}

/**
 * Get FotoGrids plugin version
 * 
 * @return string
 */
function fotogrids_get_version() {
    return defined( 'FOTOGRIDS_VERSION' ) ? FOTOGRIDS_VERSION : '0.0.0';
}

/**
 * Check if user has FotoGrids capability
 * 
 * @param string $capability The capability to check
 * @return bool
 */
function fotogrids_user_can( $capability ) {
    return current_user_can( $capability );
}

/**
 * Get gallery by ID with validation
 * 
 * @param int $gallery_id Gallery ID
 * @return WP_Post|null Gallery post or null if not found/invalid
 */
function fotogrids_get_gallery( $gallery_id ) {
    $gallery = get_post( $gallery_id );
    
    if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
        return null;
    }
    
    return $gallery;
}

/**
 * Get album by ID with validation
 * 
 * @param int $album_id Album ID
 * @return WP_Post|null Album post or null if not found/invalid
 */
function fotogrids_get_album( $album_id ) {
    $album = get_post( $album_id );
    
    if ( ! $album || $album->post_type !== 'fotogrids_album' ) {
        return null;
    }
    
    return $album;
}

/**
 * Get default gallery settings
 * 
 * @return array Default settings structure
 */
function fotogrids_get_default_gallery_settings() {
    return array(
        'layout' => 'grid',
        'columns' => array(
            'desktop' => 4,
            'tablet' => 3,
            'mobile' => 2
        ),
        'image_spacing' => array(
            'desktop' => 10,
            'tablet' => 8,
            'mobile' => 5
        ),
        'hover_effects' => false,
        'lightbox' => true,
        'captions' => true,
        'lazy_loading' => true,
        'border_radius' => array(
            'desktop' => 4,
            'tablet' => 4,
            'mobile' => 4
        ),
        'shadow_intensity' => 0,
        'animation_speed' => 300,
        'load_more' => false,
        'infinite_scroll' => false,
        'filter_buttons' => false,
        
        // Interactions settings
        'image_click_behavior' => 'lightbox',
        
        // Lightbox General settings
        'lightbox_theme' => 'dark',
        'lightbox_custom_color' => '#000000',
        'lightbox_transition' => 'fade',
        'lightbox_transition_duration' => 300,
        'lightbox_auto_progress' => true,
        'lightbox_auto_progress_delay' => 5,
        'lightbox_fit_media' => true,
        'lightbox_mobile_layout' => 'mobile_optimized',
        
        // Lightbox Controls settings
        'lightbox_show_arrows' => true,
        'lightbox_arrow_icon' => 'chevron',
        'lightbox_arrow_size' => 40,
        'lightbox_arrow_color' => '#ffffff',
        'lightbox_show_dots' => false,
        'lightbox_dot_style' => 'fill',
        'lightbox_dot_color' => '#ffffff',
        'lightbox_active_dot_color' => '#007cba',
        'lightbox_dots_spacing' => array(
            'value' => 8,
            'unit' => 'px'
        )
    );
}

/**
 * Helper function to decode gallery image IDs from post meta
 * 
 * @param int $gallery_id Gallery ID
 * @return array Array of image IDs
 */
function fotogrids_get_gallery_image_ids( $gallery_id ) {
    $image_ids = get_post_meta( $gallery_id, 'fotogrids_gallery_images', true );
    
    // If it's a JSON string, decode it
    if ( is_string( $image_ids ) ) {
        $decoded = json_decode( $image_ids, true );
        if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) {
            return array_map( 'intval', $decoded ); // Ensure all IDs are integers
        }
    } elseif ( is_array( $image_ids ) ) {
        return array_map( 'intval', $image_ids );
    }
    
    return array();
}

/**
 * Get gallery images with metadata
 * 
 * @param int $gallery_id Gallery ID
 * @return array Array of image data
 */
function fotogrids_get_gallery_images( $gallery_id ) {
    $image_ids = fotogrids_get_gallery_image_ids( $gallery_id );
    
    if ( empty( $image_ids ) ) {
        return array();
    }

    global $wpdb;
    $images = array();
    $position = 0;

    foreach ( $image_ids as $attachment_id ) {
        $attachment_id = (int) $attachment_id;
        $attachment = get_post( $attachment_id );

        if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
            continue;
        }

        $table = $wpdb->prefix . 'fotogrids_image_meta';
        $custom_meta = $wpdb->get_row( 
            $wpdb->prepare( 
                "SELECT * FROM $table WHERE gallery_id = %d AND attachment_id = %d", 
                $gallery_id, 
                $attachment_id 
            ), 
            ARRAY_A 
        );

        $image_data = array(
            'id' => $attachment_id,
            'gallery_id' => (int) $gallery_id,
            'position' => $custom_meta ? (int) $custom_meta['position'] : $position,
            'caption' => $custom_meta ? $custom_meta['caption'] : $attachment->post_excerpt,
            'description' => $custom_meta ? $custom_meta['description'] : $attachment->post_content,
            'location' => $custom_meta ? $custom_meta['location'] : '',
            'exif_data' => $custom_meta && $custom_meta['exif_data'] ? json_decode( $custom_meta['exif_data'], true ) : null,
            'custom_data' => $custom_meta && $custom_meta['custom_data'] ? json_decode( $custom_meta['custom_data'], true ) : null,
            'url' => wp_get_attachment_url( $attachment_id ),
            'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
            'medium' => wp_get_attachment_image_url( $attachment_id, 'medium' ),
            'large' => wp_get_attachment_image_url( $attachment_id, 'large' ),
            'full' => wp_get_attachment_url( $attachment_id ),
            'alt' => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
            'title' => $attachment->post_title,
        );

        $images[] = $image_data;
        $position++;
    }

    usort( $images, function( $a, $b ) {
        return $a['position'] - $b['position'];
    });

    return $images;
}

/**
 * Get gallery image count
 * 
 * @param int $gallery_id Gallery ID
 * @return int Number of images in gallery
 */
function fotogrids_get_gallery_image_count( $gallery_id ) {
    $image_ids = fotogrids_get_gallery_image_ids( $gallery_id );
    
    if ( empty( $image_ids ) ) {
        return 0;
    }
    
    // Count only valid attachment IDs
    $count = 0;
    foreach ( $image_ids as $attachment_id ) {
        $attachment = get_post( (int) $attachment_id );
        if ( $attachment && $attachment->post_type === 'attachment' ) {
            $count++;
        }
    }
    
    return $count;
}

/**
 * Add image to gallery
 * 
 * @param int $gallery_id Gallery ID
 * @param int $attachment_id Attachment ID
 * @param array $meta Image metadata
 * @return bool Success status
 */
function fotogrids_add_image_to_gallery( $gallery_id, $attachment_id, $meta = array() ) {
    global $wpdb;
    
    // Validate gallery exists
    if ( ! fotogrids_get_gallery( $gallery_id ) ) {
        return false;
    }
    
    // Validate attachment exists
    if ( ! get_post( $attachment_id ) ) {
        return false;
    }
    
    // Get current image IDs from post meta
    $image_ids = fotogrids_get_gallery_image_ids( $gallery_id );
    
    // Check if image is already in gallery
    if ( in_array( $attachment_id, $image_ids ) ) {
        return false; // Image already in gallery
    }
    
    // Add image ID to the gallery
    $image_ids[] = (int) $attachment_id;
    $post_meta_result = update_post_meta( $gallery_id, 'fotogrids_gallery_images', wp_json_encode( $image_ids ) );
    
    // If meta is provided, also store in custom table
    if ( ! empty( $meta ) ) {
        $table = $wpdb->prefix . 'fotogrids_image_meta';
        
        // Get next position
        $next_position = $wpdb->get_var( 
            $wpdb->prepare( 
                "SELECT COALESCE(MAX(position), 0) + 1 FROM $table WHERE gallery_id = %d", 
                $gallery_id 
            ) 
        );
        
        // Prepare data for custom table
        $data = array(
            'attachment_id' => $attachment_id,
            'gallery_id' => $gallery_id,
            'position' => $next_position,
            'caption' => isset( $meta['caption'] ) ? $meta['caption'] : '',
            'description' => isset( $meta['description'] ) ? $meta['description'] : '',
            'location' => isset( $meta['location'] ) ? $meta['location'] : '',
            'exif_data' => isset( $meta['exif_data'] ) ? wp_json_encode( $meta['exif_data'] ) : null,
            'custom_data' => isset( $meta['custom_data'] ) ? wp_json_encode( $meta['custom_data'] ) : null,
            'created_at' => current_time( 'mysql', true ),
            'updated_at' => current_time( 'mysql', true ),
        );
        
        $wpdb->insert( $table, $data );
    }
    
    if ( $post_meta_result !== false ) {
        do_action( 'fotogrids_image_added_to_gallery', $attachment_id, $gallery_id, $meta );
        return true;
    }
    
    return false;
}

/**
 * Remove image from gallery
 * 
 * @param int $gallery_id Gallery ID
 * @param int $attachment_id Attachment ID
 * @return bool Success status
 */
function fotogrids_remove_image_from_gallery( $gallery_id, $attachment_id ) {
    global $wpdb;
    
    // Remove from post meta
    $image_ids = fotogrids_get_gallery_image_ids( $gallery_id );
    
    if ( empty( $image_ids ) ) {
        return false;
    }
    
    $attachment_id = (int) $attachment_id;
    $key = array_search( $attachment_id, $image_ids );
    if ( $key !== false ) {
        unset( $image_ids[$key] );
        // Re-index array to prevent gaps
        $image_ids = array_values( $image_ids );
        $post_meta_result = update_post_meta( $gallery_id, 'fotogrids_gallery_images', wp_json_encode( $image_ids ) );
        
        // Also remove from custom table if it exists
        $table = $wpdb->prefix . 'fotogrids_image_meta';
        $wpdb->delete( 
            $table, 
            array( 
                'gallery_id' => $gallery_id, 
                'attachment_id' => $attachment_id 
            ),
            array( '%d', '%d' )
        );
        
        if ( $post_meta_result !== false ) {
            do_action( 'fotogrids_image_removed_from_gallery', $attachment_id, $gallery_id );
            return true;
        }
    }
    
    return false;
}

/**
 * Update image metadata in gallery
 * 
 * @param int $gallery_id Gallery ID
 * @param int $attachment_id Attachment ID
 * @param array $meta New metadata
 * @return bool Success status
 */
function fotogrids_update_image_meta( $gallery_id, $attachment_id, $meta ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'fotogrids_image_meta';
    
    $data = array(
        'updated_at' => current_time( 'mysql', true ),
    );
    
    // Update allowed fields
    $allowed_fields = array( 'caption', 'description', 'location', 'position' );
    foreach ( $allowed_fields as $field ) {
        if ( isset( $meta[ $field ] ) ) {
            $data[ $field ] = $meta[ $field ];
        }
    }
    
    // Handle JSON fields
    if ( isset( $meta['exif_data'] ) ) {
        $data['exif_data'] = wp_json_encode( $meta['exif_data'] );
    }
    
    if ( isset( $meta['custom_data'] ) ) {
        $data['custom_data'] = wp_json_encode( $meta['custom_data'] );
    }
    
    $result = $wpdb->update( 
        $table, 
        $data,
        array( 
            'gallery_id' => $gallery_id, 
            'attachment_id' => $attachment_id 
        ),
        null,
        array( '%d', '%d' )
    );
    
    if ( $result !== false ) {
        do_action( 'fotogrids_image_meta_updated', $attachment_id, $gallery_id, $meta );
        return true;
    }
    
    return false;
}

/**
 * Reorder gallery images
 * 
 * @param int $gallery_id Gallery ID
 * @param array $image_order Array of attachment IDs in new order
 * @return bool Success status
 */
function fotogrids_reorder_gallery_images( $gallery_id, $image_order ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'fotogrids_image_meta';
    
    foreach ( $image_order as $position => $attachment_id ) {
        $wpdb->update( 
            $table, 
            array( 'position' => $position + 1 ),
            array( 
                'gallery_id' => $gallery_id, 
                'attachment_id' => $attachment_id 
            ),
            array( '%d' ),
            array( '%d', '%d' )
        );
    }
    
    do_action( 'fotogrids_gallery_images_reordered', $gallery_id, $image_order );
    
    return true;
}

/**
 * Get available gallery layouts
 * 
 * @return array Array of layout options
 */
function fotogrids_get_available_layouts() {
    $layouts = array(
        'grid' => array(
            'name' => __( 'Grid', 'fotogrids' ),
            'description' => __( 'Simple grid layout', 'fotogrids' ),
            'type' => 'free',
        ),
        'masonry' => array(
            'name' => __( 'Masonry', 'fotogrids' ),
            'description' => __( 'Pinterest-style masonry layout', 'fotogrids' ),
            'type' => 'free',
        ),
        'justified' => array(
            'name' => __( 'Justified', 'fotogrids' ),
            'description' => __( 'Justified grid with equal heights', 'fotogrids' ),
            'type' => 'free',
        ),
    );
    
    // Add pro layouts if license allows
    // TODO: Implement license checking
    $pro_layouts = array(
        'slider' => array(
            'name' => __( 'Slider', 'fotogrids' ),
            'description' => __( 'Image slider with navigation', 'fotogrids' ),
            'type' => 'starter',
        ),
        'polaroid' => array(
            'name' => __( 'Polaroid', 'fotogrids' ),
            'description' => __( 'Polaroid-style photo layout', 'fotogrids' ),
            'type' => 'starter',
        ),
    );
    
    $layouts = array_merge( $layouts, $pro_layouts );
    
    return apply_filters( 'fotogrids_available_layouts', $layouts );
}

/**
 * Sanitize gallery settings
 * 
 * @param array $settings Raw settings array
 * @return array Sanitized settings
 */
function fotogrids_sanitize_gallery_settings( $settings ) {
    $sanitized = array();
    
    // Layout
    if ( isset( $settings['layout'] ) ) {
        $available_layouts = array_keys( fotogrids_get_available_layouts() );
        $sanitized['layout'] = in_array( $settings['layout'], $available_layouts ) ? $settings['layout'] : 'grid';
    }
    
    // Columns
    if ( isset( $settings['columns'] ) ) {
        $columns = (int) $settings['columns'];
        $sanitized['columns'] = max( 1, min( 12, $columns ) );
    }
    
    // Boolean settings
    $boolean_settings = array( 'lazy_load', 'lightbox', 'show_captions', 'show_filters' );
    foreach ( $boolean_settings as $setting ) {
        if ( isset( $settings[ $setting ] ) ) {
            $sanitized[ $setting ] = (bool) $settings[ $setting ];
        }
    }
    
    return apply_filters( 'fotogrids_sanitize_gallery_settings', $sanitized, $settings );
}

/**
 * Generate gallery shortcode
 * 
 * @param int $gallery_id Gallery ID
 * @param array $attributes Additional shortcode attributes
 * @return string Shortcode string
 */
function fotogrids_generate_gallery_shortcode( $gallery_id, $attributes = array() ) {
    $shortcode = '[fotogrids_gallery id="' . $gallery_id . '"';
    
    foreach ( $attributes as $key => $value ) {
        $shortcode .= ' ' . esc_attr( $key ) . '="' . esc_attr( $value ) . '"';
    }
    
    $shortcode .= ']';
    
    return $shortcode;
}

/**
 * Generate album shortcode
 * 
 * @param int $album_id Album ID
 * @param array $attributes Additional shortcode attributes
 * @return string Shortcode string
 */
function fotogrids_generate_album_shortcode( $album_id, $attributes = array() ) {
    $shortcode = '[fotogrids_album id="' . $album_id . '"';
    
    foreach ( $attributes as $key => $value ) {
        $shortcode .= ' ' . esc_attr( $key ) . '="' . esc_attr( $value ) . '"';
    }
    
    $shortcode .= ']';
    
    return $shortcode;
}

/**
 * Log debug information (only in WP_DEBUG mode)
 * 
 * @param mixed $data Data to log
 * @param string $context Context for the log entry
 */
function fotogrids_log( $data, $context = 'general' ) {
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
        $message = '[FotoGrids] ' . $context . ': ' . print_r( $data, true );
        error_log( $message );
    }
}

/**
 * Get plugin option with default value
 * 
 * @param string $option_name Option name
 * @param mixed $default Default value
 * @return mixed Option value or default
 */
function fotogrids_get_option( $option_name, $default = null ) {
    return get_option( 'fotogrids_' . $option_name, $default );
}

/**
 * Update plugin option
 * 
 * @param string $option_name Option name
 * @param mixed $value Option value
 * @return bool Success status
 */
function fotogrids_update_option( $option_name, $value ) {
    return update_option( 'fotogrids_' . $option_name, $value );
}

/**
 * Delete plugin option
 * 
 * @param string $option_name Option name
 * @return bool Success status
 */
function fotogrids_delete_option( $option_name ) {
    return delete_option( 'fotogrids_' . $option_name );
}
