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
 * Resolves the snap-adjusted per-page item count for a justified gallery.
 *
 * Algorithm:
 *
 *   1. Pack the FULL (post-sort, post-filter) item list into rows using
 *      Justified_Packer at the assumed container width.
 *   2. Walk pages by accumulating rows until the per-page target is
 *      reached. For each potential page boundary, measure the trailing
 *      row's fill ratio.
 *   3. Within the configured window (e.g. ±20% of items_per_page), pick
 *      the boundary whose trailing-row fill ratio is highest AND above
 *      the configured threshold.
 *   4. If no candidate clears the threshold, fall back to the closest
 *      boundary in the user-preferred direction.
 *
 * Snap direction:
 *   - 'prefer_remove'  : always prefer the boundary that yields fewer items.
 *   - 'prefer_add'     : always prefer the boundary that yields more items.
 *   - 'auto'           : prefer remove when the unsnapped last row is <50%
 *                         full, prefer add otherwise.
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
	 * Returns the original target_page_size when the snap settings are off
	 * or no item produces a clean enough boundary.
	 *
	 * @since  1.0.0
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
		$aspect_ratios    = $args['aspect_ratios'];
		$target_page_size = max( 1, (int) $args['target_page_size'] );
		$requested_page   = max( 1, (int) $args['requested_page'] );
		$container_width  = max( 1.0, (float) $args['container_width'] );
		$gap              = max( 0.0, (float) $args['gap'] );
		$target_height    = max( 1.0, (float) $args['target_row_height'] );
		$window_percent   = max( 0.0, min( 100.0, (float) $args['window_percent'] ) );
		$fill_threshold   = max( 0.0, min( 100.0, (float) $args['fill_threshold'] ) ) / 100.0;
		$direction        = in_array( $args['direction'] ?? 'auto', array( 'auto', 'prefer_remove', 'prefer_add' ), true )
			? $args['direction']
			: 'auto';

		$total_items = count( $aspect_ratios );
		if ( 0 === $total_items ) {
			return array(
				'page_size'   => $target_page_size,
				'offset'      => 0,
				'total_pages' => 1,
			);
		}

		$rows = Justified_Packer::pack( $aspect_ratios, $container_width, $gap, $target_height );
		if ( empty( $rows ) ) {
			return array(
				'page_size'   => $target_page_size,
				'offset'      => 0,
				'total_pages' => 1,
			);
		}

		$window_items  = (int) round( $target_page_size * $window_percent / 100.0 );
		$min_page_size = max( 1, $target_page_size - $window_items );
		$max_page_size = $target_page_size + $window_items;

		$row_aspects_cache = array();
		$get_row_aspects   = function ( int $row_index ) use ( &$row_aspects_cache, $rows, $aspect_ratios ): array {
			if ( ! isset( $row_aspects_cache[ $row_index ] ) ) {
				$row_aspects_cache[ $row_index ] = array_map(
					static fn( int $index ) => (float) $aspect_ratios[ $index ],
					$rows[ $row_index ]
				);
			}
			return $row_aspects_cache[ $row_index ];
		};

		$page_boundaries = self::resolve_all_page_boundaries(
			$rows,
			$get_row_aspects,
			$target_page_size,
			$min_page_size,
			$max_page_size,
			$total_items,
			$container_width,
			$gap,
			$target_height,
			$fill_threshold,
			$direction
		);

		$total_pages = max( 1, count( $page_boundaries ) );
		$page_index  = min( $requested_page, $total_pages ) - 1;
		$boundary    = $page_boundaries[ $page_index ];

		return array(
			'page_size'   => $boundary['page_size'],
			'offset'      => $boundary['offset'],
			'total_pages' => $total_pages,
		);
	}

	/**
	 * Walks the whole row list and resolves every page boundary at once.
	 * Returns boundaries as offset/page_size records — total_pages is the
	 * length of the returned array.
	 *
	 * @since  1.0.0
	 * @param  int[][] $rows
	 * @param  callable $get_row_aspects function(int $row_index): float[]
	 * @param  int     $target_page_size
	 * @param  int     $min_page_size
	 * @param  int     $max_page_size
	 * @param  int     $total_items
	 * @param  float   $container_width
	 * @param  float   $gap
	 * @param  float   $target_height
	 * @param  float   $fill_threshold  Fractional 0..1.
	 * @param  string  $direction
	 * @return array<int, array{ offset: int, page_size: int }>
	 */
	private static function resolve_all_page_boundaries(
		array $rows,
		callable $get_row_aspects,
		int $target_page_size,
		int $min_page_size,
		int $max_page_size,
		int $total_items,
		float $container_width,
		float $gap,
		float $target_height,
		float $fill_threshold,
		string $direction
	): array {
		$boundaries = array();
		$cursor     = 0;
		$row_index  = 0;
		$row_count  = count( $rows );

		while ( $cursor < $total_items && $row_index < $row_count ) {
			$candidates       = array();
			$accumulated      = 0;
			$candidate_row_ix = $row_index;

			while ( $candidate_row_ix < $row_count ) {
				$row          = $rows[ $candidate_row_ix ];
				$accumulated += count( $row );

				if ( $accumulated >= $min_page_size ) {
					$candidates[] = array(
						'last_row_index' => $candidate_row_ix,
						'page_size'      => $accumulated,
					);
				}
				if ( $accumulated >= $max_page_size ) {
					break;
				}

				++$candidate_row_ix;
			}

			if ( empty( $candidates ) ) {
				$candidates[] = array(
					'last_row_index' => min( $row_index, $row_count - 1 ),
					'page_size'      => min( $target_page_size, $total_items - $cursor ),
				);
			}

			$is_last_page_candidates = false;
			foreach ( $candidates as $candidate ) {
				if ( ( $cursor + $candidate['page_size'] ) >= $total_items ) {
					$is_last_page_candidates = true;
					break;
				}
			}

			if ( $is_last_page_candidates ) {
				$page_size    = min( $target_page_size, $total_items - $cursor );
				$boundaries[] = array(
					'offset'    => $cursor,
					'page_size' => $page_size,
				);
				$cursor      += $page_size;
				$row_index    = $candidate_row_ix + 1;
				while ( $row_index < $row_count ) {
					++$row_index;
				}
				break;
			}

			$chosen = self::pick_candidate(
				$candidates,
				$get_row_aspects,
				$target_page_size,
				$container_width,
				$gap,
				$target_height,
				$fill_threshold,
				$direction
			);

			$boundaries[] = array(
				'offset'    => $cursor,
				'page_size' => $chosen['page_size'],
			);

			$cursor   += $chosen['page_size'];
			$row_index = $chosen['last_row_index'] + 1;
		}

		if ( empty( $boundaries ) ) {
			$boundaries[] = array(
				'offset'    => 0,
				'page_size' => min( $target_page_size, $total_items ),
			);
		}

		return $boundaries;
	}

	/**
	 * Pick the best candidate boundary using the configured rules.
	 *
	 * @since  1.0.0
	 * @param  array<int, array{ last_row_index: int, page_size: int }> $candidates
	 * @param  callable $get_row_aspects
	 * @param  int      $target_page_size
	 * @param  float    $container_width
	 * @param  float    $gap
	 * @param  float    $target_height
	 * @param  float    $fill_threshold
	 * @param  string   $direction
	 * @return array{ last_row_index: int, page_size: int }
	 */
	private static function pick_candidate(
		array $candidates,
		callable $get_row_aspects,
		int $target_page_size,
		float $container_width,
		float $gap,
		float $target_height,
		float $fill_threshold,
		string $direction
	): array {
		$natural_target_row = self::row_natural_fill_ratio(
			$get_row_aspects( self::find_target_candidate_row_index( $candidates, $target_page_size ) ),
			$gap,
			$target_height,
			$container_width
		);

		$effective_direction = 'auto' === $direction
			? ( $natural_target_row < 0.5 ? 'prefer_remove' : 'prefer_add' )
			: $direction;

		$clean_candidates = array_values(
			array_filter(
				$candidates,
				static function ( array $candidate ) use ( $get_row_aspects, $gap, $target_height, $container_width, $fill_threshold ) {
					$aspects = $get_row_aspects( $candidate['last_row_index'] );
					$fill    = self::row_natural_fill_ratio( $aspects, $gap, $target_height, $container_width );
					return $fill >= $fill_threshold;
				}
			)
		);

		$pool = ! empty( $clean_candidates ) ? $clean_candidates : $candidates;

		usort(
			$pool,
			static function ( array $a, array $b ) use ( $effective_direction, $target_page_size ) {
				$delta_a = abs( $a['page_size'] - $target_page_size );
				$delta_b = abs( $b['page_size'] - $target_page_size );
				if ( $delta_a !== $delta_b ) {
					return $delta_a <=> $delta_b;
				}
				if ( 'prefer_remove' === $effective_direction ) {
					return $a['page_size'] <=> $b['page_size'];
				}
				return $b['page_size'] <=> $a['page_size'];
			}
		);

		return $pool[0];
	}

	/**
	 * Find the candidate index closest to the target page size — used to
	 * gauge the "natural" trailing-row fill for auto-direction resolution.
	 *
	 * @since  1.0.0
	 * @param  array<int, array{ last_row_index: int, page_size: int }> $candidates
	 * @param  int $target_page_size
	 * @return int
	 */
	private static function find_target_candidate_row_index( array $candidates, int $target_page_size ): int {
		$best       = $candidates[0];
		$best_delta = abs( $best['page_size'] - $target_page_size );
		foreach ( $candidates as $candidate ) {
			$delta = abs( $candidate['page_size'] - $target_page_size );
			if ( $delta < $best_delta ) {
				$best       = $candidate;
				$best_delta = $delta;
			}
		}
		return $best['last_row_index'];
	}

	/**
	 * Compute the trailing row's natural-fill ratio against the container.
	 * Value of 1.0 means the row exactly fills the container at the
	 * target height; <1.0 means the row would leave empty space.
	 *
	 * @since  1.0.0
	 * @param  float[] $row_aspects
	 * @param  float   $gap
	 * @param  float   $target_height
	 * @param  float   $container_width
	 * @return float
	 */
	private static function row_natural_fill_ratio( array $row_aspects, float $gap, float $target_height, float $container_width ): float {
		$natural = Justified_Packer::natural_row_width( $row_aspects, $gap, $target_height );
		if ( $container_width <= 0 ) {
			return 0.0;
		}
		return min( 1.0, $natural / $container_width );
	}
}
