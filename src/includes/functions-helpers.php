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
 * Check if FotoGrids Pro is active
 *
 * @return bool
 */
function fotogrids_has_pro() {
    return defined( 'FOTOGRIDS_PRO_VERSION' );
}

/**
 * Whether the FotoGrids Pro plugin is loaded on this site.
 *
 * @since  1.0.0
 * @return bool
 */
function fotogrids_pro_is_loaded() {
    return defined( 'FOTOGRIDS_PRO_VERSION' );
}

/**
 * Whether the current user can use a specific Pro feature.
 *
 * @since  1.0.0
 * @param  string $feature_id Stable feature identifier.
 * @return bool
 */
function fotogrids_can_use( $feature_id ) {
    if ( ! is_string( $feature_id ) || $feature_id === '' ) {
        return false;
    }

    return \FotoGrids\License_Manager::can_use( $feature_id );
}

/**
 * Whether the current user is on a specific plan or higher.
 *
 * @since  1.0.0
 * @param  string $plan Plan slug.
 * @return bool
 */
function fotogrids_on_plan( $plan ) {
    if ( ! is_string( $plan ) || $plan === '' ) {
        return false;
    }

    return \FotoGrids\License_Manager::on_plan( $plan );
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
 * @param bool $is_defaults_page If true, use second item from array defaults (for settings with isGlobalDefault options)
 * @return array Default settings structure
 */
function fotogrids_get_default_gallery_settings( $is_defaults_page = false ) {
    // Get base defaults
    $defaults = \FotoGrids\Collection_Defaults::get_base_defaults( $is_defaults_page );

    // Merge gallery-specific defaults
    $gallery_defaults = \FotoGrids\Collection_Defaults::get_gallery_defaults( $is_defaults_page );
    $defaults = array_merge( $defaults, $gallery_defaults );

    // Apply final filter
    return apply_filters( 'fotogrids/settings/defaults/gallery', $defaults, $is_defaults_page );
}

/**
 * Get default album settings
 *
 * @param bool $is_defaults_page If true, use second item from array defaults
 * @return array Default album settings structure
 */
function fotogrids_get_default_album_settings( $is_defaults_page = false ) {
    // Get base defaults
    $defaults = \FotoGrids\Collection_Defaults::get_base_defaults( $is_defaults_page );

    // Merge album-specific defaults
    $album_defaults = \FotoGrids\Collection_Defaults::get_album_defaults( $is_defaults_page );
    $defaults = array_merge( $defaults, $album_defaults );

    // Apply final filter
    return apply_filters( 'fotogrids/settings/defaults/album', $defaults, $is_defaults_page );
}


/**
 * Get album settings with defaults
 *
 * @param int $album_id Album ID
 * @return array Album settings
 */
function fotogrids_get_album_settings( $album_id ) {
    $defaults = fotogrids_get_default_album_settings();

    $settings = $defaults;

    foreach ( $defaults as $key => $default_value ) {
        $saved_value = get_post_meta( $album_id, 'fotogrids_' . $key, true );

        if ( $saved_value !== '' ) {
            if ( is_string( $saved_value ) ) {
                $decoded = json_decode( $saved_value, true );
                if ( is_array( $decoded ) ) {
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
 * Get gallery settings with defaults (without inheritance)
 *
 * @param int $gallery_id Gallery ID
 * @return array Gallery settings
 */
function fotogrids_get_gallery_settings( $gallery_id ) {
    $defaults = fotogrids_get_default_gallery_settings();

    $settings = $defaults;

    foreach ( $defaults as $key => $default_value ) {
        $saved_value = get_post_meta( $gallery_id, 'fotogrids_' . $key, true );

        if ( $saved_value !== '' ) {
            if ( is_string( $saved_value ) ) {
                $decoded = json_decode( $saved_value, true );
                if ( is_array( $decoded ) ) {
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

    // The `password` setting is stored encrypted. Expose it to the render
    // pipeline via the internal `_password_encrypted` key so gates can call
    // Password_Crypto::verify() without the raw ciphertext leaking into REST
    // responses or the public JS bundle. The public `password` key is always
    // kept as '' in the returned settings array.
    $encrypted = (string) get_post_meta( $gallery_id, 'fotogrids_password', true );
    $settings['_password_encrypted'] = $encrypted;
    $settings['password']            = '';

    return $settings;
}

function fotogrids_get_gallery_item_ids( $gallery_id ) {
    $item_ids = get_post_meta( $gallery_id, 'fotogrids_gallery_items', true );

    // If it's a JSON string, decode it
    if ( is_string( $item_ids ) ) {
        $decoded = json_decode( $item_ids, true );
        if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) {
            return array_map( 'intval', $decoded ); // Ensure all IDs are integers
        }
    } elseif ( is_array( $item_ids ) ) {
        return array_map( 'intval', $item_ids );
    }

    return array();
}

/**
 * Get gallery items with metadata
 *
 * @param int $gallery_id Gallery ID
 * @return array Array of item data
 */
function fotogrids_get_gallery_items( $gallery_id ) {
    $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );

    if ( empty( $item_ids ) ) {
        return array();
    }

    global $wpdb;
    $items = array();
    $position = 0;

    foreach ( $item_ids as $attachment_id ) {
        $attachment_id = (int) $attachment_id;
        $attachment = get_post( $attachment_id );

        if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
            continue;
        }

        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $custom_meta = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM $table WHERE gallery_id = %d AND attachment_id = %d",
                $gallery_id,
                $attachment_id
            ),
            ARRAY_A
        );

        $item_data = array(
            'id' => $attachment_id,
            'gallery_id' => (int) $gallery_id,
            'position' => $custom_meta ? (int) $custom_meta['position'] : $position,
            'caption' => $custom_meta ? $custom_meta['caption'] : $attachment->post_excerpt,
            'description' => $custom_meta ? $custom_meta['description'] : $attachment->post_content,
            'credit' => $custom_meta ? ( $custom_meta['credit'] ?? '' ) : '',
            'location' => $custom_meta ? $custom_meta['location'] : '',
            'exif_data' => $custom_meta && $custom_meta['exif_data'] ? json_decode( $custom_meta['exif_data'], true ) : null,
            'custom_data' => $custom_meta && $custom_meta['custom_data'] ? json_decode( $custom_meta['custom_data'], true ) : null,
            'url' => wp_get_attachment_url( $attachment_id ),
            'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
            'medium' => wp_get_attachment_image_url( $attachment_id, 'medium' ),
            'large' => wp_get_attachment_image_url( $attachment_id, 'large' ),
            'full' => wp_get_attachment_url( $attachment_id ),
            'alt' => get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ),
            'title' => $attachment->post_title,
            'external_url' => get_post_meta( $attachment_id, '_fotogrids_external_url', true ),
            'link_target' => get_post_meta( $attachment_id, '_fotogrids_link_target', true ),
        );

        $items[] = $item_data;
        $position++;
    }

    usort( $items, function( $a, $b ) {
        return $a['position'] - $b['position'];
    });

    return $items;
}

/**
 * Get the resolved sharing configuration for a collection.
 *
 * Merges global sharing settings with the collection's per-collection override.
 *
 * @since 1.0.0
 * @param int $collection_id Gallery or album ID.
 * @return array<string, mixed>
 */
function fotogrids_get_resolved_sharing( $collection_id ) {
    return \FotoGrids\Settings\Sharing_Settings_Store::resolve( (int) $collection_id );
}

/**
 * Get gallery item count
 *
 * @param int $gallery_id Gallery ID
 * @return int Number of items in gallery
 */
function fotogrids_get_gallery_item_count( $gallery_id ) {
    $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );

    if ( empty( $item_ids ) ) {
        return 0;
    }

    // Count only valid attachment IDs
    $count = 0;
    foreach ( $item_ids as $attachment_id ) {
        $attachment = get_post( (int) $attachment_id );
        if ( $attachment && $attachment->post_type === 'attachment' ) {
            $count++;
        }
    }

    return $count;
}

/**
 * Resolve the cover-image attachment ID for a gallery.
 *
 * Reads the gallery's `_thumbnail_id`. If it still points to an attachment
 * that exists AND is still in the gallery's `fotogrids_gallery_items`,
 * that ID wins. Otherwise the first valid item is returned. Returns 0
 * when the gallery has no resolvable cover.
 *
 * @since 1.0.0
 * @param int $gallery_id Gallery post ID.
 * @return int Attachment ID or 0.
 */
function fotogrids_get_gallery_cover_attachment_id( $gallery_id ) {
    $gallery_id = (int) $gallery_id;
    if ( $gallery_id <= 0 ) {
        return 0;
    }

    $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );
    if ( empty( $item_ids ) ) {
        return 0;
    }

    $item_ids   = array_map( 'intval', $item_ids );
    $picked     = (int) get_post_thumbnail_id( $gallery_id );
    $candidates = $picked > 0 ? array_merge( array( $picked ), $item_ids ) : $item_ids;

    foreach ( $candidates as $attachment_id ) {
        $attachment_id = (int) $attachment_id;
        if ( $attachment_id <= 0 ) {
            continue;
        }
        if ( ! in_array( $attachment_id, $item_ids, true ) ) {
            continue;
        }
        $attachment = get_post( $attachment_id );
        if ( $attachment && $attachment->post_type === 'attachment' ) {
            return $attachment_id;
        }
    }

    return 0;
}

/**
 * Resolve the cover-image attachment ID for an album.
 *
 * Reads `fotogrids_featured_gallery`. If it still names a gallery that
 * exists AND is still a child of this album AND that gallery has a
 * resolvable cover, that wins. Otherwise the first child gallery with
 * a resolvable cover is returned. Returns 0 when nothing resolves.
 *
 * @since 1.0.0
 * @param int $album_id Album post ID.
 * @return int Attachment ID or 0.
 */
function fotogrids_get_album_cover_attachment_id( $album_id ) {
    $album_id = (int) $album_id;
    if ( $album_id <= 0 ) {
        return 0;
    }

    $galleries = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $album_id );
    if ( empty( $galleries ) ) {
        return 0;
    }

    $child_ids = array();
    foreach ( $galleries as $gallery ) {
        $gid = is_object( $gallery ) ? (int) ( $gallery->ID ?? $gallery->id ?? 0 ) : (int) $gallery;
        if ( $gid > 0 ) {
            $child_ids[] = $gid;
        }
    }
    if ( empty( $child_ids ) ) {
        return 0;
    }

    $picked = (int) get_post_meta( $album_id, 'fotogrids_featured_gallery', true );
    if ( $picked > 0 && in_array( $picked, $child_ids, true ) ) {
        $cover = fotogrids_get_gallery_cover_attachment_id( $picked );
        if ( $cover > 0 ) {
            return $cover;
        }
    }

    foreach ( $child_ids as $gid ) {
        $cover = fotogrids_get_gallery_cover_attachment_id( $gid );
        if ( $cover > 0 ) {
            return $cover;
        }
    }

    return 0;
}

/**
 * Resolve the cover-image attachment ID for a gallery or album.
 *
 * Dispatcher used by every cover-image consumer (REST list endpoints,
 * statistics cards, relations widgets, view-page OG, etc.) so that the
 * resolution rules live in one place. Returns 0 when the post is not
 * a FotoGrids collection or has no resolvable cover.
 *
 * @since 1.0.0
 * @param int $post_id Gallery or album post ID.
 * @return int Attachment ID or 0.
 */
function fotogrids_get_collection_cover_attachment_id( $post_id ) {
    $post_id = (int) $post_id;
    if ( $post_id <= 0 ) {
        return 0;
    }

    $post_type = get_post_type( $post_id );
    if ( $post_type === 'fotogrids_gallery' ) {
        return fotogrids_get_gallery_cover_attachment_id( $post_id );
    }
    if ( $post_type === 'fotogrids_album' ) {
        return fotogrids_get_album_cover_attachment_id( $post_id );
    }

    return 0;
}

/**
 * Resolve the cover-image URL for a gallery or album.
 *
 * Thin convenience wrapper around `fotogrids_get_collection_cover_attachment_id`
 * + `wp_get_attachment_image_url`. Returns an empty string when nothing resolves.
 *
 * @since 1.0.0
 * @param int    $post_id Gallery or album post ID.
 * @param string $size    Image size keyword. Default 'thumbnail'.
 * @return string Cover image URL or empty string.
 */
function fotogrids_get_collection_cover_url( $post_id, $size = 'thumbnail' ) {
    $attachment_id = fotogrids_get_collection_cover_attachment_id( $post_id );
    if ( $attachment_id <= 0 ) {
        return '';
    }
    $url = wp_get_attachment_image_url( $attachment_id, $size );
    return $url ? $url : '';
}

/**
 * Add item to gallery
 *
 * @param int $gallery_id Gallery ID
 * @param int $attachment_id Attachment ID
 * @param array $meta Item metadata
 * @return bool Success status
 */
function fotogrids_add_item_to_gallery( $gallery_id, $attachment_id, $meta = array() ) {
    global $wpdb;

    // Validate gallery exists
    if ( ! fotogrids_get_gallery( $gallery_id ) ) {
        return false;
    }

    // Validate attachment exists
    if ( ! get_post( $attachment_id ) ) {
        return false;
    }

    // Seed FotoGrids alt from the WP Media Library alt if not already set.
    // This means items added before the user has touched the FotoGrids item
    // editor still render with the alt the user already typed in the Media
    // Library, rather than silently falling back to the title.
    if ( '' === get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ) ) {
        $wp_alt = get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );
        if ( '' !== (string) $wp_alt ) {
            update_post_meta( $attachment_id, '_wp_attachment_item_alt', $wp_alt );
        }
    }

    // Get current item IDs from post meta
    $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );

    // Check if item is already in gallery
    if ( in_array( $attachment_id, $item_ids ) ) {
        return false; // Item already in gallery
    }

    // Add item ID to the gallery
    $item_ids[] = (int) $attachment_id;
    $post_meta_result = update_post_meta( $gallery_id, 'fotogrids_gallery_items', wp_json_encode( $item_ids ) );

    // Extract EXIF data if not already provided in meta
    if ( ! isset( $meta['exif_data'] ) ) {
        $enabled_fields = fotogrids_get_enabled_exif_fields( $gallery_id );
        if ( ! empty( $enabled_fields ) ) {
            $exif_data = fotogrids_extract_exif_data( $attachment_id, $enabled_fields );
            if ( ! empty( $exif_data ) ) {
                $meta['exif_data'] = $exif_data;
            }
        }
    }

    // If meta is provided (or EXIF was extracted), also store in custom table
    if ( ! empty( $meta ) ) {
        $table = $wpdb->prefix . 'fotogrids_item_meta';

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
        do_action( 'fotogrids/actions/item/added', $attachment_id, $gallery_id, $meta );
        return true;
    }

    return false;
}

