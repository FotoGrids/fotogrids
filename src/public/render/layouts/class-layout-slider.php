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
 * Slider layout module.
 *
 * Renders a horizontal swipe-able strip. Each item keeps its aspect
 * ratio; the strip uses CSS scroll-snap for native swipe handling.
 * Chrome (arrows, bullets, counter, autoplay, thumbnails) is driven by
 * the layout-navigation settings and rendered by slider.js using the
 * shared carousel-helpers.
 *
 * Capabilities:
 *   - enforces_item_box : --fg-item-aspect-ratio + --fg-item-fit
 *   - paginates         : false (carousel IS the navigation)
 *   - filters           : true (filter UI still applies)
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Slider implements Layout {

	public function id(): string {
		return 'fotogrids/slider';
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
		return 'slider';
	}

	public function supports( Render_Context $render_context ): bool {
		return 'slider' === $render_context->layout->layout_id;
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

		return '<div class="fg-carousel-container" data-fg-carousel="1">'
			. '<div class="fg-carousel-viewport">'
			. '<div class="fg-carousel-track-wrapper">'
			. '<div class="fg-carousel-track" data-fg-items-root="true">' . $items_html . '</div>'
			. '</div>'
			. '</div>'
			. '</div>';
	}

	public function structural_classes( Render_Context $render_context ): array {
		return array();
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$s = $render_context->settings;

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
			'data-fg-easing'                     => self::sanitize_choice(
				$s['layout_easing'] ?? 'ease_in_out',
				array( 'ease', 'linear', 'ease_in', 'ease_out', 'ease_in_out' ),
				'ease_in_out'
			),
			'data-fg-show-arrows'                => ! empty( $s['layout_show_arrows'] ) ? '1' : '0',
			'data-fg-arrows-location'            => self::sanitize_choice(
				$s['layout_arrows_location'] ?? 'inset',
				array( 'inset', 'overlap', 'outset' ),
				'inset'
			),
			'data-fg-arrows-reserve-space'       => ! empty( $s['layout_arrows_reserve_space'] ) ? '1' : '0',
			'data-fg-arrows-visibility'          => self::sanitize_choice(
				$s['layout_arrows_visibility'] ?? 'always',
				array( 'always', 'hover_show', 'hover_hide' ),
				'always'
			),
			'data-fg-hide-arrows-at-ends'        => ! empty( $s['layout_hide_arrows_at_ends'] ) ? '1' : '0',
			'data-fg-arrows-at-ends-mode'        => self::sanitize_choice(
				$s['layout_arrows_at_ends_mode'] ?? 'hide',
				array( 'hide', 'dim' ),
				'hide'
			),
			'data-fg-show-bullets'               => ! empty( $s['layout_show_bullets'] ) ? '1' : '0',
			'data-fg-bullets-location'           => self::sanitize_choice(
				$s['layout_bullets_location'] ?? 'bottom',
				array( 'top', 'bottom', 'overlay_top', 'overlay_bottom' ),
				'bottom'
			),
			'data-fg-bullets-visibility'         => self::sanitize_choice(
				$s['layout_bullets_visibility'] ?? 'always',
				array( 'always', 'hover_show', 'hover_hide' ),
				'always'
			),
			'data-fg-bullets-align'              => self::sanitize_choice(
				$s['layout_bullet_align'] ?? 'center',
				array( 'center', 'stretch' ),
				'center'
			),
			'data-fg-thumbs-show'                => ! empty( $s['layout_thumbnails_show'] ) ? '1' : '0',
			'data-fg-thumbs-location'            => self::sanitize_choice(
				$s['layout_thumbnails_location'] ?? 'bottom',
				array( 'top', 'bottom', 'left', 'right' ),
				'bottom'
			),
			'data-fg-thumbs-size'                => self::sanitize_choice(
				$s['layout_thumbnails_size'] ?? 'normal',
				array( 'small', 'normal', 'large' ),
				'normal'
			),
			'data-fg-thumbs-drag'                => ! empty( $s['layout_thumbnails_drag'] ) ? '1' : '0',
			'data-fg-thumbs-swipe'               => ! empty( $s['layout_thumbnails_swipe'] ) ? '1' : '0',
		);

		if ( ! empty( $s['layout_show_arrows'] ) ) {
			$icon_name                       = self::sanitize_choice(
				$s['layout_arrow_icon'] ?? 'chevron',
				array( 'chevron', 'chevron_double', 'arrow', 'arrow_narrow', 'arrow_square', 'arrow_circle', 'arrow_circle_broken', 'arrow_block' ),
				'chevron'
			);
			$pair                            = Arrow_Icons::pair( $icon_name );
			$attrs['data-fg-arrow-prev-svg'] = $pair['prev'];
			$attrs['data-fg-arrow-next-svg'] = $pair['next'];
		}

		return $attrs;
	}

	public function style_vars( Render_Context $render_context ): array {
		$s = $render_context->settings;

		$items_per_view = is_array( $s['layout_items_per_view'] ?? null ) ? $s['layout_items_per_view'] : array();
		$height_fixed   = is_array( $s['layout_height_fixed'] ?? null ) ? $s['layout_height_fixed'] : array();
		$height_max     = is_array( $s['layout_height_max'] ?? null ) ? $s['layout_height_max'] : array();

		$vars = array(
			'--fg-items-per-view'       => new Responsive_Var(
				self::resolve_int( $items_per_view, 'desktop', 3 ),
				self::resolve_int( $items_per_view, 'tablet', 2 ),
				self::resolve_int( $items_per_view, 'mobile', 1 ),
			),
			'--fg-height-fixed'         => new Responsive_Var(
				self::resolve_int( $height_fixed, 'desktop', 500 ) . 'px',
				self::resolve_int( $height_fixed, 'tablet', 400 ) . 'px',
				self::resolve_int( $height_fixed, 'mobile', 300 ) . 'px',
			),
			'--fg-height-max'           => new Responsive_Var(
				self::height_max_value( $height_max, 'desktop' ),
				self::height_max_value( $height_max, 'tablet' ),
				self::height_max_value( $height_max, 'mobile' ),
			),
			'--fg-arrow-size'           => self::resolve_unit( $s['layout_arrow_size'] ?? null, 40, 'px' ),
			'--fg-arrow-distance'       => self::resolve_unit( $s['layout_arrow_distance'] ?? null, 8, 'px' ),
			'--fg-arrow-bg'             => self::resolve_color( $s['layout_arrow_bg'] ?? null, 'rgba(0, 0, 0, 0.45)' ),
			'--fg-arrow-border'         => self::resolve_color( $s['layout_arrow_border_color'] ?? null, 'rgba(0, 0, 0, 0)' ),
			'--fg-arrow-color'          => self::resolve_color( $s['layout_arrow_arrow_color'] ?? null, 'rgba(255, 255, 255, 1)' ),
			'--fg-arrow-bg-hover'       => self::resolve_color( $s['layout_arrow_hover_bg'] ?? null, 'rgba(0, 0, 0, 0.75)' ),
			'--fg-arrow-border-hover'   => self::resolve_color( $s['layout_arrow_hover_border_color'] ?? null, 'rgba(0, 0, 0, 0)' ),
			'--fg-arrow-color-hover'    => self::resolve_color( $s['layout_arrow_hover_arrow_color'] ?? null, 'rgba(255, 255, 255, 1)' ),
			'--fg-arrow-bg-active'      => self::resolve_color( $s['layout_arrow_active_bg'] ?? null, 'rgba(0, 0, 0, 0.75)' ),
			'--fg-arrow-border-active'  => self::resolve_color( $s['layout_arrow_active_border_color'] ?? null, 'rgba(0, 0, 0, 0)' ),
			'--fg-arrow-color-active'   => self::resolve_color( $s['layout_arrow_active_arrow_color'] ?? null, 'rgba(255, 255, 255, 1)' ),
			'--fg-arrow-bg-focus'       => self::resolve_color( $s['layout_arrow_focus_bg'] ?? null, 'rgba(0, 0, 0, 0.75)' ),
			'--fg-arrow-border-focus'   => self::resolve_color( $s['layout_arrow_focus_border_color'] ?? null, 'rgba(0, 0, 0, 0)' ),
			'--fg-arrow-color-focus'    => self::resolve_color( $s['layout_arrow_focus_arrow_color'] ?? null, 'rgba(255, 255, 255, 1)' ),
			'--fg-bullet-width'         => self::resolve_side( $s['layout_bullet_size'] ?? null, 'width', 10, 'px' ),
			'--fg-bullet-height'        => self::resolve_side( $s['layout_bullet_size'] ?? null, 'height', 10, 'px' ),
			'--fg-bullet-radius'        => self::resolve_unit( $s['layout_bullet_radius'] ?? null, 4, 'px' ),
			'--fg-bullet-border-width'  => self::resolve_unit( $s['layout_bullet_border_width'] ?? null, 2, 'px' ),
			'--fg-bullet-distance'      => self::resolve_unit( $s['layout_bullet_distance'] ?? null, 8, 'px' ),
			'--fg-bullet-spacing'       => self::resolve_unit( $s['layout_bullet_spacing'] ?? null, 8, 'px' ),
			'--fg-bullet-bg'            => self::resolve_color( $s['layout_bullet_bg'] ?? null, 'rgba(0, 0, 0, 0.4)' ),
			'--fg-bullet-border'        => self::resolve_color( $s['layout_bullet_border_color'] ?? null, 'rgba(0, 0, 0, 0)' ),
			'--fg-bullet-bg-hover'      => self::resolve_color( $s['layout_bullet_hover_bg'] ?? null, 'rgba(0, 0, 0, 0.7)' ),
			'--fg-bullet-border-hover'  => self::resolve_color( $s['layout_bullet_hover_border_color'] ?? null, 'rgba(0, 0, 0, 0)' ),
			'--fg-bullet-bg-active'     => self::resolve_color( $s['layout_bullet_active_bg'] ?? null, 'var(--fg-colors-blue, #3c46f0)' ),
			'--fg-bullet-border-active' => self::resolve_color( $s['layout_bullet_active_border_color'] ?? null, 'rgba(0, 0, 0, 0)' ),
			'--fg-bullet-bg-focus'      => self::resolve_color( $s['layout_bullet_focus_bg'] ?? null, 'var(--fg-colors-blue, #3c46f0)' ),
			'--fg-bullet-border-focus'  => self::resolve_color( $s['layout_bullet_focus_border_color'] ?? null, 'rgba(0, 0, 0, 0)' ),
		);

		$vars['--fg-bullets-justify'] = ( 'stretch' === self::sanitize_choice( $s['layout_bullet_align'] ?? 'center', array( 'center', 'stretch' ), 'center' ) )
			? 'stretch'
			: 'center';

		return $vars;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-render-base'   => new Asset_Decl( 'base/collection-base.css' ),
				'fotogrids-layout-slider' => new Asset_Decl( 'layouts/slider/slider.css' ),
			),
			array(
				'fotogrids-layout-slider' => new Asset_Decl(
					'../../assets/js/layout-slider.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}

	public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
		return \FotoGrids\Image_Size_Manager::SLUG_FULL;
	}

	public function requires_thumbnail_size( Render_Context $render_context ): bool {
		return false;
	}

	public function capabilities(): array {
		return array(
			'enforces_item_box'  => true,
			'paginates'          => false,
			'filters'            => true,
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
	 * Resolve one side (width / height) of a two-sided size value to a CSS
	 * length. The value persists as { width: { value, unit }, height: {...} }.
	 *
	 * @param mixed  $raw          Two-sided size value.
	 * @param string $side         'width' | 'height'.
	 * @param int    $fallback     Numeric fallback.
	 * @param string $default_unit Unit when none stored.
	 * @return string
	 */
	private static function resolve_side( $raw, string $side, int $fallback, string $default_unit ): string {
		if ( is_array( $raw ) && isset( $raw[ $side ] ) ) {
			return self::resolve_unit( $raw[ $side ], $fallback, $default_unit );
		}
		return $fallback . $default_unit;
	}

	/**
	 * Return a stored colour string when present, else the given fallback.
	 *
	 * @param mixed  $value           Raw setting value.
	 * @param string $default_value   Fallback colour string.
	 * @return string
	 */
	private static function resolve_color( $value, string $default_value ): string {
		return ( is_string( $value ) && '' !== trim( $value ) ) ? trim( $value ) : $default_value;
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
