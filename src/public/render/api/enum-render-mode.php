<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Supported render execution modes.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
enum Render_Mode: string {
	case INITIAL = 'initial';
	case AJAX    = 'ajax';
}
