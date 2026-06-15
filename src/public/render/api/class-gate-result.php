<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Gate evaluation result value object.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Gate_Result {

	/**
	 * @since   1.0.0
	 * @param   bool   $passed Whether gate passed.
	 * @param   string $blocked_html Blocked response markup.
	 * @param   int    $http_status Response status.
	 * @return  void
	 */
	private function __construct(
		public readonly bool $passed,
		public readonly string $blocked_html,
		public readonly int $http_status,
	) {}

	/**
	 * Returns a passing gate result.
	 *
	 * @since   1.0.0
	 * @return  self
	 */
	public static function pass(): self {
		return new self( true, '', 200 );
	}

	/**
	 * Returns a blocked gate result.
	 *
	 * @since   1.0.0
	 * @param   string $html Block HTML.
	 * @param   int    $http_status HTTP status code.
	 * @return  self
	 */
	public static function block( string $html, int $http_status = 200 ): self {
		return new self( false, $html, $http_status );
	}
}
