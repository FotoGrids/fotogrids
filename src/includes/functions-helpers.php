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
 * Get gallery images with metadata
 * 
 * @param int $gallery_id Gallery ID
 * @return array Array of image data
 */
function fotogrids_get_gallery_images( $gallery_id ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'fotogrids_image_meta';
    $results = $wpdb->get_results( 
        $wpdb->prepare( 
            "SELECT * FROM $table WHERE gallery_id = %d ORDER BY position ASC", 
            $gallery_id 
        ), 
        ARRAY_A 
    );
    
    $images = array();
    foreach ( $results as $row ) {
        $attachment_id = (int) $row['attachment_id'];
        $attachment = get_post( $attachment_id );
        
        if ( $attachment && $attachment->post_type === 'attachment' ) {
            $images[] = array(
                'id' => $attachment_id,
                'gallery_id' => (int) $row['gallery_id'],
                'position' => (int) $row['position'],
                'caption' => $row['caption'],
                'description' => $row['description'],
                'location' => $row['location'],
                'exif_data' => $row['exif_data'] ? json_decode( $row['exif_data'], true ) : null,
                'custom_data' => $row['custom_data'] ? json_decode( $row['custom_data'], true ) : null,
                'url' => wp_get_attachment_url( $attachment_id ),
                'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
                'medium' => wp_get_attachment_image_url( $attachment_id, 'medium' ),
                'large' => wp_get_attachment_image_url( $attachment_id, 'large' ),
                'full' => wp_get_attachment_url( $attachment_id ),
                'alt' => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
                'title' => $attachment->post_title,
            );
        }
    }
    
    return $images;
}

/**
 * Get gallery image count
 * 
 * @param int $gallery_id Gallery ID
 * @return int Number of images in gallery
 */
function fotogrids_get_gallery_image_count( $gallery_id ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'fotogrids_image_meta';
    return (int) $wpdb->get_var( 
        $wpdb->prepare( 
            "SELECT COUNT(*) FROM $table WHERE gallery_id = %d", 
            $gallery_id 
        ) 
    );
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
    
    // Get next position
    $table = $wpdb->prefix . 'fotogrids_image_meta';
    $next_position = $wpdb->get_var( 
        $wpdb->prepare( 
            "SELECT COALESCE(MAX(position), 0) + 1 FROM $table WHERE gallery_id = %d", 
            $gallery_id 
        ) 
    );
    
    // Prepare data
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
    
    $result = $wpdb->insert( $table, $data );
    
    if ( $result ) {
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
    
    $table = $wpdb->prefix . 'fotogrids_image_meta';
    $result = $wpdb->delete( 
        $table, 
        array( 
            'gallery_id' => $gallery_id, 
            'attachment_id' => $attachment_id 
        ),
        array( '%d', '%d' )
    );
    
    if ( $result ) {
        do_action( 'fotogrids_image_removed_from_gallery', $attachment_id, $gallery_id );
        return true;
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
