<?php
namespace FotoGrids\REST\Gallery;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Gallery Data Handler
 *
 * Handles gallery data retrieval for REST API endpoints.
 *
 * @since 1.0.0
 */
class Gallery_Data {
    
    /**
     * Get gallery data with items
     *
     * Retrieves a single gallery with all its associated items and metadata.
     * Supports preview mode for unpublished galleries. Automatically increments
     * view count unless in preview mode.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object containing gallery ID and preview flag
     * @return \WP_REST_Response|\WP_Error Gallery data or error response
     */
    public static function get_gallery( $request ) {
        $gallery_id = (int) $request['id'];
        $is_preview = (bool) $request['preview'];
        
        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error( 
                'gallery_not_found', 
                __( 'Gallery not found', 'fotogrids' ), 
                array( 'status' => 404 ) 
            );
        }
        
        if ( ! $is_preview && $gallery->post_status !== 'publish' ) {
            return new \WP_Error( 
                'gallery_not_published', 
                __( 'Gallery is not published', 'fotogrids' ), 
                array( 'status' => 403 ) 
            );
        }
        
        $meta = array(
            'layout' => get_post_meta( $gallery_id, 'fotogrids_layout', true ) ?: 'grid',
            'columns' => (int) get_post_meta( $gallery_id, 'fotogrids_columns', true ) ?: 3,
            'album_id' => (int) get_post_meta( $gallery_id, 'fotogrids_album_id', true ) ?: null,
        );
        
        $items = self::get_gallery_items( $gallery_id );
        
        if ( ! $is_preview ) {
            \FotoGrids\Statistics::increment( 'gallery', $gallery_id, 'views' );
        }
        
