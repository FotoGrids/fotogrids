<?php
/**
 * Settings_Localizer::merge_saved_defaults().
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Admin\Settings_Localizer;
use PHPUnit\Framework\TestCase;

require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-settings-localizer.php';

final class SettingsLocalizerDefaultsTest extends TestCase {

	public function test_without_saved_defaults_returns_the_shipped_defaults(): void {
		$shipped = array(
			'columns'     => 3,
			'lightbox'    => true,
			'item_radius' => array( 'desktop' => 0 ),
		);

		$this->assertSame( $shipped, Settings_Localizer::merge_saved_defaults( $shipped, array() ) );
	}

	public function test_saved_defaults_override_and_decode(): void {
		$shipped = array(
			'columns'      => 3,
			'lightbox'     => true,
			'item_radius'  => array( 'desktop' => 0 ),
			'layout'       => 'grid',
			'caption_text' => 'x',
			'untouched'    => 'keep',
		);
		$saved   = array(
			'columns'      => '4',
			'lightbox'     => '0',
			'item_radius'  => '{"desktop":6,"mobile":2}',
			'layout'       => 'masonry',
			'caption_text' => '{not json',
		);

		$this->assertSame(
			array(
				'columns'      => 4,
				'lightbox'     => '0',
				'item_radius'  => array(
					'desktop' => 6,
					'mobile'  => 2,
				),
				'layout'       => 'masonry',
				'caption_text' => '{not json',
				'untouched'    => 'keep',
			),
			Settings_Localizer::merge_saved_defaults( $shipped, $saved )
		);
	}

	public function test_saved_keys_outside_the_shipped_defaults_are_dropped(): void {
		$this->assertSame(
			array( 'columns' => 3 ),
			Settings_Localizer::merge_saved_defaults( array( 'columns' => 3 ), array( 'retired_key' => '1' ) )
		);
	}
}
