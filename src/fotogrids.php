<?php
/**
 * Plugin Name: FotoGrids
 * Plugin URI: https://www.fotogrids.com
 * Description: The most robust and beautiful WordPress gallery plugin. Create stunning photo galleries and albums with drag-and-drop ease, modern responsive layouts, powerful lightbox, and detailed analytics. Perfect for photographers, artists, and businesses.
 * Version: 1.0.0
 * Author: FotoGrids
 * Author URI: https://www.fotogrids.com
 * Text Domain: fotogrids
 * Domain Path: /languages
 * Requires at least: 5.8
 * Tested up to: 6.8
 * Requires PHP: 8.0
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Network: false
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'FOTOGRIDS_VERSION', '0.1.0' );
define( 'FOTOGRIDS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'FOTOGRIDS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'FOTOGRIDS_PLUGIN_FILE', __FILE__ );
define( 'FOTOGRIDS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-activator.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-deactivator.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-uninstaller.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-post-types.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-rest.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-statistics.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-gallery-album-relations.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-metadata-manager.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/functions-helpers.php';

register_activation_hook( __FILE__, array( 'FotoGrids\Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'FotoGrids\Deactivator', 'deactivate' ) );
register_uninstall_hook( __FILE__, array( 'FotoGrids\Uninstaller', 'uninstall' ) );

/**
 * Initialize the plugin
 */
function fotogrids_init() {
    load_plugin_textdomain( 
        'fotogrids', 
        false, 
        dirname( plugin_basename( __FILE__ ) ) . '/languages' 
    );

    FotoGrids\Post_Types::init();
    FotoGrids\REST::init();
    FotoGrids\Gallery_Album_Relations::init();
    
    if ( is_admin() ) {
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-admin-init.php';
        FotoGrids\Admin_Init::init();
    }
    
    if ( ! is_admin() || wp_doing_ajax() ) {
        require_once FOTOGRIDS_PLUGIN_DIR . 'public/public-render.php';
        FotoGrids\Public_Render::init();
    }
}

add_action( 'plugins_loaded', 'fotogrids_init' );

/**
 * Plugin activation check
 */
function fotogrids_activation_check() {
    if ( version_compare( get_bloginfo( 'version' ), '5.8', '<' ) ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die( 
            __( 'FotoGrids requires WordPress version 5.8 or higher.', 'fotogrids' ),
            __( 'Plugin Activation Error', 'fotogrids' ),
            array( 'back_link' => true )
        );
    }
    
    if ( version_compare( PHP_VERSION, '8.0', '<' ) ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die( 
            __( 'FotoGrids requires PHP version 8.0 or higher.', 'fotogrids' ),
            __( 'Plugin Activation Error', 'fotogrids' ),
            array( 'back_link' => true )
        );
    }
}
add_action( 'admin_init', 'fotogrids_activation_check' );