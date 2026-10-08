<?php
/**
 * The title and alt text the gallery items grid receives for an attachment.
 *
 * @package FotoGrids
 */

use FotoGrids\Metaboxes\Metabox_Registrar;
use FotoGrids\REST\Media\Media_Items;

class MetaboxGridItemTest extends WP_UnitTestCase {

	private function attachment( string $title, string $alt = '' ): int {
		$id = self::factory()->attachment->create_object(
			array(
				'file'           => 'grid-item.jpg',
				'post_mime_type' => 'image/jpeg',
				'post_title'     => $title,
			)
		);
		update_post_meta( $id, '_wp_attachment_image_alt', $alt );

		return $id;
	}

	public function title_provider(): array {
		return array(
			'ampersand, quotes, apostrophe' => array( 'Tom & "Jerry" \'s', 'Tom & “Jerry” ‘s' ),
			'hyphen and ellipsis'           => array( "Sarah's Day - Part 2...", 'Sarah’s Day – Part 2…' ),
			'plain'                         => array( 'Harbour at dawn', 'Harbour at dawn' ),
		);
	}

	/**
	 * @dataProvider title_provider
	 */
	public function test_title_and_alt_fallback_carry_characters_not_entities( string $stored, string $expected ): void {
		$item = Metabox_Registrar::build_attachment_item_data( $this->attachment( $stored ), 0 );

		$this->assertSame( $expected, $item['title'] );
		$this->assertSame( $expected, $item['alt'] );
		$this->assertDoesNotMatchRegularExpression( '/&#?\w+;/', $item['title'] . $item['alt'] );
	}

	public function test_explicit_alt_text_is_returned_as_stored(): void {
		$item = Metabox_Registrar::build_attachment_item_data( $this->attachment( 'Fish & Chips', 'Fish & "Chips"' ), 0 );

		$this->assertSame( 'Fish & Chips', $item['title'] );
		$this->assertSame( 'Fish & "Chips"', $item['alt'] );
	}

	public function test_an_empty_title_falls_back_to_untitled(): void {
		$item = Metabox_Registrar::build_attachment_item_data( $this->attachment( '' ), 0 );

		$this->assertSame( 'Untitled', $item['title'] );
		$this->assertSame( '', $item['alt'] );
	}

	public function test_an_imported_item_title_carries_characters_not_entities(): void {
		$item = Media_Items::to_item( $this->attachment( 'Tom & "Jerry" \'s' ) );

		$this->assertSame( 'Tom & “Jerry” ‘s', $item['title'] );
	}
}
