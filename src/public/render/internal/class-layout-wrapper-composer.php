<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Hooks\Filters_Render;
use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Builds the shared CSS variables and data attributes that the active
 * layout needs but shouldn't have to hand-write in every layout class.
 *
 * The render controller invokes this composer right after the active
 * layout module contributes its own wrapper_data_attrs / style_vars,
 * and merges the composer's output on top. That puts layout-supplied
 * values FIRST (so an unusual layout can pre-set its own --fg-cols and
 * the composer's merge will overwrite it - last-write wins) and
 * composer-supplied values SECOND.
 *
 * Capability-driven: each adapter only runs when the active layout
 * opts in to its capability via Layout::capabilities(). The capability
 * keys + adapter callables live in self::ADAPTERS. Adding a new
 * cross-cutting behaviour is a three-step process: add the capability
 * key to the Layout interface phpdoc, return it from the layouts that
 * opt in, and add one entry here.
 *
 * Both the dispatch map and the final composed map are filterable:
 *
 *   - fotogrids/render/layout/adapters
 *     Filter to swap or extend the capability->adapter dispatch map.
 *     Useful for Pro plugins that want to replace built-in behaviour.
 *
 *   - fotogrids/render/layout/style_vars
 *     Filter to mutate the composer's CSS variable contribution before
 *     the controller merges it with everything else.
 *
 *   - fotogrids/render/layout/wrapper_attrs
 *     Filter to mutate the composer's data-attr contribution before
 *     the controller merges it.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Layout_Wrapper_Composer {

	/**
	 * Capability key -> static adapter callable. Each adapter receives
	 * (Layout $layout, Render_Context $ctx) and returns a partial
	 *   [ 'style_vars' => [...], 'wrapper_data_attrs' => [...] ]
	 * shape. Missing keys are treated as empty arrays.
	 *
	 * The map is filterable via `fotogrids/render/layout/adapters`.
	 *
	 * @var array<string, callable>
	 */
	private const ADAPTERS = array(
		'enforces_item_box' => array( self::class, 'item_box_adapter' ),
		'uses_columns'      => array( self::class, 'columns_adapter' ),
		'uses_item_spacing' => array( self::class, 'item_spacing_adapter' ),
		'lightbox_extends'  => array( self::class, 'lightbox_extended_adapter' ),
	);

	/**
	 * Compose the shared wrapper contributions for an active layout.
	 *
	 * Always stamps `data-fg-layout = $layout->layout_key()` (every
	 * layout needs this; never worth opting out of). Then iterates the
	 * capability map and merges in each opt-in adapter's contribution.
	 *
	 * @since   1.0.0
	 * @param   Layout         $layout
	 * @param   Render_Context $render_context
	 * @return  array{style_vars: array<string, string|Responsive_Var>, wrapper_data_attrs: array<string, string>}
	 */
	public static function compose( Layout $layout, Render_Context $render_context ): array {
		$style_vars         = array();
		$wrapper_data_attrs = array(
			// Every layout needs data-fg-layout for its CSS selectors.
			// Derived from layout_key() so layouts can't disagree with
			// their own JSON option value.
			'data-fg-layout' => $layout->layout_key(),
		);

		/**
		 * Allow third-party plugins to swap or extend the dispatch map.
		 *
		 * @since 1.0.0
		 * @param array<string, callable> $adapters
		 * @param Layout                  $layout
		 * @param Render_Context          $render_context
		 */
		$adapters = apply_filters(
			Filters_Render::LAYOUT_ADAPTERS,
			self::ADAPTERS,
			$layout,
			$render_context
		);

		if ( ! is_array( $adapters ) ) {
			$adapters = self::ADAPTERS;
		}

		foreach ( $adapters as $capability_key => $adapter ) {
			if ( ! is_callable( $adapter ) ) {
				continue;
			}
			if ( ! Layout_Capabilities::layout_supports( $layout, $render_context, $capability_key ) ) {
				continue;
			}

			$contribution = $adapter( $layout, $render_context );
			if ( ! is_array( $contribution ) ) {
				continue;
			}

			if ( isset( $contribution['style_vars'] ) && is_array( $contribution['style_vars'] ) ) {
				$style_vars = array_merge( $style_vars, $contribution['style_vars'] );
			}
			if ( isset( $contribution['wrapper_data_attrs'] ) && is_array( $contribution['wrapper_data_attrs'] ) ) {
				$wrapper_data_attrs = array_merge( $wrapper_data_attrs, $contribution['wrapper_data_attrs'] );
			}
		}

		/**
		 * Filter the composer's CSS variable contribution before it is
		 * merged into the wrapper.
		 *
		 * @since 1.0.0
		 * @param array<string, string|Responsive_Var> $style_vars
		 * @param Layout                               $layout
		 * @param Render_Context                       $render_context
		 */
		$style_vars = apply_filters(
			Filters_Render::LAYOUT_STYLE_VARS,
			$style_vars,
			$layout,
			$render_context
		);

		/**
		 * Filter the composer's data-attribute contribution before it
		 * is merged into the wrapper.
		 *
		 * @since 1.0.0
		 * @param array<string, string> $wrapper_data_attrs
		 * @param Layout                $layout
		 * @param Render_Context        $render_context
		 */
		$wrapper_data_attrs = apply_filters(
			Filters_Render::LAYOUT_WRAPPER_ATTRS,
			$wrapper_data_attrs,
			$layout,
			$render_context
		);

		return array(
			'style_vars'         => is_array( $style_vars ) ? $style_vars : array(),
			'wrapper_data_attrs' => is_array( $wrapper_data_attrs ) ? $wrapper_data_attrs : array(),
		);
	}

	/* =====================================================================
		Adapters
		===================================================================== */

	/**
	 * `enforces_item_box` capability.
	 *
	 * Stamps the aspect-ratio + object-fit variables that drive the
	 * fixed item-box behaviour in base CSS. When the aspect ratio
	 * resolves to empty (the user chose "None"), stamps
	 * data-fg-natural-ratio so base CSS opts the wrapper out of the
	 * fixed-box rules entirely.
	 *
	 * Consumed by: base/collection-base.css (uses --fg-item-aspect-ratio
	 * and --fg-item-fit on the :where(...) grouping; checks
	 * [data-fg-natural-ratio="1"] for the natural-ratio escape hatch).
	 *
	 * @return array{style_vars: array<string, string>, wrapper_data_attrs: array<string, string>}
	 */
	private static function item_box_adapter( Layout $layout, Render_Context $render_context ): array {
		$style_vars         = array();
		$wrapper_data_attrs = array();

		$aspect_ratio = $render_context->layout->item_aspect_ratio;
		if ( '' !== $aspect_ratio ) {
			$style_vars['--fg-item-aspect-ratio'] = $aspect_ratio;
		} else {
			// Empty aspect ratio means the user chose "None" - opt out
			// of the fixed-box CSS so the image keeps its natural
			// intrinsic dimensions.
			$wrapper_data_attrs['data-fg-natural-ratio'] = '1';
		}

		if ( '' !== $render_context->layout->item_object_fit ) {
			$style_vars['--fg-item-fit'] = $render_context->layout->item_object_fit;
		}

		return array(
			'style_vars'         => $style_vars,
			'wrapper_data_attrs' => $wrapper_data_attrs,
		);
	}

	/**
	 * `uses_columns` capability.
	 *
	 * Stamps the column-count variables for either fixed-column mode
	 * (--fg-cols) or auto-fit mode (--fg-col-min / --fg-col-max).
	 * Also stamps data-fg-columns-mode so layout CSS can pick the
	 * right grid-template strategy.
	 *
	 * Falls back to the global defaults from
	 * Collection_Defaults::resolve_gallery() for any missing values,
	 * matching the historical Layout_Grid behaviour.
	 *
	 * @return array{style_vars: array<string, string|Responsive_Var>, wrapper_data_attrs: array<string, string>}
	 */
	private static function columns_adapter( Layout $layout, Render_Context $render_context ): array {
		$defaults = class_exists( '\FotoGrids\Collection_Defaults' )
			? \FotoGrids\Collection_Defaults::resolve_gallery()
			: array();

		$responsive_columns = $render_context->layout->responsive_columns;
		$auto_range         = $render_context->layout->columns_auto_range;
		$default_columns    = is_array( $defaults['columns'] ?? null ) ? $defaults['columns'] : array();
		$default_auto_range = is_array( $defaults['columns_auto_range'] ?? null ) ? $defaults['columns_auto_range'] : array();

		$mode               = $render_context->layout->columns_mode;
		$style_vars         = array();
		$wrapper_data_attrs = array(
			'data-fg-columns-mode' => $mode,
		);

		if ( Columns_Mode::FIXED === $mode ) {
			$style_vars['--fg-cols'] = new Responsive_Var(
				self::resolve_column_count( $responsive_columns, 'desktop', $default_columns ),
				self::resolve_column_count( $responsive_columns, 'tablet', $default_columns ),
				self::resolve_column_count( $responsive_columns, 'mobile', $default_columns ),
			);

			return array(
				'style_vars'         => $style_vars,
				'wrapper_data_attrs' => $wrapper_data_attrs,
			);
		}

		// Auto mode: emit --fg-col-min / --fg-col-max so the layout CSS
		// can use `repeat(auto-fit, minmax(...))`.
		$desktop_auto = self::resolve_auto_range(
			is_array( $auto_range['desktop'] ?? null ) ? $auto_range['desktop'] : array(),
			is_array( $default_auto_range['desktop'] ?? null ) ? $default_auto_range['desktop'] : array()
		);
		$tablet_auto  = self::resolve_auto_range(
			is_array( $auto_range['tablet'] ?? null ) ? $auto_range['tablet'] : array(),
			is_array( $default_auto_range['tablet'] ?? null ) ? $default_auto_range['tablet'] : array()
		);
		$mobile_auto  = self::resolve_auto_range(
			is_array( $auto_range['mobile'] ?? null ) ? $auto_range['mobile'] : array(),
			is_array( $default_auto_range['mobile'] ?? null ) ? $default_auto_range['mobile'] : array()
		);

		$style_vars['--fg-col-min'] = new Responsive_Var(
			$desktop_auto['min'],
			$tablet_auto['min'],
			$mobile_auto['min'],
		);
		$style_vars['--fg-col-max'] = new Responsive_Var(
			$desktop_auto['max'],
			$tablet_auto['max'],
			$mobile_auto['max'],
		);

		return array(
			'style_vars'         => $style_vars,
			'wrapper_data_attrs' => $wrapper_data_attrs,
		);
	}

	/**
	 * `uses_item_spacing` capability.
	 *
	 * Stamps --fg-gap from responsive_spacing. Layouts that flow with
	 * the image's natural dimensions but still want gap control
	 * (Masonry, Justified) opt in here without needing the columns
	 * adapter.
	 *
	 * @return array{style_vars: array<string, Responsive_Var>}
	 */
	private static function item_spacing_adapter( Layout $layout, Render_Context $render_context ): array {
		$defaults = class_exists( '\FotoGrids\Collection_Defaults' )
			? \FotoGrids\Collection_Defaults::resolve_gallery()
			: array();

		$responsive_spacing = $render_context->layout->responsive_spacing;
		$default_spacing    = is_array( $defaults['item_spacing'] ?? null ) ? $defaults['item_spacing'] : array();

		return array(
			'style_vars' => array(
				'--fg-gap' => new Responsive_Var(
					self::resolve_spacing_value( $responsive_spacing, 'desktop', $default_spacing ),
					self::resolve_spacing_value( $responsive_spacing, 'tablet', $default_spacing ),
					self::resolve_spacing_value( $responsive_spacing, 'mobile', $default_spacing ),
				),
			),
		);
	}

	/**
	 * `lightbox_extends` capability.
	 *
	 * Layouts that render fewer items than the full gallery (today:
	 * Single Item) opt in here. When the user picks click=lightbox AND
	 * lightbox_scope=gallery AND the gallery has more than one item,
	 * stamp the markers the lightbox JS uses to lazy-fetch the rest of
	 * the gallery via /gallery/lightbox/slides.
	 *
	 * The attribute name (data-fg-lightbox-extended) is distinct from
	 * data-fg-paginated so pagination-core.js doesn't accidentally
	 * wire scroll pagination on these layouts.
	 *
	 * @return array{wrapper_data_attrs: array<string, string>}
	 */
	private static function lightbox_extended_adapter( Layout $layout, Render_Context $render_context ): array {
		$is_lightbox_click = ( $render_context->behavior->click_behavior ?? '' ) === 'lightbox';
		$scope             = $render_context->settings['lightbox_scope'] ?? 'gallery';
		if ( ! $is_lightbox_click || 'gallery' !== $scope ) {
			return array( 'wrapper_data_attrs' => array() );
		}

		$total_items = (int) ( $render_context->meta->total_item_count ?? 0 );
		if ( $total_items <= 1 ) {
			return array( 'wrapper_data_attrs' => array() );
		}

		$wrapper_data_attrs = array(
			'data-fg-lightbox-extended' => 'true',
			'data-fg-total-items'       => (string) $total_items,
			'data-fg-render-url'        => esc_url( rest_url( 'fotogrids/v1/gallery/render' ) ),
			'data-fg-render-nonce'      => esc_attr( wp_create_nonce( 'wp_rest' ) ),
		);

		// Mirror Pagination_Common: random sort needs the same seed
		// across the initial render and any REST slide-fetch so they
		// share a permutation.
		if ( ( $render_context->settings['default_sort_order'] ?? '' ) === 'random'
			&& null !== $render_context->meta->random_seed
		) {
			$wrapper_data_attrs['data-fg-random-seed'] = (string) $render_context->meta->random_seed;
		}

		return array(
			'wrapper_data_attrs' => $wrapper_data_attrs,
		);
	}

	/* =====================================================================
		Shared helpers
		===================================================================== */

	private static function to_unit_value( $raw_value, string $default_unit ): string {
		if ( null === $raw_value || '' === $raw_value ) {
			return '';
		}
		if ( is_array( $raw_value ) ) {
			if ( ! isset( $raw_value['value'] ) || '' === $raw_value['value'] ) {
				return '';
			}
			$value = $raw_value['value'];
			$unit  = $raw_value['unit'] ?? $default_unit;
			return (string) $value . $unit;
		}
		return (string) $raw_value . $default_unit;
	}

	/**
	 * @param  array<string, mixed> $range
	 * @param  array<string, mixed> $fallback
	 * @return array{min: string, max: string}
	 */
	private static function resolve_auto_range( array $range, array $fallback ): array {
		return array(
			'min' => self::to_unit_value( $range['min'] ?? ( $fallback['min'] ?? '' ), 'px' ),
			'max' => self::to_unit_value( $range['max'] ?? ( $fallback['max'] ?? '' ), 'px' ),
		);
	}

	/**
	 * @param  array<string, mixed> $responsive_spacing
	 * @param  string               $breakpoint
	 * @param  array<string, mixed> $default_spacing
	 */
	private static function resolve_spacing_value( array $responsive_spacing, string $breakpoint, array $default_spacing ): string {
		$raw_spacing = $responsive_spacing[ $breakpoint ] ?? ( $default_spacing[ $breakpoint ] ?? '' );
		return self::to_unit_value( $raw_spacing, 'px' );
	}

	/**
	 * @param  array<string, mixed> $responsive_columns
	 * @param  string               $breakpoint
	 * @param  array<string, mixed> $default_columns
	 */
	private static function resolve_column_count( array $responsive_columns, string $breakpoint, array $default_columns ): string {
		$column_value = $responsive_columns[ $breakpoint ] ?? ( $default_columns[ $breakpoint ] ?? '' );
		if ( '' === $column_value || null === $column_value ) {
			return '';
		}
		return (string) absint( $column_value );
	}
}
