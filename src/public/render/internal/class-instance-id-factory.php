<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Request-scoped instance ID factory.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Instance_Id_Factory {

	private int $counter = 0;

	private static ?self $instance = null;

	/**
	 * Returns the request-scoped singleton instance.
	 *
	 * @since   1.0.0
	 * @return  self
	 */
	public static function instance(): self {
		return self::$instance ??= new self();
	}

	/**
	 * Generates a unique gallery instance identifier.
	 *
	 * @since   1.0.0
	 * @param   int $gallery_id Gallery identifier.
	 * @return  string
	 */
	public function generate( int $gallery_id ): string {
		++$this->counter;

		return sprintf( 'fg-%d-%d', $gallery_id, $this->counter );
	}

	/**
	 * Resets instance state for tests.
	 *
	 * @since   1.0.0
	 * @return  void
	 */
	public static function reset_for_tests(): void {
		self::$instance = null;
	}
}
