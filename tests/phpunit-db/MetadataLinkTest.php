<?php
/**
 * Linking library entries to an item: a link needs an existing entry of the
 * matching type, and each item counts once towards an entry's usage.
 *
 * @package FotoGrids
 */

use FotoGrids\Metadata_Manager;

class MetadataLinkTest extends WP_UnitTestCase {

	private int $item;

	public function set_up(): void {
		parent::set_up();

		$this->item = self::factory()->attachment->create( array( 'post_mime_type' => 'image/jpeg' ) );
	}

	private function usage( int $entry ): int {
		global $wpdb;

		return (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT usage_count FROM %i WHERE id = %d', $wpdb->prefix . 'fotogrids_tags', $entry )
		);
	}

	private function links( int $item ): int {
		global $wpdb;

		return (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM %i WHERE attachment_id = %d', $wpdb->prefix . 'fotogrids_item_metadata', $item )
		);
	}

	public function test_an_id_with_no_entry_behind_it_is_refused_and_writes_nothing(): void {
		foreach ( array( 'link_tag_to_item', 'link_person_to_item', 'link_location_to_item' ) as $method ) {
			foreach ( array( 999999, 0, -5 ) as $id ) {
				$this->assertFalse( Metadata_Manager::$method( $this->item, $id ), "$method( $id )" );
			}
		}

		$this->assertSame( 0, $this->links( $this->item ) );
	}

	public function test_an_entry_of_another_type_is_refused(): void {
		$person = (int) Metadata_Manager::add_or_get_person( 'Ada Lovelace' )->id;

		$this->assertFalse( Metadata_Manager::link_tag_to_item( $this->item, $person ) );
		$this->assertFalse( Metadata_Manager::link_location_to_item( $this->item, $person ) );
		$this->assertSame( 0, $this->links( $this->item ) );
		$this->assertSame( 0, $this->usage( $person ) );
	}

	public function test_linking_an_entry_the_item_already_carries_counts_it_once(): void {
		$tag      = (int) Metadata_Manager::add_or_get_tag( 'Harbour' )->id;
		$person   = (int) Metadata_Manager::add_or_get_person( 'Grace Hopper' )->id;
		$location = (int) Metadata_Manager::add_or_get_location( 'Kyoto', 35.0116, 135.7681 )->id;

		$this->assertTrue( Metadata_Manager::link_tag_to_item( $this->item, $tag ) );
		$this->assertTrue( Metadata_Manager::link_tag_to_item( $this->item, $tag ) );
		$this->assertTrue( Metadata_Manager::add_tag_to_item( $this->item, 'Harbour' ) );

		$this->assertTrue( Metadata_Manager::link_person_to_item( $this->item, $person ) );
		$this->assertTrue( Metadata_Manager::add_person_to_item( $this->item, 'Grace Hopper' ) );

		$this->assertTrue( Metadata_Manager::link_location_to_item( $this->item, $location ) );
		$this->assertTrue( Metadata_Manager::add_location_to_item( $this->item, 'Kyoto' ) );

		$this->assertSame( 1, $this->usage( $tag ) );
		$this->assertSame( 1, $this->usage( $person ) );
		$this->assertSame( 1, $this->usage( $location ) );
		$this->assertSame( 3, $this->links( $this->item ) );
	}

	public function test_usage_follows_the_items_carrying_the_entry(): void {
		$tag   = (int) Metadata_Manager::add_or_get_tag( 'Street' )->id;
		$other = self::factory()->attachment->create( array( 'post_mime_type' => 'image/jpeg' ) );

		Metadata_Manager::link_tag_to_item( $this->item, $tag );
		Metadata_Manager::link_tag_to_item( $other, $tag );
		$this->assertSame( 2, $this->usage( $tag ) );

		Metadata_Manager::clear_item_metadata( $this->item );
		$this->assertSame( 1, $this->usage( $tag ) );

		Metadata_Manager::link_tag_to_item( $this->item, $tag );
		Metadata_Manager::link_tag_to_item( $this->item, $tag );
		$this->assertSame( 2, $this->usage( $tag ) );
	}
}
