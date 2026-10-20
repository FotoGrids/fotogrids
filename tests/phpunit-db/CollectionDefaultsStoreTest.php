<?php
/**
 * Gallery and album defaults are stored apart, the shared map earlier
 * versions saved moves into both, and its old option name keeps working.
 *
 * @package FotoGrids
 */

use FotoGrids\Activator;
use FotoGrids\Migrations\Collection_Defaults_Split;
use FotoGrids\Migrations\Migration_Runner;
use FotoGrids\Settings\Collection_Defaults_Store;

class CollectionDefaultsStoreTest extends WP_UnitTestCase {

	private const LEGACY = 'fotogrids_gallery_defaults';

	public function set_up(): void {
		parent::set_up();
		// The rollback between tests leaves the options cache stale.
		wp_cache_flush();
	}

	/** Writes the legacy row the way earlier versions stored it, past the deprecation filters. */
	private function plant_legacy( $value ): void {
		global $wpdb;

		$wpdb->replace(
			$wpdb->options,
			array(
				'option_name'  => self::LEGACY,
				'option_value' => maybe_serialize( $value ),
				'autoload'     => 'on',
			)
		);
		wp_cache_flush();
	}

	private function legacy_row_exists(): bool {
		global $wpdb;

		return '0' !== $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name = %s", self::LEGACY ) );
	}

	public function test_type_names_and_post_types_map_to_a_collection_type(): void {
		$this->assertSame( 'gallery', Collection_Defaults_Store::type( 'gallery' ) );
		$this->assertSame( 'gallery', Collection_Defaults_Store::type( 'fotogrids_gallery' ) );
		$this->assertSame( 'album', Collection_Defaults_Store::type( 'album' ) );
		$this->assertSame( 'album', Collection_Defaults_Store::type( 'fotogrids_album' ) );
		$this->assertNull( Collection_Defaults_Store::type( 'page' ) );
		$this->assertNull( Collection_Defaults_Store::type( 'fotogrids_page' ) );
	}

	public function test_each_type_keeps_its_own_defaults(): void {
		$this->assertTrue( Collection_Defaults_Store::replace( 'album', array( 'layout' => 'masonry' ) ) );
		$this->assertTrue( Collection_Defaults_Store::replace( 'gallery', array( 'layout' => 'justified' ) ) );

		$this->assertSame( array( 'layout' => 'masonry' ), Collection_Defaults_Store::get( 'fotogrids_album' ) );
		$this->assertSame( array( 'layout' => 'justified' ), Collection_Defaults_Store::get( 'gallery' ) );
	}

	public function test_merge_keeps_the_keys_it_was_not_given(): void {
		Collection_Defaults_Store::replace( 'gallery', array( 'layout' => 'grid', 'columns' => 3 ) );

		$this->assertSame(
			array( 'layout' => 'masonry', 'columns' => 3 ),
			Collection_Defaults_Store::merge( 'gallery', array( 'layout' => 'masonry' ) )
		);
		$this->assertSame( array(), Collection_Defaults_Store::get( 'album' ) );
	}

	public function test_an_unknown_type_is_neither_read_nor_written(): void {
		$this->assertFalse( Collection_Defaults_Store::replace( 'page', array( 'layout' => 'grid' ) ) );
		$this->assertNull( Collection_Defaults_Store::merge( 'page', array( 'layout' => 'grid' ) ) );
		$this->assertSame( array(), Collection_Defaults_Store::get( 'page' ) );
		$this->assertNull( get_option( Collection_Defaults_Store::OPTION, null ) );
	}

	public function test_a_stored_value_that_is_not_a_map_reads_as_no_defaults(): void {
		update_option( Collection_Defaults_Store::OPTION, 'not a map' );

		$this->assertSame( array( 'gallery' => array(), 'album' => array() ), Collection_Defaults_Store::all() );
		$this->assertFalse( Collection_Defaults_Store::has_any() );

		Collection_Defaults_Store::replace( 'album', array( 'layout' => 'grid' ) );
		$this->assertTrue( Collection_Defaults_Store::has_any() );
	}

	public function test_the_shared_map_moves_into_both_types_and_its_option_is_deleted(): void {
		$this->plant_legacy( array( 'layout' => 'justified' ) );

		Collection_Defaults_Split::run();

		$this->assertSame(
			array(
				'gallery' => array( 'layout' => 'justified' ),
				'album'   => array( 'layout' => 'justified' ),
			),
			get_option( Collection_Defaults_Store::OPTION )
		);
		$this->assertFalse( $this->legacy_row_exists() );

		Collection_Defaults_Split::run();
		$this->assertSame( array( 'layout' => 'justified' ), Collection_Defaults_Store::get( 'album' ) );
	}

