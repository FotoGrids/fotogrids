<?php
/**
 * Unit tests for the Page Buttons pagination icons.
 *
 * WP-independent: the classes only guard on WPINC, which the bootstrap defines.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Features\Pagination\Page_Buttons\Page_Buttons;
use FotoGrids\Render\Internal\Arrow_Icons;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/public/render/api/interface-feature.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/api/trait-setting-helpers.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/features/pagination/trait-pagination-common.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-arrow-icons.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/features/pagination/page-buttons/class-page-buttons.php';

final class PageButtonsIconsTest extends TestCase {

	/**
	 * @return array<string, array{prev: string, next: string}>
	 */
	private static function icon_library(): array {
		$json = file_get_contents( FOTOGRIDS_PLUGIN_DIR . 'public/render/lightbox/shared/arrow-icons.json' );

		return json_decode( (string) $json, true );
	}

	/**
	 * Returns the option values the settings catalog offers for pages_button_icon.
	 *
	 * @return string[]
	 */
	private static function catalog_icon_options(): array {
		$json    = file_get_contents( FOTOGRIDS_PLUGIN_DIR . 'assets/admin/plain/collection-settings/pagination.json' );
		$catalog = json_decode( (string) $json, true );

		$find = static function ( $node ) use ( &$find ) {
			if ( ! is_array( $node ) ) {
				return null;
			}
			if ( ( $node['key'] ?? null ) === 'pages_button_icon' && isset( $node['options'] ) ) {
				return $node['options'];
			}
			foreach ( $node as $child ) {
				$found = $find( $child );
				if ( null !== $found ) {
					return $found;
				}
			}
			return null;
		};

		return array_column( (array) $find( $catalog ), 'value' );
	}

	private function render_icon( string $icon, string $side ): string {
		$method = new ReflectionMethod( Page_Buttons::class, 'render_icon' );
		$method->setAccessible( true );

		return $method->invoke( ( new ReflectionClass( Page_Buttons::class ) )->newInstanceWithoutConstructor(), $icon, $side );
	}

	/**
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function icon_style_provider(): array {
		$cases = array();
		foreach ( array_keys( self::icon_library() ) as $icon ) {
			foreach ( array( 'prev', 'next' ) as $side ) {
				$cases[ "$icon $side" ] = array( $icon, $side );
			}
		}
		return $cases;
	}

	public function test_catalog_offers_the_expected_icon_styles(): void {
		$options = self::catalog_icon_options();

		$this->assertNotEmpty( $options, 'pages_button_icon options not found in pagination.json.' );
		$this->assertContains( 'none', $options );
	}

	public function test_every_catalog_icon_style_has_an_svg_pair(): void {
		$library = self::icon_library();

		foreach ( array_diff( self::catalog_icon_options(), array( 'none' ) ) as $icon ) {
			$this->assertArrayHasKey( $icon, $library, "pages_button_icon option '$icon' has no pair in arrow-icons.json." );
			$this->assertArrayHasKey( $icon, Arrow_Icons::all(), "Arrow_Icons does not load '$icon'." );
		}
	}

	/**
	 * @dataProvider icon_style_provider
	 */
	public function test_render_icon_emits_the_selected_style( string $icon, string $side ): void {
		$html = $this->render_icon( $icon, $side );

		$this->assertStringContainsString( self::icon_library()[ $icon ][ $side ], $html );
		$this->assertStringContainsString( 'fg-pagination__icon--' . $icon, $html );
		$this->assertStringContainsString( 'data-fg-icon="' . $side . '"', $html );
	}

	public function test_render_icon_is_empty_for_none(): void {
		$this->assertSame( '', $this->render_icon( 'none', 'prev' ) );
		$this->assertSame( '', $this->render_icon( 'none', 'next' ) );
	}
}
