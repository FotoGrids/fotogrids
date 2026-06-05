<?php
/**
 * Detects whether the current admin context is a FotoGrids screen.
 *
 * @package FotoGrids\Admin
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * "Am I on a FotoGrids admin page?" predicate.
 *
 * Accepts a `WP_Screen` object, a screen-hook string, or no argument (uses
 * the current screen via `get_current_screen()`).
 *
 * @since 1.0.0
 */
final class Admin_Screen {

    /**
     * Screen-hook strings that identify a FotoGrids admin page.
     *
     * Used both as a hook-string allowlist (for the string-argument shape)
     * and as a `WP_Screen::$id` allowlist (for the WP_Screen-argument shape).
     *
     * @var string[]
     */
    private const PAGE_HOOKS = [
        'toplevel_page_fotogrids',
        'fotogrids_page_fotogrids-dashboard',
        'fotogrids_page_fotogrids-templates',
        'fotogrids_page_fotogrids-library',
        'fotogrids_page_fotogrids-stats',
        'fotogrids_page_fotogrids-settings',
        'fotogrids_page_fotogrids-license',
        'fotogrids_page_fotogrids-upgrade',
        'fotogrids_page_fotogrids-tools',
    ];

    /**
     * Screen IDs for the post-list and post-edit screens of the two
     * FotoGrids CPTs.
     *
     * @var string[]
     */
    private const POST_SCREEN_IDS = [
        'edit-fotogrids_gallery',
        'fotogrids_gallery',
        'edit-fotogrids_album',
        'fotogrids_album',
    ];

    /**
     * The two FotoGrids custom post types.
     *
     * @var string[]
     */
    private const POST_TYPES = [ 'fotogrids_gallery', 'fotogrids_album' ];

    /**
     * Return true when the current request is on a FotoGrids admin page.
     *
     * @since 1.0.0
     * @param string|\WP_Screen|null $hook_or_screen Optional. Hook string, a
     *                                               `WP_Screen` instance, or
     *                                               null to use the current
     *                                               screen.
     * @return bool
     */
    public static function is_fotogrids( $hook_or_screen = null ): bool {
        if ( ! is_admin() ) {
            return false;
        }

        $screen = null;

        if ( $hook_or_screen instanceof \WP_Screen ) {
            $screen = $hook_or_screen;
        } elseif ( is_string( $hook_or_screen ) ) {
            $screen = get_current_screen();
            if ( $screen && $screen->id !== $hook_or_screen ) {
                if ( in_array( $hook_or_screen, self::PAGE_HOOKS, true ) ) {
                    return true;
                }

                if ( in_array( $hook_or_screen, [ 'edit.php', 'post.php', 'post-new.php' ], true ) ) {
                    global $post_type;
                    if ( in_array( $post_type, self::POST_TYPES, true ) ) {
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

        if ( in_array( $screen->id, self::PAGE_HOOKS, true )
            || in_array( $screen->id, self::POST_SCREEN_IDS, true )
        ) {
            return true;
        }

        if ( isset( $screen->post_type ) && in_array( $screen->post_type, self::POST_TYPES, true ) ) {
            return true;
        }

        global $post_type;
        if ( in_array( $post_type, self::POST_TYPES, true ) ) {
            return true;
        }

        return false;
    }
}
