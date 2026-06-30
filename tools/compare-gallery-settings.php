<?php
/**
 * TEMP diagnostic - compare two galleries' settings to find a layout bug.
 *
 * Usage (from the WP root):
 *   wp eval-file wp-content/plugins/fotogrids/tools/compare-gallery-settings.php 374 my-whole-portfolio
 *
 * Or set the two identifiers below and run via `wp eval-file`.
 * Identifiers may be a numeric ID or a post slug.
 *
 * Remove this file before release.
 */

if ( ! defined( 'WPINC' ) ) {
	// Allow `wp eval-file` to pass args; fall back to hardcoded if absent.
	$args = isset( $args ) ? $args : array();
}

$ids = array();
if ( ! empty( $argv ) && count( $argv ) >= 2 ) {
	$ids = array_slice( $argv, 1, 2 );
} elseif ( isset( $args ) && count( $args ) >= 2 ) {
	$ids = array_slice( $args, 0, 2 );
} else {
	$ids = array( '374', 'my-whole-portfolio' );
}

/**
 * Resolve an identifier (numeric ID or slug) to a gallery post ID.
 */
function fg_resolve_gallery( $ident ) {
	if ( is_numeric( $ident ) ) {
		return (int) $ident;
	}
	$post = get_page_by_path( $ident, OBJECT, 'fotogrids_gallery' );
	return $post ? (int) $post->ID : 0;
}

$id_a = fg_resolve_gallery( $ids[0] );
$id_b = fg_resolve_gallery( $ids[1] );

if ( ! $id_a || ! $id_b ) {
	echo "Could not resolve one of: {$ids[0]} -> {$id_a}, {$ids[1]} -> {$id_b}\n";
	return;
}

$settings_a = \FotoGrids\Galleries\Gallery_Repository::get_settings( $id_a );
$settings_b = \FotoGrids\Galleries\Gallery_Repository::get_settings( $id_b );

echo "=== GALLERY A (BROKEN): {$ids[0]} (ID {$id_a}) ===\n";
echo "=== GALLERY B (WORKING): {$ids[1]} (ID {$id_b}) ===\n\n";

// Keys most relevant to masonry / caption / item sizing.
$focus = array(
	'layout',
	'columns',
	'columns_mode',
	'item_spacing',
	'layout_item_aspect_ratio',
	'layout_item_aspect_ratio_w',
	'layout_item_aspect_ratio_h',
	'layout_item_object_fit',
	'layout_masonry_order',
	'captions',
	'caption_type',
	'caption_placement',
	'caption_title_source',
	'caption_description_source',
	'caption_hide_title',
	'caption_hide_description',
	'caption_gap',
	'caption_title_font_size',
	'caption_desc_font_size',
	'hover_effect',
	'border_enabled',
	'border_width',
	'shadow_enabled',
	'lazy_load',
	'pagination_type',
	'pagination_method',
	'thumbnail_size',
);

echo "--- FOCUS KEYS (masonry / caption / sizing) ---\n";
printf( "%-32s | %-22s | %-22s | %s\n", 'key', 'A (broken)', 'B (working)', 'DIFF?' );
foreach ( $focus as $k ) {
	$va = isset( $settings_a[ $k ] ) ? $settings_a[ $k ] : '(unset)';
	$vb = isset( $settings_b[ $k ] ) ? $settings_b[ $k ] : '(unset)';
	$sa = is_scalar( $va ) ? (string) $va : wp_json_encode( $va );
	$sb = is_scalar( $vb ) ? (string) $vb : wp_json_encode( $vb );
	$diff = ( $sa !== $sb ) ? '  <<< DIFF' : '';
	printf( "%-32s | %-22s | %-22s |%s\n", $k, substr( $sa, 0, 22 ), substr( $sb, 0, 22 ), $diff );
}

echo "\n--- ALL DIFFERING KEYS (full settings) ---\n";
$all_keys = array_unique( array_merge( array_keys( $settings_a ), array_keys( $settings_b ) ) );
sort( $all_keys );
foreach ( $all_keys as $k ) {
	$va = $settings_a[ $k ] ?? '(unset)';
	$vb = $settings_b[ $k ] ?? '(unset)';
	$sa = is_scalar( $va ) ? (string) $va : wp_json_encode( $va );
	$sb = is_scalar( $vb ) ? (string) $vb : wp_json_encode( $vb );
	if ( $sa !== $sb ) {
		echo "{$k}:\n    A = {$sa}\n    B = {$sb}\n";
	}
}
echo "\n=== END ===\n";
