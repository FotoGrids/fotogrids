<?php
/**
 * Crop alignment of FotoGrids image sizes: registry slugs, generated files and upgrade.
 *
 * @package FotoGrids
 */

use FotoGrids\Image_Size_Manager;
use FotoGrids\Migrations\Custom_Crop_Size_Slugs;
use FotoGrids\Post_Types;

class CustomCropAlignmentTest extends WP_UnitTestCase {

	/** Expected stripe for each alignment: [ wide image (by x), tall image (by y) ]. */
	private const STRIPES = array(
		'top-left'      => array( 'red', 'red' ),
		'top-center'    => array( 'green', 'red' ),
		'top-right'     => array( 'blue', 'red' ),
		'center-left'   => array( 'red', 'green' ),
		'center'        => array( 'green', 'green' ),
		'center-right'  => array( 'blue', 'green' ),
		'bottom-left'   => array( 'red', 'blue' ),
		'bottom-center' => array( 'green', 'blue' ),
		'bottom-right'  => array( 'blue', 'blue' ),
	);

	public function tear_down(): void {
		foreach ( array_keys( wp_get_additional_image_sizes() ) as $slug ) {
			if ( 0 === strpos( $slug, Image_Size_Manager::CUSTOM_SLUG_PREFIX ) ) {
				remove_image_size( $slug );
			}
		}
		$this->remove_added_uploads();
		parent::tear_down();
	}

	private function gallery( array $settings ): int {
		$id = self::factory()->post->create(
			array(
				'post_type'   => Post_Types::GALLERY,
				'post_status' => 'publish',
			)
		);

		foreach ( $settings as $key => $value ) {
			update_post_meta( $id, 'fotogrids_' . $key, $value );
		}

		return $id;
	}

	private function cropped_gallery( int $width, int $height, string $alignment ): int {
		return $this->gallery(
			array(
				'thumbnail_size'                       => 'custom',
				'thumbnail_custom_size_width'          => (string) $width,
				'thumbnail_custom_size_height'         => (string) $height,
				'thumbnail_custom_size_crop'           => '1',
				'thumbnail_custom_size_crop_alignment' => $alignment,
			)
		);
	}

	/**
	 * A PNG of three equal red, green and blue stripes, side by side when wide, stacked when tall.
	 */
	private function striped_image( string $name, bool $wide ): int {
		$width  = $wide ? 900 : 300;
		$height = $wide ? 300 : 900;
		$image  = imagecreatetruecolor( $width, $height );
		$colors = array(
			imagecolorallocate( $image, 255, 0, 0 ),
			imagecolorallocate( $image, 0, 255, 0 ),
			imagecolorallocate( $image, 0, 0, 255 ),
		);
		foreach ( $colors as $index => $color ) {
			if ( $wide ) {
				imagefilledrectangle( $image, $index * 300, 0, $index * 300 + 299, 299, $color );
			} else {
				imagefilledrectangle( $image, 0, $index * 300, 299, $index * 300 + 299, $color );
			}
		}

		$file = wp_tempnam( "$name.png" );
		imagepng( $image, $file );
		imagedestroy( $image );

		$upload = wp_upload_bits( "$name.png", null, (string) file_get_contents( $file ) );
		unlink( $file );

		return self::factory()->attachment->create_upload_object( $upload['file'] );
	}

	private function size_path( int $attachment_id, string $slug ): string {
		$size = image_get_intermediate_size( $attachment_id, $slug );
		$this->assertIsArray( $size, "No $slug sub-size." );

		return path_join( dirname( get_attached_file( $attachment_id ) ), $size['file'] );
	}

	private function file_name( int $attachment_id, string $suffix ): string {
		return pathinfo( get_attached_file( $attachment_id ), PATHINFO_FILENAME ) . "-$suffix.png";
	}

