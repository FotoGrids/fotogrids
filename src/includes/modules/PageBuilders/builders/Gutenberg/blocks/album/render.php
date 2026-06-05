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
