<?php
/**
 * Cuts a justified gallery's item sequence into pages that end on packed rows.
 *
 * @package FotoGrids\Render\Layouts\Justified
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Layouts\Justified;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Page cutting for justified galleries.
 *
 * Mirrors public/render/layouts/justified/page-cutter.js line for line, so the
 * server and the browser cut identically at the same geometry.
 *
 * @since 1.3.0
 */
final class Page_Cutter {

	/**
	 * Packs the sequence into rows of item indices.
	 *
	 * @since  1.3.0
	 * @param  float[] $aspects    Aspect ratios (width / height) in sequence order.
	 * @param  float   $width      Container width in pixels.
	 * @param  float   $gap        Gap between items in pixels.
	 * @param  float   $row_height Target row height in pixels.
	 * @return int[][]
	 */
	public static function pack( array $aspects, float $width, float $gap, float $row_height ): array {
		return Justified_Packer::pack( $aspects, $width, max( 0.0, $gap ), $row_height );
	}

	/**
	 * Cuts the sequence into pages, from `$start` to the end.
	 *
	 * @since  1.3.0
	 * @param  float[] $aspects  Aspect ratios in sequence order.
	 * @param  array   $geometry { width, gap, row_height } in pixels.
	 * @param  array   $rules    { mode, target, window, threshold, direction, max_rows, page_end_hide }.
	 * @param  int     $start    Index of the first item of the first page.
	 * @return array<int, array{ offset: int, size: int }>
	 */
	public static function cut( array $aspects, array $geometry, array $rules, int $start = 0 ): array {
		$total = count( $aspects );
		$start = max( 0, $start );
		if ( $start >= $total ) {
			return array();
		}

		$rules  = self::normalize_rules( $rules );
		$width  = (float) ( $geometry['width'] ?? 0 );
		$gap    = max( 0.0, (float) ( $geometry['gap'] ?? 0 ) );
		$height = (float) ( $geometry['row_height'] ?? 0 );
		$rows   = ( $width > 0 && $height > 0 ) ? self::pack( $aspects, $width, $gap, $height ) : array();

		if ( empty( $rows ) ) {
			return self::fixed_pages( $total, $start, $rules['target'] );
		}

		$row_of   = array();
		$row_ends = array();
		$at       = 0;
		foreach ( $rows as $r => $row ) {
			foreach ( $row as $index ) {
				$row_of[ $index ] = $r;
			}
			$at        += count( $row );
			$row_ends[] = $at;
		}

		$pages  = array();
		$cursor = $start;
		while ( $cursor < $total ) {
			$cap = $total;
			if ( $rules['max_rows'] > 0 ) {
				$cap_row = min( count( $row_ends ) - 1, $row_of[ $cursor ] + $rules['max_rows'] - 1 );
				$cap     = $row_ends[ $cap_row ];
			}

			$end = 'match' === $rules['mode']
				? self::match_end( $cursor, $total, $cap, $row_ends, $rules )
				: self::fill_end( $cursor, $total, $cap, $rows, $row_ends, $row_of, $aspects, $width, $gap, $height, $rules );

			$pages[] = array(
				'offset' => $cursor,
				'size'   => $end - $cursor,
			);
			$cursor  = $end;
		}

		return $pages;
	}

	/**
	 * Returns the 1-based page holding `$index`, clamped to the first and last page.
	 *
	 * @since  1.3.0
	 * @param  array<int, array{ offset: int, size: int }> $pages Pages from cut().
	 * @param  int                                         $index Sequence index.
	 * @return int
	 */
	public static function page_containing( array $pages, int $index ): int {
		$count = count( $pages );
		if ( 0 === $count ) {
			return 1;
		}
		foreach ( $pages as $i => $page ) {
			if ( $index < $page['offset'] + $page['size'] ) {
				return $i + 1;
			}
		}
		return $count;
	}

	/**
	 * @param  array $rules Raw rules.
	 * @return array{ mode: string, target: int, window: float, threshold: float, direction: string, max_rows: int, page_end_hide: bool }
	 */
	private static function normalize_rules( array $rules ): array {
		$direction = (string) ( $rules['direction'] ?? 'auto' );
		return array(
			'mode'          => 'match' === ( $rules['mode'] ?? 'fill' ) ? 'match' : 'fill',
			'target'        => max( 1, (int) ( $rules['target'] ?? 12 ) ),
			'window'        => max( 0.0, min( 100.0, (float) ( $rules['window'] ?? 20 ) ) ),
			'threshold'     => max( 0.0, min( 100.0, (float) ( $rules['threshold'] ?? 85 ) ) ) / 100.0,
			'direction'     => in_array( $direction, array( 'auto', 'prefer_remove', 'prefer_add' ), true ) ? $direction : 'auto',
			'max_rows'      => max( 0, (int) ( $rules['max_rows'] ?? 0 ) ),
			'page_end_hide' => ! empty( $rules['page_end_hide'] ),
		);
	}

	/**
	 * @param  int $total  Sequence length.
	 * @param  int $start  First index.
	 * @param  int $target Page size.
	 * @return array<int, array{ offset: int, size: int }>
	 */
	private static function fixed_pages( int $total, int $start, int $target ): array {
		$pages = array();
		for ( $cursor = $start; $cursor < $total; $cursor += $target ) {
			$pages[] = array(
				'offset' => $cursor,
				'size'   => min( $target, $total - $cursor ),
			);
		}
		return $pages;
	}

