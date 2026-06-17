<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Column mode values used by layout modules.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Columns_Mode {
	const FIXED = 'fixed';
	const AUTO  = 'auto';

	/**
	 * All valid column-mode values.
	 *
	 * @since 1.0.0
	 * @var array<int,string>
	 */
	const ALL = array(
		self::FIXED,
		self::AUTO,
	);

	/**
	 * Whether the given value is a valid column mode.
	 *
	 * @since 1.0.0
	 * @param mixed $value Candidate value.
	 * @return bool
	 */
	public static function is_valid( $value ): bool {
		return in_array( $value, self::ALL, true );
	}
}
