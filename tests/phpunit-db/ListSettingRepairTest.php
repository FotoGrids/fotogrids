<?php
/**
 * List settings stored as one plain string, and how they are read back.
 *
 * @package FotoGrids
 */

use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Settings\Collection_Defaults_Seeder;
use FotoGrids\Migrations\List_Setting_Repair;

class ListSettingRepairTest extends WP_UnitTestCase {

	private const DEFAULT_BLOCKS = array( 'caption', 'description', 'file_info', 'exif', 'share', 'credit', 'tags', 'people', 'location' );

	private function gallery(): int {
		return self::factory()->post->create( array( 'post_type' => 'fotogrids_gallery' ) );
	}

	public function test_a_plain_string_is_replaced_with_the_default_list(): void {
		$gallery = $this->gallery();
		update_post_meta( $gallery, 'fotogrids_lightbox_info_blocks', 'caption' );

		List_Setting_Repair::run();

		$this->assertSame( wp_json_encode( self::DEFAULT_BLOCKS ), get_post_meta( $gallery, 'fotogrids_lightbox_info_blocks', true ) );
	}

	public function test_an_album_is_repaired_too(): void {
		$album = self::factory()->post->create( array( 'post_type' => 'fotogrids_album' ) );
		update_post_meta( $album, 'fotogrids_sharing_networks_override', 'facebook' );

		List_Setting_Repair::run();

		$this->assertSame(
			array( 'facebook', 'x', 'pinterest', 'email', 'copy_link' ),
			json_decode( get_post_meta( $album, 'fotogrids_sharing_networks_override', true ), true )
		);
	}

	public function test_a_saved_list_is_kept(): void {
		$gallery = $this->gallery();
		update_post_meta( $gallery, 'fotogrids_lightbox_info_blocks', '["exif","caption"]' );
		update_post_meta( $gallery, 'fotogrids_filter_by', '[]' );

		List_Setting_Repair::run();

		$this->assertSame( '["exif","caption"]', get_post_meta( $gallery, 'fotogrids_lightbox_info_blocks', true ) );
		$this->assertSame( '[]', get_post_meta( $gallery, 'fotogrids_filter_by', true ) );
	}

	public function test_other_post_types_and_settings_are_left_alone(): void {
		$post    = self::factory()->post->create();
		$gallery = $this->gallery();
		update_post_meta( $post, 'fotogrids_lightbox_info_blocks', 'caption' );
		update_post_meta( $gallery, 'fotogrids_caption_alignment', 'left' );

		List_Setting_Repair::run();

		$this->assertSame( 'caption', get_post_meta( $post, 'fotogrids_lightbox_info_blocks', true ) );
		$this->assertSame( 'left', get_post_meta( $gallery, 'fotogrids_caption_alignment', true ) );
	}

	public function test_saved_defaults_hold_lists_as_arrays(): void {
		update_option(
			Collection_Defaults_Seeder::OPTION,
			array(
				'sharing_networks_override' => '["x","email"]',
				'exif_fields'               => 'camera',
				'caption_alignment'         => 'center',
			)
		);

		List_Setting_Repair::run();

		$this->assertSame(
			array(
				'sharing_networks_override' => array( 'x', 'email' ),
				'caption_alignment'         => 'center',
			),
			get_option( Collection_Defaults_Seeder::OPTION )
		);
	}

	public function test_a_new_gallery_receives_a_saved_default_list(): void {
		update_option( Collection_Defaults_Seeder::OPTION, array( 'sharing_networks_override' => '["x","email"]' ) );
		List_Setting_Repair::run();

		$gallery = $this->gallery();

		$this->assertSame( array( 'x', 'email' ), Gallery_Repository::get_settings( $gallery )['sharing_networks_override'] );
	}

	public function test_a_saved_list_replaces_the_default_list(): void {
		$gallery = $this->gallery();
		update_post_meta( $gallery, 'fotogrids_lightbox_info_blocks', '["exif","caption"]' );

		$this->assertSame( array( 'exif', 'caption' ), Gallery_Repository::get_settings( $gallery )['lightbox_info_blocks'] );
	}

	public function test_an_unsaved_gallery_reads_the_default_list(): void {
		$this->assertSame( self::DEFAULT_BLOCKS, Gallery_Repository::get_settings( $this->gallery() )['lightbox_info_blocks'] );
	}
}