/**
 * Extract and normalize EXIF data from an image attachment
 *
 * @param int $attachment_id Attachment ID
 * @param array $enabled_fields Array of enabled EXIF field keys (e.g., ['camera', 'aperture', 'shutter_speed', 'iso'])
 * @return array Normalized EXIF data with only enabled fields
 */
function fotogrids_extract_exif_data( $attachment_id, $enabled_fields = array() ) {
    if ( empty( $enabled_fields ) ) {
        return array();
    }

    $file_path = get_attached_file( $attachment_id );
    if ( ! $file_path || ! file_exists( $file_path ) ) {
        return array();
    }

    $image_meta = wp_read_image_metadata( $file_path );
    if ( ! $image_meta || empty( $image_meta ) ) {
        return array();
    }

    $exif_data = array();

    // Map WordPress metadata keys to our EXIF field keys
    $field_mapping = array(
        'camera' => 'camera',
        'aperture' => 'aperture',
        'shutter_speed' => 'shutter_speed',
        'iso' => 'iso',
        'lens' => 'lens',
        'focal_length' => 'focal_length',
        'date_taken' => 'created_timestamp',
        'copyright' => 'copyright',
        'orientation' => 'orientation',
        'flash' => 'flash',
        'white_balance' => 'white_balance',
        'exposure_mode' => 'exposure_mode',
    );

    // WordPress metadata keys
    $wp_meta_keys = array(
        'camera' => 'camera',
        'aperture' => 'aperture',
        'shutter' => 'shutter_speed',
        'iso' => 'iso',
        'lens' => 'lens',
        'focal_length' => 'focal_length',
        'created_timestamp' => 'created_timestamp',
        'copyright' => 'copyright',
        'orientation' => 'orientation',
        'flash' => 'flash',
        'white_balance' => 'white_balance',
        'exposure_mode' => 'exposure_mode',
    );

    // Extract camera (combine credit and camera if available)
    if ( in_array( 'camera', $enabled_fields ) ) {
        $camera_parts = array();
        if ( ! empty( $image_meta['credit'] ) ) {
            $camera_parts[] = $image_meta['credit'];
        }
        if ( ! empty( $image_meta['camera'] ) ) {
            $camera_parts[] = $image_meta['camera'];
        }
        if ( ! empty( $camera_parts ) ) {
            $exif_data['camera'] = sanitize_text_field( implode( ' ', $camera_parts ) );
        }
    }

    // Extract aperture
    if ( in_array( 'aperture', $enabled_fields ) && ! empty( $image_meta['aperture'] ) ) {
        $aperture = $image_meta['aperture'];
        if ( is_numeric( $aperture ) ) {
            $exif_data['aperture'] = 'f/' . number_format( (float) $aperture, 1 );
        } else {
            $exif_data['aperture'] = sanitize_text_field( $aperture );
        }
    }

    // Extract shutter speed (normalize fractions)
    if ( in_array( 'shutter_speed', $enabled_fields ) && ! empty( $image_meta['shutter'] ) ) {
        $shutter = $image_meta['shutter'];
        if ( is_numeric( $shutter ) ) {
            if ( $shutter < 1 ) {
                // Convert fraction to readable format (e.g., 0.5 -> 1/2s)
                $denominator = round( 1 / $shutter );
                $exif_data['shutter_speed'] = '1/' . $denominator . 's';
            } else {
                $exif_data['shutter_speed'] = number_format( (float) $shutter, 1 ) . 's';
            }
        } else {
            $exif_data['shutter_speed'] = sanitize_text_field( $shutter );
        }
    }

    // Extract ISO
    if ( in_array( 'iso', $enabled_fields ) && ! empty( $image_meta['iso'] ) ) {
        $exif_data['iso'] = sanitize_text_field( $image_meta['iso'] );
    }

    // Extract lens
    if ( in_array( 'lens', $enabled_fields ) && ! empty( $image_meta['lens'] ) ) {
        $exif_data['lens'] = sanitize_text_field( $image_meta['lens'] );
    }

    // Extract focal length
    if ( in_array( 'focal_length', $enabled_fields ) && ! empty( $image_meta['focal_length'] ) ) {
        $focal_length = $image_meta['focal_length'];
        if ( is_numeric( $focal_length ) ) {
            $exif_data['focal_length'] = number_format( (float) $focal_length, 0 ) . 'mm';
        } else {
            $exif_data['focal_length'] = sanitize_text_field( $focal_length );
        }
    }

    // Extract date taken
    if ( in_array( 'date_taken', $enabled_fields ) && ! empty( $image_meta['created_timestamp'] ) ) {
        $timestamp = $image_meta['created_timestamp'];
        if ( is_numeric( $timestamp ) ) {
            $exif_data['date_taken'] = date( 'Y-m-d H:i:s', $timestamp );
        } else {
            $exif_data['date_taken'] = sanitize_text_field( $timestamp );
        }
    }

    // Extract copyright
    if ( in_array( 'copyright', $enabled_fields ) && ! empty( $image_meta['copyright'] ) ) {
        $exif_data['copyright'] = sanitize_text_field( $image_meta['copyright'] );
    }

    // Extract orientation
    if ( in_array( 'orientation', $enabled_fields ) && ! empty( $image_meta['orientation'] ) ) {
        $exif_data['orientation'] = sanitize_text_field( $image_meta['orientation'] );
    }

    // Extract flash
    if ( in_array( 'flash', $enabled_fields ) && isset( $image_meta['flash'] ) ) {
        $flash = $image_meta['flash'];
        if ( is_numeric( $flash ) ) {
            $exif_data['flash'] = ( $flash > 0 ) ? __( 'Yes', 'fotogrids' ) : __( 'No', 'fotogrids' );
        } else {
            $exif_data['flash'] = sanitize_text_field( $flash );
        }
    }

    // Extract white balance
    if ( in_array( 'white_balance', $enabled_fields ) && ! empty( $image_meta['white_balance'] ) ) {
        $exif_data['white_balance'] = sanitize_text_field( $image_meta['white_balance'] );
    }

    // Extract exposure mode
    if ( in_array( 'exposure_mode', $enabled_fields ) && ! empty( $image_meta['exposure_mode'] ) ) {
        $exif_data['exposure_mode'] = sanitize_text_field( $image_meta['exposure_mode'] );
    }

    return $exif_data;
}

