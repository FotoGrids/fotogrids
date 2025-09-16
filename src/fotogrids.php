<?php
/**
 * Plugin Name: FotoGrids
 * Plugin URI: https://fotogrids.com
 * Description: FotoGrids gallery plugin — freemium galleries with Pro upgrades. Create beautiful photo galleries and albums with modern templates, lightbox, and statistics.
 * Version: 0.1.0
 * Author: Your Name
 * Author URI: https://fotogrids.com
 * Text Domain: fotogrids
 * Domain Path: /languages
 * Requires at least: 5.8
 * Tested up to: 6.4
 * Requires PHP: 8.0
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Network: false
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Plugin constants
define( 'FOTOGRIDS_VERSION', '0.1.0' );
define( 'FOTOGRIDS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'FOTOGRIDS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'FOTOGRIDS_PLUGIN_FILE', __FILE__ );
define( 'FOTOGRIDS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
// No longer needed - files are in plugin root when built

// Include core classes
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-activator.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-deactivator.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-uninstaller.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-post-types.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-taxonomies.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-rest.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-statistics.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/functions-helpers.php';

// Register activation, deactivation, and uninstall hooks
register_activation_hook( __FILE__, array( 'FotoGrids\Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'FotoGrids\Deactivator', 'deactivate' ) );
register_uninstall_hook( __FILE__, array( 'FotoGrids\Uninstaller', 'uninstall' ) );

/**
 * Initialize the plugin
 */
function fotogrids_init() {
    // Load textdomain
    load_plugin_textdomain( 
        'fotogrids', 
        false, 
        dirname( plugin_basename( __FILE__ ) ) . '/languages' 
    );

    // Initialize core components
    FotoGrids\Post_Types::init();
    FotoGrids\Taxonomies::init();
    FotoGrids\REST::init();
    
    // Initialize admin interface if in admin
    if ( is_admin() ) {
        require_once FOTOGRIDS_PLUGIN_DIR . 'admin/class-admin-init.php';
        FotoGrids\Admin_Init::init();
    }
    
    // Initialize frontend functionality
    if ( ! is_admin() || wp_doing_ajax() ) {
        require_once FOTOGRIDS_PLUGIN_DIR . 'public/public-render.php';
        FotoGrids\Public_Render::init();
    }
}

// Hook into plugins_loaded to ensure WordPress is fully loaded
add_action( 'plugins_loaded', 'fotogrids_init' );

/**
 * Plugin activation check
 */
function fotogrids_activation_check() {
    // Check WordPress version
    if ( version_compare( get_bloginfo( 'version' ), '5.8', '<' ) ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die( 
            __( 'FotoGrids requires WordPress version 5.8 or higher.', 'fotogrids' ),
            __( 'Plugin Activation Error', 'fotogrids' ),
            array( 'back_link' => true )
        );
    }
    
    // Check PHP version
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