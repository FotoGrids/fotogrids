<?php
/**
 * Front-end render for the FotoGrids Gallery Gutenberg block.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Gutenberg
 * @since   1.0.0
 *
 * @var array              $attributes Block attributes, populated by WordPress.
 * @var string             $content    Inner block content (unused; the block has no inner blocks).
 * @var WP_Block|null      $block      The WP_Block instance.
 */

if ( ! defined( 'WPINC' ) ) {
	die;
}

// This is a WordPress block render template, include()d by the block renderer.
// The variables below are file-scoped locals for this template (not plugin
// globals); the sniff flags them only because a template's top level is
// technically global scope.
// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound

$gallery_id = isset( $attributes['galleryId'] ) ? absint( $attributes['galleryId'] ) : 0;
if ( $gallery_id <= 0 ) {
	return; // Unconfigured block - emit nothing on the front end.
}

$wrapper_attributes = function_exists( 'get_block_wrapper_attributes' )
	? get_block_wrapper_attributes()
	: '';

// Defer to the existing shortcode renderer so the public-page pipeline
// stays a single code path. _source = BLOCK tells the renderer this is
// a block-host render (used by Request_Source-aware modules).
if ( method_exists( '\FotoGrids\Public_Render', 'gallery_shortcode' ) ) {
	$inner = \FotoGrids\Public_Render::gallery_shortcode(
		array(
			'id'      => $gallery_id,
			'_source' => 'block',
		)
	);

	if ( '' !== $wrapper_attributes ) {
		printf( '<div %s>%s</div>', $wrapper_attributes, $inner ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	} else {
		echo $inner; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