/**
 * Get enabled EXIF fields from gallery settings
 *
 * @param int $gallery_id Gallery ID
 * @return array Array of enabled EXIF field keys
 */
function fotogrids_get_enabled_exif_fields( $gallery_id ) {
    $settings = fotogrids_get_gallery_settings( $gallery_id );

    if ( empty( $settings['display_exif'] ) ) {
        return array();
    }

    $enabled_fields = array();

    // Free fields
    if ( ! empty( $settings['exif_camera'] ) ) {
        $enabled_fields[] = 'camera';
    }
    if ( ! empty( $settings['exif_aperture'] ) ) {
        $enabled_fields[] = 'aperture';
    }
    if ( ! empty( $settings['exif_shutter_speed'] ) ) {
        $enabled_fields[] = 'shutter_speed';
    }
    if ( ! empty( $settings['exif_iso'] ) ) {
        $enabled_fields[] = 'iso';
    }

    // Pro fields (only if Pro is active)
    $is_pro = apply_filters( 'fotogrids/features/pro/is_active', false );
    if ( $is_pro ) {
        if ( ! empty( $settings['exif_lens'] ) ) {
            $enabled_fields[] = 'lens';
        }
        if ( ! empty( $settings['exif_focal_length'] ) ) {
            $enabled_fields[] = 'focal_length';
        }
        if ( ! empty( $settings['exif_date_taken'] ) ) {
            $enabled_fields[] = 'date_taken';
        }
        if ( ! empty( $settings['exif_copyright'] ) ) {
            $enabled_fields[] = 'copyright';
        }
        if ( ! empty( $settings['exif_orientation'] ) ) {
            $enabled_fields[] = 'orientation';
        }
        if ( ! empty( $settings['exif_flash'] ) ) {
            $enabled_fields[] = 'flash';
        }
        if ( ! empty( $settings['exif_white_balance'] ) ) {
            $enabled_fields[] = 'white_balance';
        }
        if ( ! empty( $settings['exif_exposure_mode'] ) ) {
            $enabled_fields[] = 'exposure_mode';
        }
    }

    return $enabled_fields;
}

