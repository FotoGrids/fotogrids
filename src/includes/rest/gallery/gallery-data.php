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
     * Set or clear the gallery's featured item.
     *
     * Body: { item_id: int | null }. When null, the explicit choice is
     * cleared (the runtime cover resolver falls back to the first valid
     * item). When set, the item must be an attachment AND still listed
     * in the gallery's `fotogrids_gallery_items`.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response|\WP_Error
     */
    public static function set_featured_item( $request ) {
        $gallery_id = (int) $request['id'];

        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error(
                'fotogrids_gallery_not_found',
                __( 'Gallery not found.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        $item_param = $request->get_param( 'item_id' );
        $clearing   = ( $item_param === null || $item_param === '' || (int) $item_param === 0 );

        if ( $clearing ) {
            delete_post_thumbnail( $gallery_id );
            return rest_ensure_response( array(
                'gallery_id' => $gallery_id,
                'item_id'    => null,
                'cleared'    => true,
            ) );
        }

        $item_id    = (int) $item_param;
        $attachment = get_post( $item_id );
        if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
            return new \WP_Error(
                'fotogrids_invalid_item',
                __( 'Featured item must be an attachment.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $item_ids = array_map( 'intval', \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id ) );
        if ( ! in_array( $item_id, $item_ids, true ) ) {
            return new \WP_Error(
                'fotogrids_item_not_in_gallery',
                __( 'Item is not part of this gallery.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        set_post_thumbnail( $gallery_id, $item_id );

        return rest_ensure_response( array(
            'gallery_id' => $gallery_id,
            'item_id'    => $item_id,
            'cleared'    => false,
        ) );
    }

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

        // decrypt() returns '' for empty/invalid stored values - treat both as
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
     * inline error - no redirect or reload.
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
        $settings = \FotoGrids\Galleries\Gallery_Repository::get_settings( $gallery_id );

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
        $resolver  = \FotoGrids\Render\Internal\Asset_Resolver::instance();
        $css_urls  = $resolver->get_css_asset_urls();
        $js_data   = $resolver->get_js_asset_data();

        return rest_ensure_response( array(
            'success'  => true,
            'html'     => $html,
            'css'      => $css_urls,
            'js'       => $js_data,
            'remember' => $remember,
        ) );
    }

    /**
     * Render a gallery server-side and return its HTML plus the CSS
     * handles the render pipeline collected.
     *
     * Used by the Album_To_Gallery_Ajax decorator's JS client to swap a
     * gallery's full render into the album in place, with whatever
     * stylesheets the pipeline decided this specific gallery needs.
     *
     * The response shape mirrors unlock_gallery exactly so the client
     * can use the same injectMissingStyles helper.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response|\WP_Error
     */
    public static function render_gallery( $request ) {
        $gallery_id      = (int) $request->get_param( 'gallery_id' );
        $page            = max( 1, (int) $request->get_param( 'page' ) );
        $items_per_page  = (int) $request->get_param( 'items_per_page' );
        $container_width = (int) $request->get_param( 'container_width' );
        $breakpoint      = (string) $request->get_param( 'breakpoint' );
        $partial         = (string) $request->get_param( 'partial' );
        $filters_raw     = $request->get_param( 'filters' );
        $filters         = is_array( $filters_raw ) ? $filters_raw : array();
        $random_seed     = (int) $request->get_param( 'random_seed' );
        $via_album_id    = (int) $request->get_param( 'via_album_id' );

        if ( $gallery_id <= 0 ) {
            return new \WP_Error(
                'gallery_id_required',
                __( 'A gallery_id is required.', 'fotogrids' ),
                array( 'status' => 400 )
            );
        }

        $gallery = get_post( $gallery_id );
        if ( ! $gallery || $gallery->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error(
                'gallery_not_found',
                __( 'Gallery not found.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        if ( $gallery->post_status !== 'publish' ) {
            return new \WP_Error(
                'gallery_not_published',
                __( 'Gallery is not published.', 'fotogrids' ),
                array( 'status' => 403 )
            );
        }

        // Branch on whether the caller asked for pagination/partial. When
        // no pagination params are supplied (Album_To_Gallery_Ajax path),
        // fall through to the legacy shortcode path so we don't change
        // behaviour for that caller. When ANY pagination param is set,
        // use the dedicated REST entry point that threads meta_overrides
        // into Context_Builder.
        $is_paginated_request = $page > 1 || $items_per_page > 0 || $container_width > 0 || $partial !== '' || $breakpoint !== 'desktop' || ! empty( $filters ) || $random_seed > 0;

        // Visit-context: any render emitted from this endpoint is an AJAX
        // swap. We pass via_album_id through both branches so the rendered
        // gallery's Collection_Header can build a Back / Breadcrumb that
        // points at the originating album.
        $shared_meta_overrides = array(
            'is_ajax_swap' => true,
        );
        if ( $via_album_id > 0 ) {
            $shared_meta_overrides['via_album_id'] = $via_album_id;
        }

        if ( ! $is_paginated_request ) {
            $html     = \FotoGrids\Public_Render::render_gallery_for_rest(
                $gallery_id,
                $shared_meta_overrides
            );
            $resolver = \FotoGrids\Render\Internal\Asset_Resolver::instance();
            $css_urls = $resolver->get_css_asset_urls();
            $js_data  = $resolver->get_js_asset_data();

            return rest_ensure_response( array(
                'success' => true,
                'html'    => $html,
                'css'     => $css_urls,
                'js'      => $js_data,
            ) );
        }

        $meta_overrides = array(
            'requested_page' => $page,
            'breakpoint'     => $breakpoint,
        );
        if ( $items_per_page > 0 ) {
            $meta_overrides['requested_per_page'] = $items_per_page;
        }
        if ( $container_width > 0 ) {
            $meta_overrides['container_width'] = $container_width;
        }
        if ( $partial !== '' ) {
            $meta_overrides['partial'] = $partial;
        }
        if ( ! empty( $filters ) ) {
            $meta_overrides['active_filters'] = $filters;
        }
        if ( $random_seed > 0 ) {
            $meta_overrides['random_seed'] = $random_seed;
        }
        $meta_overrides = array_merge( $meta_overrides, $shared_meta_overrides );

        $html     = \FotoGrids\Public_Render::render_gallery_for_rest( $gallery_id, $meta_overrides );
        $resolver = \FotoGrids\Render\Internal\Asset_Resolver::instance();
        $css_urls = $resolver->get_css_asset_urls();
        $js_data  = $resolver->get_js_asset_data();

        // Pagination metadata for the client. When filters are active,
        // total reflects the filtered set so chrome (load-more hasMore,
        // page-buttons total_pages) is computed against the filtered
        // count. We can't easily count the filtered set without
        // running the predicates here too, so for v1 we'll trust that
        // the renderer has produced the correct slice and read the
        // resulting size hint back. A cleaner pass would have
        // Context_Builder return a "filtered total" alongside the
        // sliced items; flagged as a follow-up below.
        // For now: when filters are absent, use the raw total; when
        // present, we still use the raw total but the client treats
        // has_more as authoritative — the renderer sets total_pages
        // to be consistent with what was sliced.
        $settings    = \FotoGrids\Galleries\Gallery_Repository::get_settings( $gallery_id );
        $page_size   = $items_per_page > 0
            ? $items_per_page
            : \FotoGrids\Render\Features\Pagination\Page_Size_Resolver::resolve_page_size( $settings );

        if ( ! empty( $filters ) ) {
            // Re-run filtering on the full id list, count survivors. This
            // mirrors Context_Builder::apply_server_filters but at the
            // ID level. We need this so the client knows the true
            // total_pages of the filtered set.
            $filtered_total = self::count_filtered_items( $gallery_id, $filters );
            $total          = $filtered_total;
        } else {
            $all_items = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
            $total     = is_array( $all_items ) ? count( $all_items ) : 0;
        }

        $meta = \FotoGrids\Public_Render::last_render_meta();
        if ( $meta !== null && $meta->pagination_page_size !== null ) {
            $page_size = (int) $meta->pagination_page_size;
        }
        $total_pages = $meta !== null && $meta->pagination_total_pages !== null
            ? (int) $meta->pagination_total_pages
            : ( $page_size > 0 ? max( 1, (int) ceil( $total / $page_size ) ) : 1 );
        $has_more    = $page < $total_pages;

        return rest_ensure_response( array(
            'success'     => true,
            'html'        => $html,
            'css'         => $css_urls,
            'js'          => $js_data,
            'page'        => $page,
            'page_size'   => $page_size,
            'total_pages' => $total_pages,
            'has_more'    => $has_more,
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
    /**
     * Counts how many items in a gallery survive the given filters.
     *
     * Thin wrapper over Gallery_Item_Sequence::count() — the canonical
     * counter that the renderer, the count-filtered-items helper, and
     * the lightbox slides endpoint all share.
     *
     * @since 1.0.0
     * @param int                              $gallery_id
     * @param array<string, array<int,string>> $filters    Sanitised filter map.
     * @return int
     */
    private static function count_filtered_items( int $gallery_id, array $filters ): int {
        $settings = \FotoGrids\Galleries\Gallery_Repository::get_settings( $gallery_id );
        return \FotoGrids\Render\Internal\Gallery_Item_Sequence::count( $gallery_id, $settings, $filters );
    }

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
            $item_count    = self::get_gallery_item_count( $post->ID );
            $featured_item = \FotoGrids\Galleries\Cover_Resolver::url_for_collection( $post->ID, 'medium' );

            $galleries[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'item_count' => $item_count,
                'featured_item' => $featured_item !== '' ? $featured_item : null,
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
     * Return cache status metadata for a gallery.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function get_cache_status( $request ) {
        $gallery_id = (int) $request['id'];
        $meta       = \FotoGrids\FotoGrids_Cache::get_meta( $gallery_id );

        return rest_ensure_response( array(
            'gallery_id' => $gallery_id,
            'cached'     => $meta !== null,
            'meta'       => $meta,
        ) );
    }

    /**
     * Flush the render cache for a specific gallery.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response
     */
    public static function flush_cache( $request ) {
        $gallery_id = (int) $request['id'];
        \FotoGrids\FotoGrids_Cache::flush_for_gallery( $gallery_id );

        return rest_ensure_response( array(
            'gallery_id' => $gallery_id,
            'flushed'    => true,
        ) );
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
