<?php
namespace FotoGrids\REST\Items;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Item Save Handler
 *
 * Unified REST endpoint that saves both the item's core fields (title, alt,
 * caption, description, credit, external_url, link_target, exif) and its
 * structured metadata (tags, people, locations) in a single HTTP call.
 *
 * This replaces the previous two-step flow (wp-admin AJAX for fields + a
 * separate REST call for metadata), eliminating the silent partial-failure
 * window that existed when the AJAX succeeded but the metadata call failed.
 *
 * Response shape:
 * {
 *   success:   true,
 *   message:   string,
 *   metadata: {
 *     tags:      array,
 *     people:    array,
 *     locations: array,
 *     errors:    string[],
 *   },
 * }
 *
 * @since 1.0.0
 */
class Save_Item_Data {

    /**
     * Save all item data - core fields plus structured metadata.
     *
     * @since 1.0.0
     * @param \WP_REST_Request $request
     * @return \WP_REST_Response|\WP_Error
     */
    public static function save( \WP_REST_Request $request ) {
        $item_id = (int) $request->get_param( 'id' );

        $attachment = get_post( $item_id );
        if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
            return new \WP_Error(
                'fotogrids_not_found',
                __( 'Item not found.', 'fotogrids' ),
                array( 'status' => 404 )
            );
        }

        // ── Core attachment fields ────────────────────────────────────────────
        $title       = sanitize_text_field( $request->get_param( 'title' ) ?? '' );
        $alt         = sanitize_text_field( $request->get_param( 'alt' ) ?? '' );
        $caption     = sanitize_textarea_field( $request->get_param( 'caption' ) ?? '' );
        $description = sanitize_textarea_field( $request->get_param( 'description' ) ?? '' );

        $post_result = wp_update_post( array(
            'ID'           => $item_id,
            'post_title'   => $title,
            'post_excerpt' => $caption,
            'post_content' => $description,
        ), true );

        if ( is_wp_error( $post_result ) ) {
            return new \WP_Error(
                'fotogrids_save_failed',
                $post_result->get_error_message(),
                array( 'status' => 500 )
            );
        }

        update_post_meta( $item_id, '_wp_attachment_item_alt', $alt );

        // ── fotogrids_item_meta upsert ────────────────────────────────────────
        $credit       = sanitize_text_field( $request->get_param( 'credit' ) ?? '' );
        $external_url = sanitize_url( $request->get_param( 'external_url' ) ?? '' );
        $link_target  = sanitize_text_field( $request->get_param( 'link_target' ) ?? 'global' );

        $exif_data = array();
        $exif_raw  = $request->get_param( 'exif' );
        if ( is_array( $exif_raw ) ) {
            $exif_data = array_map( 'sanitize_text_field', $exif_raw );
        }

        global $wpdb;
        $meta_table = $wpdb->prefix . 'fotogrids_item_meta';

        $existing = $wpdb->get_row( $wpdb->prepare(
            "SELECT id FROM {$meta_table} WHERE attachment_id = %d AND gallery_id = 0",
            $item_id
        ) );

        $meta_row = array(
            'attachment_id' => $item_id,
            'gallery_id'    => 0,
            'credit'        => $credit,
            // Note: `location` VARCHAR column is deprecated; structured location
            // data lives in fotogrids_item_metadata. Do not write it here.
            'external_url'  => $external_url,
            'link_target'   => $link_target,
            'exif_data'     => ! empty( $exif_data ) ? wp_json_encode( $exif_data ) : null,
            'updated_at'    => current_time( 'mysql', true ),
        );

        if ( $existing ) {
            $wpdb->update(
                $meta_table,
                $meta_row,
                array( 'id' => $existing->id ),
                array( '%d', '%d', '%s', '%s', '%s', '%s', '%s' ),
                array( '%d' )
            );
        } else {
            $meta_row['created_at'] = current_time( 'mysql', true );
            $wpdb->insert(
                $meta_table,
                $meta_row,
                array( '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s' )
            );
        }

        // ── Structured metadata (tags / people / locations) ───────────────────
        $tags      = $request->get_param( 'tags' )      ?: array();
        $people    = $request->get_param( 'people' )    ?: array();
        $locations = $request->get_param( 'locations' ) ?: array();

        \FotoGrids\Metadata_Manager::clear_item_metadata( $item_id );

        $meta_results = array(
            'tags'      => array(),
            'people'    => array(),
            'locations' => array(),
            'errors'    => array(),
        );