/**
 * Remove item from gallery
 *
 * @param int $gallery_id Gallery ID
 * @param int $attachment_id Attachment ID
 * @return bool Success status
 */
function fotogrids_remove_item_from_gallery( $gallery_id, $attachment_id ) {
    global $wpdb;

    // Remove from post meta
    $item_ids = fotogrids_get_gallery_item_ids( $gallery_id );

    if ( empty( $item_ids ) ) {
        return false;
    }

    $attachment_id = (int) $attachment_id;
    $key = array_search( $attachment_id, $item_ids );
    if ( $key !== false ) {
        unset( $item_ids[$key] );
        // Re-index array to prevent gaps
        $item_ids = array_values( $item_ids );
        $post_meta_result = update_post_meta( $gallery_id, 'fotogrids_gallery_items', wp_json_encode( $item_ids ) );

        // Also remove from custom table if it exists
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $wpdb->delete(
            $table,
            array(
                'gallery_id' => $gallery_id,
                'attachment_id' => $attachment_id
            ),
            array( '%d', '%d' )
        );

        if ( $post_meta_result !== false ) {
            do_action( 'fotogrids/actions/item/removed', $attachment_id, $gallery_id );
            return true;
        }
    }

    return false;
}

/**
 * Update item metadata in gallery
 *
 * @param int $gallery_id Gallery ID
 * @param int $attachment_id Attachment ID
 * @param array $meta New metadata
 * @return bool Success status
 */
