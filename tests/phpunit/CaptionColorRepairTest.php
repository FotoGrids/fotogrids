<?php
/**
 * Unit tests for which stored caption colours Caption_Color_Repair treats as
 * the white defaults of 1.2.0.
 *
 * WP-independent: is_old_default() compares strings only.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Migrations\Caption_Color_Repair;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/includes/migrations/class-caption-color-repair.php';

final class CaptionColorRepairTest extends TestCase {

	public function test_the_old_defaults_match_whatever_their_spacing_or_case(): void {
		foreach ( array( 'rgba(255, 255, 255, 1)', 'rgba(255,255,255,1)', ' RGBA( 255, 255, 255, 1 ) ' ) as $value ) {
			$this->assertTrue( Caption_Color_Repair::is_old_default( 'caption_title_color', $value ), $value );
		}
		$this->assertTrue( Caption_Color_Repair::is_old_default( 'caption_description_color', 'rgba(255, 255, 255, 0.7)' ) );
	}

	public function test_each_setting_matches_only_its_own_old_default(): void {
		$this->assertFalse( Caption_Color_Repair::is_old_default( 'caption_title_color', 'rgba(255, 255, 255, 0.7)' ) );
		$this->assertFalse( Caption_Color_Repair::is_old_default( 'caption_description_color', 'rgba(255, 255, 255, 1)' ) );
	}

	public function test_other_colours_and_settings_are_kept(): void {
		foreach ( array( '#ffffff', 'rgba(255, 255, 255, 0.5)', 'rgba(200, 30, 30, 1)', '' ) as $value ) {
			$this->assertFalse( Caption_Color_Repair::is_old_default( 'caption_title_color', $value ), $value );
		}
		$this->assertFalse( Caption_Color_Repair::is_old_default( 'border_color', 'rgba(255, 255, 255, 1)' ) );
		$this->assertFalse( Caption_Color_Repair::is_old_default( 'caption_title_color', null ) );
		$this->assertFalse( Caption_Color_Repair::is_old_default( 'caption_title_color', array( 'rgba(255, 255, 255, 1)' ) ) );
	}
}