        return rest_ensure_response( array(
            'id' => $gallery->ID,
            'title' => $gallery->post_title,
            'description' => $gallery->post_content,
            'meta' => $meta,
            'items' => $items,
            'shortcode' => '[fotogrids_gallery id="' . $gallery_id . '"]',
        ) );
    }

    /**
     * Reveal the decrypted password for a gallery (admin eye-button).
     *
     * Only reachable when the permission callback
     * (Gallery_Permissions::check_gallery_password_read) passes, which requires
     * the fotogrids/security/can_view_gallery_password filter to return true.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public static function get_gallery_password( $request ) {
        $gallery_id = (int) $request['id'];

        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error(
                'gallery_not_found',
                __( 'Gallery not found', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        $stored    = (string) get_post_meta( $gallery_id, 'fotogrids_password', true );
        $plaintext = \FotoGrids\Password_Crypto::decrypt( $stored );

        // decrypt() returns '' for empty/invalid stored values — treat both as
        // "no password set" rather than surfacing an error.
        return rest_ensure_response( array( 'password' => $plaintext ) );
    }

    /**
     * Validate a visitor-submitted password and unlock the gallery.
     *
     * On success: sets a 7-day unlock cookie and returns the rendered gallery
     * HTML so the frontend can swap the locked placeholder in place without a
     * full page reload.
     *
     * On failure: returns a 401 with success=false. The caller should show an
     * inline error — no redirect or reload.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request object.
     * @return \WP_REST_Response|\WP_Error
     */
    public static function unlock_gallery( $request ) {
        $gallery_id = (int) $request['id'];
        $submitted  = (string) ( $request->get_param( 'password' ) ?? '' );

        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error(
                'gallery_not_found',
                __( 'Gallery not found', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        if ( $gallery->post_status !== 'publish' ) {
            return new \WP_Error(
                'gallery_not_published',
                __( 'Gallery is not published', 'fotogrids' ),
                array( 'status' => 403 )
            );
        }

        $stored   = (string) get_post_meta( $gallery_id, 'fotogrids_password', true );
        $settings = fotogrids_get_gallery_settings( $gallery_id );

        if ( ! \FotoGrids\Password_Crypto::verify( $submitted, $stored ) ) {
            return new \WP_Error(
                'fotogrids_invalid_password',
                __( 'Incorrect password.', 'fotogrids' ),
                array( 'status' => 401 )
            );
        }

        // Only set a persistent unlock cookie when the gallery is configured
        // to allow it. When password_remember is false the visitor must re-enter
        // the password on every page load.
        $cookie_key   = 'fotogrids_unlocked_' . $gallery_id;
        $cookie_value = self::make_unlock_cookie_value( $gallery_id, $stored );

        $remember      = ! empty( $settings['password_remember'] );
        $remember_days = max( 1, min( 365, (int) ( $settings['password_remember_days'] ?? 7 ) ) );

        if ( $remember ) {
            setcookie(
                $cookie_key,
                $cookie_value,
                array(
                    'expires'  => time() + ( $remember_days * DAY_IN_SECONDS ),
                    'path'     => COOKIEPATH,
                    'domain'   => COOKIE_DOMAIN,
                    'secure'   => is_ssl(),
                    'httponly' => true,
                    'samesite' => 'Lax',
                )
            );
        }

        // Make the cookie visible within this request so the render pipeline's
        // gate sees it as unlocked when producing the gallery HTML below.
        $_COOKIE[ $cookie_key ] = $cookie_value;

        // Render the gallery HTML server-side so the frontend can swap it in
        // without a full page reload.
        $html      = \FotoGrids\Public_Render::gallery_shortcode( array( 'id' => $gallery_id ) );
        $css_urls  = \FotoGrids\Render\Internal\Asset_Resolver::instance()->get_css_asset_urls();

        return rest_ensure_response( array(
            'success'  => true,
            'html'     => $html,
            'css'      => $css_urls,
            'remember' => $remember,
        ) );
    }

    /**
     * Produces the HMAC value stored in the unlock cookie.
     *
     * Ties the cookie to both the gallery ID and the current stored ciphertext,
     * so changing the gallery password automatically invalidates old cookies.
     *
     * @since  1.0.0
     * @param  int    $gallery_id Gallery ID.
     * @param  string $stored     Encrypted password from post meta.
     * @return string
     */
    public static function make_unlock_cookie_value( int $gallery_id, string $stored ): string {
        return hash_hmac( 'sha256', $gallery_id . '|' . $stored, wp_salt( 'auth' ) );
    }

    /**
     * Get galleries list for Gutenberg block
     *
     * Retrieves a paginated list of published galleries with basic metadata.
     * Specifically designed for use in Gutenberg block selection interfaces.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request with pagination and search parameters
     * @return \WP_REST_Response Array of galleries with metadata
     */
    public static function get_galleries_list( $request ) {
        $per_page = (int) $request['per_page'];
        $page = (int) $request['page'];
        $search = $request['search'];

        $args = array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => 'publish',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'DESC',
        );

        if ( ! empty( $search ) ) {
            $args['s'] = $search;
        }

        $query = new \WP_Query( $args );
        $galleries = array();

        foreach ( $query->posts as $post ) {
            $item_count = self::get_gallery_item_count( $post->ID );
            $featured_item = get_the_post_thumbnail_url( $post->ID, 'medium' );

            $galleries[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'item_count' => $item_count,
                'featured_item' => $featured_item ?: null,
                'created' => $post->post_date,
                'modified' => $post->post_modified,
            );
        }

        return rest_ensure_response( $galleries );
    }

    /**
     * Get gallery items endpoint for Gutenberg block
     *
     * Retrieves items from a specific gallery with optional pagination.
     * Designed for use in Gutenberg block preview and selection interfaces.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request The REST API request with gallery ID and pagination parameters
     * @return \WP_REST_Response|\WP_Error Array of gallery items or error response
     */
    public static function get_gallery_items_endpoint( $request ) {
        $gallery_id = (int) $request['id'];
        $limit = (int) $request['limit'];
        $offset = (int) $request['offset'];
        
        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error( 'gallery_not_found', __( 'Gallery not found.', 'fotogrids' ), array( 'status' => 404 ) );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        
        $sql = "SELECT * FROM $table WHERE gallery_id = %d ORDER BY position ASC";
        $params = array( $gallery_id );

        if ( $limit > 0 ) {
            $sql .= " LIMIT %d";
            $params[] = $limit;

            if ( $offset > 0 ) {
                $sql .= " OFFSET %d";
                $params[] = $offset;
            }
        }

        $results = $wpdb->get_results( 
            $wpdb->prepare( $sql, $params ), 
            ARRAY_A 
        );

        $items = array();
        foreach ( $results as $row ) {
            $attachment_id = (int) $row['attachment_id'];
            $attachment = get_post( $attachment_id );

            if ( $attachment ) {
                $items[] = array(
                    'id' => $attachment_id,
                    'position' => (int) $row['position'],
                    'caption' => $row['caption'],
                    'description' => $row['description'],
                    'url' => wp_get_attachment_url( $attachment_id ),
                    'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
                    'medium' => wp_get_attachment_image_url( $attachment_id, 'medium' ),
                    'large' => wp_get_attachment_image_url( $attachment_id, 'large' ),
                    'full' => wp_get_attachment_url( $attachment_id ),
                    'alt' => get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ),
                    'title' => $attachment->post_title,
                );
            }
        }

        return rest_ensure_response( $items );
    }

    /**
     * Get items for a specific gallery
     *
     * Retrieves all items associated with a specific gallery from the database,
     * including their metadata, captions, and various item size URLs.
     *
     * @since 1.0.0
     * @param int $gallery_id The ID of the gallery to retrieve items for
     * @return array Array of item data with attachment information
     */
    private static function get_gallery_items( $gallery_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $results = $wpdb->get_results( 
            $wpdb->prepare( 
                "SELECT * FROM $table WHERE gallery_id = %d ORDER BY position ASC", 
                $gallery_id 
            ), 
            ARRAY_A 
        );
        
        $items = array();
        foreach ( $results as $row ) {
            $attachment_id = (int) $row['attachment_id'];
            $attachment = get_post( $attachment_id );
            
            if ( $attachment ) {
                $items[] = array(
                    'id' => $attachment_id,
                    'position' => (int) $row['position'],
                    'caption' => $row['caption'],
                    'description' => $row['description'],
                    'location' => $row['location'],
                    'url' => wp_get_attachment_url( $attachment_id ),
                    'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
                    'medium' => wp_get_attachment_image_url( $attachment_id, 'medium' ),
                    'large' => wp_get_attachment_image_url( $attachment_id, 'large' ),
                    'full' => wp_get_attachment_url( $attachment_id ),
                    'alt' => get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ),
                );
            }
        }
        
        return $items;
    }

    /**
     * Get item count for a gallery
     *
     * Returns the total number of items associated with a specific gallery.
     * Used for display purposes and pagination calculations.
     *
     * @since 1.0.0
     * @param int $gallery_id The ID of the gallery to count items for
     * @return int The number of items in the gallery
     */
    private static function get_gallery_item_count( $gallery_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        return (int) $wpdb->get_var( 
            $wpdb->prepare( 
                "SELECT COUNT(*) FROM $table WHERE gallery_id = %d", 
                $gallery_id 
            ) 
        );
    }
}