        // Tags - FE sends integer IDs.
        foreach ( $tags as $tag_data ) {
            if ( is_int( $tag_data ) || ( is_numeric( $tag_data ) && intval( $tag_data ) == $tag_data ) ) {
                $tag_id = (int) $tag_data;
                $result = \FotoGrids\Metadata_Manager::link_tag_to_item( $item_id, $tag_id );
                if ( $result ) {
                    $meta_results['tags'][] = array( 'id' => $tag_id );
                } else {
                    $meta_results['errors'][] = sprintf(
                        __( 'Failed to link tag ID %d to item %d', 'fotogrids' ),
                        $tag_id,
                        $item_id
                    );
                }
            } else {
                // Fallback: name string (backwards compat).
                $tag_name = is_string( $tag_data ) ? trim( $tag_data ) : ( isset( $tag_data['name'] ) ? trim( $tag_data['name'] ) : '' );
                if ( empty( $tag_name ) ) {
                    continue;
                }
                $result = \FotoGrids\Metadata_Manager::add_tag_to_item( $item_id, $tag_name );
                if ( $result ) {
                    $meta_results['tags'][] = array( 'name' => $tag_name );
                } else {
                    $meta_results['errors'][] = sprintf(
                        __( 'Failed to add tag: %s to item %d', 'fotogrids' ),
                        $tag_name,
                        $item_id
                    );
                }
            }
        }

        // People - FE sends { id, name, details }.
        foreach ( $people as $person ) {
            $person_id = isset( $person['id'] ) ? (int) $person['id'] : 0;
            $name      = isset( $person['name'] )    ? trim( $person['name'] )    : '';
            $details   = isset( $person['details'] ) ? trim( $person['details'] ) : '';

            if ( $person_id > 0 ) {
                $result = \FotoGrids\Metadata_Manager::link_person_to_item( $item_id, $person_id );
                if ( $result ) {
                    $meta_results['people'][] = array( 'id' => $person_id, 'name' => $name );
                } else {
                    $meta_results['errors'][] = sprintf(
                        __( 'Failed to link person ID %d to item %d', 'fotogrids' ),
                        $person_id,
                        $item_id
                    );
                }
            } elseif ( ! empty( $name ) ) {
                $result = \FotoGrids\Metadata_Manager::add_person_to_item( $item_id, $name, $details );
                if ( $result ) {
                    $meta_results['people'][] = array( 'name' => $name );
                } else {
                    $meta_results['errors'][] = sprintf( __( 'Failed to add person: %s', 'fotogrids' ), $name );
                }
            }
        }

        // Locations - FE sends { id, name, latitude, longitude }.
        foreach ( $locations as $location ) {
            $location_id = isset( $location['id'] ) ? (int) $location['id'] : 0;
            $name        = isset( $location['name'] )      ? trim( $location['name'] )  : '';
            $latitude    = isset( $location['latitude'] )  ? $location['latitude']      : null;
            $longitude   = isset( $location['longitude'] ) ? $location['longitude']     : null;

            if ( $location_id > 0 ) {
                $result = \FotoGrids\Metadata_Manager::link_location_to_item( $item_id, $location_id );
                if ( $result ) {
                    $meta_results['locations'][] = array( 'id' => $location_id, 'name' => $name );
                } else {
                    $meta_results['errors'][] = sprintf(
                        __( 'Failed to link location ID %d to item %d', 'fotogrids' ),
                        $location_id,
                        $item_id
                    );
                }
            } elseif ( ! empty( $name ) ) {
                $result = \FotoGrids\Metadata_Manager::add_location_to_item( $item_id, $name, $latitude, $longitude );
                if ( $result ) {
                    $meta_results['locations'][] = array( 'name' => $name );
                } else {
                    $meta_results['errors'][] = sprintf( __( 'Failed to add location: %s', 'fotogrids' ), $name );
                }
            }
        }

        /**
         * Fires after core metadata has been saved for an item.
         *
         * Pro (or any extension) can hook here to save additional metadata types
         * atomically within the same save request lifecycle.
         *
         * @since 1.0.0
         * @param array            $meta_results Current results array (tags, people, locations, errors).
         * @param int              $item_id      The attachment ID being saved.
         * @param \WP_REST_Request $request      The full REST request (allows access to extra params).
         */
        $meta_results = apply_filters( 'fotogrids/save/item/metadata', $meta_results, $item_id, $request );

        return rest_ensure_response( array(
            'success'  => true,
            'message'  => __( 'Item saved successfully.', 'fotogrids' ),
            'metadata' => $meta_results,
        ) );
    }
}