	public function test_a_type_that_already_has_defaults_keeps_them(): void {
		update_option( Collection_Defaults_Store::OPTION, array( 'album' => array( 'layout' => 'masonry' ) ) );
		$this->plant_legacy( array( 'layout' => 'justified' ) );

		Collection_Defaults_Split::run();

		$this->assertSame( array( 'layout' => 'masonry' ), Collection_Defaults_Store::get( 'album' ) );
		$this->assertSame( array( 'layout' => 'justified' ), Collection_Defaults_Store::get( 'gallery' ) );
		$this->assertFalse( $this->legacy_row_exists() );
	}

	public function test_without_the_shared_map_nothing_is_written(): void {
		Collection_Defaults_Split::run();

		$this->assertNull( get_option( Collection_Defaults_Store::OPTION, null ) );
	}

	public function test_the_shared_map_is_kept_when_its_copy_cannot_be_written(): void {
		$this->plant_legacy( array( 'layout' => 'justified' ) );
		$block = static function ( $value, $old_value ) {
			return $old_value;
		};
		add_filter( 'pre_update_option_' . Collection_Defaults_Store::OPTION, $block, 10, 2 );

		try {
			Collection_Defaults_Split::run();
			$this->fail( 'the split reported success without writing the copy' );
		} catch ( RuntimeException $e ) {
			$this->assertTrue( $this->legacy_row_exists() );
		} finally {
			remove_filter( 'pre_update_option_' . Collection_Defaults_Store::OPTION, $block, 10 );
		}

		Collection_Defaults_Split::run();
		$this->assertFalse( $this->legacy_row_exists() );
		$this->assertSame( array( 'layout' => 'justified' ), Collection_Defaults_Store::get( 'gallery' ) );
	}

	public function test_reading_the_defaults_leaves_a_shared_map_for_the_upgrade(): void {
		$this->plant_legacy( array( 'layout' => 'slider' ) );

		$this->assertSame( array(), Collection_Defaults_Store::get( 'album' ) );
		$this->assertTrue( $this->legacy_row_exists() );
	}

	public function test_the_upgrade_moves_the_shared_map_once(): void {
		$this->plant_legacy( array( 'layout' => 'masonry' ) );
		update_option( Migration_Runner::RECORD_OPTION, array_values( array_diff( Migration_Runner::completed(), array( Collection_Defaults_Split::id() ) ) ) );

		Activator::maybe_upgrade();

		$this->assertSame( array( 'layout' => 'masonry' ), Collection_Defaults_Store::get( 'gallery' ) );
		$this->assertSame( array( 'layout' => 'masonry' ), Collection_Defaults_Store::get( 'album' ) );
		$this->assertFalse( $this->legacy_row_exists() );
		$this->assertContains( Collection_Defaults_Split::id(), Migration_Runner::completed() );
	}

	public function test_an_upgrade_that_cannot_write_the_copy_leaves_the_move_pending(): void {
		$this->plant_legacy( array( 'layout' => 'masonry' ) );
		update_option( Migration_Runner::RECORD_OPTION, array_values( array_diff( Migration_Runner::completed(), array( Collection_Defaults_Split::id() ) ) ) );
		$block = static function ( $value, $old_value ) {
			return $old_value;
		};
		add_filter( 'pre_update_option_' . Collection_Defaults_Store::OPTION, $block, 10, 2 );

		Activator::maybe_upgrade();
		remove_filter( 'pre_update_option_' . Collection_Defaults_Store::OPTION, $block, 10 );

		$this->assertTrue( $this->legacy_row_exists() );
		$this->assertNotContains( Collection_Defaults_Split::id(), Migration_Runner::completed() );

		Activator::maybe_upgrade();

		$this->assertFalse( $this->legacy_row_exists() );
		$this->assertContains( Collection_Defaults_Split::id(), Migration_Runner::completed() );
	}

	public function test_the_old_option_name_reads_the_gallery_defaults(): void {
		$this->setExpectedDeprecated( 'get_option' );
		Collection_Defaults_Store::replace( 'gallery', array( 'layout' => 'masonry' ) );
		Collection_Defaults_Store::replace( 'album', array( 'layout' => 'grid' ) );

		$this->assertSame( array( 'layout' => 'masonry' ), get_option( self::LEGACY ) );
	}

	public function test_the_old_option_name_reads_as_absent_without_defaults(): void {
		$this->assertSame( 'fallback', get_option( self::LEGACY, 'fallback' ) );
	}

	public function test_writing_the_old_option_name_replaces_the_gallery_defaults_only(): void {
		$this->setExpectedDeprecated( 'get_option' );
		$this->setExpectedDeprecated( 'update_option' );
		Collection_Defaults_Store::replace( 'gallery', array( 'layout' => 'grid' ) );
		Collection_Defaults_Store::replace( 'album', array( 'layout' => 'masonry' ) );

		update_option( self::LEGACY, array( 'layout' => 'justified', 'not_a_setting' => 'x' ) );

		$this->assertSame( array( 'layout' => 'justified' ), Collection_Defaults_Store::get( 'gallery' ) );
		$this->assertSame( array( 'layout' => 'masonry' ), Collection_Defaults_Store::get( 'album' ) );
		$this->assertFalse( $this->legacy_row_exists() );
	}
}
