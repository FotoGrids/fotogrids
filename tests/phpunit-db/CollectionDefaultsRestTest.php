<?php
/**
 * Settings > Defaults saves, shows and applies gallery and album defaults
 * separately, through /admin/collection-defaults and the deprecated
 * /admin/gallery-defaults.
 *
 * @package FotoGrids
 */

use FotoGrids\Admin\Settings_Localizer;
use FotoGrids\Admin_Init;
use FotoGrids\Settings\Collection_Defaults_Store;

class CollectionDefaultsRestTest extends WP_UnitTestCase {

	private const ROUTE = '/fotogrids/v1/admin/collection-defaults';

	private const LEGACY_ROUTE = '/fotogrids/v1/admin/gallery-defaults';

	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	public function tear_down(): void {
		wp_set_current_user( 0 );
		unset( $_GET['subtab'] );
		set_current_screen( 'front' );
		parent::tear_down();
	}

	private function request( string $method, string $route, array $params = array() ): WP_REST_Response {
		$request = new WP_REST_Request( $method, $route );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		return rest_get_server()->dispatch( $request );
	}

	private function save( string $type, array $defaults ): WP_REST_Response {
		return $this->request( 'POST', self::ROUTE, array( 'type' => $type, 'defaults' => $defaults ) );
	}

	private function create( string $post_type ): int {
		return self::factory()->post->create( array( 'post_type' => $post_type ) );
	}

	public function test_the_type_is_required_and_must_be_a_collection_type(): void {
		$this->assertSame( 400, $this->request( 'GET', self::ROUTE )->get_status() );
		$this->assertSame( 400, $this->request( 'GET', self::ROUTE, array( 'type' => 'page' ) )->get_status() );
		$this->assertSame( 400, $this->save( 'page', array( 'layout' => 'grid' ) )->get_status() );
	}

	public function test_saving_album_defaults_leaves_gallery_defaults_alone(): void {
		$this->save( 'gallery', array( 'layout' => 'justified' ) );

		$response = $this->save( 'album', array( 'layout' => 'masonry' ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'album', $response->get_data()['type'] );
		$this->assertSame( 'masonry', $response->get_data()['defaults']['layout'] );
		$this->assertSame( 'justified', Collection_Defaults_Store::get( 'gallery' )['layout'] );

		$read = $this->request( 'GET', self::ROUTE, array( 'type' => 'gallery' ) )->get_data();
		$this->assertSame( array( 'type' => 'gallery', 'defaults' => array( 'layout' => 'justified' ) ), $read );
	}

	public function test_each_type_is_sanitised_against_its_own_settings(): void {
		$this->save( 'album', array( 'single_item_auto_progress' => true, 'layout' => 'grid', 'fotogrids_not_a_key' => 'x' ) );
		$this->save( 'gallery', array( 'single_item_auto_progress' => true ) );

		$this->assertSame( array( 'layout' => 'grid' ), Collection_Defaults_Store::get( 'album' ) );
		$this->assertSame( array( 'single_item_auto_progress' => true ), Collection_Defaults_Store::get( 'gallery' ) );
	}

	public function test_a_default_password_is_stored_encrypted_and_never_returned(): void {
		$response = $this->save( 'album', array( 'password' => 'Album-Pass-1' ) );

		$this->assertSame( '', $response->get_data()['defaults']['password'] );
		$this->assertNotSame( 'Album-Pass-1', Collection_Defaults_Store::get( 'album' )['password'] );
		$this->assertNotSame( '', Collection_Defaults_Store::get( 'album' )['password'] );
		$this->assertSame( '', $this->request( 'GET', self::ROUTE, array( 'type' => 'album' ) )->get_data()['defaults']['password'] );
	}

	public function test_a_subscriber_can_neither_read_nor_save(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		$this->assertSame( 403, $this->request( 'GET', self::ROUTE, array( 'type' => 'gallery' ) )->get_status() );
		$this->assertSame( 403, $this->save( 'gallery', array( 'layout' => 'grid' ) )->get_status() );
	}

	public function test_the_deprecated_route_reads_and_saves_gallery_defaults(): void {
		$this->setExpectedDeprecated( 'FotoGrids\REST\Admin\Admin_Data::get_gallery_defaults' );
		$this->setExpectedDeprecated( 'FotoGrids\REST\Admin\Admin_Data::save_gallery_defaults' );
		$this->save( 'album', array( 'layout' => 'masonry' ) );

		$saved = $this->request( 'POST', self::LEGACY_ROUTE, array( 'defaults' => array( 'layout' => 'justified' ) ) );
		$read  = $this->request( 'GET', self::LEGACY_ROUTE );

		$this->assertSame( array( 'defaults' => array( 'layout' => 'justified' ) ), $saved->get_data() );
		$this->assertSame( array( 'defaults' => array( 'layout' => 'justified' ) ), $read->get_data() );
		$this->assertSame( 'masonry', Collection_Defaults_Store::get( 'album' )['layout'] );
	}

	public function test_new_galleries_and_albums_start_from_their_own_defaults(): void {
		$this->save( 'gallery', array( 'layout' => 'justified' ) );
		$this->save( 'album', array( 'layout' => 'masonry' ) );

		$this->assertSame( 'justified', get_post_meta( $this->create( 'fotogrids_gallery' ), 'fotogrids_layout', true ) );
		$this->assertSame( 'masonry', get_post_meta( $this->create( 'fotogrids_album' ), 'fotogrids_layout', true ) );
	}

	public function test_saved_defaults_count_as_configured_settings(): void {
		$overview = function (): bool {
			return $this->request( 'GET', '/fotogrids/v1/admin/stats/overview' )->get_data()['settings_configured'];
		};

		$this->assertFalse( $overview() );
		$this->save( 'album', array( 'layout' => 'masonry' ) );
		$this->assertTrue( $overview() );
	}

	public function test_the_defaults_page_shows_each_type_its_own_values(): void {
		$this->save( 'gallery', array( 'layout' => 'justified' ) );
		$this->save( 'album', array( 'layout' => 'masonry' ) );

		$album = Settings_Localizer::data_for_collection(
			array(
				'post_type'   => 'fotogrids_album',
				'is_defaults' => true,
			)
		);

		$this->assertSame( 'fotogrids_album', $album['postType'] );
		$this->assertSame( 'masonry', $album['settings']['layout'] );
		$this->assertArrayNotHasKey( 'single_item_auto_progress', $album['settings'] );
	}

	public function test_the_defaults_page_carries_both_types_and_opens_the_requested_one(): void {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-admin-init.php';
		$this->save( 'gallery', array( 'layout' => 'justified' ) );
		$this->save( 'album', array( 'layout' => 'masonry' ) );
		$_GET['subtab'] = 'album';
		set_current_screen( 'fotogrids_page_fotogrids-settings' );

		Admin_Init::enqueue_admin_scripts( 'fotogrids_page_fotogrids-settings' );

		$data   = (string) wp_scripts()->get_data( 'fotogrids-collection-settings', 'data' );
		$before = implode( "\n", (array) wp_scripts()->get_data( 'fotogrids-collection-settings', 'before' ) );

		$this->assertStringContainsString( 'var fotogridsDefaultsSettings = ', $data );
		$this->assertStringContainsString( '"postType":"fotogrids_gallery"', $data );
		$this->assertStringContainsString( '"postType":"fotogrids_album"', $data );
		$this->assertStringContainsString( 'window.fotogridsSettings = window.fotogridsDefaultsSettings["album"];', $before );
	}
}
