<?php
/**
 * Save pipeline for gallery / album collection settings.
 *
 * @package FotoGrids\Metaboxes
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Metaboxes;

use FotoGrids\Collection_Defaults;
use FotoGrids\Hooks\Actions_Gallery;
use FotoGrids\Permissions\Permission_Check;
use FotoGrids\Permissions\Permission_Gate;
use FotoGrids\Settings\Edit_Gate;
use FotoGrids\Settings\Setting_Value_Codec;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Persists collection settings on both the legacy `save_post` path and the
 * modern `wp_ajax_fotogrids_save_collection` path.
 *
 * Owns the permission gate (`Permission_Gate::settings_cap_for`) and the
 * Edit_Gate filter; per-key (de)serialisation is delegated to
 * `Setting_Value_Codec`.
 *
 * @since 1.0.0
 */
final class Collection_Save_Pipeline {

    /**
     * Wire the two save entry points.
     *
     * @since 1.0.0
     */
    public static function init(): void {
        add_action( 'save_post', [ __CLASS__, 'on_save_post' ] );
        add_action( 'wp_ajax_fotogrids_save_collection', [ __CLASS__, 'on_ajax_save_collection' ] );
    }

    /**
     * `save_post` handler — only fires for FotoGrids galleries with the
     * metabox nonce present.
     *
     * @since 1.0.0
     * @param int $post_id Post being saved.
     */
    public static function on_save_post( $post_id ): void {
        if ( ! isset( $_POST['fotogrids_meta_box_nonce'] )
            || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['fotogrids_meta_box_nonce'] ) ), 'fotogrids_meta_box' )
        ) {
            return;
        }

        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }

        if ( get_post_type( $post_id ) !== 'fotogrids_gallery' ) {
            return;
        }

        if ( isset( $_POST['fotogrids_gallery_items'] ) && is_array( $_POST['fotogrids_gallery_items'] ) ) {
            $gallery_items = array_map( 'intval', $_POST['fotogrids_gallery_items'] );
            update_post_meta( $post_id, 'fotogrids_gallery_items', wp_json_encode( $gallery_items ) );
        } else {
            delete_post_meta( $post_id, 'fotogrids_gallery_items' );
        }

        self::persist_settings_with_gate( (int) $post_id, $_POST );
    }

    /**
     * AJAX save handler for the React save flow.
     *
     * @since 1.0.0
     */
    public static function on_ajax_save_collection(): void {
        $nonce = sanitize_text_field( wp_unslash( $_POST['nonce'] ?? $_POST['fotogrids_meta_box_nonce'] ?? '' ) );
        if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'fotogrids_meta_box' ) ) {
            wp_send_json_error( [ 'message' => __( 'Security check failed', 'fotogrids' ) ] );
        }

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( [ 'message' => __( 'Insufficient permissions', 'fotogrids' ) ] );
        }

        $post_id = intval( $_POST['post_id'] ?? 0 );
        if ( ! $post_id ) {
            wp_send_json_error( [ 'message' => __( 'Invalid post ID', 'fotogrids' ) ] );
        }

        $post = get_post( $post_id );
        if ( ! $post || ! in_array( $post->post_type, [ 'fotogrids_gallery', 'fotogrids_album' ], true ) ) {
            wp_send_json_error( [ 'message' => __( 'Invalid collection', 'fotogrids' ) ] );
        }

        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            wp_send_json_error( [ 'message' => __( 'Cannot edit this gallery', 'fotogrids' ) ] );
        }

        $post_data    = [ 'ID' => $post_id ];
        $post_updated = false;

        if ( isset( $_POST['post_title'] ) && ! empty( $_POST['post_title'] ) ) {
            $post_data['post_title'] = sanitize_text_field( wp_unslash( $_POST['post_title'] ) );
            $post_updated            = true;
        }

        if ( isset( $_POST['content'] ) ) {
            $post_data['post_content'] = wp_kses_post( wp_unslash( $_POST['content'] ) );
            $post_updated              = true;
        }

        if ( isset( $_POST['post_status'] ) ) {
            $post_data['post_status'] = sanitize_text_field( wp_unslash( $_POST['post_status'] ) );
            $post_updated             = true;
        }

        if ( $post_updated ) {
            $result = wp_update_post( $post_data );
            if ( is_wp_error( $result ) ) {
                wp_send_json_error( [ 'message' => __( 'Failed to update gallery', 'fotogrids' ) ] );
            }
        }

        if ( isset( $_POST['fotogrids_gallery_items'] ) && is_array( $_POST['fotogrids_gallery_items'] ) ) {
            $gallery_items = array_map( 'intval', $_POST['fotogrids_gallery_items'] );
            update_post_meta( $post_id, 'fotogrids_gallery_items', wp_json_encode( $gallery_items ) );
        }

        $gated_result = self::persist_settings_with_gate( (int) $post_id, $_POST );

        if ( $post->post_type === 'fotogrids_gallery' ) {
            do_action( Actions_Gallery::SETTINGS_SAVED, $post_id );
        }

        $collection_type = $post->post_type === 'fotogrids_album'
            ? __( 'Album', 'fotogrids' )
            : __( 'Gallery', 'fotogrids' );

        wp_send_json_success( [
            /* translators: %s: collection type (Gallery or Album). */
            'message'      => sprintf( __( '%s saved successfully', 'fotogrids' ), $collection_type ),
            'post_id'      => $post_id,
            'post_title'   => get_the_title( $post_id ),
            'post_type'    => $post->post_type,
            'redirect_url' => get_edit_post_link( $post_id, 'raw' ),
            'gated'        => $gated_result['gated'] ?? [],
            // Settings keys the user attempted to save but lacked the
            // modify_fotogrids_{gallery|album}_settings cap for. Empty when
            // the user has the cap; the React save handler reads this to
            // show a toast.
            'skipped_for_permissions' => $gated_result['skipped_for_permissions'] ?? [],
        ] );
    }

    /**
     * Walk the gallery/album catalog, normalise + persist each setting whose
     * key is present in the request payload, then route through Edit_Gate.
     *
     * Returns the gate result + any keys that were dropped because the user
     * lacked the per-CPT settings cap (Option A: silent skip, surfaced to
     * the caller for toasting).
     *
     * @since 1.0.0
     * @param int   $post_id       Post being saved.
     * @param array $request_data  Raw request payload.
     * @return array{settings: array<string,mixed>, gated: array<int,array<string,mixed>>, skipped_for_permissions?: string[]}
     */
    private static function persist_settings_with_gate( int $post_id, array $request_data ): array {
        // Use gallery defaults as the iteration source — they are a superset
        // of album defaults for setting keys. This mirrors the legacy
        // behaviour of Meta_Boxes::save_collection_settings_with_gate.
        $defaults = Collection_Defaults::resolve_gallery();
        $incoming = [];
        $existing = [];

        foreach ( $defaults as $setting_key => $default_value ) {
            $post_meta_key = 'fotogrids_' . $setting_key;
            $existing[ $setting_key ] = Setting_Value_Codec::decode_stored(
                get_post_meta( $post_id, $post_meta_key, true ),
                $default_value
            );

            if ( ! isset( $request_data[ $post_meta_key ] ) ) {
                continue;
            }

            $field_type = Setting_Value_Codec::catalog_field_type( $setting_key );
            $incoming[ $setting_key ] = Setting_Value_Codec::normalize_incoming(
                $request_data[ $post_meta_key ],
                $default_value,
                $field_type
            );
        }

        // Permission gate: every key in $incoming is a Collection Settings
        // value (settings, not content). If the user lacks the per-CPT
        // settings cap, drop them all and report the skipped keys (Option A
        // behaviour — silent skip, surfaced to caller).
        $post_type    = get_post_type( $post_id ) ?: 'fotogrids_gallery';
        $settings_cap = Permission_Gate::settings_cap_for( $post_type );
        $skipped      = [];
        if ( $settings_cap !== null && ! Permission_Check::can( $settings_cap, $post_id ) && ! empty( $incoming ) ) {
            $skipped  = array_keys( $incoming );
            $incoming = [];
        }

        $gated_result = Edit_Gate::filter( $incoming, $existing );
        if ( ! empty( $skipped ) ) {
            $gated_result['skipped_for_permissions'] = $skipped;
        }

        foreach ( $gated_result['settings'] as $setting_key => $setting_value ) {
            if ( ! array_key_exists( $setting_key, $defaults ) ) {
                continue;
            }

            $field_type    = Setting_Value_Codec::catalog_field_type( $setting_key );
            $post_meta_key = 'fotogrids_' . $setting_key;
            Setting_Value_Codec::persist(
                $post_id,
                $post_meta_key,
                $setting_value,
                $defaults[ $setting_key ],
                $field_type
            );
        }

        // When password_protect is being turned off, remove the stored
        // encrypted password so the gallery can never be accidentally locked
        // by a stale ciphertext if the toggle is re-enabled without a new
        // password being set.
        $protect_value = $gated_result['settings']['password_protect'] ?? null;
        if ( $protect_value !== null && ! $protect_value ) {
            delete_post_meta( $post_id, 'fotogrids_password' );
        }

        return $gated_result;
    }
}