	private function stripe_at_centre( string $path ): string {
		$image = imagecreatefrompng( $path );
		$color = imagecolorsforindex( $image, imagecolorat( $image, (int) ( imagesx( $image ) / 2 ), (int) ( imagesy( $image ) / 2 ) ) );
		imagedestroy( $image );

		$channels = array_intersect_key( $color, array_flip( array( 'red', 'green', 'blue' ) ) );
		arsort( $channels );

		return (string) array_key_first( $channels );
	}

	public function test_galleries_with_one_size_and_different_alignments_get_their_own_registry_entries(): void {
		$top_left = $this->cropped_gallery( 400, 300, 'top-left' );
		$centre   = $this->cropped_gallery( 400, 300, 'center' );

		$registry = Image_Size_Manager::get_custom_sizes( true );

		$this->assertSame( array( $top_left ), $registry['fotogrids_custom_400x300_crop_top_left']['gallery_ids'] );
		$this->assertSame( 'top-left', $registry['fotogrids_custom_400x300_crop_top_left']['alignment'] );
		$this->assertSame( array( $centre ), $registry['fotogrids_custom_400x300_crop']['gallery_ids'] );
	}

	public function test_a_gallery_renders_its_own_alignment_slug(): void {
		$gallery = $this->cropped_gallery( 400, 300, 'bottom-center' );

		list( $thumb ) = Image_Size_Manager::resolve_setting_slugs(
			\FotoGrids\Galleries\Gallery_Repository::get_settings( $gallery )
		);

		$this->assertSame( 'fotogrids_custom_400x300_crop_bottom_center', $thumb );
	}

	public function test_each_alignment_crops_its_own_part_of_the_image_into_its_own_file(): void {
		foreach ( array_keys( self::STRIPES ) as $alignment ) {
			$this->cropped_gallery( 100, 100, $alignment );
		}

		foreach ( array( 0 => true, 1 => false ) as $axis => $wide ) {
			$attachment = $this->striped_image( $wide ? 'fg-crop-wide' : 'fg-crop-tall', $wide );
			$paths      = array();

			foreach ( self::STRIPES as $alignment => $stripes ) {
				$slug = Image_Size_Manager::compute_custom_slug( 100, 100, true, $alignment );
				$path = $this->size_path( $attachment, $slug );

				$this->assertFileExists( $path );
				$this->assertSame(
					$stripes[ $axis ],
					$this->stripe_at_centre( $path ),
					sprintf( '%s crop of the %s image', $alignment, $wide ? 'wide' : 'tall' )
				);
				$paths[ $alignment ] = $path;
			}

			$this->assertCount( 9, array_unique( $paths ), 'Each alignment has its own file.' );
			$this->assertSame( $this->file_name( $attachment, '100x100' ), basename( $paths['center'] ) );
			$this->assertSame( $this->file_name( $attachment, '100x100-top-left' ), basename( $paths['top-left'] ) );
		}
	}

	public function test_the_plugin_thumbnail_and_a_custom_size_of_the_same_dimensions_keep_separate_files(): void {
		update_option(
			'fotogrids_media_settings',
			array(
				'thumbnail_width'     => 100,
				'thumbnail_height'    => 100,
				'thumbnail_crop'      => true,
				'thumbnail_alignment' => 'left',
			)
		);
		Image_Size_Manager::add_image_sizes();
		$this->cropped_gallery( 100, 100, 'center' );

		$attachment = $this->striped_image( 'fg-crop-plugin', true );

		$plugin = $this->size_path( $attachment, Image_Size_Manager::SLUG_THUMBNAIL );
		$custom = $this->size_path( $attachment, 'fotogrids_custom_100x100_crop' );

		$this->assertSame( $this->file_name( $attachment, '100x100-center-left' ), basename( $plugin ) );
		$this->assertSame( 'red', $this->stripe_at_centre( $plugin ) );
		$this->assertSame( 'green', $this->stripe_at_centre( $custom ) );

		delete_option( 'fotogrids_media_settings' );
		Image_Size_Manager::add_image_sizes();
	}

