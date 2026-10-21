<?php
/**
 * Unit tests for the caption overlay background the Captions decorator emits.
 *
 * WP-independent: style_vars() reads only the render context, and the font
 * filters it passes through are the bootstrap's apply_filters stub.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Render_Behavior;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Render_Layout;
use FotoGrids\Render\Api\Render_Meta;
use FotoGrids\Render\Api\Render_Mode;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Decorators\Captions\Captions;
use PHPUnit\Framework\TestCase;

// WordPress polyfills this for PHP 7.4; this suite runs without WordPress.
if ( ! function_exists( 'str_ends_with' ) ) {
	function str_ends_with( string $haystack, string $needle ): bool {
		return '' === $needle || substr( $haystack, -strlen( $needle ) ) === $needle;
	}
}

$fotogrids_render_api = dirname( __DIR__, 2 ) . '/src/public/render/';
require_once dirname( __DIR__, 2 ) . '/src/includes/hooks/filters/class-filters-render.php';
require_once $fotogrids_render_api . 'api/class-collection-kind.php';
require_once $fotogrids_render_api . 'api/class-columns-mode.php';
require_once $fotogrids_render_api . 'api/class-render-mode.php';
require_once $fotogrids_render_api . 'api/class-request-source.php';
require_once $fotogrids_render_api . 'api/class-render-meta.php';
require_once $fotogrids_render_api . 'api/class-render-layout.php';
require_once $fotogrids_render_api . 'api/class-render-behavior.php';
require_once $fotogrids_render_api . 'api/class-item-view.php';
require_once $fotogrids_render_api . 'api/class-render-context.php';
require_once $fotogrids_render_api . 'api/class-asset-decl.php';
require_once $fotogrids_render_api . 'api/class-module-assets.php';
require_once $fotogrids_render_api . 'api/class-responsive-var.php';
require_once $fotogrids_render_api . 'api/trait-setting-helpers.php';
require_once $fotogrids_render_api . 'api/interface-decorator.php';
require_once $fotogrids_render_api . 'api/class-hover-effect.php';
require_once $fotogrids_render_api . 'api/class-font-resolver.php';
require_once $fotogrids_render_api . 'internal/class-hover-effect-registry.php';
require_once $fotogrids_render_api . 'decorators/captions/class-captions.php';

final class CaptionOverlayColorTest extends TestCase {

	/**
	 * The two overlay backgrounds for an overlay caption.
	 *
	 * @param array<string, mixed> $settings Caption settings.
	 * @return array{0: mixed, 1: mixed}
	 */
	private function overlay( array $settings ): array {
		$context = new Render_Context(
			new Render_Meta(
				7,
				null,
				'fg-instance-7',
				Request_Source::SHORTCODE,
				false,
				Render_Mode::INITIAL,
				2,
				Collection_Kind::GALLERY
			),
			new Render_Layout( 'grid', Columns_Mode::FIXED, array( 'desktop' => 3 ), array( 'desktop' => 10 ), array() ),
			new Render_Behavior( 'lightbox', 'show_all', 'load_more', null, 'full' ),
			array_merge( array( 'caption_placement' => 'overlay' ), $settings ),
			array()
		);

		$vars = ( new Captions() )->style_vars( $context );

		return array( $vars['--fg-caption-overlay-bg'] ?? null, $vars['--fg-caption-overlay-bg-hover'] ?? null );
	}

	/**
	 * CAP-05: the colour's own alpha is multiplied by the opacity, and the
	 * hover background uses the hover opacity.
	 */
	public function test_overlay_alpha_is_the_colour_alpha_times_each_opacity(): void {
		$this->assertSame(
			array( 'rgba(10, 20, 30, 0.4)', 'rgba(10, 20, 30, 0.1)' ),
			$this->overlay(
				array(
					'caption_overlay_color'         => 'rgba(10, 20, 30, 0.8)',
					'caption_overlay_opacity'       => 50,
					'caption_overlay_hover_opacity' => 12.5,
				)
			)
		);
	}

	/** CAP-05: opacities outside 0..100 are clamped, not passed through. */
	public function test_opacity_is_clamped_to_zero_and_one_hundred(): void {
		$this->assertSame(
			array( 'rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 0)' ),
			$this->overlay(
				array(
					'caption_overlay_color'         => '#000',
					'caption_overlay_opacity'       => 250,
					'caption_overlay_hover_opacity' => -40,
				)
			)
		);
	}

	/** CAP-05: no opacity saved means 100% regular and 50% on hover. */
	public function test_missing_opacities_fall_back_to_full_and_half(): void {
		$this->assertSame(
			array( 'rgba(255, 0, 0, 0.6)', 'rgba(255, 0, 0, 0.3)' ),
			$this->overlay( array( 'caption_overlay_color' => 'rgba(255, 0, 0, 0.6)' ) )
		);
	}

	/**
	 * Colour formats the parser reads, with the alpha each one carries.
	 *
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function colours(): array {
		return array(
			'#rgb'                => array( '#f80', 'rgba(255, 136, 0, 1)' ),
			'#rgba'               => array( '#f808', 'rgba(255, 136, 0, 0.5333)' ),
			'#rrggbb'             => array( '#0A141E', 'rgba(10, 20, 30, 1)' ),
			'#rrggbbaa'           => array( '#0a141e80', 'rgba(10, 20, 30, 0.502)' ),
			'rgb() with commas'   => array( 'rgb(1, 2, 3)', 'rgba(1, 2, 3, 1)' ),
			'rgb() with spaces'   => array( 'rgb(1 2 3)', 'rgba(1, 2, 3, 1)' ),
			'rgba()'              => array( 'rgba(1, 2, 3, 0.25)', 'rgba(1, 2, 3, 0.25)' ),
			'rgba() alpha in %'   => array( 'rgb(1 2 3 / 40%)', 'rgba(1, 2, 3, 0.4)' ),
			'surrounding spaces'  => array( '  #fff  ', 'rgba(255, 255, 255, 1)' ),
		);
	}

	/**
	 * CAP-06: every supported format parses to the right channels and alpha.
	 *
	 * @dataProvider colours
	 */
	public function test_each_colour_format_parses( string $colour, string $expected ): void {
		$this->assertSame(
			$expected,
			$this->overlay(
				array(
					'caption_overlay_color'   => $colour,
					'caption_overlay_opacity' => 100,
				)
			)[0]
		);
	}

	/**
	 * Values the parser cannot read.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function unreadable(): array {
		return array(
			'named colour'  => array( 'red' ),
			'hsl()'         => array( 'hsl(0, 100%, 50%)' ),
			'five hex'      => array( '#12345' ),
			'empty'         => array( '' ),
		);
	}

	/**
	 * CAP-06: an unreadable colour degrades to the default translucent black
	 * instead of emitting an invalid value.
	 *
	 * @dataProvider unreadable
	 */
	public function test_an_unreadable_colour_degrades_to_translucent_black( string $colour ): void {
		$this->assertSame(
			array( 'rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.15)' ),
			$this->overlay( array( 'caption_overlay_color' => $colour ) )
		);
	}
}
