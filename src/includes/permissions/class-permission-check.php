<?php
/**
 * Object-aware FotoGrids permission check.
 *
 * @package FotoGrids\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Permissions;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Single entry point for every FotoGrids permission decision.
 *
 * Replacement for direct current_user_can() calls in new code. Resolution:
 *
 *   1. Fast path - delegate to user_can() / current_user_can() with the
 *      object id if one was passed (engages WP map_meta_cap on CPT caps).
 *   2. Fire the 'fotogrids/permissions/check' filter so Pro can extend
 *      with user-level grants, scoped grants, and deny rules without
 *      every call site having to know about them.
 *
 * Free's behaviour is identical to native WP. Pro hooks the filter to layer
 * the Permissions Manager grants table on top.
 *
 * Three call shapes:
 *
 *   Permission_Check::can( 'manage_fotogrids' )
 *       → current user, global cap
 *
 *   Permission_Check::can( 'edit_post', 42 )
 *       → current user, cap scoped to post 42 (engages map_meta_cap)
 *
 *   Permission_Check::can( 'edit_fotogrids_galleries', $user, 42 )
 *       → explicit user, cap scoped to post 42
 *
 * @since 1.0.0
 */
final class Permission_Check {

    /**
     * Resolve a FotoGrids capability check.
     *
     * @since 1.0.0
     * @param string                 $capability     The capability to check.
     * @param int|\WP_User|null      $user_or_object Either the user (id or
     *                                               WP_User) OR the object id
     *                                               to scope to. If int and
     *                                               $object_id is null, treated
     *                                               as object_id (current user
     *                                               is assumed).
     * @param int|null               $object_id      Optional explicit object id.
     * @return bool
     */
    public static function can( string $capability, $user_or_object = null, ?int $object_id = null ): bool {
        if ( $capability === '' ) {
            return false;
        }

        // Argument shape disambiguation.
        $user = null;
        if ( $user_or_object instanceof \WP_User ) {
            $user = $user_or_object;
        } elseif ( is_int( $user_or_object ) && $object_id === null ) {
            // Two-arg shape: ( cap, object_id ) - current user.
            $object_id = $user_or_object;
        } elseif ( is_int( $user_or_object ) ) {
            $user = get_user_by( 'id', $user_or_object );
            if ( ! $user ) {
                return false;
            }
        }

        // Fast path - delegate to WP.
        if ( $user instanceof \WP_User ) {
            $allowed = $object_id !== null
                ? user_can( $user, $capability, (int) $object_id )
                : user_can( $user, $capability );
        } else {
            $allowed = $object_id !== null
                ? current_user_can( $capability, (int) $object_id )
                : current_user_can( $capability );
        }

        // Master-cap fallback. `manage_fotogrids` is documented as the master
        // capability that grants every other FotoGrids permission. Honour that
        // here so newly-added atomic caps work for admins on existing installs
        // even before the role-grant migration in Activator runs, and so the
        // contract holds regardless of cap-grant drift. Skip when the cap
        // being checked IS manage_fotogrids (avoids infinite recursion) and
        // when it isn't a FotoGrids cap at all.
        if ( ! $allowed
            && $capability !== 'manage_fotogrids'
            && self::is_fotogrids_capability( $capability )
        ) {
            if ( $user instanceof \WP_User ) {
                $allowed = user_can( $user, 'manage_fotogrids' );
            } else {
                $allowed = current_user_can( 'manage_fotogrids' );
            }
        }

        /**
         * Filter: post-WP permission decision.
         *
         * Pro hooks here to consult the fotogrids_permission_grants table for
         * scoped, user-level and token grants. Receives the resolved WP
         * decision plus full context so Pro can flip it either way.
         *
         * Free never registers a callback for this filter.
         *
         * @since 1.0.0
         * @param bool          $allowed    The current decision.
         * @param string        $capability Cap being checked.
         * @param \WP_User|null $user       User being checked (null = current).
         * @param int|null      $object_id  Object id if scoped, else null.
         */
        return (bool) apply_filters(
            'fotogrids/permissions/check',
            (bool) $allowed,
            $capability,
            $user,
            $object_id
        );
    }

    /**
     * Heuristic for whether $capability is owned by FotoGrids.
     *
     * Used to scope the manage_fotogrids master-fallback so it only ever
     * grants FotoGrids caps - never WordPress core caps or third-party caps.
     * Cheap string check by design; the Permission_Registry catalogue is not
     * yet guaranteed booted at every call site.
     *
     * @since 1.0.0
     * @param string $capability
     * @return bool
     */
    private static function is_fotogrids_capability( string $capability ): bool {
        if ( $capability === '' ) {
            return false;
        }
        if ( strpos( $capability, 'fotogrids' ) !== false ) {
            return true;
        }
        // Logical-cap convention: `fg_…`.
        if ( strpos( $capability, 'fg_' ) === 0 ) {
            return true;
        }
        return false;
    }
}