function fotogrids_update_item_meta( $gallery_id, $attachment_id, $meta ) {
    global $wpdb;

    $table = $wpdb->prefix . 'fotogrids_item_meta';

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
        do_action( 'fotogrids/actions/item/meta/updated', $attachment_id, $gallery_id, $meta );
        return true;
    }

    return false;
}

/**
 * Reorder gallery items
 *
 * @param int $gallery_id Gallery ID
 * @param array $item_order Array of attachment IDs in new order
 * @return bool Success status
 */
function fotogrids_reorder_gallery_items( $gallery_id, $item_order ) {
    global $wpdb;

    $table = $wpdb->prefix . 'fotogrids_item_meta';

    foreach ( $item_order as $position => $attachment_id ) {
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

    do_action( 'fotogrids/actions/gallery/reordered', $gallery_id, $item_order );

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
            'description' => __( 'Item slider with navigation', 'fotogrids' ),
            'type' => 'starter',
        ),
        'polaroid' => array(
            'name' => __( 'Polaroid', 'fotogrids' ),
            'description' => __( 'Polaroid-style photo layout', 'fotogrids' ),
            'type' => 'starter',
        ),
    );

    $layouts = array_merge( $layouts, $pro_layouts );

    return apply_filters( 'fotogrids/features/layouts/available', $layouts );
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

    return apply_filters( 'fotogrids/settings/sanitize', $sanitized, $settings );
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

