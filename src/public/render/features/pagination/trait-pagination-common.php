<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Pagination;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Font_Resolver;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;
use FotoGrids\Render\Internal\Layout_Capabilities;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Shared behaviour for the three pagination sibling modules.
 *
 * Holds:
 *  - page-size resolution (responsive `items_per_page` shape → int),
 *  - "should this gallery actually paginate" check,
 *  - preload flag resolution,
 *  - the canonical wrapper data-attrs every method writes,
 *  - the standard assets() declaration (each method JS depends on
 *    `fotogrids-pagination-core` which depends on `fotogrids-runtime`).
 *
 * Used as a trait, not a base class, because the modules implement
 * `Feature` directly and PHP doesn't let us inherit from an interface.
 *
 * @package FotoGrids\Render\Features\Pagination
 * @since   1.0.0
 */
trait Pagination_Common {

	use Setting_Helpers;

	/**
	 * Shared gating predicate.
	 *
	 * Returns false for albums and when pagination_type !== 'paginated'.
	 * Each module then adds its own `pagination_method` check on top of
	 * this.
	 *
	 * @since 1.0.0
	 */
	protected function pagination_supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}

		// Ask the active layout whether it wants pagination chrome around
		// it. Layouts like Single Item, Image Viewer, Slider, and Carousel
		// return capabilities()['paginates'] = false because they render
		// a single item (or handle navigation inside themselves). Layouts
		// that don't care (Grid, Masonry, Justified) return [], which the
		// helper treats as permissive default true.
		if ( ! Layout_Capabilities::supports( $render_context, 'paginates' ) ) {
			return false;
		}

		$type = $render_context->settings['pagination_type'] ?? 'show_all';
		if ( 'paginated' !== $type ) {
			return false;
		}

		// If total items <= page size, nothing to paginate.
		return Page_Size_Resolver::should_paginate(
			(int) ( $render_context->meta->total_item_count ?? count( $render_context->items ) ),
			Page_Size_Resolver::resolve_page_size( $render_context->settings, $render_context )
		);
	}

	/**
	 * Delegates to Page_Size_Resolver::resolve_page_size().
	 *
	 * Kept as a static method on the trait for API ergonomics inside the
	 * module classes; calls the shared resolver under the hood so the
	 * module classes and Context_Builder agree on the answer.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $settings
	 */
	public static function resolve_page_size( array $settings, ?Render_Context $render_context = null ): int {
		return Page_Size_Resolver::resolve_page_size( $settings, $render_context );
	}

	/**
	 * Delegates to Page_Size_Resolver::should_paginate().
	 *
	 * @since 1.0.0
	 */
	public static function should_paginate( int $total_items, int $page_size ): bool {
		return Page_Size_Resolver::should_paginate( $total_items, $page_size );
	}

	/**
	 * Whether preloading the next page is enabled.
	 *
	 * Pro-gated: setting lives in Free but the toggle is tier_required:
	 * pro_starter, so unlicensed sites get false even if the value is true.
	 *
	 * @since 1.0.0
	 */
	protected function preload_enabled( Render_Context $render_context ): bool {
		if ( empty( $render_context->settings['preload_next_page'] ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Canonical wrapper data-attrs every pagination method emits.
	 *
	 * Each method's wrapper_data_attrs() should call this and merge its
	 * own attrs on top.
	 *
	 * @since 1.0.0
	 * @return array<string, string>
	 */
	protected function common_wrapper_attrs( Render_Context $render_context, string $method ): array {
		$page_size   = $render_context->meta->pagination_page_size
			?? self::resolve_page_size( $render_context->settings, $render_context );
		$total       = (int) ( $render_context->meta->total_item_count ?? count( $render_context->items ) );
		$total_pages = $render_context->meta->pagination_total_pages
			?? (int) ceil( $total / max( 1, $page_size ) );
		$current     = (int) ( $render_context->meta->requested_page ?? 1 );

		// The REST URL + nonce for the JS to fetch additional pages.
		// Mirrors how Album_To_Gallery_Ajax wires its <a> triggers — same
		// endpoint, same nonce action ('wp_rest'). Written on the gallery
		// wrapper itself so pagination-core.js can read it via
		// `galleryEl.dataset.fgRenderUrl` / `dataset.fgRenderNonce`.
		$attrs = array(
			'data-fg-paginated'          => 'true',
			'data-fg-pagination-method'  => $method,
			'data-fg-page-size'          => (string) $page_size,
			'data-fg-page-current'       => (string) $current,
			'data-fg-page-total'         => (string) $total_pages,
			// Authoritative total item count for the filtered+sorted
			// sequence. Used by the lightbox to size its sparse slide
			// cache correctly without estimating from
			// total_pages * page_size (which over-counts when the last
			// page is partial — a 49-item gallery with page_size=8
			// would estimate 56).
			'data-fg-total-items'        => (string) $total,
			'data-fg-pagination-preload' => $this->preload_enabled( $render_context ) ? 'true' : 'false',
			'data-fg-render-url'         => esc_url( rest_url( 'fotogrids/v1/gallery/render' ) ),
			'data-fg-render-nonce'       => esc_attr( wp_create_nonce( 'wp_rest' ) ),
		);

		// Random sort seed — pagination-core.js sends this back with
		// every paginated request so paginated/filtered draws share the
		// same shuffle permutation. Only emitted when sort is random;
		// otherwise it's irrelevant and bloats the attribute list.
		if ( ( $render_context->settings['default_sort_order'] ?? '' ) === 'random'
			&& null !== $render_context->meta->random_seed
		) {
			$attrs['data-fg-random-seed'] = (string) $render_context->meta->random_seed;
		}

		return $attrs;
	}

	/**
	 * Shared CSS variables every pagination method emits.
	 *
	 * Covers two concerns, both shared across all three pagination methods:
	 *
	 *  1. `--fg-pagination-distance` — margin above the pagination bar,
	 *     driven by `pagination_distance_from_items`. Falls back to the
	 *     original `calc(var(--fg-pagination-base-size) * 2)` in
	 *     pagination.css when absent.
	 *
	 *  2. `--fg-pagination-button-*` — the Styling subtab inside
	 *     `pagination_buttons_subtabs`. The same JSON tab now drives both
	 *     the Load More button and the Page Buttons chips, so the
	 *     resolved vars live on the trait and both method modules
	 *     inherit them.
	 *
	 * Each method's `style_vars()` should call this and merge its own
	 * method-specific vars on top.
	 *
	 * @since  1.0.0
	 * @return array<string, string|Responsive_Var>
	 */
	protected function common_style_vars( Render_Context $render_context ): array {
		$vars = array();

		$s = $render_context->settings;

		// ---- Distance from items ----
		$distance_raw     = $s['pagination_distance_from_items'] ?? null;
		$distance_desktop = $this->resolve_responsive_value( $distance_raw, 'desktop', 'px' );
		$distance_tablet  = $this->resolve_responsive_value( $distance_raw, 'tablet', 'px' );
		$distance_mobile  = $this->resolve_responsive_value( $distance_raw, 'mobile', 'px' );

		if ( '' !== $distance_desktop || '' !== $distance_tablet || '' !== $distance_mobile ) {
			$vars['--fg-pagination-distance'] = new Responsive_Var(
				desktop: $distance_desktop,
				tablet:  $distance_tablet,
				mobile:  $distance_mobile,
			);
		}

		// ---- Button font ----
		// `pagination_button_font_family` and `pagination_button_font_weight`
		// are resolved through Font_Resolver so theme-provided system stacks
		// come back as real CSS values (same approach as captions).
		$resolver    = Font_Resolver::instance();
		$font_family = $resolver->resolve_font_family(
			$s['pagination_button_font_family'] ?? null,
			$render_context
		);
		if ( '' !== $font_family ) {
			$vars['--fg-pagination-button-font-family'] = $font_family;
		}

		$font_weight = $resolver->resolve_font_weight(
			$s['pagination_button_font_weight'] ?? null,
			$render_context
		);
		if ( '' !== $font_weight ) {
			$vars['--fg-pagination-button-font-weight'] = $font_weight;
		}

		// `pagination_button_font_size` is a responsive_range with per-side
		// units (px / em / rem).
		$font_size  = $s['pagination_button_font_size'] ?? null;
		$fs_desktop = $this->resolve_responsive_value( $font_size, 'desktop', 'px' );
		$fs_tablet  = $this->resolve_responsive_value( $font_size, 'tablet', 'px' );
		$fs_mobile  = $this->resolve_responsive_value( $font_size, 'mobile', 'px' );
		if ( '' !== $fs_desktop || '' !== $fs_tablet || '' !== $fs_mobile ) {
			$vars['--fg-pagination-button-font-size'] = new Responsive_Var(
				desktop: $fs_desktop,
				tablet:  $fs_tablet,
				mobile:  $fs_mobile,
			);
		}

		// ---- Regular state ----
		$this->add_color_var( $vars, '--fg-pagination-button-bg', $s['pagination_button_bg'] ?? null );
		$this->add_color_var( $vars, '--fg-pagination-button-color', $s['pagination_button_color'] ?? null );
		$this->add_color_var( $vars, '--fg-pagination-button-border-color', $s['pagination_button_border_color'] ?? null );
		$this->add_px_var( $vars, '--fg-pagination-button-border-width', $s['pagination_button_border_width'] ?? null );

		// ---- Mouseover state ----
		// Border WIDTH is unified across regular + hover + active (one
		// `pagination_button_border_width` setting drives all three) —
		// only the colours diverge per state.
		$this->add_color_var( $vars, '--fg-pagination-button-hover-bg', $s['pagination_button_hover_bg'] ?? null );
		$this->add_color_var( $vars, '--fg-pagination-button-hover-color', $s['pagination_button_hover_color'] ?? null );
		$this->add_color_var( $vars, '--fg-pagination-button-hover-border-color', $s['pagination_button_hover_border_color'] ?? null );

		// ---- Active (current-page) state ----
		// Only meaningful for Page Buttons' numbered chips — Load More
		// never has an active state. The CSS-side rule scopes to
		// `.fg-pagination--pages .fg-pagination__btn.fg-is-active`, so
		// emitting these vars on every method is harmless: load-more
		// simply doesn't read them.
		$this->add_color_var( $vars, '--fg-pagination-button-active-bg', $s['pagination_button_active_bg'] ?? null );
		$this->add_color_var( $vars, '--fg-pagination-button-active-color', $s['pagination_button_active_color'] ?? null );
		$this->add_color_var( $vars, '--fg-pagination-button-active-border-color', $s['pagination_button_active_border_color'] ?? null );

		return $vars;
	}

	/**
	 * Adds a colour CSS variable when the value is a non-empty string.
	 *
	 * @since  1.0.0
	 * @param  array<string, string|Responsive_Var> $vars  Reference to vars array.
	 * @param  string                               $key   CSS variable name.
	 * @param  mixed                                $value Raw setting value.
	 */
	private function add_color_var( array &$vars, string $key, mixed $value ): void {
		if ( is_string( $value ) && '' !== $value ) {
			$vars[ $key ] = $value;
		}
	}

	/**
	 * Adds a px-unit CSS variable when the value is a non-empty numeric.
	 *
	 * Mirrors the small `unit_val` helper used by class-filter-ui.php.
	 *
	 * @since  1.0.0
	 * @param  array<string, string|Responsive_Var> $vars  Reference to vars array.
	 * @param  string                               $key   CSS variable name.
	 * @param  mixed                                $value Raw setting value.
	 */
	private function add_px_var( array &$vars, string $key, mixed $value ): void {
		if ( null === $value || '' === $value ) {
			return;
		}
		if ( is_numeric( $value ) ) {
			$vars[ $key ] = $value . 'px';
			return;
		}
		if ( is_string( $value ) ) {
			$vars[ $key ] = $value;
		}
	}

	/**
	 * Standard assets declaration shared by all three method modules.
	 *
	 * Each method module returns this plus its own per-method CSS/JS file
	 * on top.
	 *
	 * The shared CSS (pagination.css) holds the base button look, the
	 * sr-only status region, and the loading/disabled states — all three
	 * method modules pull it in automatically. See pagination.css for the
	 * full list of selectors and theming hooks.
	 *
	 * @since 1.0.0
	 */
	protected function common_assets(): Module_Assets {
		return new Module_Assets(
			css: array(
				'fotogrids-pagination' => new Asset_Decl(
					path:      'features/pagination/pagination.css',
					in_footer: false,
				),
			),
			js:  array(
				'fotogrids-pagination-core' => new Asset_Decl(
					path:      '../../assets/js/pagination-core.js',
					deps:      array( 'fotogrids-runtime' ),
					in_footer: true,
				),
			)
		);
	}
}
