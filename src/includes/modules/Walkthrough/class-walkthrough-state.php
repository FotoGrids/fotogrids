<?php
/**
 * Per-user walkthrough progress.
 *
 * @package FotoGrids\Modules\Walkthrough
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\Walkthrough;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Walkthrough_State
 *
 * Stores, per user, how far each tour got: one user meta holding a map of
 * tour id to state. A tour with no entry has never run for the user.
 *
 * @package FotoGrids\Modules\Walkthrough
 * @since   1.3.0
 */
final class Walkthrough_State {

	const META_KEY   = 'fotogrids_walkthroughs';
	const PREFERENCE = 'walkthrough';

	const TOUR_GALLERY   = 'gallery';
	const TOUR_ALBUM     = 'album';
	const TOUR_DASHBOARD = 'dashboard';

	const PUBLISH_PENDING = 'publish-pending';
	const DONE            = 'done';
	const SKIPPED         = 'skipped';

	/**
	 * Known tour ids.
	 *
	 * @since  1.3.0
	 * @return string[]
	 */
	public static function tours(): array {
		return array( self::TOUR_GALLERY, self::TOUR_ALBUM, self::TOUR_DASHBOARD );
	}

	/**
	 * Known states.
	 *
	 * @since  1.3.0
	 * @return string[]
	 */
	public static function states(): array {
		return array( self::PUBLISH_PENDING, self::DONE, self::SKIPPED );
	}

	/**
	 * Every stored tour state for a user, without unknown entries.
	 *
	 * @since  1.3.0
	 * @param  int $user_id User ID.
	 * @return array<string, string> Tour id => state.
	 */
	public static function all( int $user_id ): array {
		if ( $user_id <= 0 ) {
			return array();
		}

		$stored = get_user_meta( $user_id, self::META_KEY, true );
		if ( ! is_array( $stored ) ) {
			return array();
		}

		$states = array();
		foreach ( $stored as $tour => $state ) {
			if ( in_array( $tour, self::tours(), true ) && in_array( $state, self::states(), true ) ) {
				$states[ $tour ] = $state;
			}
		}

		return $states;
	}

	/**
	 * A user's state for one tour, or '' when the tour never ran.
	 *
	 * @since  1.3.0
	 * @param  int    $user_id User ID.
	 * @param  string $tour    Tour id.
	 * @return string
	 */
	public static function get( int $user_id, string $tour ): string {
		return self::all( $user_id )[ $tour ] ?? '';
	}

	/**
	 * Store a user's state for one tour.
	 *
	 * @since  1.3.0
	 * @param  int    $user_id User ID.
	 * @param  string $tour    Tour id.
	 * @param  string $state   One of `states()`.
	 * @return bool Whether the stored state now equals `$state`.
	 */
	public static function set( int $user_id, string $tour, string $state ): bool {
		if ( $user_id <= 0 || ! in_array( $tour, self::tours(), true ) || ! in_array( $state, self::states(), true ) ) {
			return false;
		}

		$states = self::all( $user_id );
		if ( ( $states[ $tour ] ?? '' ) === $state ) {
			return true;
		}

		$states[ $tour ] = $state;

		return (bool) update_user_meta( $user_id, self::META_KEY, $states );
	}

	/**
	 * The preference value to store, or null when it is not `<tour>:<state>`.
	 *
	 * @since  1.3.0
	 * @param  string $value Submitted value.
	 * @return string|null
	 */
	public static function validate_preference( string $value ): ?string {
		$parts = explode( ':', $value );
		if ( 2 !== count( $parts ) ) {
			return null;
		}

		return in_array( $parts[0], self::tours(), true ) && in_array( $parts[1], self::states(), true ) ? $value : null;
	}

	/**
	 * Store a validated `<tour>:<state>` preference.
	 *
	 * @since  1.3.0
	 * @param  int    $user_id User ID.
	 * @param  string $value   Value from `validate_preference()`.
	 * @return bool
	 */
	public static function save_preference( int $user_id, string $value ): bool {
		$parts = explode( ':', $value );

		return 2 === count( $parts ) && self::set( $user_id, $parts[0], $parts[1] );
	}

	/**
	 * Add the walkthrough preference to the per-user preference handlers.
	 *
	 * @since  1.3.0
	 * @param  mixed $handlers Handlers registered so far.
	 * @return array<string, array{validate: callable, save: callable}>
	 */
	public static function register_preferences( $handlers ): array {
		$handlers = is_array( $handlers ) ? $handlers : array();

		$handlers[ self::PREFERENCE ] = array(
			'validate' => array( self::class, 'validate_preference' ),
			'save'     => array( self::class, 'save_preference' ),
		);

		return $handlers;
	}
}
