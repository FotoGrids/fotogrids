<?php
/**
 * Unit tests for Video_Item_Helpers::playback_settings().
 *
 * WP-independent: the class only guards on WPINC, which the bootstrap defines.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Video\Video_Item_Helpers;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/public/render/video/class-video-item-helpers.php';

final class VideoPlaybackSettingsTest extends TestCase {

	public function test_empty_custom_data_yields_the_editor_defaults(): void {
		$this->assertSame(
			array(
				'autoplay' => true,
				'mute'     => false,
				'loop'     => false,
				'controls' => true,
			),
			Video_Item_Helpers::playback_settings( array() )
		);
	}

	public function test_stored_values_are_returned_as_booleans(): void {
		$settings = Video_Item_Helpers::playback_settings(
			array(
				'autoplay' => false,
				'mute'     => true,
				'loop'     => true,
				'controls' => false,
			)
		);

		$this->assertSame(
			array(
				'autoplay' => false,
				'mute'     => true,
				'loop'     => true,
				'controls' => false,
			),
			$settings
		);
	}

	public function test_poster_fields_are_not_carried_into_the_markup(): void {
		$settings = Video_Item_Helpers::playback_settings(
			array(
				'poster_id'     => 42,
				'poster_url'    => 'https://example.com/poster.jpg',
				'thumbnail_url' => 'https://example.com/thumb.jpg',
				'mute'          => true,
			)
		);

		$this->assertSame(
			array( 'autoplay', 'mute', 'loop', 'controls' ),
			array_keys( $settings )
		);
	}

	public function test_truthy_and_falsy_scalars_are_cast(): void {
		$settings = Video_Item_Helpers::playback_settings(
			array(
				'autoplay' => 0,
				'mute'     => '1',
				'loop'     => '',
				'controls' => 1,
			)
		);

		$this->assertFalse( $settings['autoplay'] );
		$this->assertTrue( $settings['mute'] );
		$this->assertFalse( $settings['loop'] );
		$this->assertTrue( $settings['controls'] );
	}
}
