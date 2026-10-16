<?php
/**
 * Import / Export stores settings the way their settings screens do and never
 * imports the usage-data sharing choice.
 *
 * @package FotoGrids
 */

use FotoGrids\Collection_Defaults;
use FotoGrids\Image_Size_Manager;
use FotoGrids\Tools\ImportExport\Import_Export_Data;

class ImportExportSettingsTest extends WP_UnitTestCase {

	public static function set_up_before_class(): void {
		parent::set_up_before_class();
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-data.php';
	}

	public function set_up(): void {
		parent::set_up();
		add_filter( 'query', array( $this, 'keep_the_test_transaction' ) );
	}

	public function tear_down(): void {
		remove_filter( 'query', array( $this, 'keep_the_test_transaction' ) );
		parent::tear_down();
	}

	/**
	 * Drops the import's own transaction statements, which would end the test's.
	 *
	 * @param  string $query SQL.
	 * @return string
	 */
	public function keep_the_test_transaction( $query ) {
		return in_array( trim( $query ), array( 'START TRANSACTION', 'COMMIT', 'ROLLBACK' ), true ) ? '' : $query;
	}

	private function import( array $settings ): void {
		$file = array(
			'meta'     => array( 'version' => '1.2.0' ),
			'settings' => $settings,
		);

		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/import-export/import' );
		$request->set_param( 'phase', 'execute' );
		$request->set_param( 'file', wp_json_encode( $file ) );
		$request->set_param( 'include', array( 'settings' ) );

		$response = Import_Export_Data::import( $request );
		$this->assertSame( 200, $response->get_status() );
	}

	private function bool_default_key(): string {
		foreach ( Collection_Defaults::resolve_gallery() as $key => $value ) {
			if ( is_bool( $value ) ) {
				return $key;
			}
		}
		$this->fail( 'The gallery defaults have no boolean setting.' );
	}

	public function share_statistics_provider(): array {
		return array(
			'file on, site off' => array( true, '0' ),
			'file off, site on' => array( false, '1' ),
		);
	}

	/**
	 * @dataProvider share_statistics_provider
	 */
	public function test_an_import_leaves_usage_data_sharing_as_it_was( bool $in_file, string $on_site ): void {
		update_option( 'fotogrids_share_statistics', $on_site );

		$this->import( array( 'share_statistics' => $in_file ) );

		$this->assertSame( $on_site, get_option( 'fotogrids_share_statistics' ) );
	}

	public function test_flags_are_stored_as_one_or_zero(): void {
		$this->import(
			array(
				'autosave'                   => 'yes',
				'preserve_data_on_uninstall' => true,
			)
		);

		$this->assertSame( '0', get_option( 'fotogrids_autosave' ) );
		$this->assertSame( '1', get_option( 'fotogrids_preserve_data_on_uninstall' ) );

		$this->import(
			array(
				'autosave'                   => array( 'on' ),
				'preserve_data_on_uninstall' => 'false',
			)
		);

		$this->assertSame( '0', get_option( 'fotogrids_autosave' ) );
		$this->assertSame( '0', get_option( 'fotogrids_preserve_data_on_uninstall' ) );
	}

	public function test_media_sizes_go_through_the_media_sanitizer(): void {
		$this->import(
			array(
				'media' => array(
					'thumbnail_width'     => '-50',
					'thumbnail_crop'      => 'false',
					'thumbnail_alignment' => '<script>',
					'full_crop'           => true,
					'unknown'             => 'x',
				),
			)
		);

		$stored = get_option( 'fotogrids_media_settings' );
		$this->assertSame( array_keys( Image_Size_Manager::get_plugin_size_defaults() ), array_keys( $stored ) );
		$this->assertSame( 1, $stored['thumbnail_width'] );
		$this->assertFalse( $stored['thumbnail_crop'] );
		$this->assertFalse( $stored['full_crop'] );
		$this->assertNotSame( '<script>', $stored['thumbnail_alignment'] );
	}

	public function test_media_that_is_not_a_map_is_ignored(): void {
		update_option( 'fotogrids_media_settings', Image_Size_Manager::get_plugin_size_defaults() );

		$this->import( array( 'media' => 'not a map' ) );

		$this->assertSame( Image_Size_Manager::get_plugin_size_defaults(), get_option( 'fotogrids_media_settings' ) );
	}

	public function test_gallery_defaults_go_through_the_defaults_sanitizer(): void {
		$key = $this->bool_default_key();

		$this->import(
			array(
				'gallery_defaults' => array(
					$key                  => 'yes',
					'fotogrids_not_a_key' => 'x',
				),
			)
		);

		$this->assertSame( array( $key => false ), get_option( 'fotogrids_gallery_defaults' ) );
	}
}
