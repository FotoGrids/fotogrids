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

$fotogrids_album_id = isset( $attributes['albumId'] ) ? absint( $attributes['albumId'] ) : 0;
if ( $fotogrids_album_id <= 0 ) {
	return;
}

$fotogrids_wrapper_attributes = function_exists( 'get_block_wrapper_attributes' )
	? get_block_wrapper_attributes()
	: '';

if ( method_exists( '\FotoGrids\Public_Render', 'album_shortcode' ) ) {
	$fotogrids_inner = \FotoGrids\Public_Render::album_shortcode(
		array(
			'id' => $fotogrids_album_id,
		)
	);

	$fotogrids_markup = '' !== $fotogrids_wrapper_attributes
		? '<div ' . $fotogrids_wrapper_attributes . '>' . $fotogrids_inner . '</div>'
		: $fotogrids_inner;
	echo wp_kses( $fotogrids_markup, \FotoGrids\Kses::rules( $fotogrids_markup ) );
}
