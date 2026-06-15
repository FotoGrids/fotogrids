<?php
declare(strict_types=1);

namespace FotoGrids\Render\Layouts;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Font_Resolver;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Internal\Item_Renderer;
use FotoGrids\Render\Lightbox\Grid\Lightbox_Grid;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Featured Item layout module (Airbnb-style).
 *
 * One large featured image beside a compact grid of items. The featured
 * image is the gallery's set featured image (Cover_Resolver), or the first
 * item when none is set. The grid shows the next N items (4 / 6 / 9),
 * skipping the featured one so it is not repeated.
 *
 * EVERY item — the featured image and each grid tile — is rendered through
 * Item_Renderer as a normal decorated .fg-item, so they all run the
 * gallery's own click behaviour (lightbox, link, etc.). There is NO
 * navigation chrome: clicking a grid tile does not change the featured
 * image; it just runs that item's action. The layout has no arrows, dots,
 * or pager.
 *
 * When the gallery has more items than are shown inline (featured + grid),
 * a "Show all" button is rendered automatically over the featured image.
 * It opens the LightboxGrid overlay (see Lightbox\Grid\Lightbox_Grid),
 * which lists every item. The button never appears when everything already
 * fits inline.
 *
 * Capabilities:
 *   - enforces_item_box : --fg-item-aspect-ratio + --fg-item-fit
 *   - paginates         : false (no pager; Show all replaces it)
 *   - filters           : false (a featured composition, not a browseable grid)
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Featured_Item implements Layout {

	use \FotoGrids\Render\Api\Setting_Helpers;

	public function id(): string {
		return 'fotogrids/featured-item';
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
		return 'featured-item';
	}

	public function supports( Render_Context $render_context ): bool {
		return 'featured-item' === $render_context->layout->layout_id;
	}

	public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
		$items = array_values( $render_context->items );
		if ( count( $items ) === 0 ) {
			return '';
		}

		$grid_count   = self::grid_count( $render_context );
		$featured_idx = $this->resolve_featured_index( $render_context, $items );

		// Featured image — rendered decorated so it runs the gallery's click
		// behaviour like any other item. It's shown large (roughly half the
		// layout width), so swap its displayed source to the full-size
		// derivative; the small grid thumbnail would otherwise be upscaled
		// and look pixelated. Grid tiles keep the small thumb. Image items
		// only — videos resolve their own poster.
		$featured_view = $items[ $featured_idx ];
		if ( 'image' === $featured_view->item_type && '' !== $featured_view->full_url ) {
			$featured_view = $featured_view->with(
				array(
					'thumb_url'  => $featured_view->full_url,
					'thumb_size' => \FotoGrids\Image_Size_Manager::SLUG_FULL,
					'width'      => $featured_view->full_width ?? $featured_view->width,
					'height'     => $featured_view->full_height ?? $featured_view->height,
				)
			);
		}
		$featured_html = $item_renderer->render( $featured_view, $render_context );

		// Grid: the next items in order, skipping the featured one, up to N.
		$grid_html = '';
		$shown     = 0;
		foreach ( $items as $i => $item_view ) {
			if ( $i === $featured_idx ) {
				continue;
			}
			if ( $shown >= $grid_count ) {
				break;
			}
			$grid_html .= $item_renderer->render( $item_view, $render_context );
			++$shown;
		}

		// Show all button — only when there are more items than shown inline.
		$show_all_html = '';
		if ( Lightbox_Grid::should_show_all( $render_context ) ) {
			$show_all_html = $this->render_show_all_button( $render_context );
		}

		// The Show all button is a direct child of the wrapper (not the
		// featured image) so it positions against the whole layout.
		return '<div class="fg-featured-container">'
			. '<div class="fg-featured-main">' . $featured_html . '</div>'
			. '<div class="fg-featured-grid" data-fg-items-root="true">' . $grid_html . '</div>'
			. $show_all_html
			. '</div>';
	}

	/**
	 * Resolve the index (in the rendered item list) of the featured image.
	 * Uses Cover_Resolver's attachment id; falls back to the first item.
	 *
	 * @since 1.0.0
	 * @param Render_Context                      $render_context Render context.
	 * @param array<int, \FotoGrids\Render\Api\Item_View> $items  Items.
	 * @return int
	 */
	private function resolve_featured_index( Render_Context $render_context, array $items ): int {
		$gallery_id = (int) ( $render_context->meta->gallery_id ?? 0 );
		if ( $gallery_id > 0 && class_exists( '\FotoGrids\Galleries\Cover_Resolver' ) ) {
			$featured_attachment = \FotoGrids\Galleries\Cover_Resolver::for_collection( $gallery_id );
			if ( $featured_attachment > 0 ) {
				foreach ( $items as $i => $item_view ) {
					if ( (int) $item_view->id === $featured_attachment ) {
						return $i;
					}
				}
			}
		}
		return 0;
	}

	/**
	 * Render the auto "Show all" button. Plain button carrying the marker
	 * attribute the LightboxGrid JS delegates on, plus its label. Position
	 * + styling are driven by wrapper data-attrs / CSS vars.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return string
	 */
	private function render_show_all_button( Render_Context $render_context ): string {
		$label = (string) ( $render_context->settings['featured_show_all_label'] ?? '' );
		if ( '' === $label ) {
			$label = __( 'Show all images', 'fotogrids' );
		}

		return sprintf(
			'<button type="button" class="fg-featured-show-all" data-fg-show-all data-fg-show-all-label="%s">%s<span class="fg-featured-show-all-text">%s</span></button>',
			esc_attr( $label ),
			self::show_all_icon(),
			esc_html( $label )
		);
	}

	/**
	 * The grid glyph shown on the Show all button (dots_grid_full). Inline
	 * SVG so the layout needs no icon dependency; currentColor inherits the
	 * button text colour.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	private static function show_all_icon(): string {
		return '<svg class="fg-featured-show-all-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">'
			. '<path d="M12 6a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M12 13a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M12 20a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M19 6a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M19 13a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M19 20a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M5 6a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M5 13a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '<path d="M5 20a1 1 0 100-2 1 1 0 000 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			. '</svg>';
	}

	public function structural_classes( Render_Context $render_context ): array {
		return array();
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$attrs = array(
			'data-fg-featured-side'         => self::sanitize_choice(
				$render_context->settings['featured_image_side'] ?? 'left',
				array( 'left', 'right' ),
				'left'
			),
			'data-fg-featured-thumbs-count' => (string) self::grid_count( $render_context ),
			'data-fg-show-all-position'     => self::sanitize_choice(
				$render_context->settings['featured_show_all_position'] ?? 'bottom-right',
				array( 'top-left', 'top-right', 'bottom-left', 'bottom-right' ),
				'bottom-right'
			),
		);

		// Lightbox spans the FULL gallery. Featured Item only renders the
		// featured image + N grid tiles inline, but opening the lightbox from
		// any of them must walk every item. We stamp the lightbox-extended
		// markers directly here — unconditionally on click=lightbox, ignoring
		// the lightbox_scope setting — because for this layout "single" scope
		// would otherwise trap the lightbox in the tiny inline subset. The
		// lightbox JS reads data-fg-lightbox-extended + data-fg-total-items
		// and lazy-fetches the rest via the render URL.
		if ( ( $render_context->behavior->click_behavior ?? '' ) === 'lightbox' ) {
			$total = (int) ( $render_context->meta->total_item_count ?? 0 );
			if ( $total > 1 ) {
				$attrs['data-fg-lightbox-extended'] = 'true';
				$attrs['data-fg-total-items']       = (string) $total;
				$attrs['data-fg-render-url']        = esc_url( rest_url( 'fotogrids/v1/gallery/render' ) );
				$attrs['data-fg-render-nonce']      = esc_attr( wp_create_nonce( 'wp_rest' ) );

				if ( ( $render_context->settings['default_sort_order'] ?? '' ) === 'random'
					&& null !== $render_context->meta->random_seed
				) {
					$attrs['data-fg-random-seed'] = (string) $render_context->meta->random_seed;
				}
			}
		}

		return $attrs;
	}

	public function style_vars( Render_Context $render_context ): array {
		$s = $render_context->settings;

		$count   = self::grid_count( $render_context );
		$columns = 4 === $count ? 2 : 3;
		$rows    = 9 === $count ? 3 : 2;

		$vars = array(
			'--fg-featured-grid-cols' => (string) $columns,
			'--fg-featured-grid-rows' => (string) $rows,
		);

		// Show all button styling (fuller set).
		$bg     = self::safe_color( $s['featured_show_all_bg'] ?? null );
		$text   = self::safe_color( $s['featured_show_all_text'] ?? null );
		$border = self::safe_color( $s['featured_show_all_border_color'] ?? null );
		if ( '' !== $bg ) {
			$vars['--fg-show-all-bg'] = $bg;
		}
		if ( '' !== $text ) {
			$vars['--fg-show-all-text'] = $text;
		}
		if ( '' !== $border ) {
			$vars['--fg-show-all-border-color'] = $border;
		}
		$radius = $s['featured_show_all_radius'] ?? null;
		if ( is_numeric( $radius ) ) {
			$vars['--fg-show-all-radius'] = (int) $radius . 'px';
		}
		$border_w = $s['featured_show_all_border_width'] ?? null;
		if ( is_numeric( $border_w ) ) {
			$vars['--fg-show-all-border-width'] = (int) $border_w . 'px';
		}
		// Padding is a four-sided responsive_range. Resolve each breakpoint
		// to a "top right bottom left" shorthand; emit a Responsive_Var so
		// the framework writes the per-device --fg-show-all-padding values.
		$pad         = self::maybe_decode_array( $s['featured_show_all_padding'] ?? null );
		$pad_desktop = $this->resolve_four_sided_value( $pad, 'desktop', 'px' );
		$pad_tablet  = $this->resolve_four_sided_value( $pad, 'tablet', 'px' );
		$pad_mobile  = $this->resolve_four_sided_value( $pad, 'mobile', 'px' );
		if ( '' !== $pad_desktop || '' !== $pad_tablet || '' !== $pad_mobile ) {
			$vars['--fg-show-all-padding'] = new Responsive_Var(
				desktop: $pad_desktop,
				tablet:  $pad_tablet,
				mobile:  $pad_mobile,
			);
		}
		$offset = $s['featured_show_all_offset'] ?? null;
		if ( is_numeric( $offset ) ) {
			$vars['--fg-show-all-offset'] = (int) $offset . 'px';
		}

		// Mouseover state (empty = inherit the regular colours via the CSS
		// var fallback chain).
		$hover_bg     = self::safe_color( $s['featured_show_all_hover_bg'] ?? null );
		$hover_text   = self::safe_color( $s['featured_show_all_hover_text'] ?? null );
		$hover_border = self::safe_color( $s['featured_show_all_hover_border_color'] ?? null );
		if ( '' !== $hover_bg ) {
			$vars['--fg-show-all-hover-bg'] = $hover_bg;
		}
		if ( '' !== $hover_text ) {
			$vars['--fg-show-all-hover-text'] = $hover_text;
		}
		if ( '' !== $hover_border ) {
			$vars['--fg-show-all-hover-border-color'] = $hover_border;
		}

		// Typography. Family/weight go through Font_Resolver so theme system
		// stacks resolve to real CSS (same approach as captions / pagination).
		$resolver    = Font_Resolver::instance();
		$font_family = $resolver->resolve_font_family( $s['featured_show_all_font_family'] ?? null, $render_context );
		if ( '' !== $font_family ) {
			$vars['--fg-show-all-font-family'] = $font_family;
		}
		$font_weight = $resolver->resolve_font_weight( $s['featured_show_all_font_weight'] ?? null, $render_context );
		if ( '' !== $font_weight ) {
			$vars['--fg-show-all-font-weight'] = $font_weight;
		}

		// Font size — responsive_range (px/em/rem). Resolved via the shared
		// Setting_Helpers trait so it handles both the plain-number default
		// shape and the {value, unit} shape the UI stores.
		$font_size  = self::maybe_decode_array( $s['featured_show_all_font_size'] ?? null );
		$fs_desktop = $this->resolve_responsive_value( $font_size, 'desktop', 'px' );
		$fs_tablet  = $this->resolve_responsive_value( $font_size, 'tablet', 'px' );
		$fs_mobile  = $this->resolve_responsive_value( $font_size, 'mobile', 'px' );
		if ( '' !== $fs_desktop || '' !== $fs_tablet || '' !== $fs_mobile ) {
			$vars['--fg-show-all-font-size'] = new Responsive_Var(
				desktop: $fs_desktop,
				tablet:  $fs_tablet,
				mobile:  $fs_mobile,
			);
		}

		return $vars;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			css: array(
				'fotogrids-render-base'          => new Asset_Decl( path: 'base/collection-base.css' ),
				'fotogrids-layout-featured-item' => new Asset_Decl( path: 'layouts/featured-item/featured-item.css' ),
			)
		);
	}

	public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
		// No preference. One mid-size derivative (the user's configured
		// thumbnail_size) serves both the featured image and the grid
		// tiles; Lightbox / LightboxGrid use full_url for true full-res.
		return null;
	}

	public function requires_thumbnail_size( Render_Context $render_context ): bool {
		return false;
	}

	public function capabilities(): array {
		return array(
			'enforces_item_box' => true,
			'uses_item_spacing' => true,
			'paginates'         => false,
			'filters'           => false,
			// NB: we deliberately do NOT use the `lightbox_extends` capability
			// here. That adapter only fires when lightbox_scope === 'gallery',
			// but Featured Item must span the full gallery even under "single"
			// scope. wrapper_data_attrs() stamps the extended markers directly
			// and unconditionally instead.
		);
	}

	/**
	 * Resolve the configured grid item count (4 / 6 / 9, default 6).
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return int
	 */
	/**
	 * Return an array setting as-is, or decode it when it arrives as a JSON
	 * string. Responsive / four-sided settings are stored as JSON in post
	 * meta and usually decoded upstream, but some render paths (e.g. the live
	 * admin preview) can pass the raw JSON string straight through. Decoding
	 * here makes resolve_responsive_value / resolve_four_sided_value robust to
	 * both shapes so the CSS vars always reflect the current setting.
	 *
	 * @since 1.0.0
	 * @param mixed $value Raw setting value.
	 * @return mixed Array when resolvable, otherwise the original value.
	 */
	private static function maybe_decode_array( $value ) {
		if ( is_array( $value ) ) {
			return $value;
		}
		if ( is_string( $value ) && '' !== $value ) {
			$decoded = json_decode( $value, true );
			if ( is_array( $decoded ) ) {
				return $decoded;
			}
		}
		return $value;
	}

	private static function grid_count( Render_Context $render_context ): int {
		$raw = (int) ( $render_context->settings['featured_thumbs_count'] ?? 6 );
		return in_array( $raw, array( 4, 6, 9 ), true ) ? $raw : 6;
	}

	/**
	 * Pin a value to the given allowlist, defaulting otherwise.
	 *
	 * @since 1.0.0
	 * @param mixed         $value
	 * @param array<string> $allowed
	 * @param string        $default_value
	 * @return string
	 */
	private static function sanitize_choice( $value, array $allowed, string $default_value ): string {
		return ( is_string( $value ) && in_array( $value, $allowed, true ) ) ? $value : $default_value;
	}

	/**
	 * Validate a colour string, returning '' when not a recognised colour
	 * (so style_vars only stamps the var when the user actually set one).
	 *
	 * @since 1.0.0
	 * @param mixed $value
	 * @return string
	 */
	private static function safe_color( $value ): string {
		if ( ! is_string( $value ) ) {
			return '';
		}
		$v = trim( $value );
		if (
			preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $v ) ||
			preg_match( '/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(\s*,\s*[\d.]+)?\s*\)$/', $v ) ||
			preg_match( '/^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/', $v )
		) {
			return $v;
		}
		return '';
	}
}
