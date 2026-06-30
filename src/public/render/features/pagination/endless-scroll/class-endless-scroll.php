<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Pagination\Endless_Scroll;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Features\Pagination\Pagination_Common;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Endless-scroll pagination.
 *
 * Active when:
 *   - pagination_type      === 'paginated'
 *   - pagination_method    === 'endless_scroll'
 *
 * Renders a single sentinel <div data-fg-pagination-sentinel> after the
 * layout (via html_after). Client-side, an IntersectionObserver watches the
 * sentinel and calls FotoGrids.modules.pagination.goToPage(gEl, next, {
 * mode: 'append' }) when it enters the viewport.
 *
 * @package FotoGrids\Render\Features\Pagination\Endless_Scroll
 * @since   1.0.0
 */
final class Endless_Scroll implements Feature {

	use Pagination_Common;

	public function id(): string {
		return 'fotogrids/pagination/endless-scroll';
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

	public function supports( Render_Context $render_context ): bool {
		if ( ! $this->pagination_supports( $render_context ) ) {
			return false;
		}

		return ( $render_context->settings['pagination_method'] ?? '' ) === 'endless_scroll';
	}

	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Sentinel element. Sits at the end of the wrapper; the
	 * IntersectionObserver in endless-scroll.js triggers the next page
	 * load when this element enters the viewport.
	 *
	 * Also includes a hidden "loading more…" status region for
	 * screen-reader announcements; the visible spinner is purely CSS.
	 *
	 * Uses html_appendix (NOT html_after) so the sentinel lives INSIDE
	 * the gallery wrapper - see Load_More for the same reasoning.
	 *
	 * @since 1.0.0
	 */
	public function html_appendix( Render_Context $render_context ): string {
		// Use the same loading icon configured under Effects > Loading Effects
		// so the end-of-list loader matches the gallery's item loaders. Default
		// mirrors Loading_Icon::DEFAULT_ICON.
		$icon_name = $render_context->settings['loading_icon'] ?? '';
		$icon_name = is_string( $icon_name ) && '' !== $icon_name ? $icon_name : '12-dots';

		// Unique suffix so gradient / clipPath IDs in the SVG don't collide
		// with the gallery's per-item loaders (which replace __FG_ID__ too).
		$instance_id = 'fges' . $render_context->meta->instance_id;
		$svg         = class_exists( '\FotoGrids\Assets\Loading_Icon_Library' )
			? \FotoGrids\Assets\Loading_Icon_Library::svg( $icon_name, $instance_id )
			: '';

		return sprintf(
			'<div class="fg-pagination fg-pagination--endless-scroll" data-fg-pagination-role="endless-scroll">'
			. '<div class="fg-pagination__sentinel" data-fg-pagination-sentinel="true" aria-hidden="true"></div>'
			. '<div class="fg-pagination__loader" data-fg-loading-icon="%s" aria-hidden="true">%s</div>'
			. '<div class="fg-pagination__status" role="status" aria-live="polite"></div>'
			. '</div>',
			esc_attr( $icon_name ),
			$svg
		);
	}

	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return $this->common_wrapper_attrs( $render_context, 'endless_scroll' );
	}

	public function style_vars( Render_Context $render_context ): array {
		// Inherits `--fg-pagination-distance` (margin above the bar) from
		// the shared trait. No endless-scroll-specific theming in v1 - the
		// spinner uses the gallery's existing --fg-color-primary if
		// defined; otherwise falls back to currentColor in the CSS.
		return $this->common_style_vars( $render_context );
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		$common = $this->common_assets();

		// Merge per-method CSS + JS on top of the shared pagination-core JS.
		return new Module_Assets(
			array_merge(
				$common->css,
				array(
					'fotogrids-pagination-endless-scroll' => new Asset_Decl(
						'features/pagination/endless-scroll/endless-scroll.css',
						array(),
						false,
					),
				)
			),
			array_merge(
				$common->js,
				array(
					'fotogrids-pagination-endless-scroll' => new Asset_Decl(
						'../../assets/js/endless-scroll.js',
						array( 'fotogrids-pagination-core' ),
						true,
					),
				)
			)
		);
	}
}
