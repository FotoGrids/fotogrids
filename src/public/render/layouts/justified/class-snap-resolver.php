<?php
/**
 * Picks per-page item counts that snap to clean justified rows.
 *
 * @package FotoGrids\Render\Layouts\Justified
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Layouts\Justified;

use FotoGrids\Hooks\Filters_Render;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Assumed container widths and the page lookup for justified Fill pagination.
 * Cutting itself is Page_Cutter's.
 *
 * @package FotoGrids\Render\Layouts\Justified
 * @since   1.0.0
 */
final class Snap_Resolver {

	/**
	 * Default container widths assumed when the client hasn't measured one.
	 */
	private const ASSUMED_WIDTH_DEFAULTS = array(
		'desktop' => 1200,
		'tablet'  => 760,
		'mobile'  => 400,
	);

	/**
	 * Returns the configured assumed width for a breakpoint, filterable
	 * via fotogrids/render/justified/assumed_width.
	 *
	 * @since  1.0.0
	 * @param  string $breakpoint Active breakpoint.
	 * @return float
	 */
	public static function assumed_width_for( string $breakpoint ): float {
		$defaults = self::ASSUMED_WIDTH_DEFAULTS;

		/**
		 * Filter the per-breakpoint container width the snap pagination
		 * resolver assumes when the client hasn't measured the real
		 * container width yet. The returned array must map 'desktop',
		 * 'tablet', and 'mobile' to pixel ints.
		 *
		 * @since 1.0.0
		 * @param array{desktop:int,tablet:int,mobile:int} $defaults
		 */
		$resolved = apply_filters( Filters_Render::JUSTIFIED_ASSUMED_WIDTH, $defaults );
		if ( ! is_array( $resolved ) ) {
			$resolved = $defaults;
		}

		$value = $resolved[ $breakpoint ] ?? $resolved['desktop'] ?? $defaults['desktop'];
		return max( 1.0, (float) $value );
	}

	/**
	 * Resolves the snapped page size for the requested page.
	 *
	 * Returns the original target_page_size when there is nothing to cut.
	 *
	 * @since 1.0.0
	 * @param  array{
	 *     aspect_ratios:        float[],
	 *     target_page_size:     int,
	 *     requested_page:       int,
	 *     container_width:      float,
	 *     gap:                  float,
	 *     target_row_height:    float,
	 *     window_percent:       float,
	 *     fill_threshold:       float,
	 *     direction:            string
	 * } $args
	 * @return array{ page_size: int, offset: int, total_pages: int }
	 */
	public static function resolve( array $args ): array {
		$target = max( 1, (int) $args['target_page_size'] );
		$pages  = Page_Cutter::cut(
			$args['aspect_ratios'],
			array(
				'width'      => max( 1.0, (float) $args['container_width'] ),
				'gap'        => (float) $args['gap'],
				'row_height' => max( 1.0, (float) $args['target_row_height'] ),
			),
			array(
				'mode'      => 'fill',
				'target'    => $target,
				'window'    => (float) $args['window_percent'],
				'threshold' => (float) $args['fill_threshold'],
				'direction' => (string) ( $args['direction'] ?? 'auto' ),
			)
		);

		if ( empty( $pages ) ) {
			return array(
				'page_size'   => $target,
				'offset'      => 0,
				'total_pages' => 1,
			);
		}

		$index = min( max( 1, (int) $args['requested_page'] ), count( $pages ) ) - 1;

		return array(
			'page_size'   => $pages[ $index ]['size'],
			'offset'      => $pages[ $index ]['offset'],
			'total_pages' => count( $pages ),
		);
	}
}
