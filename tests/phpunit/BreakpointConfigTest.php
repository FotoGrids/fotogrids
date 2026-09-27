<?php
/**
 * Unit tests for how Breakpoint_Config scopes breakpoint rules and hands its
 * configuration to the frontend runtime.
 *
 * WP-independent: scope() and wrapper_attrs() read only the constructed values.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Api\Breakpoint_Config;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-breakpoint-config.php';

final class BreakpointConfigTest extends TestCase {

	public function test_viewport_detection_emits_max_width_blocks_at_the_configured_widths(): void {
		$config = new Breakpoint_Config( 900, 600, false );

		$this->assertSame(
			"@media (max-width: 900px) {\n    #g {\n--v: 1;\n    }\n}\n",
			$config->scope( 'tablet', '#g', "--v: 1;\n" )
		);
		$this->assertStringStartsWith( '@media (max-width: 600px) {', $config->scope( 'mobile', '#g', "--v: 1;\n" ) );
	}

	public function test_device_detection_selects_on_the_device_class(): void {
		$config = new Breakpoint_Config( 900, 600, true );

		$tablet = $config->scope( 'tablet', '#g', "--v: 1;\n" );
		$mobile = $config->scope( 'mobile', '#g', "--v: 2;\n" );

		$this->assertStringStartsWith(
			'html[data-fg-breakpoint="tablet"] #g, html[data-fg-breakpoint="mobile"] #g {',
			$tablet
		);
		$this->assertStringStartsWith( 'html[data-fg-breakpoint="mobile"] #g {', $mobile );
		$this->assertStringNotContainsString( 'data-fg-breakpoint="tablet"', $mobile );
	}

	public function test_device_detection_falls_back_to_the_viewport_until_the_runtime_runs(): void {
		$config = new Breakpoint_Config( 900, 600, true );

		$this->assertStringContainsString(
			"@media (max-width: 900px) {\n    html:not([data-fg-breakpoint]) #g {",
			$config->scope( 'tablet', '#g', "--v: 1;\n" )
		);
	}

	public function test_wrapper_attrs_carry_the_widths_and_detection_mode(): void {
		$this->assertSame(
			array(
				'data-fg-breakpoints'       => '600 900',
				'data-fg-breakpoint-detect' => 'device',
			),
			( new Breakpoint_Config( 900, 600, true ) )->wrapper_attrs()
		);
		$this->assertSame(
			'viewport',
			( new Breakpoint_Config( 1024, 767 ) )->wrapper_attrs()['data-fg-breakpoint-detect']
		);
	}
}