	public function test_regenerating_writes_the_alignment_files(): void {
		$attachment = $this->striped_image( 'fg-crop-regen', true );
		$this->cropped_gallery( 100, 100, 'center-right' );

		$this->assertFalse( image_get_intermediate_size( $attachment, 'fotogrids_custom_100x100_crop_center_right' ) );

		$metadata = wp_generate_attachment_metadata( $attachment, get_attached_file( $attachment ) );
		wp_update_attachment_metadata( $attachment, $metadata );

		$path = $this->size_path( $attachment, 'fotogrids_custom_100x100_crop_center_right' );
		$this->assertSame( $this->file_name( $attachment, '100x100-center-right' ), basename( $path ) );
		$this->assertSame( 'blue', $this->stripe_at_centre( $path ) );
	}

	public function test_making_missing_sub_sizes_writes_the_alignment_files(): void {
		$attachment = $this->striped_image( 'fg-crop-missing', true );
		$this->cropped_gallery( 100, 100, 'top-right' );

		wp_update_image_subsizes( $attachment );

		$path = $this->size_path( $attachment, 'fotogrids_custom_100x100_crop_top_right' );
		$this->assertSame( $this->file_name( $attachment, '100x100-top-right' ), basename( $path ) );
		$this->assertSame( 'blue', $this->stripe_at_centre( $path ) );
	}

	public function test_a_size_registered_by_someone_else_keeps_the_core_file_name(): void {
		add_image_size( 'theme_top_crop', 120, 120, array( 'center', 'top' ) );
		$attachment = $this->striped_image( 'fg-crop-theme', false );
		remove_image_size( 'theme_top_crop' );

		$size = image_get_intermediate_size( $attachment, 'theme_top_crop' );
		$this->assertSame( $this->file_name( $attachment, '120x120' ), $size['file'] );
	}

	public function test_the_upgrade_moves_off_centre_galleries_off_the_shared_slug(): void {
		$top_left = $this->cropped_gallery( 400, 300, 'top-left' );
		$centre   = $this->cropped_gallery( 400, 300, 'center' );

		update_option(
			'fotogrids_custom_sizes',
			array(
				'fotogrids_custom_400x300_crop' => array(
					'width'       => 400,
					'height'      => 300,
					'crop'        => true,
					'alignment'   => 'top-left',
					'gallery_ids' => array( $top_left, $centre ),
				),
			),
			false
		);

		Custom_Crop_Size_Slugs::run();

		$registry = Image_Size_Manager::get_custom_sizes( true );
		$this->assertEqualsCanonicalizing( array( 'fotogrids_custom_400x300_crop', 'fotogrids_custom_400x300_crop_top_left' ), array_keys( $registry ) );
		$this->assertSame( array( $centre ), $registry['fotogrids_custom_400x300_crop']['gallery_ids'] );
		$this->assertSame( 'center', $registry['fotogrids_custom_400x300_crop']['alignment'] );
		$this->assertSame( array( $top_left ), $registry['fotogrids_custom_400x300_crop_top_left']['gallery_ids'] );
	}

	public function test_an_off_centre_gallery_shows_its_pre_upgrade_file_until_regenerated(): void {
		$this->cropped_gallery( 100, 100, 'center' );
		$attachment = $this->striped_image( 'fg-crop-legacy', true );
		$this->cropped_gallery( 100, 100, 'top-left' );

		$this->assertSame(
			'fotogrids_custom_100x100_crop',
			Image_Size_Manager::resolve_size( $attachment, 'custom', 'thumbnail', 'fotogrids_custom_100x100_crop_top_left' )
		);

		$metadata = wp_generate_attachment_metadata( $attachment, get_attached_file( $attachment ) );
		wp_update_attachment_metadata( $attachment, $metadata );

		$this->assertSame(
			'fotogrids_custom_100x100_crop_top_left',
			Image_Size_Manager::resolve_size( $attachment, 'custom', 'thumbnail', 'fotogrids_custom_100x100_crop_top_left' )
		);
	}
}
