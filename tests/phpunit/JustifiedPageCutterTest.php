<?php
/**
 * Unit tests for Page_Cutter: how a justified gallery's sequence is cut into pages.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Layouts\Justified\Justified_Packer;
use FotoGrids\Render\Layouts\Justified\Page_Cutter;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/public/render/layouts/justified/class-justified-packer.php';

final class JustifiedPageCutterTest extends TestCase {

	private const RATIOS = array( 0.5, 0.66, 0.75, 1.0, 1.33, 1.5, 1.78, 2.4 );

	protected function setUp(): void {
		$file = dirname( __DIR__, 2 ) . '/src/public/render/layouts/justified/class-page-cutter.php';
		if ( ! file_exists( $file ) ) {
			$this->fail( 'Page_Cutter is not implemented: ' . $file );
		}
		require_once $file;
	}

	/**
	 * @return float[]
	 */
	private static function sequence( int $count, ?array $pool = null ): array {
		$pool    = $pool ?? self::RATIOS;
		$aspects = array();
		for ( $i = 0; $i < $count; $i++ ) {
			$aspects[] = $pool[ mt_rand( 0, count( $pool ) - 1 ) ];
		}
		return $aspects;
	}

	private static function geometry( float $width = 1200, float $gap = 10, float $row_height = 220 ): array {
		return array(
			'width'      => $width,
			'gap'        => $gap,
			'row_height' => $row_height,
		);
	}

	private static function rules( array $overrides = array() ): array {
		return array_merge(
			array(
				'mode'          => 'fill',
				'target'        => 12,
				'window'        => 20,
				'threshold'     => 85,
				'direction'     => 'auto',
				'max_rows'      => 0,
				'page_end_hide' => false,
			),
			$overrides
		);
	}

	/**
	 * Item index at which each packed row ends (exclusive), for the whole sequence.
	 *
	 * @return array<int, true>
	 */
	private static function row_ends( array $aspects, array $geometry ): array {
		$ends = array();
		$at   = 0;
		foreach ( Justified_Packer::pack( $aspects, $geometry['width'], $geometry['gap'], $geometry['row_height'] ) as $row ) {
			$at          += count( $row );
			$ends[ $at ] = true;
		}
		return $ends;
	}

	/**
	 * Row index of every item in the whole-sequence packing.
	 *
	 * @return int[]
	 */
	private static function row_of( array $aspects, array $geometry ): array {
		$row_of = array();
		foreach ( Justified_Packer::pack( $aspects, $geometry['width'], $geometry['gap'], $geometry['row_height'] ) as $r => $row ) {
			foreach ( $row as $index ) {
				$row_of[ $index ] = $r;
			}
		}
		return $row_of;
	}

	private function assert_covers( array $pages, int $start, int $total, string $case ): void {
		$next = $start;
		foreach ( $pages as $i => $page ) {
			$this->assertSame( $next, $page['offset'], "$case: page $i starts at {$page['offset']}, expected $next" );
			$this->assertGreaterThan( 0, $page['size'], "$case: page $i is empty" );
			$next += $page['size'];
		}
		$this->assertSame( $total, $next, "$case: pages end at $next of $total" );
	}

	public function test_pack_matches_the_justified_packer(): void {
		mt_srand( 1 );
		for ( $t = 0; $t < 50; $t++ ) {
			$aspects  = self::sequence( mt_rand( 1, 80 ) );
			$geometry = self::geometry( (float) mt_rand( 280, 1600 ), (float) mt_rand( 0, 40 ), (float) mt_rand( 60, 400 ) );
			$this->assertSame(
				Justified_Packer::pack( $aspects, $geometry['width'], $geometry['gap'], $geometry['row_height'] ),
				Page_Cutter::pack( $aspects, $geometry['width'], $geometry['gap'], $geometry['row_height'] )
			);
		}
	}

	/** FIL-01 */
	public function test_fill_pages_are_contiguous_cover_everything_and_end_on_row_ends_within_the_window(): void {
		mt_srand( 11 );
		foreach ( array( 6, 12, 24 ) as $target ) {
			foreach ( array( 0, 20, 50 ) as $window ) {
				foreach ( array( 0, 85, 100 ) as $threshold ) {
					foreach ( array( 'auto', 'prefer_remove', 'prefer_add' ) as $direction ) {
						for ( $t = 0; $t < 6; $t++ ) {
							$total    = mt_rand( 5, 200 );
							$aspects  = self::sequence( $total );
							$geometry = self::geometry( (float) mt_rand( 280, 1600 ), (float) mt_rand( 0, 40 ), (float) mt_rand( 60, 400 ) );
							$rules    = self::rules( compact( 'target', 'window', 'threshold', 'direction' ) );
							$case     = "n=$total target=$target window=$window threshold=$threshold $direction " . wp_json_encode_safe( $geometry );
							$pages    = Page_Cutter::cut( $aspects, $geometry, $rules );
							$ends     = self::row_ends( $aspects, $geometry );
							$min      = max( 1, $target - (int) round( $target * $window / 100 ) );
							$max      = $target + (int) round( $target * $window / 100 );

							$this->assert_covers( $pages, 0, $total, $case );
							$last = count( $pages ) - 1;
							foreach ( $pages as $i => $page ) {
								if ( $i === $last ) {
									continue;
								}
								$end = $page['offset'] + $page['size'];
								$this->assertArrayHasKey( $end, $ends, "$case: page $i ends mid-row at $end" );
								$this->assertGreaterThanOrEqual( $min, $page['size'], "$case: page $i holds {$page['size']}, under $min" );
								if ( $page['size'] > $max ) {
									for ( $e = $page['offset'] + $min; $e < $end; $e++ ) {
										$this->assertArrayNotHasKey( $e, $ends, "$case: page $i overshoots the window although a row ends at $e" );
									}
								}
							}
						}
					}
				}
			}
		}
	}

	/** FIL-02, FIL-03 */
	public function test_fill_continues_from_any_start_including_mid_row(): void {
		mt_srand( 12 );
		for ( $t = 0; $t < 300; $t++ ) {
			$total    = mt_rand( 10, 150 );
			$aspects  = self::sequence( $total );
			$geometry = self::geometry( (float) mt_rand( 280, 1600 ), (float) mt_rand( 0, 30 ), (float) mt_rand( 80, 320 ) );
			$start    = mt_rand( 1, $total - 1 );
			$pages    = Page_Cutter::cut( $aspects, $geometry, self::rules(), $start );
			$ends     = self::row_ends( $aspects, $geometry );
			$case     = "n=$total start=$start";

			$this->assert_covers( $pages, $start, $total, $case );
			foreach ( array_slice( $pages, 0, -1 ) as $i => $page ) {
				$end = $page['offset'] + $page['size'];
				$this->assertArrayHasKey( $end, $ends, "$case: page $i ends mid-row at $end" );
			}
		}
	}

	/** FIL-04 */
	public function test_fill_walk_with_the_geometry_changing_before_every_page_covers_everything_once(): void {
		mt_srand( 13 );
		for ( $t = 0; $t < 100; $t++ ) {
			$total   = mt_rand( 20, 200 );
			$aspects = self::sequence( $total );
			$seen    = 0;
			$guard   = 0;
			while ( $seen < $total && $guard++ < 500 ) {
				$geometry = self::geometry( (float) mt_rand( 280, 1600 ), (float) mt_rand( 0, 30 ), (float) mt_rand( 80, 320 ) );
				$pages    = Page_Cutter::cut( $aspects, $geometry, self::rules(), $seen );
				$this->assertNotEmpty( $pages );
				$this->assertSame( $seen, $pages[0]['offset'] );
				$seen += $pages[0]['size'];
			}
			$this->assertSame( $total, $seen );
		}
	}

	/** FIL-05 */
	public function test_page_containing_finds_the_page_of_any_index(): void {
		mt_srand( 14 );
		$aspects  = self::sequence( 97 );
		$geometry = self::geometry( 900 );
		$pages    = Page_Cutter::cut( $aspects, $geometry, self::rules() );
		foreach ( $pages as $i => $page ) {
			for ( $index = $page['offset']; $index < $page['offset'] + $page['size']; $index++ ) {
				$this->assertSame( $i + 1, Page_Cutter::page_containing( $pages, $index ) );
			}
		}
		$this->assertSame( count( $pages ), Page_Cutter::page_containing( $pages, 9999 ) );
		$this->assertSame( 1, Page_Cutter::page_containing( $pages, -3 ) );
	}

	/** FIL-06 */
	public function test_fill_final_page_holds_exactly_the_remainder(): void {
		mt_srand( 15 );
		for ( $t = 0; $t < 200; $t++ ) {
			$total   = mt_rand( 13, 120 );
			$aspects = self::sequence( $total );
			$pages   = Page_Cutter::cut( $aspects, self::geometry( (float) mt_rand( 300, 1600 ) ), self::rules() );
			$last    = end( $pages );
			$this->assertSame( $total, $last['offset'] + $last['size'] );
		}
	}

	/** FIL-07 */
	public function test_a_sequence_within_the_window_is_one_page(): void {
		mt_srand( 16 );
		foreach ( array( 1, 5, 11, 12, 13, 14 ) as $total ) {
			$pages = Page_Cutter::cut( self::sequence( $total ), self::geometry(), self::rules() );
			$this->assertSame( array( array( 'offset' => 0, 'size' => $total ) ), $pages, "n=$total" );
		}
	}

	/** FIL-08 */
	public function test_a_row_longer_than_the_window_is_never_split(): void {
		$aspects  = array_fill( 0, 40, 0.5 );
		$geometry = self::geometry( 1600, 4, 60 );
		$pages    = Page_Cutter::cut( $aspects, $geometry, self::rules( array( 'target' => 6, 'window' => 0 ) ) );
		$ends     = self::row_ends( $aspects, $geometry );
		$this->assert_covers( $pages, 0, 40, 'portraits' );
		foreach ( array_slice( $pages, 0, -1 ) as $page ) {
			$this->assertArrayHasKey( $page['offset'] + $page['size'], $ends );
		}
	}

	/** FIL-09 */
	public function test_degenerate_geometry_still_covers_everything(): void {
		mt_srand( 17 );
		$aspects = self::sequence( 50 );
		foreach ( array( self::geometry( 0 ), self::geometry( 300, 400 ), self::geometry( 1200, 10, 0 ), self::geometry( -5, -5, -5 ) ) as $geometry ) {
			$this->assert_covers( Page_Cutter::cut( $aspects, $geometry, self::rules() ), 0, 50, wp_json_encode_safe( $geometry ) );
		}
	}

	/** FIL-10 */
	public function test_cut_is_deterministic(): void {
		mt_srand( 18 );
		$aspects  = self::sequence( 120 );
		$geometry = self::geometry( 777, 7, 177 );
		$this->assertSame( Page_Cutter::cut( $aspects, $geometry, self::rules() ), Page_Cutter::cut( $aspects, $geometry, self::rules() ) );
	}

	public function test_start_at_or_past_the_end_yields_no_pages(): void {
		$aspects = self::sequence( 20 );
		$this->assertSame( array(), Page_Cutter::cut( $aspects, self::geometry(), self::rules(), 20 ) );
		$this->assertSame( array(), Page_Cutter::cut( $aspects, self::geometry(), self::rules(), 25 ) );
		$this->assertSame( array(), Page_Cutter::cut( array(), self::geometry(), self::rules() ) );
	}

	/** MAT-01 */
	public function test_match_pages_hold_exactly_the_target_at_any_geometry(): void {
		mt_srand( 19 );
		for ( $t = 0; $t < 100; $t++ ) {
			$total  = mt_rand( 1, 150 );
			$target = mt_rand( 1, 30 );
			$pages  = Page_Cutter::cut( self::sequence( $total ), self::geometry( (float) mt_rand( 280, 1600 ) ), self::rules( array( 'mode' => 'match', 'target' => $target ) ) );
			$this->assert_covers( $pages, 0, $total, "n=$total target=$target" );
			foreach ( array_slice( $pages, 0, -1 ) as $page ) {
				$this->assertSame( $target, $page['size'] );
			}
		}
	}

	/** LR-06, CLI-16 */
	public function test_match_with_page_end_hide_ends_pages_before_the_incomplete_row(): void {
		mt_srand( 20 );
		for ( $t = 0; $t < 200; $t++ ) {
			$total    = mt_rand( 20, 150 );
			$aspects  = self::sequence( $total );
			$geometry = self::geometry( (float) mt_rand( 400, 1600 ), 10, (float) mt_rand( 120, 300 ) );
			$pages    = Page_Cutter::cut( $aspects, $geometry, self::rules( array( 'mode' => 'match', 'page_end_hide' => true ) ) );
			$ends     = self::row_ends( $aspects, $geometry );
			$case     = "n=$total";

			$this->assert_covers( $pages, 0, $total, $case );
			foreach ( array_slice( $pages, 0, -1 ) as $i => $page ) {
				$end = $page['offset'] + $page['size'];
				$this->assertLessThanOrEqual( 12, $page['size'], "$case: page $i exceeds the target" );
				$has_row_end = false;
				for ( $e = $page['offset'] + 1; $e <= $page['offset'] + 12; $e++ ) {
					$has_row_end = $has_row_end || isset( $ends[ $e ] );
				}
				if ( $has_row_end ) {
					$this->assertArrayHasKey( $end, $ends, "$case: page $i ends mid-row although a row ends inside it" );
					for ( $e = $end + 1; $e <= $page['offset'] + 12; $e++ ) {
						$this->assertArrayNotHasKey( $e, $ends, "$case: page $i stops before a later row end at $e" );
					}
				} else {
					$this->assertSame( 12, $page['size'], "$case: page $i with no row end inside should hold the target" );
				}
			}
		}
	}

	/** MR-02, MR-03 */
	public function test_max_rows_caps_every_page_in_both_modes(): void {
		mt_srand( 21 );
		foreach ( array( 'fill', 'match' ) as $mode ) {
			foreach ( array( 1, 2, 3 ) as $max_rows ) {
				for ( $t = 0; $t < 60; $t++ ) {
					$total    = mt_rand( 10, 150 );
					$aspects  = self::sequence( $total );
					$geometry = self::geometry( (float) mt_rand( 300, 1600 ), 10, (float) mt_rand( 100, 300 ) );
					$start    = 0 === $t % 3 ? mt_rand( 0, $total - 1 ) : 0;
					$pages    = Page_Cutter::cut( $aspects, $geometry, self::rules( array( 'mode' => $mode, 'max_rows' => $max_rows ) ), $start );
					$row_of   = self::row_of( $aspects, $geometry );
					$case     = "$mode max_rows=$max_rows n=$total start=$start";

					$this->assert_covers( $pages, $start, $total, $case );
					foreach ( $pages as $i => $page ) {
						$rows = $row_of[ $page['offset'] + $page['size'] - 1 ] - $row_of[ $page['offset'] ] + 1;
						$this->assertLessThanOrEqual( $max_rows, $rows, "$case: page $i spans $rows rows" );
					}
				}
			}
		}
	}

	/** MR-03 */
	public function test_max_rows_that_does_not_bind_leaves_pages_unchanged(): void {
		mt_srand( 22 );
		$aspects  = self::sequence( 80, array( 1.5 ) );
		$geometry = self::geometry( 1200 );
		$this->assertSame(
			Page_Cutter::cut( $aspects, $geometry, self::rules() ),
			Page_Cutter::cut( $aspects, $geometry, self::rules( array( 'max_rows' => 50 ) ) )
		);
	}
}

if ( ! function_exists( 'wp_json_encode_safe' ) ) {
	/**
	 * @param mixed $value Value to encode for a failure message.
	 * @return string
	 */
	function wp_json_encode_safe( $value ): string { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- test-only helper.
		return (string) json_encode( $value ); // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- no WordPress in the isolated suite.
	}
}
