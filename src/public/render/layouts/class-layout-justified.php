<?php
declare(strict_types=1);

namespace FotoGrids\Render\Layouts;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Internal\Item_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Justified layout module.
 *
 * Capabilities:
 *   - uses_item_spacing : --fg-gap.
 *
 * Items flow at their natural aspect ratio packed into rows of a target
 * height. Sizing is JS-driven (layouts/justified/justified.js); the
 * server-side render just stamps the target height, tolerance, last-row
 * behaviour and max-row count onto the wrapper so the JS row-packer can
 * read them without an additional fetch.
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Justified implements Layout {

	public function id(): string {
		return 'fotogrids/justified';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	public function layout_key(): string {
		return 'justified';
	}

	public function supports( Render_Context $render_context ): bool {
		return 'justified' === $render_context->layout->layout_id;
	}

	public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
		$items_html = '';
		foreach ( $render_context->items as $item_view ) {
			$hidden_view = $item_view->with(
				array(
					'classes' => array_merge( $item_view->classes, array( 'fg-item-hidden' ) ),
				)
			);
			$items_html .= $item_renderer->render( $hidden_view, $render_context );
		}

		return '<div class="fg-justified-track" data-fg-items-root="true">' . $items_html . '</div>';
	}

	public function structural_classes( Render_Context $render_context ): array {
		return array();
	}

	/**
	 * @since   1.0.0
	 * @return  array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$settings = $render_context->settings;

		$tolerance = isset( $settings['layout_justified_row_height_tolerance'] )
			? (int) $settings['layout_justified_row_height_tolerance']
			: 25;
		$tolerance = max( 0, min( 100, $tolerance ) );

		$last_row = $settings['layout_justified_last_row'] ?? 'nojustify';
		if ( ! in_array( $last_row, array( 'justify', 'nojustify', 'left', 'center', 'right', 'hide' ), true ) ) {
			$last_row = 'nojustify';
		}

		$max_rows = isset( $settings['layout_justified_max_rows'] )
			? max( 0, (int) $settings['layout_justified_max_rows'] )
			: 0;

		$page_trailing_row = $settings['layout_justified_page_trailing_row'] ?? 'fill';
		if ( ! in_array( $page_trailing_row, array( 'fill', 'match' ), true ) ) {
			$page_trailing_row = 'fill';
		}

		return array(
			'data-fg-justified-tolerance'         => (string) $tolerance,
			'data-fg-justified-last-row'          => (string) $last_row,
			'data-fg-justified-max-rows'          => (string) $max_rows,
			'data-fg-justified-page-trailing-row' => (string) $page_trailing_row,
		);
	}

	/**
	 * @since   1.0.0
	 * @return  array<string, string|Responsive_Var>
	 */
	public function style_vars( Render_Context $render_context ): array {
		$row_height = $render_context->settings['layout_justified_row_height'] ?? array();

		$desktop = self::resolve_row_height_breakpoint( $row_height, 'desktop', 220 );
		$tablet  = self::resolve_row_height_breakpoint( $row_height, 'tablet', 180 );
		$mobile  = self::resolve_row_height_breakpoint( $row_height, 'mobile', 140 );

		return array(
			'--fg-justified-row-height' => new Responsive_Var(
				desktop: $desktop . 'px',
				tablet:  $tablet . 'px',
				mobile:  $mobile . 'px',
			),
		);
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			css: array(
				'fotogrids-render-base'      => new Asset_Decl( path: 'base/collection-base.css' ),
				'fotogrids-layout-justified' => new Asset_Decl( path: 'layouts/justified/justified.css' ),
			),
			js: array(
				'fotogrids-layout-justified' => new Asset_Decl(
					path:      '../../assets/js/layout-justified.js',
					deps:      array( 'fotogrids-runtime' ),
					in_footer: true,
				),
			)
		);
	}

	public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
		return \FotoGrids\Image_Size_Manager::SLUG_JUSTIFIED;
	}

	/**
	 * Justified packs items at a fixed row height with variable widths, so
	 * it requires the proportional fotogrids_justified derivative. A cropped
	 * or square user-picked size would force every tile to the same aspect
	 * ratio and defeat the layout — the preference is mandatory.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  bool
	 */
	public function requires_thumbnail_size( Render_Context $render_context ): bool {
		return true;
	}

	public function capabilities(): array {
		return array(
			'uses_item_spacing' => true,
		);
	}

	/**
	 * Resolves a per-breakpoint row-height value into a positive integer
	 * pixel count.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $row_height Responsive row-height map.
	 * @param  string               $breakpoint One of 'desktop', 'tablet', 'mobile'.
	 * @param  int                  $fallback   Pixel fallback when the breakpoint is missing or invalid.
	 * @return int
	 */
	private static function resolve_row_height_breakpoint( array $row_height, string $breakpoint, int $fallback ): int {
		$raw = $row_height[ $breakpoint ] ?? null;

		if ( is_array( $raw ) ) {
			$raw = $raw['value'] ?? null;
		}

		if ( null === $raw || '' === $raw ) {
			return $fallback;
		}

		$value = (int) $raw;
		return $value > 0 ? $value : $fallback;
	}
}
