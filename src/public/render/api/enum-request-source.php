<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Supported render request sources.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
enum Request_Source: string {
	case SHORTCODE        = 'shortcode';
	case BLOCK            = 'block';
	case ELEMENTOR        = 'elementor';
	case DIVI             = 'divi';
	case PREVIEW_SAVED    = 'preview_saved';
	case PREVIEW_UNSAVED  = 'preview_unsaved';
	case ALBUM_AJAX       = 'album_ajax';
	case TEMPLATE_PREVIEW = 'template_preview';
}
