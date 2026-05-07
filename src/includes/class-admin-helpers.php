<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Admin Helper Functions Class
 *
 * Contains utility functions for admin-related operations
 */
class Admin_Helpers {

    /**
     * Check if current admin page is a FotoGrids admin page
     *
     * Works with both screen objects and hook strings.
     * Checks screen IDs, post types, and page hooks.
     *
     * @param string|WP_Screen|null $hook_or_screen Optional. Screen hook string, WP_Screen object, or null to use current screen
     * @return bool True if on a FotoGrids admin page
     */
    public static function is_fotogrids_page( $hook_or_screen = null ) {
        if ( ! is_admin() ) {
            return false;
        }

        $screen = null;

        if ( $hook_or_screen instanceof \WP_Screen ) {
            $screen = $hook_or_screen;
        } elseif ( is_string( $hook_or_screen ) ) {
            $screen = get_current_screen();
            if ( $screen && $screen->id !== $hook_or_screen ) {

                $fotogrids_hooks = array(
                    'toplevel_page_fotogrids',
                    'fotogrids_page_fotogrids-dashboard',
                    'fotogrids_page_fotogrids-templates',
                    'fotogrids_page_fotogrids-stats',
                    'fotogrids_page_fotogrids-settings',
                    'fotogrids_page_fotogrids-license',
                    'fotogrids_page_fotogrids-upgrade',
                );

                if ( in_array( $hook_or_screen, $fotogrids_hooks, true ) ) {
                    return true;
                }

                if ( in_array( $hook_or_screen, array( 'edit.php', 'post.php', 'post-new.php' ), true ) ) {
                    global $post_type;
                    if ( in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
                        return true;
                    }
                }
            }
        } else {
            $screen = get_current_screen();
        }

        if ( ! $screen ) {
            return false;
        }

        $fotogrids_screen_ids = array(
            'toplevel_page_fotogrids',
            'fotogrids_page_fotogrids-dashboard',
            'fotogrids_page_fotogrids-templates',
            'fotogrids_page_fotogrids-stats',
            'fotogrids_page_fotogrids-settings',
            'fotogrids_page_fotogrids-license',
            'fotogrids_page_fotogrids-upgrade',
            'edit-fotogrids_gallery',
            'fotogrids_gallery',
            'edit-fotogrids_album',
            'fotogrids_album',
        );

        if ( in_array( $screen->id, $fotogrids_screen_ids, true ) ) {
            return true;
        }

        if ( isset( $screen->post_type ) && in_array( $screen->post_type, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
            return true;
        }

        global $post_type;
        if ( in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
            return true;
        }

        return false;
    }

    /**
     * Get localized script data for gallery settings
     *
     * @param array $args {
     *     Optional. Array of arguments.
     *     @type int    $post_id        Post ID (default: 0)
     *     @type bool   $is_defaults    Whether this is defaults mode (default: false)
     *     @type array  $gallery_items  Gallery items array (default: empty array)
     *     @type array  $settings       Settings array (default: from defaults)
     *     @type array  $defaults       Defaults array (default: from fotogrids_get_default_gallery_settings)
     * }
     * @return array Localized script data
     */
    public static function get_collection_settings_localized_data( $args = array() ) {
        $defaults_args = array(
            'post_id' => 0,
            'post_type' => null,
            'is_defaults' => false,
            'gallery_items' => array(),
            'settings' => null,
            'defaults' => null,
        );
        $args = wp_parse_args( $args, $defaults_args );

        // Detect post type if not provided
        if ( $args['post_type'] === null && $args['post_id'] > 0 ) {
            $post = get_post( $args['post_id'] );
            if ( $post ) {
                $args['post_type'] = $post->post_type;
            } else {
                $args['post_type'] = 'gallery'; // Default fallback
            }
        } elseif ( $args['post_type'] === null ) {
            $args['post_type'] = 'gallery'; // Default fallback
        }

        // Get defaults based on post type
        if ( $args['defaults'] === null ) {
            if ( $args['post_type'] === 'fotogrids_album' ) {
                $args['defaults'] = fotogrids_get_default_album_settings( $args['is_defaults'] );
            } else {
                $args['defaults'] = fotogrids_get_default_gallery_settings( $args['is_defaults'] );
            }
        }

        // Get settings if not provided
        if ( $args['settings'] === null ) {
            $args['settings'] = array();
            foreach ( $args['defaults'] as $key => $default_value ) {
                if ( $args['is_defaults'] ) {
                    $saved_defaults = get_option( 'fotogrids_gallery_defaults', array() );
                    if ( isset( $saved_defaults[$key] ) ) {
                        $saved_value = $saved_defaults[$key];
                        if ( is_string( $saved_value ) ) {
                            $decoded = json_decode( $saved_value, true );
                            $args['settings'][$key] = ( is_array( $decoded ) ) ? $decoded : $saved_value;
                        } else {
                            $args['settings'][$key] = $saved_value;
                        }
                    } else {
                        $args['settings'][$key] = $default_value;
                    }
                } else {
                    $saved_value = get_post_meta( $args['post_id'], 'fotogrids_' . $key, true );
                    if ( $saved_value !== '' ) {
                        if ( is_string( $saved_value ) ) {
                            $decoded = json_decode( $saved_value, true );
                            $args['settings'][$key] = ( is_array( $decoded ) ) ? $decoded : $saved_value;
                        } else {
                            $args['settings'][$key] = $saved_value;
                        }
                    } else {
                        $args['settings'][$key] = $default_value;
                    }
                }
            }
        }

        // Prepare gallery items
        $gallery_items = $args['gallery_items'];
        if ( empty( $gallery_items ) && ! $args['is_defaults'] && $args['post_id'] > 0 ) {
            $gallery_items = get_post_meta( $args['post_id'], 'fotogrids_gallery_items', true );
            if ( is_string( $gallery_items ) ) {
                $gallery_items = json_decode( $gallery_items, true );
            }
            if ( ! is_array( $gallery_items ) ) {
                $gallery_items = array();
            }
        }

        $fg_post_type = 'gallery';
        if ( $args['post_type'] === 'fotogrids_album' ) {
            $fg_post_type = 'album';
        }

        $data = array(
            'settings' => $args['settings'],
            'defaults' => $args['defaults'],
            'postId' => $args['post_id'],
            'postType' => $args['post_type'],
            'nonce' => wp_create_nonce( 'fotogrids_settings' ),
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'isProActive' => License_Manager::is_pro_active(), // Backward compatibility
            'enabledFeatures' => License_Manager::get_enabled_features(),
            'galleryItems' => $gallery_items,
            'canEditPosts' => current_user_can( 'edit_posts' ),
            'defaultsUrl' => admin_url( 'admin.php?page=fotogrids-settings&tab=defaults&subtab=' . $fg_post_type ),
            'documentationUrl' => $fg_post_type === 'album'
                ? 'https://go.fotogrids.com/docs/albums'
                : 'https://go.fotogrids.com/docs/galleries',
            'strings' => array(
                'layout' => __( 'Layout', 'fotogrids' ),
                'styling' => __( 'Styling', 'fotogrids' ),
                'effects' => __( 'Effects', 'fotogrids' ),
                'advanced' => __( 'Advanced', 'fotogrids' ),
                'pro' => __( 'Pro', 'fotogrids' ),
            ),
        );

        // Add restUrl for gallery edit pages
        if ( ! $args['is_defaults'] && $args['post_id'] > 0 ) {
            $data['restUrl'] = rest_url( 'fotogrids/v1/' );
        }

        // Add isDefaultsMode flag
        if ( $args['is_defaults'] ) {
            $data['isDefaultsMode'] = true;
        }

        return $data;
    }
}

