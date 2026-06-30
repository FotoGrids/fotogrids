<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @link       https://fotogrids.com
 * @since      1.0.0
 *
 * @package    FotoGrids
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

require_once plugin_dir_path( __FILE__ ) . 'includes/class-uninstaller.php';

FotoGrids\Uninstaller::uninstall();
