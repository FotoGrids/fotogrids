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

define( 'FOTOGRIDS_VERSION', '1.0.0' );
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
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-hover-effects-css.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/licensing/interface-license-provider.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/licensing/class-null-license-provider.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/licensing/class-local-license-provider.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/licensing/class-freemius-license-provider.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/licensing/class-freemius-bootstrap.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/licensing/class-licensing-toasts.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-license-manager.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-collection-defaults.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-admin-helpers.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/functions-helpers.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/ModuleInterface.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/ModuleLoader.php';

\FotoGrids\Licensing\Freemius_Bootstrap::init();

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
    FotoGrids\License_Manager::init();
    FotoGrids\Licensing\Licensing_Toasts::init();

    $module_loader = new \FotoGrids\Modules\ModuleLoader();
    $module_loader->init();

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

/**
 * Add Settings link to plugin action links
 */
add_filter(
    'plugin_action_links_' . plugin_basename(__FILE__),
    function (array $links) {
        $settings_link = '<a href="' . esc_url(
            admin_url('admin.php?page=fotogrids-settings')
        ) . '">' . __('Settings', 'fotogrids') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    }
);

/**
 * Add Pro link after Deactivate in plugin action links
 */
add_filter(
    'plugin_action_links_' . plugin_basename(__FILE__),
    function (array $links) {
        if (fotogrids_has_pro()) {
            return $links;
        }
        $pro_link = '<a href="https://go.fotogrids.com/pro"
            target="_blank"
            style="font-weight:600;color:#3c46f0;">'
            . __('Get FotoGrids Pro', 'fotogrids') .
            '</a>';
        // Insert AFTER Deactivate
        $new_links = [];
        foreach ($links as $link) {
            $new_links[] = $link;
            if (str_contains($link, 'deactivate')) {
                $new_links[] = $pro_link;
            }
        }
        return $new_links;
    },
    20
);

/**
 * Add Help Center link to plugin row meta
 */
add_filter(
    'plugin_row_meta',
    function (array $links, string $file) {
        if ($file !== plugin_basename(__FILE__)) {
            return $links;
        }
        $links[] = '<a href="https://go.fotogrids.com/help"
            target="_blank">'
            . __('Help Center', 'fotogrids') .
            '</a>';
        return $links;
    },
    10,
    2
);
