<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Supported edit-time field states.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Field_State {
	const TEASER   = 'teaser';
	const LOCKED   = 'locked';
	const EDITABLE = 'editable';

	/**
	 * All valid field-state values.
	 *
	 * @since 1.0.0
	 * @var array<int,string>
	 */
	const ALL = array(
		self::TEASER,
		self::LOCKED,
		self::EDITABLE,
	);

	/**
	 * Whether the given value is a valid field state.
	 *
	 * @since 1.0.0
	 * @param mixed $value Candidate value.
	 * @return bool
	 */
	public static function is_valid( $value ): bool {
		return in_array( $value, self::ALL, true );
	}
}
