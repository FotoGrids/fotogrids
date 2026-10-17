<?php
/**
 * The title the Edit Item modal receives for an attachment.
 *
 * @package FotoGrids
 */

use FotoGrids\Metaboxes\Item_Ajax_Endpoints;

class ItemEditDataTest extends WP_Ajax_UnitTestCase {

	private int $admin;

	public function set_up(): void {
		parent::set_up();
		$this->admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		Item_Ajax_Endpoints::init();
	}

	/** An attachment whose post_title column holds exactly $title. */
	private function attachment( string $title ): int {
		global $wpdb;

		$id = self::factory()->attachment->create_object(
			array(
				'file'           => 'item-edit.jpg',
				'post_mime_type' => 'image/jpeg',
				'post_title'     => 'placeholder',
			)
		);
		$wpdb->update( $wpdb->posts, array( 'post_title' => $title ), array( 'ID' => $id ) );
		clean_post_cache( $id );

		return $id;
	}

	/** The item data the modal loads, through the admin-ajax handler. */
	private function item_data( int $id ): array {
		wp_set_current_user( $this->admin );
		$_POST = array(
			'nonce'   => wp_create_nonce( 'fotogrids_item_edit' ),
			'item_id' => (string) $id,
		);

		try {
			$this->_handleAjax( 'fotogrids_get_item_data' );
		} catch ( WPAjaxDieContinueException $e ) {
			unset( $e );
		}

		$response = json_decode( $this->_last_response, true );
		$this->_last_response = '';
		$this->assertTrue( $response['success'] ?? false, 'the item data request failed' );

		return $response['data'];
	}

	public function title_provider(): array {
		return array(
			'encoded ampersand'           => array( 'Tom &amp; Jerry', 'Tom & Jerry' ),
			'encoded quotes and brackets' => array( '1 &lt; 2 &quot;q&quot; &#039;s&#039;', '1 < 2 "q" \'s\'' ),
			'numeric entity'              => array( 'Sarah&#8217;s Day', 'Sarah’s Day' ),
			'plain punctuation unchanged' => array( 'Sarah\'s "Day" - Part 2...', 'Sarah\'s "Day" - Part 2...' ),
			'literal tags unchanged'      => array( 'Harbour <b>at</b> dawn', 'Harbour <b>at</b> dawn' ),
		);
	}

	/**
	 * @dataProvider title_provider
	 */
	public function test_the_title_carries_characters_not_entities( string $stored, string $expected ): void {
		$this->assertSame( $expected, $this->item_data( $this->attachment( $stored ) )['title'] );
	}
}
