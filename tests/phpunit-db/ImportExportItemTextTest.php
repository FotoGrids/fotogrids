<?php
/**
 * Item text — title, caption, description, alt — through export and import.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Galleries\Item_Meta;
use FotoGrids\Tools\ImportExport\Attachment_Map;
use FotoGrids\Tools\ImportExport\Import_Export_Data;

class ImportExportItemTextTest extends WP_UnitTestCase {

	private const TEXT = array(
		'title'       => 'Harbour at dawn',
		'caption'     => "Boats leaving\nbefore sunrise",
		'description' => 'Shot from the <a href="https://example.com/pier">north pier</a> & the quay, C:\\Photos\\raw.',
		'alt'         => 'Fishing boats in a harbour at dawn',
	);

	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		rest_get_server();
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-data.php';
	}

	private static function call( string $method, ...$args ) {
		$reflection = new ReflectionMethod( Import_Export_Data::class, $method );
		$reflection->setAccessible( true );

		return $reflection->invoke( null, ...$args );
	}

	private function attachment( array $text = self::TEXT ): int {
		$id = self::factory()->attachment->create_object(
			'harbour.jpg',
			0,
			wp_slash(
				array(
					'post_mime_type' => 'image/jpeg',
					'post_title'     => $text['title'],
					'post_excerpt'   => $text['caption'],
					'post_content'   => $text['description'],
				)
			)
		);
		update_post_meta( $id, '_wp_attachment_image_alt', wp_slash( $text['alt'] ) );

		return $id;
	}

	private function gallery_with( int ...$item_ids ): int {
		$gallery = self::factory()->post->create(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
			)
		);
		Gallery_Repository::set_item_ids( $gallery, $item_ids );

		return $gallery;
	}

	/** @return array<int, array<string, mixed>> Exported item entries keyed by attachment ID. */
	private function exported_items(): array {
		$data = self::call( 'collect_export_data', array( 'items' ) );

		return array_column( $data['items'], null, 'attachment_id' );
	}

	private function text_of( int $id ): array {
		$post = get_post( $id );

		return array(
			'title'       => $post->post_title,
			'caption'     => $post->post_excerpt,
			'description' => $post->post_content,
			'alt'         => get_post_meta( $id, '_wp_attachment_image_alt', true ),
		);
	}

	/** Leaves the attachment in place, as a site that has the media but no FotoGrids data. */
	private function forget_fotogrids_data( int $id ): void {
		global $wpdb;
		$wpdb->delete( Item_Meta::table(), array( 'attachment_id' => $id ) );
		foreach ( get_posts( array( 'post_type' => 'fotogrids_gallery', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids' ) ) as $gallery ) {
			wp_delete_post( $gallery, true );
		}
		wp_update_post(
			array(
				'ID'           => $id,
				'post_title'   => 'harbour',
				'post_excerpt' => '',
				'post_content' => '',
			)
		);
		delete_post_meta( $id, '_wp_attachment_image_alt' );
	}

	private function import( array $items ): array {
		$known = self::call( 'known_item_ids' );

		return array_slice( self::call( 'import_items', $items, array(), $known, new Attachment_Map( null, get_site_url() ) ), 0, 2 );
	}

	public function test_export_carries_the_attachment_text_of_an_item_with_a_row(): void {
		$id = $this->attachment();
		Item_Meta::save( $id, array( 'credit' => 'Jane Doe' ) );

		$item = $this->exported_items()[ $id ];

		$this->assertSame( 'Jane Doe', $item['credit'] );
		foreach ( self::TEXT as $key => $value ) {
			$this->assertSame( $value, $item[ $key ], $key );
		}
	}

	public function test_export_includes_a_gallery_item_without_a_row(): void {
		$id = $this->attachment();
		$this->gallery_with( $id );

		$items = $this->exported_items();

		$this->assertArrayHasKey( $id, $items );
		$this->assertSame( self::TEXT['caption'], $items[ $id ]['caption'] );
	}

	public function unpublished_status_provider(): array {
		return array(
			'draft'   => array( 'draft' ),
			'pending' => array( 'pending' ),
			'private' => array( 'private' ),
			'future'  => array( 'future' ),
		);
	}

	/**
	 * @dataProvider unpublished_status_provider
	 */
	public function test_export_includes_an_item_without_a_row_in_an_unpublished_gallery( string $status ): void {
		$id   = $this->attachment();
		$args = array(
			'post_type'   => 'fotogrids_gallery',
			'post_status' => $status,
		);
		if ( 'future' === $status ) {
			$args['post_date'] = gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS );
		}
		Gallery_Repository::set_item_ids( self::factory()->post->create( $args ), array( $id ) );

		$items = $this->exported_items();

		$this->assertArrayHasKey( $id, $items );
		$this->assertSame( self::TEXT['caption'], $items[ $id ]['caption'] );
	}

	public function test_a_round_trip_restores_the_text_onto_the_attachment(): void {
		$id = $this->attachment();
		$this->gallery_with( $id );
		$file = $this->exported_items()[ $id ];

		$this->forget_fotogrids_data( $id );
		$this->assertSame( array( 1, 0 ), $this->import( array( $file ) ) );

		$this->assertSame( self::TEXT, $this->text_of( $id ) );
	}

	public function test_a_round_trip_through_xml_restores_the_text(): void {
		$id = $this->attachment();
		$this->gallery_with( $id );
		Item_Meta::save( $id, array( 'credit' => 'Jane Doe' ) );
		$data = self::call( 'collect_export_data', array( 'items' ) );
		$xml  = self::call( 'serialise_xml', $data );

		$this->forget_fotogrids_data( $id );
		$parsed = self::call( 'parse_xml', $xml );
		$this->import( $parsed['items'] );

		$this->assertSame( self::TEXT, $this->text_of( $id ) );
		$this->assertSame( 'Jane Doe', Item_Meta::get( $id )['credit'] );
	}

	public function test_an_item_already_in_a_gallery_keeps_its_text(): void {
		$id   = $this->attachment();
		$file = array_merge( array( 'attachment_id' => $id ), array_fill_keys( array_keys( self::TEXT ), 'From the file' ) );
		$this->gallery_with( $id );

		$this->import( array( $file ) );

		$this->assertSame( self::TEXT, $this->text_of( $id ) );
	}

	public function test_an_item_with_a_row_is_skipped_and_keeps_its_text(): void {
		$id = $this->attachment();
		Item_Meta::save( $id, array( 'credit' => 'Jane Doe' ) );
		$file = array_merge( array( 'attachment_id' => $id ), array_fill_keys( array_keys( self::TEXT ), 'From the file' ) );

		$this->assertSame( array( 0, 1 ), $this->import( array( $file ) ) );
		$this->assertSame( self::TEXT, $this->text_of( $id ) );
	}

	public function test_empty_values_in_an_older_file_leave_the_attachment_text_alone(): void {
		$id = $this->attachment();

		$this->import(
			array(
				array(
					'attachment_id' => $id,
					'gallery_id'    => 0,
					'caption'       => '',
					'description'   => '',
					'credit'        => 'Jane Doe',
				),
			)
		);

		$this->assertSame( self::TEXT, $this->text_of( $id ) );
		$this->assertSame( 'Jane Doe', Item_Meta::get( $id )['credit'] );
	}

	public function test_import_leaves_the_item_row_caption_and_description_empty(): void {
		$id = $this->attachment();

		$this->import( array( array_merge( array( 'attachment_id' => $id, 'credit' => 'Jane Doe' ), self::TEXT ) ) );

		$row = Item_Meta::get( $id );
		$this->assertSame( 'Jane Doe', $row['credit'] );
		$this->assertEmpty( $row['caption'] );
		$this->assertEmpty( $row['description'] );
	}

	public function test_an_entry_with_only_text_writes_the_text_and_no_row(): void {
		$id = $this->attachment( array_fill_keys( array_keys( self::TEXT ), '' ) );

		$this->assertSame( array( 1, 0 ), $this->import( array( array_merge( array( 'attachment_id' => $id, 'gallery_id' => 0 ), self::TEXT ) ) ) );

		$this->assertSame( self::TEXT, $this->text_of( $id ) );
		$this->assertNull( Item_Meta::get( $id ) );
	}

	public function test_an_entry_with_only_text_for_an_item_in_a_gallery_is_skipped(): void {
		$id = $this->attachment();
		$this->gallery_with( $id );

		$this->assertSame( array( 0, 1 ), $this->import( array( array( 'attachment_id' => $id, 'gallery_id' => 0, 'caption' => 'From the file' ) ) ) );

		$this->assertSame( self::TEXT, $this->text_of( $id ) );
		$this->assertNull( Item_Meta::get( $id ) );
	}

	public function test_an_entry_without_some_item_fields_keeps_their_column_defaults(): void {
		$id = $this->attachment();

		$this->import( array( array( 'attachment_id' => $id, 'credit' => 'Jane Doe' ) ) );

		$row = Item_Meta::get( $id );
		$this->assertSame( 'global', $row['link_target'] );
		$this->assertSame( 'image', $row['item_type'] );
	}

	public function test_a_user_without_unfiltered_html_has_markup_filtered(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );
		$id = $this->attachment( array_fill_keys( array_keys( self::TEXT ), '' ) );

		$this->import(
			array(
				array(
					'attachment_id' => $id,
					'caption'       => 'Pier<script>alert(1)</script>',
					'description'   => '<a href="https://example.com/pier">north pier</a><script>alert(1)</script>',
				),
			)
		);

		$this->assertSame( 'Pieralert(1)', $this->text_of( $id )['caption'] );
		$this->assertSame( '<a href="https://example.com/pier">north pier</a>alert(1)', $this->text_of( $id )['description'] );
	}
}
