<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Supported render execution modes.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Render_Mode {
	const INITIAL = 'initial';
	const AJAX    = 'ajax';

	/**
	 * All valid render-mode values.
	 *
	 * @since 1.0.0
	 * @var array<int,string>
	 */
	const ALL = array(
		self::INITIAL,
		self::AJAX,
	);

	/**
	 * Whether the given value is a valid render mode.
	 *
	 * @since 1.0.0
	 * @param mixed $value Candidate value.
	 * @return bool
	 */
	public static function is_valid( $value ): bool {
		return in_array( $value, self::ALL, true );
	}
}
