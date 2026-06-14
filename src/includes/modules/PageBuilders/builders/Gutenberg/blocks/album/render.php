<?php
/**
 * Front-end render for the FotoGrids Album Gutenberg block.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Gutenberg
 * @since   1.0.0
 *
 * @var array         $attributes
 * @var string        $content
 * @var WP_Block|null $block
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

// This is a WordPress block render template, include()d by the block renderer.
// The variables below are file-scoped locals for this template (not plugin
// globals); the sniff flags them only because a template's top level is
// technically global scope.
// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound

$album_id = isset( $attributes['albumId'] ) ? absint( $attributes['albumId'] ) : 0;
if ( $album_id <= 0 ) {
    return;
}

$wrapper_attributes = function_exists( 'get_block_wrapper_attributes' )
    ? get_block_wrapper_attributes()
    : '';

if ( method_exists( '\FotoGrids\Public_Render', 'album_shortcode' ) ) {
    $inner = \FotoGrids\Public_Render::album_shortcode( [
        'id' => $album_id,
    ] );

    if ( $wrapper_attributes !== '' ) {
        printf( '<div %s>%s</div>', $wrapper_attributes, $inner ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    } else {
        echo $inner; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}
// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