	/**
	 * End (exclusive) of a Match page starting at `$cursor`.
	 *
	 * @param  int   $cursor   Page start.
	 * @param  int   $total    Sequence length.
	 * @param  int   $cap      Last index allowed by Max Rows.
	 * @param  int[] $row_ends Row end indices, ascending.
	 * @param  array $rules    Normalised rules.
	 * @return int
	 */
	private static function match_end( int $cursor, int $total, int $cap, array $row_ends, array $rules ): int {
		$end = min( $total, $cursor + $rules['target'], $cap );
		if ( $rules['page_end_hide'] && $end < $total && ! in_array( $end, $row_ends, true ) ) {
			$best = 0;
			foreach ( $row_ends as $row_end ) {
				if ( $row_end > $cursor && $row_end <= $end ) {
					$best = $row_end;
				}
			}
			if ( $best > 0 ) {
				$end = $best;
			}
		}
		return $end;
	}

	/**
	 * End (exclusive) of a Fill page starting at `$cursor`.
	 *
	 * @param  int     $cursor   Page start.
	 * @param  int     $total    Sequence length.
	 * @param  int     $cap      Last index allowed by Max Rows.
	 * @param  int[][] $rows     Packed rows.
	 * @param  int[]   $row_ends Row end indices, ascending.
	 * @param  int[]   $row_of   Row index of each item.
	 * @param  float[] $aspects  Aspect ratios.
	 * @param  float   $width    Container width.
	 * @param  float   $gap      Gap.
	 * @param  float   $height   Target row height.
	 * @param  array   $rules    Normalised rules.
	 * @return int
	 */
	private static function fill_end( int $cursor, int $total, int $cap, array $rows, array $row_ends, array $row_of, array $aspects, float $width, float $gap, float $height, array $rules ): int {
		$target        = $rules['target'];
		$window_items  = (int) round( $target * $rules['window'] / 100.0 );
		$min_page_size = max( 1, $target - $window_items );
		$max_page_size = $target + $window_items;

		$candidates = array();
		foreach ( $row_ends as $row_end ) {
			if ( $row_end <= $cursor ) {
				continue;
			}
			if ( $row_end > $cap ) {
				break;
			}
			$size = $row_end - $cursor;
			if ( $size >= $min_page_size ) {
				$candidates[] = $row_end;
			}
			if ( $size >= $max_page_size ) {
				break;
			}
		}

		if ( empty( $candidates ) ) {
			return min( $total, $cap );
		}
		if ( in_array( $total, $candidates, true ) ) {
			return $total;
		}

		$in_window = array_values(
			array_filter(
				$candidates,
				static function ( int $end ) use ( $cursor, $max_page_size ): bool {
					return $end - $cursor <= $max_page_size;
				}
			)
		);
		$pool      = empty( $in_window ) ? $candidates : $in_window;

		$fill_of = static function ( int $end ) use ( $rows, $row_of, $aspects, $width, $gap, $height ): float {
			return self::row_fill( $rows[ $row_of[ $end - 1 ] ], $aspects, $width, $gap, $height );
		};

		$clean = array_values(
			array_filter(
				$pool,
				static function ( int $end ) use ( $fill_of, $rules ): bool {
					return $fill_of( $end ) >= $rules['threshold'];
				}
			)
		);
		if ( ! empty( $clean ) ) {
			$pool = $clean;
		}

		$direction = $rules['direction'];
		if ( 'auto' === $direction ) {
			$nearest = $candidates[0];
			foreach ( $candidates as $end ) {
				if ( abs( $end - $cursor - $target ) < abs( $nearest - $cursor - $target ) ) {
					$nearest = $end;
				}
			}
			$direction = $fill_of( $nearest ) < 0.5 ? 'prefer_remove' : 'prefer_add';
		}

		usort(
			$pool,
			static function ( int $a, int $b ) use ( $cursor, $target, $direction ): int {
				$delta_a = abs( $a - $cursor - $target );
				$delta_b = abs( $b - $cursor - $target );
				if ( $delta_a !== $delta_b ) {
					return $delta_a <=> $delta_b;
				}
				return 'prefer_remove' === $direction ? $a <=> $b : $b <=> $a;
			}
		);

		return $pool[0];
	}

	/**
	 * How much of the container a row fills at the target height, 0..1.
	 *
	 * @param  int[]   $row     Item indices.
	 * @param  float[] $aspects Aspect ratios.
	 * @param  float   $width   Container width.
	 * @param  float   $gap     Gap.
	 * @param  float   $height  Target row height.
	 * @return float
	 */
	private static function row_fill( array $row, array $aspects, float $width, float $gap, float $height ): float {
		$sum = 0.0;
		foreach ( $row as $index ) {
			$aspect = $aspects[ $index ];
			$sum   += ( is_numeric( $aspect ) && $aspect > 0 ) ? (float) $aspect : 1.5;
		}
		$natural = $sum * $height + max( 0, count( $row ) - 1 ) * $gap;
		return min( 1.0, $natural / $width );
	}
}
