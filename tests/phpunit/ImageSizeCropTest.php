<?php
/**
 * Unit tests for Image_Size_Manager crop parameters, crop suffixes and custom slugs.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Image_Size_Manager;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/includes/class-image-size-manager.php';

final class ImageSizeCropTest extends TestCase {

	/**
	 * The nine catalog alignments with their WP crop parameter and suffix.
	 *
	 * @return array<string, array{string, array{string, string}, string}>
	 */
	public static function catalog_alignments(): array {
		return array(
			'top-left'      => array( 'top-left', array( 'left', 'top' ), 'top-left' ),
			'top-center'    => array( 'top-center', array( 'center', 'top' ), 'top-center' ),
			'top-right'     => array( 'top-right', array( 'right', 'top' ), 'top-right' ),
			'center-left'   => array( 'center-left', array( 'left', 'center' ), 'center-left' ),
			'center'        => array( 'center', array( 'center', 'center' ), '' ),
			'center-right'  => array( 'center-right', array( 'right', 'center' ), 'center-right' ),
			'bottom-left'   => array( 'bottom-left', array( 'left', 'bottom' ), 'bottom-left' ),
			'bottom-center' => array( 'bottom-center', array( 'center', 'bottom' ), 'bottom-center' ),
			'bottom-right'  => array( 'bottom-right', array( 'right', 'bottom' ), 'bottom-right' ),
		);
	}

	/**
	 * @dataProvider catalog_alignments
	 */
	public function test_each_catalog_alignment_has_its_own_crop( string $alignment, array $crop, string $suffix ): void {
		$this->assertSame( $crop, Image_Size_Manager::build_crop_param( true, $alignment ) );
		$this->assertSame( $suffix, Image_Size_Manager::crop_suffix( $crop ) );
	}

	public function test_the_media_settings_alignments_still_map(): void {
		$this->assertSame( array( 'center', 'top' ), Image_Size_Manager::build_crop_param( true, 'top' ) );
		$this->assertSame( array( 'center', 'bottom' ), Image_Size_Manager::build_crop_param( true, 'bottom' ) );
		$this->assertSame( array( 'left', 'center' ), Image_Size_Manager::build_crop_param( true, 'left' ) );
		$this->assertSame( array( 'right', 'center' ), Image_Size_Manager::build_crop_param( true, 'right' ) );
	}

	public function test_an_unknown_alignment_crops_from_the_centre(): void {
		$this->assertSame( array( 'center', 'center' ), Image_Size_Manager::build_crop_param( true, 'middle' ) );
	}

	public function test_no_crop_ignores_the_alignment(): void {
		$this->assertFalse( Image_Size_Manager::build_crop_param( false, 'top-left' ) );
	}

	public function test_no_crop_and_a_plain_crop_have_no_suffix(): void {
		$this->assertSame( '', Image_Size_Manager::crop_suffix( false ) );
		$this->assertSame( '', Image_Size_Manager::crop_suffix( true ) );
	}

	public function test_a_centre_crop_keeps_the_slug_it_always_had(): void {
		$this->assertSame( 'fotogrids_custom_400x300_crop', Image_Size_Manager::compute_custom_slug( 400, 300, true ) );
		$this->assertSame( 'fotogrids_custom_400x300_crop', Image_Size_Manager::compute_custom_slug( 400, 300, true, 'center' ) );
	}

	public function test_no_crop_keeps_the_slug_it_always_had_whatever_the_alignment(): void {
		$this->assertSame( 'fotogrids_custom_800x0_nocrop', Image_Size_Manager::compute_custom_slug( 800, 0, false, 'top-left' ) );
	}

	public function test_each_alignment_gets_a_distinct_slug(): void {
		$slugs = array();
		foreach ( self::catalog_alignments() as $row ) {
			$slugs[] = Image_Size_Manager::compute_custom_slug( 400, 300, true, $row[0] );
		}

		$this->assertCount( 9, array_unique( $slugs ) );
		$this->assertContains( 'fotogrids_custom_400x300_crop_top_left', $slugs );
		$this->assertContains( 'fotogrids_custom_400x300_crop_bottom_center', $slugs );
	}

	public function test_alignments_that_crop_alike_share_a_slug(): void {
		$this->assertSame(
			Image_Size_Manager::compute_custom_slug( 400, 300, true, 'top-center' ),
			Image_Size_Manager::compute_custom_slug( 400, 300, true, 'top' )
		);
		$this->assertSame(
			Image_Size_Manager::compute_custom_slug( 400, 300, true ),
			Image_Size_Manager::compute_custom_slug( 400, 300, true, 'middle' )
		);
	}

	public function test_the_editor_filter_leaves_other_editors_alone(): void {
		$editors = array( 'Some_Other_Editor', 'Another_Editor' );
		$this->assertSame( $editors, Image_Size_Manager::filter_image_editors( $editors ) );
		$this->assertSame( 'not-a-list', Image_Size_Manager::filter_image_editors( 'not-a-list' ) );
	}
}
