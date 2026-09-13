<?php
/**
 * Unit tests for which video module claims a gallery.
 *
 * WP-independent: the modules only guard on WPINC, which the bootstrap
 * defines, and supports() reads nothing but the render context.
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
use FotoGrids\Render\Video\Video_Inline;
use FotoGrids\Render\Video\Video_Lightbox_Mini;
use PHPUnit\Framework\TestCase;

$fotogrids_render_api = dirname( __DIR__, 2 ) . '/src/public/render/';
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
require_once $fotogrids_render_api . 'api/interface-feature.php';
require_once $fotogrids_render_api . 'video/class-video-inline.php';
require_once $fotogrids_render_api . 'video/class-video-lightbox-mini.php';

final class VideoPlaybackRoutingTest extends TestCase {

	private function context(
		string $playback_mode,
		string $click_behavior,
		string $collection_kind = Collection_Kind::GALLERY
	): Render_Context {
		return new Render_Context(
			new Render_Meta(
				7,
				null,
				'fg-instance-7',
				Request_Source::SHORTCODE,
				false,
				Render_Mode::INITIAL,
				2,
				$collection_kind
			),
			new Render_Layout(
				'grid',
				Columns_Mode::FIXED,
				array( 'desktop' => 3 ),
				array( 'desktop' => 10 ),
				array()
			),
			new Render_Behavior( $click_behavior, 'show_all', 'load_more', null ),
			array( 'video_playback_mode' => $playback_mode ),
			array()
		);
	}

	/**
	 * @return array<string, array{0: string, 1: string, 2: bool, 3: bool}>
	 */
	public function playback_matrix(): array {
		return array(
			// playback mode, click behaviour, inline active, mini active.
			'inline + lightbox click' => array( 'inline', 'lightbox', true, false ),
			'inline + direct click'   => array( 'inline', 'direct', true, false ),
			'inline + external click' => array( 'inline', 'external', true, false ),
			'inline + no click'       => array( 'inline', 'nothing', true, false ),
			'lightbox + direct click' => array( 'lightbox', 'direct', false, true ),
			'lightbox + no click'     => array( 'lightbox', 'nothing', false, true ),
			// The full lightbox is already on the page and owns video slides.
			'lightbox + lightbox click' => array( 'lightbox', 'lightbox', false, false ),
		);
	}

	/**
	 * @dataProvider playback_matrix
	 */
	public function test_the_playback_mode_decides_the_module(
		string $mode,
		string $click,
		bool $inline_active,
		bool $mini_active
	): void {
		$context = $this->context( $mode, $click );

		$this->assertSame(
			$inline_active,
			( new Video_Inline() )->supports( $context ),
			'Video_Inline for ' . $mode . ' + ' . $click
		);
		$this->assertSame(
			$mini_active,
			( new Video_Lightbox_Mini() )->supports( $context ),
			'Video_Lightbox_Mini for ' . $mode . ' + ' . $click
		);
	}

	public function test_albums_never_play_video_inline_or_in_the_mini_overlay(): void {
		foreach ( array( 'inline', 'lightbox' ) as $mode ) {
			$context = $this->context( $mode, 'direct', Collection_Kind::ALBUM );
			$this->assertFalse( ( new Video_Inline() )->supports( $context ) );
			$this->assertFalse( ( new Video_Lightbox_Mini() )->supports( $context ) );
		}
	}
}
