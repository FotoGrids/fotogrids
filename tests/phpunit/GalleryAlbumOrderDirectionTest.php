<?php
/**
 * Unit tests for the sort direction the album and gallery relation queries put into SQL.
 *
 * WP-independent: $wpdb is replaced with a double that records the query it runs.
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
final class GalleryAlbumOrderDirectionTest extends TestCase {

	/**
	 * @var mixed
	 */
	private $previous_wpdb;

	/**
	 * @var object
	 */
	private $wpdb;

	protected function setUp(): void {
		$this->previous_wpdb = $GLOBALS['wpdb'] ?? null;

		$this->wpdb = new class() {
			/**
			 * @var string
			 */
			public $prefix = 'wp_';

			/**
			 * @var string
			 */
			public $posts = 'wp_posts';

			/**
			 * @var string
			 */
			public $last_query = '';

			/**
			 * @param string $query Query.
			 * @param mixed  ...$args Placeholder values.
			 */
			public function prepare( string $query, ...$args ): string {
				return $query;
			}

			/**
			 * @param string $query Query.
			 * @return array<int, object>
			 */
			public function get_results( string $query ): array {
				$this->last_query = $query;

				return array();
			}
		};

		$GLOBALS['wpdb'] = $this->wpdb;
	}

	protected function tearDown(): void {
		$GLOBALS['wpdb'] = $this->previous_wpdb;
	}

	/**
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function order_provider(): array {
		return array(
			'ASC'                => array( 'ASC', 'ASC' ),
			'DESC'               => array( 'DESC', 'DESC' ),
			'lowercase desc'     => array( 'desc', 'DESC' ),
			'mixed-case Desc'    => array( 'Desc', 'DESC' ),
			'empty string'       => array( '', 'ASC' ),
			'unknown word'       => array( 'sideways', 'ASC' ),
			'appended statement' => array( 'DESC; DROP TABLE wp_posts', 'ASC' ),
			'appended subquery'  => array( 'ASC, (SELECT 1)', 'ASC' ),
		);
	}

	/**
	 * @dataProvider order_provider
	 *
	 * @param string $order    Value passed as the order argument.
	 * @param string $expected Direction expected in the SQL.
	 */
	public function test_galleries_for_album_order_by_asc_or_desc_only( string $order, string $expected ): void {
		$columns = array(
			'position' => 'ga.position',
			'title'    => 'p.post_title',
			'date'     => 'p.post_date',
		);

		foreach ( $columns as $orderby => $column ) {
			Gallery_Album_Relations::get_galleries_for_album(
				7,
				array(
					'orderby'      => $orderby,
					'order'        => $order,
					'include_meta' => false,
				)
			);

			$this->assertStringEndsWith( "ORDER BY {$column} {$expected}", $this->wpdb->last_query );
		}
	}

	/**
	 * @dataProvider order_provider
	 *
	 * @param string $order    Value passed as the order argument.
	 * @param string $expected Direction expected in the SQL.
	 */
	public function test_albums_for_gallery_order_by_asc_or_desc_only( string $order, string $expected ): void {
		$columns = array(
			'title' => 'p.post_title',
			'date'  => 'p.post_date',
		);

		foreach ( $columns as $orderby => $column ) {
			Gallery_Album_Relations::get_albums_for_gallery(
				7,
				array(
					'orderby'      => $orderby,
					'order'        => $order,
					'include_meta' => false,
				)
			);

			$this->assertStringEndsWith( "ORDER BY {$column} {$expected}", $this->wpdb->last_query );
		}
	}
}
