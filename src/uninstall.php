<?php
/**
 * Uninstall entry point.
 *
 * @package FotoGrids
 * @since   1.1.5
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

require_once __DIR__ . '/fotogrids.php';

\FotoGrids\Uninstaller::uninstall();
