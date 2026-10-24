<?php
/**
 * Easy or Advanced settings mode, per user.
 *
 * @package FotoGrids\Settings
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Hooks\Filters_Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Settings_Mode
 *
 * Resolves which settings mode a user sees: their own choice, else the site
 * default, else Easy. Also tracks the one-time upgrade tip.
 *
 * @package FotoGrids\Settings
 * @since   1.3.0
 */
final class Settings_Mode {

	const EASY     = 'easy';
	const ADVANCED = 'advanced';

	const SITE_OPTION        = 'fotogrids_settings_mode';
	const USER_META          = 'fotogrids_settings_mode';
	const TIP_OPTION         = 'fotogrids_settings_mode_tip';
	const TIP_DISMISSED_META = 'fotogrids_settings_mode_tip_dismissed';

	const PREFERENCE_MODE          = 'settings_mode';
	const PREFERENCE_TIP_DISMISSED = 'settings_mode_tip_dismissed';

	/**
	 * Whether a value is a known mode.
	 *
	 * @since  1.3.0
	 * @param  string $mode Mode to check.
	 * @return bool
	 */
	public static function is_valid( string $mode ): bool {
		return in_array( $mode, array( self::EASY, self::ADVANCED ), true );
	}

	/**
	 * The site default mode.
	 *
	 * @since  1.3.0
	 * @return string
	 */
	public static function site_default(): string {
		$mode = get_option( self::SITE_OPTION, self::EASY );

		return is_string( $mode ) && self::is_valid( $mode ) ? $mode : self::EASY;
	}

	/**
	 * The mode a user sees.
	 *
	 * @since  1.3.0
	 * @param  int $user_id User ID.
	 * @return string
	 */
	public static function resolve( int $user_id ): string {
		if ( $user_id > 0 ) {
			$mode = get_user_meta( $user_id, self::USER_META, true );

			if ( is_string( $mode ) && self::is_valid( $mode ) ) {
				return $mode;
			}
		}

		return self::site_default();
	}

	/**
	 * Store a user's mode.
	 *
	 * @since  1.3.0
	 * @param  int    $user_id User ID.
	 * @param  string $mode    Mode to store.
	 * @return bool Whether the user's stored mode now equals `$mode`.
	 */
	public static function set_user_mode( int $user_id, string $mode ): bool {
		if ( $user_id <= 0 || ! self::is_valid( $mode ) ) {
			return false;
		}

		if ( get_user_meta( $user_id, self::USER_META, true ) === $mode ) {
			return true;
		}

		return (bool) update_user_meta( $user_id, self::USER_META, $mode );
	}

	/**
	 * Whether the upgrade tip shows for a user.
	 *
	 * @since  1.3.0
	 * @param  int $user_id User ID.
	 * @return bool
	 */
	public static function should_show_tip( int $user_id ): bool {
		if ( $user_id <= 0 || '1' !== (string) get_option( self::TIP_OPTION, '' ) ) {
			return false;
		}

		if ( '1' === (string) get_user_meta( $user_id, self::TIP_DISMISSED_META, true ) ) {
			return false;
		}

		return true === apply_filters( Filters_Settings::MODE_TIP_SHOW, true, $user_id );
	}

	/**
	 * Record that a user dismissed the upgrade tip.
	 *
	 * @since  1.3.0
	 * @param  int $user_id User ID.
	 * @return bool Whether the tip is now dismissed for the user.
	 */
	public static function dismiss_tip( int $user_id ): bool {
		if ( $user_id <= 0 ) {
			return false;
		}

		if ( '1' === (string) get_user_meta( $user_id, self::TIP_DISMISSED_META, true ) ) {
			return true;
		}

		return (bool) update_user_meta( $user_id, self::TIP_DISMISSED_META, '1' );
	}

	/**
	 * The value to store for a user preference, or null when either is invalid.
	 *
	 * @since  1.3.0
	 * @param  string $preference `PREFERENCE_MODE` or `PREFERENCE_TIP_DISMISSED`.
	 * @param  string $value      Submitted value.
	 * @return string|null
	 */
	public static function validate_preference( string $preference, string $value ): ?string {
		if ( self::PREFERENCE_MODE === $preference ) {
			return self::is_valid( $value ) ? $value : null;
		}

		if ( self::PREFERENCE_TIP_DISMISSED === $preference ) {
			return '1' === $value ? '1' : null;
		}

		return null;
	}

	/**
	 * Store a validated user preference.
	 *
	 * @since  1.3.0
	 * @param  int    $user_id    User ID.
	 * @param  string $preference `PREFERENCE_MODE` or `PREFERENCE_TIP_DISMISSED`.
	 * @param  string $value      Value from `validate_preference()`.
	 * @return bool Whether the preference is stored.
	 */
	public static function save_preference( int $user_id, string $preference, string $value ): bool {
		if ( self::PREFERENCE_MODE === $preference ) {
			return self::set_user_mode( $user_id, $value );
		}

		if ( self::PREFERENCE_TIP_DISMISSED === $preference ) {
			return self::dismiss_tip( $user_id );
		}

		return false;
	}

	/**
	 * Add this class's preferences to the per-user preference handlers.
	 *
	 * @since  1.3.0
	 * @param  mixed $handlers Handlers registered so far.
	 * @return array<string, array{validate: callable, save: callable}>
	 */
	public static function register_preferences( $handlers ): array {
		$handlers = is_array( $handlers ) ? $handlers : array();

		foreach ( array( self::PREFERENCE_MODE, self::PREFERENCE_TIP_DISMISSED ) as $preference ) {
			$handlers[ $preference ] = array(
				'validate' => static function ( string $value ) use ( $preference ): ?string {
					return self::validate_preference( $preference, $value );
				},
				'save'     => static function ( int $user_id, string $value ) use ( $preference ): bool {
					return self::save_preference( $user_id, $preference, $value );
				},
			);
		}

		return $handlers;
	}
}