/**
 * Enqueue collection settings scripts (render functions and main script)
 *
 * @param bool $enqueue_settings_loader Whether to enqueue the settings loader script
 * @param bool $enqueue_codemirror Whether to enqueue codemirror-init script
 */
function fotogrids_enqueue_collection_settings_scripts( $enqueue_settings_loader = true, $enqueue_codemirror = false ) {
    if ( $enqueue_settings_loader ) {
        wp_enqueue_script(
            'fotogrids-settings-loader',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/collection-settings/index.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );
    }

    // fg-tooltip — the shared lightweight tooltip used on the frontend.
    // We reuse it inside wp-admin (shortcode metabox copy button, docs strip
    // links) so the tooltip styling matches the public surface. Picks up any
    // element with [data-fg-tooltip] on DOMContentLoaded.
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

    if ( $enqueue_codemirror ) {
        wp_enqueue_script(
            'fotogrids-codemirror-init',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/codemirror-init.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );
    }

    // Standalone helper scripts that render functions may depend on.

    // Standalone helper scripts that render functions may depend on.
    // These live in render-settings/utils/ - not render functions themselves.

    // Tooltip utilities - must load before any render helper that shows Pro badges.
    wp_enqueue_script(
        'fotogrids-tooltip-utils',
        FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/utils/tooltip-utils.js',
        array( 'wp-element' ),
        FOTOGRIDS_VERSION,
        true
    );

    wp_enqueue_script(
        'fotogrids-fg-color-picker',
        FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/utils/fg-color-picker.js',
        array(),
        FOTOGRIDS_VERSION,
        true
    );

    $render_functions = array(
        'renderCustomUnitSelect',
        'renderResponsiveRange',
        'renderLayoutGrid',
        'renderHoverEffectsGrid',
        'renderButtonGroup',
        'renderButtonGroupDynamic',
        'renderAlignmentGrid',
        'renderImageSize',
        'renderColorPicker',
        'renderPasswordInput',
        'renderRange',
        'renderTextInput',
        'renderSelect',
        'renderFontFamily',
        'renderFontWeight',
        'renderSideBySide',
        'renderToggle',
        'renderConditionalMessage',
        'renderSettingSubTabs',
        'renderBulkModal',
        'renderExternalUrlManager',
        'renderGroup',
        'renderCodeArea',
        'renderPromo',
        'renderInfoBlock',
        'renderTokenSelect',
        'renderCacheStatus',
        'renderImagePicker'
    );

    foreach ( $render_functions as $function ) {
        $dependencies = array( 'wp-element', 'wp-components', 'wp-i18n', 'fotogrids-icons' );

        // The image picker calls wp.apiFetch to resolve thumbnail URLs and
        // wp.media to open the upload modal.
        if ( $function === 'renderImagePicker' ) {
            $dependencies[] = 'wp-api-fetch';
            wp_enqueue_media();
        }

        // Render helpers that display Pro badges depend on the tooltip utilities.
        $uses_pro_badges = array( 'renderButtonGroup', 'renderButtonGroupDynamic', 'renderLayoutGrid', 'renderHoverEffectsGrid', 'renderTokenSelect' );
        if ( in_array( $function, $uses_pro_badges, true ) ) {
            $dependencies[] = 'fotogrids-tooltip-utils';
        }

        if ( $function === 'renderCodeArea' ) {
            $dependencies[] = 'fotogrids-codemirror-init';
        }

        if ( $function === 'renderColorPicker' ) {
            $dependencies[] = 'fotogrids-fg-color-picker';
        }

        if ( in_array( $function, array( 'renderRange', 'renderResponsiveRange' ), true ) ) {
            $dependencies[] = 'fotogrids-render-custom-unit-select';
        }

        if ( in_array( $function, array( 'renderFontFamily', 'renderFontWeight' ), true ) ) {
            $dependencies[] = 'fotogrids-render-select';
        }

        wp_enqueue_script(
            'fotogrids-' . strtolower( preg_replace( '/([a-z])([A-Z])/', '$1-$2', $function ) ),
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/' . $function . '.js',
            $dependencies,
            FOTOGRIDS_VERSION,
            true
        );
    }

    wp_enqueue_script(
        'fotogrids-collection-settings',
        FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/collection-settings.js',
        array( 'wp-element', 'wp-components', 'wp-i18n', 'jquery', 'fotogrids-icons', 'fotogrids-settings-loader', 'fotogrids-ui-state-manager' ),
        FOTOGRIDS_VERSION,
        true
    );
}

