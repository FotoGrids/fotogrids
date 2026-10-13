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
	 * Generates the instance identifier for one builder placement of a collection.
	 *
	 * Returns `fg-{id}-p{key}`, so placements rendered in separate requests stay
	 * distinct and keep the same ID across re-renders.
	 *
	 * @since   1.2.0
	 * @param   int    $collection_id Gallery or album identifier.
	 * @param   string $placement_key Builder element identifier.
	 * @return  string|null Null when the key holds no usable characters.
	 */
	public function generate_for_placement( int $collection_id, string $placement_key ): ?string {
		$key = substr( (string) preg_replace( '/[^a-z0-9]/', '', strtolower( $placement_key ) ), 0, 32 );

		if ( '' === $key ) {
			return null;
		}

		return sprintf( 'fg-%d-p%s', $collection_id, $key );
	}

	/**
	 * Whether an instance ID has the shape this factory gives a collection.
	 *
	 * Matches `fg-{id}-{n}` and `fg-{id}-p{key}`. A request that renders into a
	 * page it cannot see, such as a password unlock or an album swap, takes the
	 * ID the page chose for it only when this returns true.
	 *
	 * @since   1.3.0
	 * @param   int    $collection_id Gallery or album identifier.
	 * @param   string $instance_id   Instance identifier to check.
	 * @return  bool
	 */
	public static function matches( int $collection_id, string $instance_id ): bool {
		return $collection_id > 0
			&& 1 === preg_match( '/^fg-' . $collection_id . '-[0-9a-z]{1,33}$/D', $instance_id );
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
