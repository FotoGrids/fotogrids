<?php
/**
 * The schema the activator creates, at column and index level.
 *
 * The lifecycle scenarios assert the tables exist on a real install; this
 * asserts their shape, which is what a dbDelta edit gets wrong.
 *
 * @package FotoGrids
 */

class SchemaTest extends WP_UnitTestCase {

	/** Table suffixes the plugin owns, without the prefix. */
	private const TABLES = array(
		'item_meta',
		'statistics',
		'statistics_daily',
		'gallery_albums',
		'tags',
		'item_metadata',
		'render_cache',
	);

	/** @return array<string, array{0: string}> */
	public function tableProvider(): array {
		$cases = array();
		foreach ( self::TABLES as $table ) {
			$cases[ $table ] = array( $table );
		}

		return $cases;
	}

	/** @dataProvider tableProvider */
	public function test_the_table_exists( string $suffix ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'fotogrids_' . $suffix;

		$this->assertSame(
			$table,
			$wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ),
			"$table was not created"
		);
	}

	/** @dataProvider tableProvider */
	public function test_the_table_has_an_auto_increment_primary_key( string $suffix ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'fotogrids_' . $suffix;

		$id = $wpdb->get_row( "SHOW COLUMNS FROM `$table` WHERE Field = 'id'" );

		$this->assertNotNull( $id, "$table has no id column" );
		$this->assertSame( 'PRI', $id->Key, "$table does not key on id" );
		$this->assertStringContainsString( 'auto_increment', $id->Extra, "$table does not auto-increment id" );
	}

	public function test_no_table_is_created_outside_the_plugin_prefix(): void {
		global $wpdb;

		$found = $wpdb->get_col( "SHOW TABLES LIKE '{$wpdb->prefix}fotogrids_%'" );

		$this->assertCount(
			count( self::TABLES ),
			$found,
			'the plugin owns a table this suite does not name: ' . implode( ', ', $found )
		);
	}

	/**
	 * The uniqueness the relation and metadata writers rely on. Without these
	 * a duplicate insert succeeds and the duplicate surfaces as a repeated
	 * gallery in an album, or a tag linked twice to one item.
	 *
	 * @return array<string, array{0: string, 1: array<int, string>}>
	 */
	public function uniqueIndexProvider(): array {
		return array(
			'gallery_albums'   => array( 'gallery_albums', array( 'gallery_id', 'album_id' ) ),
			'item_metadata'    => array( 'item_metadata', array( 'attachment_id', 'metadata_type', 'metadata_id' ) ),
			'tags'             => array( 'tags', array( 'name', 'type' ) ),
			'statistics'       => array( 'statistics', array( 'object_type', 'object_id' ) ),
			'statistics_daily' => array( 'statistics_daily', array( 'object_type', 'object_id', 'viewed_date' ) ),
			'render_cache'     => array( 'render_cache', array( 'cache_key' ) ),
		);
	}

	/** @dataProvider uniqueIndexProvider */
	public function test_the_table_carries_a_unique_index_over( string $suffix, array $columns ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'fotogrids_' . $suffix;

		$unique = array();
		foreach ( $wpdb->get_results( "SHOW INDEX FROM `$table`" ) as $row ) {
			if ( '0' === (string) $row->Non_unique ) {
				$unique[ $row->Key_name ][ (int) $row->Seq_in_index ] = $row->Column_name;
			}
		}

		$sets = array();
		foreach ( $unique as $columns_by_seq ) {
			ksort( $columns_by_seq );
			$sets[] = array_values( $columns_by_seq );
		}

		$this->assertContains(
			$columns,
			$sets,
			"$table has no unique index over " . implode( ' + ', $columns )
		);
	}
}
