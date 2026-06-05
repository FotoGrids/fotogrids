<?php
/**
 * View Collections module.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections;

use FotoGrids\Hooks\Filters_View;
use FotoGrids\Modules\Abstract_Module;
use FotoGrids\Modules\Lifecycle_Module_Interface;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Public shareable view pages for galleries and albums.
 *
 * Self-contained Free module: it makes the collection CPTs publicly queryable
 * via the register_post_type_args filter, serves a standalone shell through
 * template_include, and owns its own REST resource, admin panel and assets.
 * Pro extends every region through the fotogrids/view/* hooks rather than
 * replacing this module.
 *
 * @since 1.0.0
 */
class Module extends Abstract_Module implements Lifecycle_Module_Interface {

    public function get_id(): string {
        return 'view-collections';
    }

    public function get_name(): string {
        return __( 'View Collections', 'fotogrids' );
    }

    public function get_description(): string {
        return __( 'Public shareable view pages for galleries and albums.', 'fotogrids' );
    }

    /**
     * Active unless disabled by filter.
     *
     * @since 1.0.0
     * @return bool
     */
    public function is_active(): bool {
        /**
         * Master switch for the view pages feature.
         *
         * @since 1.0.0
         * @param bool $enabled
         */
        return (bool) apply_filters( Filters_View::ENABLED, true );
    }

    /**
     * Boot routing (frontend + rest), admin surface and REST routes.
     *
     * @since 1.0.0
     * @return void
     */
    public function init(): void {
        require_once __DIR__ . '/class-settings.php';
        require_once __DIR__ . '/class-router.php';
        require_once __DIR__ . '/class-renderer.php';
        require_once __DIR__ . '/class-integrated-renderer.php';
        require_once __DIR__ . '/class-seo-conflict-guard.php';

        Router::init();
        Integrated_Renderer::init();
        SEO_Conflict_Guard::init();

        add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
    }

    /**
     * Register the view collections REST routes.
     *
     * @since 1.0.0
     * @return void
     */
    public function register_rest_routes(): void {
        require_once __DIR__ . '/rest/view-collections-permissions.php';
        require_once __DIR__ . '/rest/view-collections-data.php';
        require_once __DIR__ . '/rest/register-view-collections-routes.php';

        REST\Register_View_Collections_Routes::register();
    }

    /**
     * Flush rewrite rules so the new view page routes resolve.
     *
     * The CPTs are registered with the new public rewrite base during this
     * request before the flush runs.
     *
     * @since 1.0.0
     * @return void
     */
    public function on_activate(): void {
        require_once __DIR__ . '/class-router.php';

        add_filter( 'register_post_type_args', array( Router::class, 'filter_cpt_args' ), 10, 2 );

        if ( class_exists( '\FotoGrids\Post_Types' ) ) {
            \FotoGrids\Post_Types::register_cpts();
        }

        Router::stamp_rewrite_flush();
    }

    /**
     * Drop the view page routes on deactivation.
     *
     * Clears the rewrite version stamp so the next activation regenerates the
     * rules from a clean state.
     *
     * @since 1.0.0
     * @return void
     */
    public function on_deactivate(): void {
        Router::clear_rewrite_flush();
        flush_rewrite_rules();
    }

    /**
     * No persistent state to remove on uninstall.
     *
     * @since 1.0.0
     * @return void
     */
    public function on_uninstall(): void {
    }
}
