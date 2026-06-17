<?php
declare(strict_types=1);

namespace FotoGrids\Render\Layouts;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Internal\Arrow_Icons;
use FotoGrids\Render\Internal\Item_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Image Viewer layout module.
 *
 * A distraction-free, one-image-at-a-time viewer. Conceptually a Slider
 * locked to a single item per view: every item is rendered into a stage,
 * stacked on top of each other, and only the active one is shown. The
 * navigation chrome (arrows, bullets, counter, autoplay, thumbnails) is
 * driven by the same layout-navigation settings the Slider uses, so the
 * two share the entire Navigation settings tab.
 *
 * Unlike Slider, Image Viewer supports fade and vertical transitions in
 * addition to horizontal and none, because it swaps a single image rather
 * than scrolling a strip. The stage is a CSS stack (absolutely positioned
 * items) and image-viewer.js toggles the active item; the transition mode
 * decides how the outgoing/incoming items animate.
 *
 * Capabilities:
 *   - enforces_item_box  : --fg-item-aspect-ratio + --fg-item-fit
 *   - paginates          : false (the viewer IS the navigation)
 *   - filters            : true (filter UI still applies)
 *   - pointer_navigation : true
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Image_Viewer implements Layout {

	public function id(): string {
		return 'fotogrids/image-viewer';
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
		return 'image-viewer';
	}

	public function supports( Render_Context $render_context ): bool {
		return 'image-viewer' === $render_context->layout->layout_id;
	}

	public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
		$items_html = '';
		foreach ( $render_context->items as $item_view ) {
			// Items start hidden; image-viewer.js reveals the active one
			// after boot so there is no flash of every stacked image.
			$hidden_view = $item_view->with(
				array(
					'classes' => array_merge( $item_view->classes, array( 'fg-item-hidden' ) ),
				)
			);
			$items_html .= $item_renderer->render( $hidden_view, $render_context );
		}

		return '<div class="fg-viewer-container" data-fg-viewer="1">'
			. '<div class="fg-viewer-stage">'
			. '<div class="fg-viewer-track" data-fg-items-root="true">' . $items_html . '</div>'
			. '</div>'
			. '</div>';
	}

	public function structural_classes( Render_Context $render_context ): array {
		return array();
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$s = $render_context->settings;

		// Image Viewer chrome is a single control bar (arrows + centred
		// counter) beneath the image - no bullets, no thumbnail strip - so
		// only the attributes the bar JS reads are stamped here.
		$attrs = array(
			'data-fg-height-mode'                => self::sanitize_choice(
				$s['layout_height_mode'] ?? 'auto',
				array( 'auto', 'fixed' ),
				'auto'
			),
			'data-fg-loop'                       => ! empty( $s['layout_loop'] ) ? '1' : '0',
			'data-fg-show-counter'               => ! empty( $s['layout_show_counter'] ) ? '1' : '0',
			'data-fg-autoplay'                   => ! empty( $s['layout_autoplay'] ) ? '1' : '0',
			'data-fg-autoplay-delay'             => (string) max( 0, (int) ( $s['layout_autoplay_delay'] ?? 4000 ) ),
			'data-fg-autoplay-pause-on-hover'    => ! empty( $s['layout_autoplay_pause_on_hover'] ) ? '1' : '0',
			// Image Viewer allows fade + vertical in addition to the
			// shared horizontal / none.
			'data-fg-transition'                 => self::sanitize_choice(
				$s['layout_transition'] ?? 'fade',
				array( 'fade', 'horizontal', 'vertical', 'none' ),
				'fade'
			),
			'data-fg-transition-duration'        => self::sanitize_choice(
				$s['layout_transition_duration'] ?? 'normal',
				array( 'fast', 'normal', 'slow', 'custom' ),
				'normal'
			),
			'data-fg-transition-duration-custom' => (string) max( 0, (int) ( $s['layout_transition_duration_custom'] ?? 300 ) ),
			'data-fg-hide-arrows-at-ends'        => ! empty( $s['layout_hide_arrows_at_ends'] ) ? '1' : '0',
		);

		// Arrows always show in this layout (the bar is the only chrome), so
		// the icon SVGs are stamped unconditionally - the Show Arrows toggle
		// is hidden for Image Viewer in the admin.
		$icon_name                       = self::sanitize_choice(
			$s['layout_arrow_icon'] ?? 'chevron',
			array( 'chevron', 'chevron_double', 'arrow', 'arrow_narrow', 'arrow_square', 'arrow_circle', 'arrow_circle_broken', 'arrow_block' ),
			'chevron'
		);
		$pair                            = Arrow_Icons::pair( $icon_name );
		$attrs['data-fg-arrow-prev-svg'] = $pair['prev'];
		$attrs['data-fg-arrow-next-svg'] = $pair['next'];

		return $attrs;
	}

	public function style_vars( Render_Context $render_context ): array {
		$s = $render_context->settings;

		$height_fixed = is_array( $s['layout_height_fixed'] ?? null ) ? $s['layout_height_fixed'] : array();
		$height_max   = is_array( $s['layout_height_max'] ?? null ) ? $s['layout_height_max'] : array();

		return array(
			'--fg-height-fixed'    => new Responsive_Var(
				self::resolve_int( $height_fixed, 'desktop', 500 ) . 'px',
				self::resolve_int( $height_fixed, 'tablet', 400 ) . 'px',
				self::resolve_int( $height_fixed, 'mobile', 300 ) . 'px',
			),
			'--fg-height-max'      => new Responsive_Var(
				self::height_max_value( $height_max, 'desktop' ),
				self::height_max_value( $height_max, 'tablet' ),
				self::height_max_value( $height_max, 'mobile' ),
			),
			'--fg-arrow-size'      => self::resolve_unit( $s['layout_arrow_size'] ?? null, 40, 'px' ),
			'--fg-arrow-distance'  => self::resolve_unit( $s['layout_arrow_distance'] ?? null, 8, 'px' ),
			'--fg-bullet-size'     => self::resolve_unit( $s['layout_bullet_size'] ?? null, 10, 'px' ),
			'--fg-bullet-distance' => self::resolve_unit( $s['layout_bullet_distance'] ?? null, 8, 'px' ),
			'--fg-bullets-spacing' => self::resolve_unit( $s['layout_bullets_spacing'] ?? null, 8, 'px' ),
		);
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-render-base'         => new Asset_Decl( 'base/collection-base.css' ),
				'fotogrids-layout-image-viewer' => new Asset_Decl( 'layouts/image-viewer/image-viewer.css' ),
			),
			array(
				'fotogrids-layout-image-viewer' => new Asset_Decl(
					'../../assets/js/layout-image-viewer.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}

	public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
		return \FotoGrids\Image_Size_Manager::SLUG_FULL;
	}

	/**
	 * Image Viewer shows one large image at a time, never a cropped grid
	 * thumbnail. The Thumbnail Size setting is hidden for this layout in the
	 * admin, so the preferred full-image size is mandatory here - it must
	 * override any stale saved thumbnail_size value too. This guarantees the
	 * hidden setting can never apply at the frontend.
	 */
	public function requires_thumbnail_size( Render_Context $render_context ): bool {
		return true;
	}

	public function capabilities(): array {
		return array(
			'enforces_item_box'  => true,
			'paginates'          => false,
			// No filter bar: Image Viewer shows one image at a time, so a
			// filter chrome on top makes no sense (and filtering is hidden in
			// the admin for this layout too). Filter_Ui::supports() reads this.
			'filters'            => false,
			'pointer_navigation' => true,
		);
	}

	/**
	 * Resolve a per-breakpoint max-height to a CSS value. Zero means
	 * "no explicit maximum" - defer to the baseline 100vh cap so items
	 * never grow taller than the viewport.
	 *
	 * @param array<string, mixed> $bucket
	 * @param string               $breakpoint
	 * @return string
	 */
	private static function height_max_value( array $bucket, string $breakpoint ): string {
		$raw = $bucket[ $breakpoint ] ?? null;
		if ( is_array( $raw ) ) {
			$raw = $raw['value'] ?? null;
		}
		$value = is_numeric( $raw ) ? (int) $raw : 0;
		return $value > 0 ? ( $value . 'px' ) : '100vh';
	}

	/**
	 * Resolve a per-breakpoint integer from a responsive-shape array.
	 *
	 * @param array<string, mixed> $bucket
	 * @param string               $breakpoint
	 * @param int                  $fallback
	 * @return string
	 */
	private static function resolve_int( array $bucket, string $breakpoint, int $fallback ): string {
		$raw = $bucket[ $breakpoint ] ?? null;
		if ( is_array( $raw ) ) {
			$raw = $raw['value'] ?? null;
		}
		$value = is_numeric( $raw ) ? (int) $raw : 0;
		return (string) ( $value > 0 ? $value : $fallback );
	}

	/**
	 * Resolve a value-or-{value,unit} setting to a CSS length string.
	 *
	 * @param mixed  $raw
	 * @param int    $fallback
	 * @param string $default_unit
	 * @return string
	 */
	private static function resolve_unit( $raw, int $fallback, string $default_unit ): string {
		if ( is_array( $raw ) ) {
			$value = $raw['value'] ?? null;
			$unit  = $raw['unit'] ?? $default_unit;
			if ( ! is_numeric( $value ) ) {
				return $fallback . $default_unit;
			}
			return ( (int) $value ) . (string) $unit;
		}
		if ( is_numeric( $raw ) ) {
			return ( (int) $raw ) . $default_unit;
		}
		return $fallback . $default_unit;
	}

	/**
	 * Pin a value to the given allowlist, defaulting otherwise.
	 *
	 * @param mixed         $value
	 * @param array<string> $allowed
	 * @param string        $default_value
	 * @return string
	 */
	private static function sanitize_choice( $value, array $allowed, string $default_value ): string {
		return ( is_string( $value ) && in_array( $value, $allowed, true ) ) ? $value : $default_value;
	}
}
