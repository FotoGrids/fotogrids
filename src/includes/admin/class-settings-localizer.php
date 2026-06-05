<?php
/**
 * Builds the `wp_localize_script` payload for the gallery/album settings UI.
 *
 * @package FotoGrids\Admin
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Admin;

use FotoGrids\Collection_Defaults;
use FotoGrids\License_Manager;
use FotoGrids\Password_Crypto;
use FotoGrids\Settings\SEO_Settings_Store;
use FotoGrids\Settings\Sharing_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Builds the payload that drives the React Collection Settings panel.
 *
 * Two surfaces consume it: the per-post metabox (real post id, real
 * settings) and the global defaults page in wp-admin (`is_defaults = true`,
 * post id 0, reads from the `fotogrids_gallery_defaults` option).
 *
 * Guarantees the encrypted password ciphertext never reaches the browser
 * even when callers pre-build the settings array.
 *
 * @since 1.0.0
 */
final class Settings_Localizer {

    /**
     * Build the localised data payload.
     *
     * @since 1.0.0
     * @param array $args {
     *     Optional. Localiser arguments.
     *     @type int          $post_id        Post ID (default: 0).
     *     @type string|null  $post_type      'fotogrids_gallery' | 'fotogrids_album'.
     *     @type bool         $is_defaults    Whether this is the global defaults page.
     *     @type array        $gallery_items  Pre-loaded gallery items (default: read from post meta).
     *     @type array|null   $settings       Pre-built settings array (default: read from post meta).
     *     @type array|null   $defaults       Pre-built defaults array (default: from Collection_Defaults).
     * }
     * @return array<string, mixed> Localised script data.
     */
    public static function data_for_collection( array $args = [] ): array {
        $args = wp_parse_args( $args, [
            'post_id'       => 0,
            'post_type'     => null,
            'is_defaults'   => false,
            'gallery_items' => [],
            'settings'      => null,
            'defaults'      => null,
        ] );

        $args['post_type'] = self::resolve_post_type( $args['post_type'], (int) $args['post_id'] );

        if ( $args['defaults'] === null ) {
            $args['defaults'] = self::resolve_defaults( $args['post_type'], (bool) $args['is_defaults'] );
        }

        if ( $args['settings'] === null ) {
            $args['settings'] = self::build_settings_from_storage(
                (array) $args['defaults'],
                (int) $args['post_id'],
                (bool) $args['is_defaults']
            );
        }

        // Hard guarantee: the encrypted password ciphertext must NEVER reach
        // the browser, regardless of how $args['settings'] was built.
        if ( isset( $args['settings']['password'] ) && $args['settings']['password'] !== '' ) {
            $args['settings']['password'] = '';
        }

        $gallery_items = self::resolve_gallery_items(
            $args['gallery_items'],
            (int) $args['post_id'],
            (bool) $args['is_defaults']
        );

        return self::assemble_payload( $args, $gallery_items );
    }

    /**
     * Resolve the effective post type from explicit args or by reading the
     * post.
     */
    private static function resolve_post_type( ?string $explicit, int $post_id ): string {
        if ( $explicit !== null ) {
            return $explicit;
        }

        if ( $post_id > 0 ) {
            $post = get_post( $post_id );
            if ( $post ) {
                return $post->post_type;
            }
        }

        return 'gallery';
    }

    /**
     * Resolve the defaults array for a given post type.
     *
     * @return array<string, mixed>
     */
    private static function resolve_defaults( string $post_type, bool $is_defaults_page ): array {
        if ( $post_type === 'fotogrids_album' ) {
            return Collection_Defaults::resolve_album( $is_defaults_page );
        }
        return Collection_Defaults::resolve_gallery( $is_defaults_page );
    }

    /**
     * Read each setting key from its storage (post meta for collections, the
     * `fotogrids_gallery_defaults` option for the defaults page) and decode
     * to the in-memory PHP shape that the JS payload expects.
     *
     * Mirrors the legacy `Admin_Helpers::get_collection_settings_localized_data`
     * behaviour exactly — including the "boolean stored as string '1' / '0'"
     * quirk that the JS toggle's `=== '1'` check depends on.
     *
     * @param array $defaults    Defaults array (drives the key list + type coercion).
     * @param int   $post_id     Post id (0 for defaults page).
     * @param bool  $is_defaults Defaults-page mode.
     * @return array<string, mixed>
     */
    private static function build_settings_from_storage( array $defaults, int $post_id, bool $is_defaults ): array {
        $settings = [];

        if ( $is_defaults ) {
            $saved_defaults = get_option( 'fotogrids_gallery_defaults', [] );
            foreach ( $defaults as $key => $default_value ) {
                if ( ! isset( $saved_defaults[ $key ] ) ) {
                    $settings[ $key ] = $default_value;
                    continue;
                }

                $saved_value = $saved_defaults[ $key ];
                if ( is_bool( $default_value ) ) {
                    $settings[ $key ] = $saved_value;
                    continue;
                }
                if ( is_string( $saved_value ) ) {
                    $decoded = json_decode( $saved_value, true );
                    if ( is_array( $decoded ) ) {
                        $settings[ $key ] = $decoded;
                    } elseif ( json_last_error() === JSON_ERROR_NONE && $decoded !== null ) {
                        $settings[ $key ] = $decoded;
                    } else {
                        $settings[ $key ] = $saved_value;
                    }
                    continue;
                }
                $settings[ $key ] = $saved_value;
            }

            return $settings;
        }

        foreach ( $defaults as $key => $default_value ) {
            $saved_value = get_post_meta( $post_id, 'fotogrids_' . $key, true );

            // The `password` field is stored encrypted. Never send the
            // ciphertext to the browser — the eye-button reveal is done via
            // a dedicated permission-gated REST call instead.
            if ( $key === 'password' ) {
                $settings[ $key ] = '';
                continue;
            }

            if ( $saved_value === '' ) {
                $settings[ $key ] = $default_value;
                continue;
            }

            if ( is_bool( $default_value ) ) {
                // Boolean settings: stored as '1'/'0'. Keep as string so the
                // JS toggle's `=== '1'` check works correctly.
                $settings[ $key ] = $saved_value;
                continue;
            }

            if ( is_string( $saved_value ) ) {
                $decoded = json_decode( $saved_value, true );
                if ( is_array( $decoded ) ) {
                    // Array values (e.g. token_select, responsive objects).
                    $settings[ $key ] = $decoded;
                } elseif ( json_last_error() === JSON_ERROR_NONE && $decoded !== null ) {
                    // Scalar JSON values (e.g. numeric strings "2", "16") —
                    // use the decoded scalar so the JS side receives the
                    // correct type (integer, not string) for
                    // strict-equality comparisons in button_group renders.
                    $settings[ $key ] = $decoded;
                } else {
                    $settings[ $key ] = $saved_value;
                }
                continue;
            }

            $settings[ $key ] = $saved_value;
        }

        return $settings;
    }

