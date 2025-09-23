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
        require_once $base_path . 'templates/templates-data.php';
        require_once $base_path . 'templates/register-templates-routes.php';
        
        // Images files
        require_once $base_path . 'images/images-data.php';
        require_once $base_path . 'images/register-images-routes.php';
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
        \FotoGrids\REST\Images\Register_Images_Routes::register();
    }
}