<?php
/**
 * Per-user admin preferences, saved by the feature that owns each one.
 *
 * @package FotoGrids\Admin
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Admin;

use FotoGrids\Hooks\Filters_Admin;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * User_Preferences
 *
 * Validates and stores a preference request through the handler its feature
 * registered on {@see Filters_Admin::USER_PREFERENCES}.
 *
 * @package FotoGrids\Admin
 * @since   1.3.0
 */
final class User_Preferences {

	const ERROR_FORBIDDEN = 'forbidden';
	const ERROR_INVALID   = 'invalid';
	const ERROR_FAILED    = 'failed';

	/**
	 * Registered preference handlers with a callable `validate` and `save`.
	 *
	 * @since  1.3.0
	 * @return array<string, array{validate: callable, save: callable}>
	 */
	public static function handlers(): array {
		$handlers = apply_filters( Filters_Admin::USER_PREFERENCES, array() );

		if ( ! is_array( $handlers ) ) {
			return array();
		}

		return array_filter(
			$handlers,
			static function ( $handler, $key ): bool {
				return is_string( $key )
					&& is_array( $handler )
					&& isset( $handler['validate'], $handler['save'] )
					&& is_callable( $handler['validate'] )
					&& is_callable( $handler['save'] );
			},
			ARRAY_FILTER_USE_BOTH
		);
	}

	/**
	 * Validate and store a preference request for a user.
	 *
	 * @since  1.3.0
	 * @param  int    $user_id    Requesting user ID.
	 * @param  bool   $can_read   Whether the user has the `read` capability.
	 * @param  string $preference Submitted preference.
	 * @param  string $value      Submitted value.
	 * @return array{ok:bool,value?:string,error?:string} `error` is one of the `ERROR_*` constants.
	 */
	public static function handle_request( int $user_id, bool $can_read, string $preference, string $value ): array {
		if ( $user_id <= 0 || ! $can_read ) {
			return array(
				'ok'    => false,
				'error' => self::ERROR_FORBIDDEN,
			);
		}

		$handlers = self::handlers();
		$handler  = $handlers[ $preference ] ?? null;
		$valid    = null === $handler ? null : call_user_func( $handler['validate'], $value );

		if ( ! is_string( $valid ) ) {
			return array(
				'ok'    => false,
				'error' => self::ERROR_INVALID,
			);
		}

		if ( true !== call_user_func( $handler['save'], $user_id, $valid ) ) {
			return array(
				'ok'    => false,
				'error' => self::ERROR_FAILED,
			);
		}

		return array(
			'ok'    => true,
			'value' => $valid,
		);
	}
}