    /**
     * Resolve the gallery items list.
     *
     * @param array $caller_value Caller-provided value (preferred when non-empty).
     * @param int   $post_id      Post id; reads `fotogrids_gallery_items` post meta
     *                            when caller didn't provide and we're not on the
     *                            defaults page.
     * @param bool  $is_defaults  Defaults-page mode.
     * @return array<int|string, mixed>
     */
    private static function resolve_gallery_items( $caller_value, int $post_id, bool $is_defaults ): array {
        if ( ! empty( $caller_value ) ) {
            return (array) $caller_value;
        }

        if ( $is_defaults || $post_id <= 0 ) {
            return [];
        }

        $stored = get_post_meta( $post_id, 'fotogrids_gallery_items', true );
        if ( is_string( $stored ) ) {
            $stored = json_decode( $stored, true );
        }
        return is_array( $stored ) ? $stored : [];
    }

    /**
     * Assemble the final payload from already-resolved pieces.
     *
     * @param array $args          Resolved args (post_id, post_type, is_defaults).
     * @param array $gallery_items Resolved gallery items list.
     * @return array<string, mixed>
     */
    private static function assemble_payload( array $args, array $gallery_items ): array {
        $fg_post_type = $args['post_type'] === 'fotogrids_album' ? 'album' : 'gallery';

        $data = [
            'settings'         => $args['settings'],
            'defaults'         => $args['defaults'],
            'globalSharing'    => Sharing_Settings_Store::get(),
            'globalSeo'        => SEO_Settings_Store::get(),
            'postId'           => $args['post_id'],
            'postType'         => $args['post_type'],
            'nonce'            => wp_create_nonce( 'fotogrids_settings' ),
            'ajaxUrl'          => admin_url( 'admin-ajax.php' ),
            'isProActive'      => License_Manager::is_pro_active(),
            'enabledFeatures'  => License_Manager::get_enabled_features(),
            'galleryItems'     => $gallery_items,
            'canEditPosts'     => current_user_can( 'edit_posts' ),
            'defaultsUrl'      => admin_url( 'admin.php?page=fotogrids-settings&tab=defaults&subtab=' . $fg_post_type ),
            'documentationUrl' => $fg_post_type === 'album'
                ? 'https://go.fotogrids.com/docs/albums'
                : 'https://go.fotogrids.com/docs/galleries',
            'toolsUrl'         => admin_url( 'admin.php?page=fotogrids-tools' ),
            'strings'          => [
                'layout'   => __( 'Layout', 'fotogrids' ),
                'styling'  => __( 'Styling', 'fotogrids' ),
                'effects'  => __( 'Effects', 'fotogrids' ),
                'advanced' => __( 'Advanced', 'fotogrids' ),
                'pro'      => __( 'Pro', 'fotogrids' ),
            ],
        ];

        // restUrl + passwordIsSet only make sense for real-post pages.
        if ( ! $args['is_defaults'] && $args['post_id'] > 0 ) {
            $data['restUrl']   = rest_url( 'fotogrids/v1/' );
            $data['restNonce'] = wp_create_nonce( 'wp_rest' );

            // Let the React password field know whether a password has been
            // configured without exposing the encrypted value. The actual
            // plaintext is only ever retrieved via the permission-gated
            // GET /gallery/{id}/password REST endpoint.
            $stored_password       = (string) get_post_meta( $args['post_id'], 'fotogrids_password', true );
            $data['passwordIsSet'] = Password_Crypto::is_encrypted( $stored_password );
        }

        if ( current_user_can( 'manage_fotogrids_settings' ) ) {
            $simulate_state = isset( $_GET['fotogrids_simulate_state'] )
                ? sanitize_text_field( wp_unslash( (string) $_GET['fotogrids_simulate_state'] ) )
                : '';
            if ( in_array( $simulate_state, [ 'ok', 'password_required', 'expired', 'unauthorized' ], true ) ) {
                $data['catalogSimulateState'] = $simulate_state;
            }
        }

        if ( $args['is_defaults'] ) {
            $data['isDefaultsMode'] = true;
        }

        return $data;
    }
}