/**
 * Get loading icon SVG by icon name
 *
 * Returns only the selected icon's SVG for optimal frontend performance.
 * Icons are loaded from config/loading-icons.json (built from loading-icons.yaml).
 * SVG templates contain __FG_ID__; pass $instance_id to avoid duplicate IDs when
 * multiple loaders are on the page (e.g. PHP: uniqid(), React: useId(), vanilla: bin2hex(random_bytes(4))).
 *
 * @param string $icon_name   The icon name (e.g. 'spinner', '12-dots').
 * @param string $instance_id Optional. Unique id for this instance; replaces __FG_ID__ in the SVG. If empty, __FG_ID__ is left as-is (single loader) or you can pass uniqid('fg', true).
 * @return string The SVG markup for the icon, or default spinner if not found.
 */
function fotogrids_get_loading_icon_svg( $icon_name = 'spinner', $instance_id = '' ) {
    static $icons_cache = null;

    if ( $icons_cache === null ) {
        $icons_file = FOTOGRIDS_PLUGIN_DIR . 'config/loading-icons.json';

        if ( file_exists( $icons_file ) ) {
            $icons_json = file_get_contents( $icons_file );
            $icons_cache = json_decode( $icons_json, true );

            if ( ! is_array( $icons_cache ) ) {
                $icons_cache = array();
            }
        } else {
            $icons_cache = array();
        }
    }

    $svg = '';
    if ( isset( $icons_cache[ $icon_name ] ) ) {
        $svg = $icons_cache[ $icon_name ];
    } elseif ( isset( $icons_cache['spinner'] ) ) {
        $svg = $icons_cache['spinner'];
    }

    if ( $svg !== '' && $instance_id !== '' ) {
        $svg = str_replace( '__FG_ID__', $instance_id, $svg );
    }

    return $svg;
}

