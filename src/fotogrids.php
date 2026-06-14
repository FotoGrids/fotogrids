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
 * Requires at least: 6.1
 * Tested up to: 7.0
 * Requires PHP: 8.0
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'FOTOGRIDS_VERSION', '1.0.0' );
define( 'FOTOGRIDS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'FOTOGRIDS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'FOTOGRIDS_PLUGIN_FILE', __FILE__ );
define( 'FOTOGRIDS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Hook name catalogue. Every action / filter / JS-event identifier dispatched
// by FotoGrids is declared as a class constant on a small category class
// under one of: includes/hooks/actions/, includes/hooks/filters/,
// includes/hooks/js-events/. Add a new class-<category>.php in the matching
// folder and it loads automatically — no central list to keep in sync.
// See docs/hooks-reference.md for the generated catalogue.
foreach ( [ 'actions', 'filters', 'js-events' ] as $fotogrids_hooks_group ) {
    foreach ( glob( FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/' . $fotogrids_hooks_group . '/class-*.php' ) ?: [] as $fotogrids_hooks_file ) {
        require_once $fotogrids_hooks_file;
    }
}
unset( $fotogrids_hooks_group, $fotogrids_hooks_file );
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-svg.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-activator.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-deactivator.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-uninstaller.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-post-types.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-rest.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-statistics.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/cache/class-object-cache.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/cache/class-metadata-cache.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-fotogrids-cache.php';
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
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-image-size-manager.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/watermark/class-watermark-paths.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/watermark/class-watermark-engine.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/watermark/class-watermark-generator.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/watermark/class-watermark-hooks.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/watermark/class-watermark-render-filter.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/watermark/class-watermark-regenerate-data.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-collection-defaults.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-password-crypto.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-admin-screen.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-settings-localizer.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-debug-log.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-state-resolver.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog-assembler.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-settings-normalizer.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-setting-value-codec.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-plugin-settings-store.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-sharing-settings-store.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-watermark-settings-store.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-seo-settings-store.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-view-settings-store.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/settings/class-edit-gate.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/admin/class-preview-request-validator.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/admin/class-preview-endpoint.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/admin/class-catalog-field-states-endpoint.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/admin/class-catalog-entries-endpoint.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/licensing/class-access-state.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/interface-module.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/interface-lifecycle-module.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/class-abstract-module.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/class-module-registry.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/class-modules-rest.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/interface-tool.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/class-abstract-tool.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/class-tools-registry.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/class-tools-rest.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/assets/class-loading-icon-library.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/assets/class-collection-settings-assets.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/galleries/class-gallery-repository.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/galleries/class-gallery-items.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/galleries/class-embed-store.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/galleries/class-cover-resolver.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/metaboxes/class-metabox-registrar.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/metaboxes/class-item-ajax-endpoints.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/metaboxes/class-collection-save-pipeline.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/exif/class-exif-extractor.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/albums/class-album-repository.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/sanitization/class-code-field.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-permission-check.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-permission-definition.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-permission-registry.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-core-permissions.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-tool-harvester.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-module-harvester.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-grants-store.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-permission-gate.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/permissions/class-permission-options.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'public/render/boot.php';

\FotoGrids\Licensing\Freemius_Bootstrap::init();

register_activation_hook( __FILE__, array( 'FotoGrids\Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'FotoGrids\Deactivator', 'deactivate' ) );
register_uninstall_hook( __FILE__, array( 'FotoGrids\Uninstaller', 'uninstall' ) );

/**
 * Initialize the plugin
 */
function fotogrids_init() {
    // Kept intentionally: WordPress 4.6+ auto-loads textdomains for .org-hosted
    // plugins, but FotoGrids also ships off-.org (Pro/licensing site) where the
    // explicit call still loads translations. Harmless for the .org build.
    // phpcs:ignore PluginCheck.CodeAnalysis.DiscouragedFunctions.load_plugin_textdomainFound
    load_plugin_textdomain(
        'fotogrids',
        false,
        dirname( plugin_basename( __FILE__ ) ) . '/languages'
    );

    FotoGrids\Activator::maybe_upgrade();

    FotoGrids\Post_Types::init();
    FotoGrids\REST::init();
    FotoGrids\Gallery_Album_Relations::init();
    FotoGrids\FotoGrids_Cache::init();
    FotoGrids\License_Manager::init();
    FotoGrids\Licensing\Licensing_Toasts::init();
    FotoGrids\Image_Size_Manager::init();
    FotoGrids\Watermark\Watermark_Hooks::init();

    // Boot the module registry on 'init' (priority 5), not here on
    // 'plugins_loaded'. This is the robust fix for the same-priority load-order
    // fragility between Free and Pro: both plugins attach their
    // 'fotogrids/modules/register' listeners at plugin-file load time, and
    // boot() fires that action once 'init' runs - which is guaranteed to be
    // after every plugin's 'plugins_loaded' callback. Source-derived sorting
    // in the registry then guarantees Free modules init before Pro modules
    // regardless of which plugin registered first.
    add_action( 'init', array( '\FotoGrids\Modules\Module_Registry', 'boot' ), 5 );

    // Boot the Permission_Registry after modules + tools have registered.
    // The registry harvests definitions from both, then fires
    // 'fotogrids/permissions/register' so Pro / third-party can extend.
    // Priority 7 = after modules (5) and tools (registered on
    // 'fotogrids/tools/init' fired below at 'plugins_loaded' time).
    add_action( 'init', array( '\FotoGrids\Permissions\Permission_Registry', 'boot' ), 7 );

    // The modules manifest endpoint (GET /fotogrids/v1/admin/modules) registers
    // its own route on rest_api_init.
    \FotoGrids\Modules\Modules_Rest::init();

    // Module admin assets. enqueue_all() runs on admin_enqueue_scripts at
    // priority 20 - after Admin_Init::enqueue_admin_scripts (priority 10) has
    // registered 'fotogrids-admin' - so module scripts that declare it as a
    // dependency resolve correctly. Each module guards its own screen. Mirrors
    // the Tools_Registry::enqueue_all wiring.
    add_action( 'admin_enqueue_scripts', array( '\FotoGrids\Modules\Module_Registry', 'enqueue_all' ), 20 );

    // Fire the tools registration hook. Free registers at priority 10;
    // Pro and third-party plugins hook in at priority 10 (Pro, runs after Free
    // because Pro loads after plugins_loaded fires for Free) or 20+ (third-party).
    do_action( \FotoGrids\Hooks\Actions_System::TOOLS_INIT );

    // Tool init() methods call register_rest_route(), which must run on rest_api_init.
    // Register at priority 5 so tool routes are in place before other rest_api_init
    // callbacks that might inspect the route table.
    add_action( 'rest_api_init', array( '\FotoGrids\Tools\Tools_Registry', 'init_all' ), 5 );

    // Tool asset enqueueing is separate from REST init - enqueue_all() runs on
    // admin_enqueue_scripts at priority 20, after Admin_Init::enqueue_admin_scripts
    // (priority 10) has already registered 'fotogrids-admin'. This guarantees the
    // dependency declared by each tool script resolves correctly.
    add_action( 'admin_enqueue_scripts', array( '\FotoGrids\Tools\Tools_Registry', 'enqueue_all' ), 20 );

    // Divi 5 native modules must register their dependency-tree hook
    // BEFORE 'init' runs: Divi fires the tree from `et_setup_builder_5` on
    // 'init' priority 0, earlier than Module_Registry::boot() (init:5).
    // We attach those timing-sensitive Divi hooks here, at plugins_loaded.
    // No-ops internally when Divi 5 isn't present.
    require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/PageBuilders/builders/Divi/Module.php';
    \FotoGrids\Modules\PageBuilders\Builders\Divi\Module::boot_early();

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
 * Register built-in Free modules.
 *
 * Runs on 'fotogrids/modules/register' at priority 10 (fired from
 * Module_Registry::boot() on 'init'). Pro modules register at the same
 * priority - source-derived sorting in the registry guarantees Free modules
 * init before Pro regardless of add order. Third-party plugins should use
 * priority 20 or higher.
 */
add_action( \FotoGrids\Hooks\Actions_System::MODULES_REGISTER, function () {
    require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/Metaboxes/Module.php';
    require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/Templates/Module.php';
    require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/ViewCollections/Module.php';
    require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/PageBuilders/Module.php';

    \FotoGrids\Modules\Module_Registry::register( new \FotoGrids\Modules\Metaboxes\Module() );
    \FotoGrids\Modules\Module_Registry::register( new \FotoGrids\Modules\Templates\Module() );
    \FotoGrids\Modules\Module_Registry::register( new \FotoGrids\Modules\ViewCollections\Module() );
    \FotoGrids\Modules\Module_Registry::register( new \FotoGrids\Modules\PageBuilders\Module() );
}, 10 );

/**
 * Register built-in Free tools.
 *
 * Runs on 'fotogrids/tools/init' at priority 10 (fired from fotogrids_init).
 * Pro tools hook in at the same priority (Pro loads after Free so order is
 * guaranteed). Third-party plugins should use priority 20 or higher.
 */
add_action( \FotoGrids\Hooks\Actions_System::TOOLS_INIT, function () {
    require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/regenerate-thumbnails/class-regenerate-thumbnails-tool.php';
    require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-tool.php';
    require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/migration/class-migration-tool.php';

    \FotoGrids\Tools\Tools_Registry::register( new \FotoGrids\Tools\RegenerateThumbnails\Regenerate_Thumbnails_Tool() );
    \FotoGrids\Tools\Tools_Registry::register( new \FotoGrids\Tools\ImportExport\Import_Export_Tool() );
    \FotoGrids\Tools\Tools_Registry::register( new \FotoGrids\Tools\Migration\Migration_Tool() );
}, 10 );

/**
 * Plugin activation check
 */
function fotogrids_activation_check() {
    if ( version_compare( get_bloginfo( 'version' ), '6.1', '<' ) ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die(
            esc_html__( 'FotoGrids requires WordPress version 6.1 or higher.', 'fotogrids' ),
            esc_html__( 'Plugin Activation Error', 'fotogrids' ),
            array( 'back_link' => true )
        );
    }

    if ( version_compare( PHP_VERSION, '8.0', '<' ) ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die(
            esc_html__( 'FotoGrids requires PHP version 8.0 or higher.', 'fotogrids' ),
            esc_html__( 'Plugin Activation Error', 'fotogrids' ),
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
        if (\FotoGrids\License_Manager::has_pro()) {
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
