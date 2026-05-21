<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * REST API Class
 *
 * Handles all REST API endpoints for FotoGrids
 *
 * @since 1.0.0
 */
class REST {

    /**
     * Initialize the REST API class
     *
     * Loads all REST API component files and registers routes.
     *
     * @since 1.0.0
     * @return void
     */
    public static function init() {
        self::load_files();
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    /**
     * Load all REST API component files
     *
     * Includes all the modular REST API files.
     *
     * @since 1.0.0
     * @return void
     */
    private static function load_files() {
        $base_path = FOTOGRIDS_PLUGIN_DIR . 'includes/rest/';

        // Gallery files
        require_once $base_path . 'gallery/gallery-permissions.php';
        require_once $base_path . 'gallery/gallery-data.php';
        require_once $base_path . 'gallery/register-gallery-routes.php';

        // Album files
        require_once $base_path . 'album/album-permissions.php';
        require_once $base_path . 'album/album-data.php';
        require_once $base_path . 'album/register-album-routes.php';

        // Statistics files
        require_once $base_path . 'stats/stats-permissions.php';
        require_once $base_path . 'stats/stats-data.php';
        require_once $base_path . 'stats/register-stats-routes.php';

        // Templates files
        require_once $base_path . 'templates/templates-permissions.php';
        require_once $base_path . 'templates/templates-data.php';
        require_once $base_path . 'templates/register-templates-routes.php';

        // Items files
        require_once $base_path . 'items/items-permissions.php';
        require_once $base_path . 'items/items-data.php';
        require_once $base_path . 'items/embed-data.php';
        require_once $base_path . 'items/save-item-data.php';
        require_once $base_path . 'items/register-items-routes.php';

        // Metadata files
        require_once $base_path . 'metadata/metadata-permissions.php';
        require_once $base_path . 'metadata/metadata-data.php';
        require_once $base_path . 'metadata/register-metadata-routes.php';
        require_once $base_path . 'metadata/library-data.php';
        require_once $base_path . 'metadata/register-library-routes.php';

        // Lightbox files
        require_once $base_path . 'lightbox/lightbox-permissions.php';
        require_once $base_path . 'lightbox/lightbox-data.php';
        require_once $base_path . 'lightbox/register-lightbox-routes.php';

        // Admin files
        require_once $base_path . 'admin/admin-permissions.php';
        require_once $base_path . 'admin/admin-data.php';
        require_once $base_path . 'admin/register-admin-routes.php';
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog-rest-endpoint.php';

        // Tools infrastructure files are loaded in fotogrids.php (required before REST::init).
        // Tools_Rest only registers the manifest route; individual tool routes are
        // registered by each tool's init() method via Tools_Registry::init_all().
    }

    /**
     * Register all REST API routes
     *
     * Calls the register method on all route registration classes.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register_routes() {
        \FotoGrids\REST\Gallery\Register_Gallery_Routes::register();
        \FotoGrids\REST\Album\Register_Album_Routes::register();
        \FotoGrids\REST\Stats\Register_Stats_Routes::register();
        \FotoGrids\REST\Templates\Register_Templates_Routes::register();
        \FotoGrids\REST\Items\Register_Items_Routes::register();
        \FotoGrids\REST\Metadata\Register_Metadata_Routes::register();
        \FotoGrids\REST\Metadata\Register_Library_Routes::register();
        \FotoGrids\REST\Lightbox\Register_Lightbox_Routes::register();
        \FotoGrids\REST\Admin\Register_Admin_Routes::register();
        \FotoGrids\Tools\Tools_Rest::register_routes();
    }
}
