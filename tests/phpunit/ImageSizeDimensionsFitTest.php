<?php
/**
 * Unit tests for Image_Size_Manager::dimensions_fit().
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Image_Size_Manager;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/includes/class-image-size-manager.php';

final class ImageSizeDimensionsFitTest extends TestCase {

	public function test_an_original_narrower_than_a_width_only_bound_fits(): void {
		$this->assertTrue( Image_Size_Manager::dimensions_fit( 1600, 1067, 1920, 0 ) );
	}

	public function test_an_original_equal_to_the_bound_fits(): void {
		$this->assertTrue( Image_Size_Manager::dimensions_fit( 1920, 1280, 1920, 0 ) );
	}

	public function test_an_original_wider_than_the_bound_does_not_fit(): void {
		$this->assertFalse( Image_Size_Manager::dimensions_fit( 2560, 1707, 1920, 0 ) );
	}

	public function test_a_height_bound_is_enforced(): void {
		$this->assertFalse( Image_Size_Manager::dimensions_fit( 1000, 1500, 1920, 1080 ) );
		$this->assertTrue( Image_Size_Manager::dimensions_fit( 1000, 1000, 1920, 1080 ) );
	}

	public function test_a_zero_width_bound_is_unlimited(): void {
		$this->assertTrue( Image_Size_Manager::dimensions_fit( 5000, 300, 0, 400 ) );
	}
}
