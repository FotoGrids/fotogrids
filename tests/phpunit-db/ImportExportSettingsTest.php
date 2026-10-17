<?php
/**
 * Import / Export stores only the settings chosen for the import, the way
 * their settings screens do.
 *
 * @package FotoGrids
 */

use FotoGrids\Collection_Defaults;
use FotoGrids\Image_Size_Manager;
use FotoGrids\Settings\Collection_Defaults_Store;
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

	/**
	 * Run an execute-phase import of a settings block.
	 *
	 * @param  array         $settings The file's settings block.
	 * @param  string[]|null $keys     Settings chosen; null chooses every one but usage-data sharing.
	 * @return array The response's `imported` map.
	 */
	private function import( array $settings, ?array $keys = null ): array {
		$response = Import_Export_Data::import(
			$this->request(
				array( 'settings' => $settings ),
				array(
					'include'  => array( 'settings' ),
					'settings' => $keys ?? array_values( array_diff( Import_Export_Data::SETTINGS_KEYS, array( 'share_statistics' ) ) ),
				)
			)
		);
		$this->assertInstanceOf( WP_REST_Response::class, $response );
		$this->assertSame( 200, $response->get_status() );

		return $response->get_data()['imported'];
	}

	private function request( array $file, array $params, string $phase = 'execute' ): WP_REST_Request {
		$request = new WP_REST_Request( 'POST', '/fotogrids/v1/admin/tools/import-export/import' );
		$request->set_param( 'phase', $phase );
		$request->set_param( 'file', wp_json_encode( array( 'meta' => array( 'version' => '1.2.0' ) ) + $file ) );
		foreach ( $params as $name => $value ) {
			$request->set_param( $name, $value );
		}

		return $request;
	}

	/**
	 * Keeps the Freemius SDK off the network.
	 *
	 * @return WP_Error
	 */
	public function refuse_http(): WP_Error {
		return new WP_Error( 'http_request_failed', 'No network in tests.' );
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
	public function test_usage_data_sharing_left_unticked_stays_as_it_was( bool $in_file, string $on_site ): void {
		update_option( 'fotogrids_share_statistics', $on_site );

		$imported = $this->import(
			array(
				'share_statistics' => $in_file,
				'autosave'         => true,
			)
		);

		$this->assertSame( $on_site, get_option( 'fotogrids_share_statistics' ) );
		$this->assertNotContains( 'share_statistics', $imported['settings_detail'] );
	}

	/**
	 * @dataProvider share_statistics_provider
	 */
	public function test_ticked_usage_data_sharing_goes_through_the_consent_helper( bool $in_file, string $on_site ): void {
		update_option( 'fotogrids_share_statistics', $on_site );
		update_option( 'fotogrids_marketing_allowed', '1' );
		add_filter( 'pre_http_request', array( $this, 'refuse_http' ) );

		$imported = $this->import( array( 'share_statistics' => $in_file ), array( 'share_statistics' ) );

		remove_filter( 'pre_http_request', array( $this, 'refuse_http' ) );

		$this->assertSame( $in_file ? '1' : '0', get_option( 'fotogrids_share_statistics' ) );
		// Only the consent helper revokes marketing consent along with sharing.
		$this->assertSame( $in_file ? '1' : '0', get_option( 'fotogrids_marketing_allowed' ) );
		$this->assertSame( array( 'share_statistics' ), $imported['settings_detail'] );
	}

	public function test_settings_without_a_chosen_list_are_refused_and_nothing_is_written(): void {
		update_option( 'fotogrids_autosave', '1' );
		$galleries = wp_count_posts( 'fotogrids_gallery' )->draft;

		$response = Import_Export_Data::import(
			$this->request(
				array(
					'galleries' => array(
						array(
							'id'     => 9001,
							'title'  => 'From the file',
							'slug'   => 'from-the-file',
							'status' => 'draft',
							'date'   => '2026-01-01 00:00:00',
							'meta'   => array(),
						),
					),
					'settings'  => array( 'autosave' => false ),
				),
				array(
					'include'   => array( 'galleries', 'settings' ),
					'galleries' => 'duplicate',
				)
			)
		);

		$this->assertWPError( $response );
		$this->assertSame( 'settings_keys_required', $response->get_error_code() );
		$this->assertSame( 400, $response->get_error_data()['status'] );
		$this->assertSame( '1', get_option( 'fotogrids_autosave' ) );
		$this->assertSame( $galleries, wp_count_posts( 'fotogrids_gallery' )->draft );
	}

	public function test_an_unticked_setting_is_left_unchanged(): void {
		update_option( 'fotogrids_autosave', '1' );
		update_option( 'fotogrids_preserve_data_on_uninstall', '1' );
		Collection_Defaults_Store::replace( 'gallery', array( 'layout' => 'justified' ) );

		$imported = $this->import(
			array(
				'autosave'                   => false,
				'preserve_data_on_uninstall' => false,
				'collection_defaults'        => array( 'gallery' => array( 'layout' => 'masonry' ) ),
			),
			array( 'preserve_data_on_uninstall' )
		);

		$this->assertSame( '1', get_option( 'fotogrids_autosave' ) );
		$this->assertSame( array( 'layout' => 'justified' ), Collection_Defaults_Store::get( 'gallery' ) );
		$this->assertSame( '0', get_option( 'fotogrids_preserve_data_on_uninstall' ) );
		$this->assertSame( array( 'preserve_data_on_uninstall' ), $imported['settings_detail'] );
	}

	public function test_an_empty_list_imports_no_settings(): void {
		update_option( 'fotogrids_autosave', '1' );

		$imported = $this->import( array( 'autosave' => false ), array() );

		$this->assertSame( '1', get_option( 'fotogrids_autosave' ) );
		$this->assertArrayNotHasKey( 'settings', $imported );
	}

	public function test_the_result_names_only_the_settings_that_changed(): void {
		update_option( 'fotogrids_autosave', '1' );
		update_option( 'fotogrids_preserve_data_on_uninstall', '1' );

		$imported = $this->import(
			array(
				'autosave'                   => true,
				'preserve_data_on_uninstall' => false,
			)
		);

		$this->assertTrue( $imported['settings'] );
		$this->assertSame( array( 'preserve_data_on_uninstall' ), $imported['settings_detail'] );
	}

	public function test_analysis_lists_the_settings_the_file_holds(): void {
		$response = Import_Export_Data::import(
			$this->request(
				array(
					'settings' => array(
						'media'            => 'not a map',
						'gallery_defaults' => array(),
						'autosave'         => false,
						'share_statistics' => true,
					),
				),
				array(),
				'analyse'
			)
		);

		$this->assertSame(
			array( 'collection_defaults', 'autosave', 'share_statistics' ),
			$response->get_data()['contents']['settings_detail']
		);
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

	public function test_defaults_from_an_earlier_export_apply_to_galleries_and_albums(): void {
		$key = $this->bool_default_key();

		$this->import(
			array(
				'gallery_defaults' => array(
					$key                  => 'yes',
					'fotogrids_not_a_key' => 'x',
				),
			)
		);

		$this->assertSame(
			array(
				'gallery' => array( $key => false ),
				'album'   => array( $key => false ),
			),
			Collection_Defaults_Store::all()
		);
	}

	public function test_each_type_imports_its_own_defaults_through_its_sanitizer(): void {
		Collection_Defaults_Store::replace( 'album', array( 'layout' => 'grid' ) );

		$this->import(
			array(
				'collection_defaults' => array(
					'gallery' => array(
						'layout'                    => 'justified',
						'single_item_auto_progress' => '1',
					),
					'album'   => array(
						'layout'                    => 'masonry',
						'single_item_auto_progress' => '1',
					),
				),
			)
		);

		$this->assertSame(
			array(
				'layout'                    => 'justified',
				'single_item_auto_progress' => true,
			),
			Collection_Defaults_Store::get( 'gallery' )
		);
		$this->assertSame( array( 'layout' => 'masonry' ), Collection_Defaults_Store::get( 'album' ) );
	}

	public function test_a_type_missing_from_the_file_keeps_its_defaults(): void {
		Collection_Defaults_Store::replace( 'gallery', array( 'layout' => 'slider' ) );

		$this->import( array( 'collection_defaults' => array( 'album' => array( 'layout' => 'masonry' ) ) ) );

		$this->assertSame( array( 'layout' => 'slider' ), Collection_Defaults_Store::get( 'gallery' ) );
		$this->assertSame( array( 'layout' => 'masonry' ), Collection_Defaults_Store::get( 'album' ) );
	}

	public function test_the_export_carries_each_types_defaults(): void {
		Collection_Defaults_Store::replace( 'gallery', array( 'layout' => 'justified' ) );
		Collection_Defaults_Store::replace( 'album', array( 'layout' => 'masonry' ) );

		$collect = new ReflectionMethod( Import_Export_Data::class, 'collect_export_data' );
		$collect->setAccessible( true );
		$settings = $collect->invoke( null, array( 'settings' ) )['settings'];

		$this->assertSame( Collection_Defaults_Store::all(), $settings['collection_defaults'] );
		$this->assertArrayNotHasKey( 'gallery_defaults', $settings );
	}
}
