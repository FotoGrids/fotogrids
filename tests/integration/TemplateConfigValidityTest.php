<?php
/**
 * Template config validity guard.
 *
 * Asserts that every predefined free template's settings reference only real
 * keys (members of the gallery/album default schema) and acceptable values for
 * the enum-constrained keys, and that pro templates carry no settings block.
 *
 * WordPress-independent: the valid key set is extracted by static parsing of
 * class-collection-defaults.php (no WP bootstrap, matching the isolated suite).
 *
 * @package FotoGrids\Tests
 * @since   1.1.0
 */

declare(strict_types=1);

$plugin_root   = dirname( __DIR__, 2 );
$defaults_file = $plugin_root . '/src/includes/class-collection-defaults.php';
$templates_dir = $plugin_root . '/src/includes/rest/templates/templates';

$failures = array();

/**
 * Extract the top-level key set from a get_*_defaults() method body.
 *
 * @param string $src       File source.
 * @param string $fn_name   Method name.
 * @return array<int,string>
 */
$extract_block = static function ( string $src, string $fn_name ): array {
	if ( ! preg_match( '/function\s+' . preg_quote( $fn_name, '/' ) . '\b/', $src, $m, PREG_OFFSET_CAPTURE ) ) {
		return array();
	}
	$start = strpos( $src, 'array(', $m[0][1] );
	if ( false === $start ) {
		return array();
	}
	$depth = 0;
	$end   = $start;
	for ( $i = $start, $len = strlen( $src ); $i < $len; $i++ ) {
		if ( '(' === $src[ $i ] ) {
			$depth++;
		} elseif ( ')' === $src[ $i ] ) {
			$depth--;
			if ( 0 === $depth ) {
				$end = $i;
				break;
			}
		}
	}
	$block = substr( $src, $start, $end - $start );
	$keys  = array();
	$d     = 0;
	preg_match_all( "/\\(|\\)|'([a-zA-Z0-9_\\/]+)'\\s*=>/", $block, $tokens, PREG_SET_ORDER );
	foreach ( $tokens as $tok ) {
		if ( '(' === $tok[0] ) {
			$d++;
		} elseif ( ')' === $tok[0] ) {
			$d--;
		} elseif ( 1 === $d && isset( $tok[1] ) ) {
			$keys[] = $tok[1];
		}
	}
	return $keys;
};

if ( ! file_exists( $defaults_file ) ) {
	echo "ERROR: defaults file not found: {$defaults_file}\n";
	exit( 1 );
}

$src        = file_get_contents( $defaults_file );
$base_keys  = $extract_block( $src, 'get_base_defaults' );
$gal_keys   = array_values( array_unique( array_merge( $base_keys, $extract_block( $src, 'get_gallery_defaults' ) ) ) );
$alb_keys   = array_values( array_unique( array_merge( $base_keys, $extract_block( $src, 'get_album_defaults' ) ) ) );
$valid_keys = array(
	'gallery' => array_flip( $gal_keys ),
	'album'   => array_flip( $alb_keys ),
);

// Enum constraints for value-level validation. Keys absent here are key-checked only.
$enums = array(
	'layout'                => array( 'grid', 'masonry', 'justified', 'slider', 'single-item', 'instant-photos' ),
	'caption_placement'     => array( 'overlay', 'top', 'bottom' ),
	'default_sort_order'    => array( 'manual', 'date', 'title', 'filename', 'random' ),
	'date_sort_direction'   => array( 'asc', 'desc' ),
	'item_click_behavior'   => array( 'lightbox', 'none', 'nothing', 'direct_link', 'external_link', 'view_page' ),
	'hover_effect'          => array(
		'none',
		'zoom',
		'pan',
		'blur-focus',
		'grayscale',
		'tint',
		'lift',
		'frame',
		'tilt',
		'caption-fade',
		'caption-rise',
		'caption-slide',
		'caption-split',
		'spotlight',
	),
);

foreach ( array( 'gallery', 'album' ) as $cat ) {
	foreach ( glob( "{$templates_dir}/{$cat}/*.json" ) as $file ) {
		$name = basename( $file );
		$data = json_decode( file_get_contents( $file ), true );

		if ( null === $data || JSON_ERROR_NONE !== json_last_error() ) {
			$failures[] = "{$name}: invalid JSON";
			continue;
		}

		$type = $data['type'] ?? '';

		if ( 'pro' === $type ) {
			if ( isset( $data['settings'] ) ) {
				$failures[] = "{$name}: pro template must not carry a settings block";
			}
			continue;
		}

		$settings = $data['settings'] ?? array();
		foreach ( $settings as $key => $value ) {
			if ( ! isset( $valid_keys[ $cat ][ $key ] ) ) {
				$failures[] = "{$name}: unknown setting key '{$key}'";
				continue;
			}
			if ( isset( $enums[ $key ] ) && is_string( $value ) && ! in_array( $value, $enums[ $key ], true ) ) {
				$allowed    = implode( ', ', $enums[ $key ] );
				$failures[] = "{$name}: '{$key}' has invalid value '{$value}' (allowed: {$allowed})";
			}
		}
	}
}

if ( empty( $failures ) ) {
	echo "OK: all template configs valid.\n";
	exit( 0 );
}

echo "FAIL: template config validity\n";
foreach ( $failures as $f ) {
	echo "  - {$f}\n";
}
exit( 1 );
