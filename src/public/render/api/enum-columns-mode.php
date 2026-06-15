<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Column mode values used by layout modules.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
enum Columns_Mode: string {
	case FIXED = 'fixed';
	case AUTO  = 'auto';
}