/**
 * Get the WAAPI animate function source for a loading icon by name.
 *
 * Returns a raw JS function string:
 *   function animate(svg) { ... }
 *
 * This is emitted verbatim by Loading_Icon into the inline script global so the
 * browser receives a fully pre-built function - no eval, no new Function, no
 * runtime code generation. The helpers (fgCubicBezier, fgAnimAttr, etc.) are
 * inlined inside the function by the build-time converter.
 *
 * @param string $icon_name The icon name (e.g. 'spinner', '12-dots').
 * @return string Raw JS function source, or empty string if not found.
 */
function fotogrids_get_loading_icon_animate_fn( $icon_name = 'spinner' ) {
    static $waapi_cache = null;

    if ( $waapi_cache === null ) {
        $waapi_file = FOTOGRIDS_PLUGIN_DIR . 'config/loading-icons-waapi.json';

        if ( file_exists( $waapi_file ) ) {
            $waapi_json  = file_get_contents( $waapi_file );
            $waapi_cache = json_decode( $waapi_json, true );

            if ( ! is_array( $waapi_cache ) ) {
                $waapi_cache = array();
            }
        } else {
            $waapi_cache = array();
        }
    }

    if ( isset( $waapi_cache[ $icon_name ] ) ) {
        return $waapi_cache[ $icon_name ];
    }

    if ( isset( $waapi_cache['spinner'] ) ) {
        return $waapi_cache['spinner'];
    }

    return '';
}

/**
 * Sanitizes a raw code string (CSS, JS, or similar) for safe storage.
 *
 * This is the correct sanitizer for `codearea` fields. It is intentionally
 * narrower than `sanitize_textarea_field`:
 *
 *  - Removes null bytes and ASCII control characters (except tab, newline, CR)
 *    which have no legitimate use in source code and are common in obfuscation
 *    payloads.
 *  - Preserves ALL printable characters, including `<`, `>`, `&`, quotes, and
 *    every character valid in CSS or JavaScript.
 *
 * `sanitize_textarea_field` strips HTML tags and encodes entities, which
 * corrupts legitimate code - e.g. JS comparisons (`a < b`), arrow functions
 * (`=>`), template literal expressions, or any CSS selector containing `>`.
 * This function avoids that corruption.
 *
 * NOTE: this function sanitizes for *storage* only. Render-time sanitization
 * (preventing breakout from `<style>` / `<script>` tags) is handled separately
 * by the Custom_Css and Custom_Js feature classes.
 *
 * @since  1.0.0
 * @param  string $raw Raw code input.
 * @return string Sanitized code, safe for storage in post meta.
 */
function fotogrids_sanitize_code_field( string $raw ): string {
    // Strip null bytes and ASCII control characters, preserving tab (\x09),
    // newline (\x0A), and carriage return (\x0D) which are valid in code.
    $sanitized = preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $raw );

    return is_string( $sanitized ) ? $sanitized : '';
}
