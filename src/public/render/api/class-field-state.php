<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Supported edit-time field states.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
enum Field_State: string {
	case TEASER   = 'teaser';
	case LOCKED   = 'locked';
	case EDITABLE = 'editable';
}
