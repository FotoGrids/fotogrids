<?php
/**
 * Plugin-wide options that govern how Permissions behave.
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
 * Thin wrapper around the WordPress options the Permissions feature owns.
 *
 * Today: a single option that controls how the Collection Settings and
 * Templates metaboxes render for users who lack
 * modify_fotogrids_{gallery|album}_settings on the post they're editing.
 *
 *   'readonly' (default) - render the metabox with a notice + every control
 *                          disabled. Same content, can't be edited. Editors
 *                          can still see what an administrator has
 *                          configured.
 *   'hidden'             - skip the metabox entirely.
 *
 * @since 1.0.0
 */
final class Permission_Options {

    /**
     * Option key for the unauthorised-metabox visibility mode.
     */
    public const OPTION_UNAUTHORISED_VISIBILITY = 'fotogrids_unauthorised_settings_visibility';

    /**
     * Allowed values for the visibility option.
     *
     * @var string[]
     */
    public const VISIBILITY_MODES = [ 'readonly', 'hidden' ];

    /**
     * Default value when the option has never been written.
     */
    public const DEFAULT_VISIBILITY = 'readonly';

    /**
     * Current visibility mode. Always returns one of self::VISIBILITY_MODES.
     */
    public static function get_unauthorised_visibility(): string {
        $value = get_option( self::OPTION_UNAUTHORISED_VISIBILITY, self::DEFAULT_VISIBILITY );
        return in_array( $value, self::VISIBILITY_MODES, true )
            ? (string) $value
            : self::DEFAULT_VISIBILITY;
    }

    /**
     * Persist the visibility mode. Returns true on success / no-change,
     * false on invalid input.
     */
    public static function set_unauthorised_visibility( string $value ): bool {
        if ( ! in_array( $value, self::VISIBILITY_MODES, true ) ) {
            return false;
        }
        update_option( self::OPTION_UNAUTHORISED_VISIBILITY, $value, false );
        return true;
    }
}
