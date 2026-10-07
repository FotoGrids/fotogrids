<?php
/**
 * Unit tests for the position a gallery gets when appended to an album.
 *
 * WP-independent: $wpdb is replaced with a double that returns a fixed MAX(position).
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Gallery_Album_Relations;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/includes/class-gallery-album-relations.php';

/**
 * @covers \FotoGrids\Gallery_Album_Relations
 */
final class GalleryAlbumNextPositionTest extends TestCase {

	/**
	 * @var mixed
	 */
	private $previous_wpdb;

	protected function setUp(): void {
		$this->previous_wpdb = $GLOBALS['wpdb'] ?? null;
	}

	protected function tearDown(): void {
		$GLOBALS['wpdb'] = $this->previous_wpdb;
	}

	/**
	 * @return array<string, array{0: ?string, 1: int}>
	 */
	public function max_position_provider(): array {
		return array(
			'empty album'           => array( null, 0 ),
			'one gallery at 0'      => array( '0', 1 ),
			'highest position is 4' => array( '4', 5 ),
		);
	}

	/**
	 * @dataProvider max_position_provider
	 *
	 * @param string|null $max_position Value MAX(position) returns.
	 * @param int         $expected     Expected next position.
	 */
	public function test_next_position_follows_highest_existing_position( ?string $max_position, int $expected ): void {
		$GLOBALS['wpdb'] = new class( $max_position ) {
			/**
			 * @var string
			 */
			public $prefix = 'wp_';

			/**
			 * @var string|null
			 */
			private $max_position;

			public function __construct( ?string $max_position ) {
				$this->max_position = $max_position;
			}

			public function prepare( string $query ): string {
				return $query;
			}

			public function get_var( string $query ): ?string {
				return $this->max_position;
			}
		};

		$method = new ReflectionMethod( Gallery_Album_Relations::class, 'get_next_position' );
		$method->setAccessible( true );

		$this->assertSame( $expected, $method->invoke( null, 7 ) );
	}
}
