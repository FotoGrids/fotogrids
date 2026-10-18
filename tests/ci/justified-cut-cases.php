<?php
/**
 * Prints random justified cut cases with the PHP result for each, as JSON, for
 * check-justified-cut-parity.js to replay against the JS cutter.
 *
 * Usage: php tests/ci/justified-cut-cases.php [count] [seed]
 *
 * @package FotoGrids
 */

define( 'WPINC', 'wp-includes' );
define( 'ABSPATH', __DIR__ . '/' );

$fg_root   = dirname( __DIR__, 2 ) . '/src/public/render/layouts/justified/';
$fg_cutter = $fg_root . 'class-page-cutter.php';
require_once $fg_root . 'class-justified-packer.php';
if ( ! file_exists( $fg_cutter ) ) {
	fwrite( STDERR, "Page_Cutter is not implemented: $fg_cutter\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- CLI output.
	exit( 1 );
}
require_once $fg_cutter;

use FotoGrids\Render\Layouts\Justified\Page_Cutter;

$fg_count = isset( $argv[1] ) ? (int) $argv[1] : 1000;
mt_srand( isset( $argv[2] ) ? (int) $argv[2] : 7 );

$fg_ratios = array( 0.5, 0.66, 0.75, 1.0, 1.33, 1.5, 1.78, 2.4, 0.3333, 3.2, 0.0, -1.0 );
$fg_cases  = array();
for ( $fg_i = 0; $fg_i < $fg_count; $fg_i++ ) {
	$fg_total   = mt_rand( 0, 150 );
	$fg_aspects = array();
	for ( $fg_j = 0; $fg_j < $fg_total; $fg_j++ ) {
		$fg_aspects[] = $fg_ratios[ mt_rand( 0, count( $fg_ratios ) - 1 ) ];
	}
	$fg_geometry = array(
		'width'      => (float) ( 0 === $fg_i % 50 ? 0 : mt_rand( 200, 2000 ) ) + mt_rand( 0, 99 ) / 100,
		'gap'        => (float) mt_rand( 0, 40 ) + ( 0 === $fg_i % 7 ? 0.5 : 0.0 ),
		'row_height' => (float) mt_rand( 40, 600 ),
	);
	$fg_rules    = array(
		'mode'          => 0 === $fg_i % 3 ? 'match' : 'fill',
		'target'        => mt_rand( 1, 40 ),
		'window'        => array( 0, 10, 20, 50 )[ mt_rand( 0, 3 ) ],
		'threshold'     => array( 0, 60, 85, 100 )[ mt_rand( 0, 3 ) ],
		'direction'     => array( 'auto', 'prefer_remove', 'prefer_add' )[ mt_rand( 0, 2 ) ],
		'max_rows'      => 0 === $fg_i % 4 ? mt_rand( 1, 5 ) : 0,
		'page_end_hide' => 0 === $fg_i % 5,
	);
	$fg_start    = 0 === $fg_i % 2 || 0 === $fg_total ? 0 : mt_rand( 0, $fg_total );
	$fg_cases[]  = array(
		'aspects'  => $fg_aspects,
		'geometry' => $fg_geometry,
		'rules'    => $fg_rules,
		'start'    => $fg_start,
		'rows'     => Page_Cutter::pack( $fg_aspects, $fg_geometry['width'], $fg_geometry['gap'], $fg_geometry['row_height'] ),
		'pages'    => Page_Cutter::cut( $fg_aspects, $fg_geometry, $fg_rules, $fg_start ),
	);
}

echo json_encode( $fg_cases ); // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode, WordPress.Security.EscapeOutput.OutputNotEscaped -- CLI JSON output.
