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
				'autoplay' => false,
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
				'autoplay' => 1,
				'mute'     => '1',
				'loop'     => '',
				'controls' => 0,
			)
		);

		$this->assertTrue( $settings['autoplay'] );
		$this->assertTrue( $settings['mute'] );
		$this->assertFalse( $settings['loop'] );
		$this->assertFalse( $settings['controls'] );
	}

	public function test_lightbox_playback_always_keeps_the_badge(): void {
		$this->assertTrue(
			Video_Item_Helpers::needs_play_badge(
				Video_Item_Helpers::TYPE_FILE,
				'lightbox',
				array( 'autoplay' => true, 'controls' => true )
			)
		);
	}

	public function test_an_autoplaying_inline_tile_needs_no_badge(): void {
		$this->assertFalse(
			Video_Item_Helpers::needs_play_badge(
				Video_Item_Helpers::TYPE_FILE,
				'inline',
				array( 'autoplay' => true, 'controls' => false )
			)
		);
	}

	public function test_a_file_video_showing_its_controls_needs_no_badge(): void {
		$this->assertFalse(
			Video_Item_Helpers::needs_play_badge(
				Video_Item_Helpers::TYPE_FILE,
				'inline',
				array( 'autoplay' => false, 'controls' => true )
			)
		);
	}

	public function test_a_file_video_hiding_its_controls_keeps_the_badge(): void {
		$this->assertTrue(
			Video_Item_Helpers::needs_play_badge(
				Video_Item_Helpers::TYPE_FILE,
				'inline',
				array( 'autoplay' => false, 'controls' => false )
			)
		);
	}

	public function test_an_unloaded_embed_keeps_the_badge_even_with_controls_on(): void {
		$this->assertTrue(
			Video_Item_Helpers::needs_play_badge(
				Video_Item_Helpers::TYPE_YOUTUBE,
				'inline',
				array( 'autoplay' => false, 'controls' => true )
			)
		);
	}
}
