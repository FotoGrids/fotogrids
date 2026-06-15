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
 * Requires PHP: 8.1
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

// Hook name catalogue: each action / filter / JS-event identifier is a class
// constant under includes/hooks/{actions,filters,js-events}/, auto-loaded by glob.
foreach ( array( 'actions', 'filters', 'js-events' ) as $fotogrids_hooks_group ) {
	foreach ( glob( FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/' . $fotogrids_hooks_group . '/class-*.php' ) ?: array() as $fotogrids_hooks_file ) {
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
	// Explicit load: FotoGrids also ships off-.org (Pro/licensing site) where the
	// .org auto-loading of translations does not apply.
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

	// Boot on 'init' (not 'plugins_loaded') so it runs after every plugin's
	// 'plugins_loaded' callback; source-derived sorting in the registry then
	// guarantees Free modules init before Pro regardless of registration order.
	add_action( 'init', array( '\FotoGrids\Modules\Module_Registry', 'boot' ), 5 );

	// Priority 7: after modules (5) and tools so the registry can harvest
	// definitions from both before firing 'fotogrids/permissions/register'.
	add_action( 'init', array( '\FotoGrids\Permissions\Permission_Registry', 'boot' ), 7 );

	\FotoGrids\Modules\Modules_Rest::init();

	// Priority 20: after Admin_Init::enqueue_admin_scripts (10) has registered
	// 'fotogrids-admin', so module scripts declaring it as a dependency resolve.
	add_action( 'admin_enqueue_scripts', array( '\FotoGrids\Modules\Module_Registry', 'enqueue_all' ), 20 );

	do_action( \FotoGrids\Hooks\Actions_System::TOOLS_INIT );

	// Priority 5: tool routes in place before other rest_api_init callbacks that
	// might inspect the route table.
	add_action( 'rest_api_init', array( '\FotoGrids\Tools\Tools_Registry', 'init_all' ), 5 );

	// Priority 20: see Module_Registry::enqueue_all above.
	add_action( 'admin_enqueue_scripts', array( '\FotoGrids\Tools\Tools_Registry', 'enqueue_all' ), 20 );

	// Divi 5 fires its dependency tree from `et_setup_builder_5` on 'init'
	// priority 0, earlier than Module_Registry::boot() (init:5), so these
	// timing-sensitive hooks must attach at plugins_loaded. No-ops without Divi 5.
	require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/PageBuilders/builders/Divi/Module.php';
	\FotoGrids\Modules\PageBuilders\Builders\Divi\Module::boot_early();

	if ( is_admin() ) {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-admin-init.php';
		FotoGrids\Admin_Init::init();
	}

	if ( ! is_admin() || wp_doing_ajax() ) {
		require_once FOTOGRIDS_PLUGIN_DIR . 'public/class-public-render.php';
		FotoGrids\Public_Render::init();
	}
}

add_action( 'plugins_loaded', 'fotogrids_init' );

/**
 * Register built-in Free modules.
 *
 * Runs on 'fotogrids/modules/register' at priority 10. Pro registers at the same
 * priority; source-derived sorting guarantees Free inits first. Third-party
 * plugins should use priority 20 or higher.
 */
add_action(
	\FotoGrids\Hooks\Actions_System::MODULES_REGISTER,
	function () {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/Metaboxes/Module.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/Templates/Module.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/ViewCollections/Module.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/PageBuilders/Module.php';

		\FotoGrids\Modules\Module_Registry::register( new \FotoGrids\Modules\Metaboxes\Module() );
		\FotoGrids\Modules\Module_Registry::register( new \FotoGrids\Modules\Templates\Module() );
		\FotoGrids\Modules\Module_Registry::register( new \FotoGrids\Modules\ViewCollections\Module() );
		\FotoGrids\Modules\Module_Registry::register( new \FotoGrids\Modules\PageBuilders\Module() );
	},
	10
);

/**
 * Register built-in Free tools.
 *
 * Runs on 'fotogrids/tools/init' at priority 10. Pro hooks in at the same
 * priority (loads after Free). Third-party plugins should use priority 20+.
 */
add_action(
	\FotoGrids\Hooks\Actions_System::TOOLS_INIT,
	function () {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/regenerate-thumbnails/class-regenerate-thumbnails-tool.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/import-export/class-import-export-tool.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/tools/migration/class-migration-tool.php';

		\FotoGrids\Tools\Tools_Registry::register( new \FotoGrids\Tools\RegenerateThumbnails\Regenerate_Thumbnails_Tool() );
		\FotoGrids\Tools\Tools_Registry::register( new \FotoGrids\Tools\ImportExport\Import_Export_Tool() );
		\FotoGrids\Tools\Tools_Registry::register( new \FotoGrids\Tools\Migration\Migration_Tool() );
	},
	10
);

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

	if ( version_compare( PHP_VERSION, '8.1', '<' ) ) {
		deactivate_plugins( plugin_basename( __FILE__ ) );
		wp_die(
			esc_html__( 'FotoGrids requires PHP version 8.1 or higher.', 'fotogrids' ),
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
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( array $links ) {
		$settings_link = '<a href="' . esc_url(
			admin_url( 'admin.php?page=fotogrids-settings' )
		) . '">' . __( 'Settings', 'fotogrids' ) . '</a>';
		array_unshift( $links, $settings_link );
		return $links;
	}
);

/**
 * Add Pro link after Deactivate in plugin action links
 */
add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( array $links ) {
		if ( \FotoGrids\License_Manager::has_pro() ) {
			return $links;
		}
		$pro_link  = '<a href="https://go.fotogrids.com/pro"
            target="_blank"
            style="font-weight:600;color:#3c46f0;">'
			. __( 'Get FotoGrids Pro', 'fotogrids' ) .
			'</a>';
		$new_links = array();
		foreach ( $links as $link ) {
			$new_links[] = $link;
			if ( str_contains( $link, 'deactivate' ) ) {
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
	function ( array $links, string $file ) {
		if ( plugin_basename( __FILE__ ) !== $file ) {
			return $links;
		}
		$links[] = '<a href="https://go.fotogrids.com/help"
            target="_blank">'
			. __( 'Help Center', 'fotogrids' ) .
			'</a>';
		return $links;
	},
	10,
	2
);
