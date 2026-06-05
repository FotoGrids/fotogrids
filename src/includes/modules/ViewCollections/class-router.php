<?php
/**
 * View page routing: makes the collection CPTs public and serves the shell.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections;

use FotoGrids\Hooks\Filters_View;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Routes public view page requests.
 *
 * Flips fotogrids_gallery / fotogrids_album to publicly_queryable at
 * registration via register_post_type_args, then serves a standalone shell
 * template through template_include. WordPress owns URL resolution, permalinks,
 * old-slug redirects and sitemap eligibility; the shell template owns the
 * rendered document.
 *
 * @since 1.0.0
 */
class Router {

    /**
     * Post types that get a public view page.
     *
     * @var string[]
     */
    private const POST_TYPES = array( 'fotogrids_gallery', 'fotogrids_album' );

    /**
     * The collection resolved for the current view page request.
     *
     * @var \WP_Post|null
     */
    private static $current_post = null;

    /**
     * Rewrite rules version. Bump when the rewrite base or query handling
     * changes so the version-gated flush regenerates rules without requiring
     * the user to reactivate the plugin or visit the Permalinks screen.
     *
     * @var string
     */
    private const REWRITE_VERSION = '1';

    /**
     * Option key storing the flushed rewrite version.
     *
     * @var string
     */
    private const REWRITE_VERSION_OPTION = 'fotogrids_view_rewrite_version';

    /**
     * Register routing hooks.
     *
     * @since 1.0.0
     * @return void
     */
    public static function init(): void {
        add_filter( 'register_post_type_args', array( __CLASS__, 'filter_cpt_args' ), 10, 2 );
        add_filter( 'template_include', array( __CLASS__, 'route' ), 99 );
        add_action( 'init', array( __CLASS__, 'maybe_flush_rewrite_rules' ), 100 );
    }

    /**
     * Flush rewrite rules once after the rewrite version changes.
     *
     * Runs late on init, after the CPTs are registered with their public
     * rewrite base, so an update that introduces or changes the view routes
     * regenerates rules on the next page load without user intervention.
     *
     * @since 1.0.0
     * @return void
     */
    public static function maybe_flush_rewrite_rules(): void {
        if ( get_option( self::REWRITE_VERSION_OPTION ) === self::REWRITE_VERSION ) {
            return;
        }

        self::stamp_rewrite_flush();
    }

    /**
     * Flush rewrite rules and record the current rewrite version.
     *
     * @since 1.0.0
     * @return void
     */
    public static function stamp_rewrite_flush(): void {
        flush_rewrite_rules();
        update_option( self::REWRITE_VERSION_OPTION, self::REWRITE_VERSION );
    }

    /**
     * Clear the recorded rewrite version so the next load re-flushes.
     *
     * @since 1.0.0
     * @return void
     */
    public static function clear_rewrite_flush(): void {
        delete_option( self::REWRITE_VERSION_OPTION );
    }

    /**
     * Make the collection CPTs publicly queryable with a clean rewrite base.
     *
     * @since 1.0.0
     * @param array  $args      Post type registration args.
     * @param string $post_type Post type key.
     * @return array
     */
    public static function filter_cpt_args( array $args, string $post_type ): array {
        if ( ! in_array( $post_type, self::POST_TYPES, true ) ) {
            return $args;
        }

        $args['public']              = true;
        $args['publicly_queryable']  = true;
        $args['exclude_from_search'] = true;
        $args['show_in_nav_menus']   = false;
        $args['show_in_menu']        = false;
        // show_in_admin_bar defaults to show_in_menu; set it true so the
        // editor and front-end admin bar render the native View link.
        $args['show_in_admin_bar']   = true;
        $args['has_archive']         = false;
        $args['rewrite']             = array(
            'slug'       => self::base_slug( $post_type ),
            'with_front' => false,
        );

        // The admin bar "New" dropdown uses name_admin_bar; brand it so it is
        // distinguishable from other gallery plugins' entries.
        $args['labels']['name_admin_bar'] = $post_type === 'fotogrids_album'
            ? __( 'FotoGrids Album', 'fotogrids' )
            : __( 'FotoGrids Gallery', 'fotogrids' );

        /**
         * Filter the registration args for a collection view page CPT.
         *
         * @since 1.0.0
         * @param array  $args
         * @param string $post_type
         */
        return apply_filters( Filters_View::CPT_ARGS, $args, $post_type );
    }

    /**
     * Rewrite base for a collection type, e.g. 'fotogrids/gallery'.
     *
     * @since 1.0.0
     * @param string $post_type Post type key.
     * @return string
     */
    public static function base_slug( string $post_type ): string {
        $slug = $post_type === 'fotogrids_album' ? 'fotogrids/album' : 'fotogrids/gallery';

        /**
         * Filter the rewrite base for a collection view page.
         *
         * @since 1.0.0
         * @param string $slug
         * @param string $post_type
         */
        return (string) apply_filters( Filters_View::BASE_SLUG, $slug, $post_type );
    }

    /**
     * Route a collection view request to either the standalone shell or the
     * active theme (Integrated mode).
     *
     * Resolution order:
     *   1. Bail unless this is a singular request for one of our CPTs.
     *   2. Bail unless the post is published, or the current user can edit it
     *      (the latter enables draft preview for editors).
     *   3. Stash the resolved post on the Router so SEO_Conflict_Guard and
     *      Integrated_Renderer can pick it up regardless of mode.
     *   4. Honour the `fotogrids/view/pre_render` short-circuit (used by Pro
     *      for password forms / expiry screens). Returns the filter path
     *      regardless of mode.
     *   5. In Integrated mode, return the WordPress-resolved template (the
     *      active theme owns rendering; Integrated_Renderer injects the
     *      gallery via the_content).
     *   6. In Standalone mode, return the theme override `fotogrids/single-*.php`
     *      if present, else the standalone shell.
     *
     * @since 1.0.0
     * @param string $template Template path WordPress resolved.
     * @return string
     */
    public static function route( string $template ): string {
        if ( ! is_singular( self::POST_TYPES ) ) {
            return $template;
        }

        $post = get_queried_object();
        if ( ! $post instanceof \WP_Post ) {
            return $template;
        }

        if ( $post->post_status !== 'publish' && ! current_user_can( 'edit_post', $post->ID ) ) {
            return $template;
        }

        /**
         * Short-circuit before the shell renders.
         *
         * Returning a template path here wins (Pro uses this for password
         * forms and expiry screens). Returning null falls through to either
         * the Integrated mode theme template or the standalone shell.
         *
         * @since 1.0.0
         * @param string|null $pre
         * @param \WP_Post    $post
         */
        $pre = apply_filters( Filters_View::PRE_RENDER, null, $post );
        if ( is_string( $pre ) && $pre !== '' ) {
            self::$current_post = $post;
            return $pre;
        }

        // Always stash the post: Integrated_Renderer and SEO_Conflict_Guard
        // both key off Router::current_post() regardless of mode.
        self::$current_post = $post;

        $settings    = \FotoGrids\Settings\View_Settings_Store::get();
        $layout_mode = isset( $settings['layout_mode'] ) ? (string) $settings['layout_mode'] : 'integrated';

        /**
         * Filter the resolved view-page layout mode for this request.
         *
         * Pro and 3rd-party code can override the site-wide mode per request
         * (e.g. force standalone for a specific collection, or vice versa).
         *
         * @since 1.0.0
         * @param string   $layout_mode 'integrated' | 'standalone'
         * @param \WP_Post $post
         */
        $layout_mode = (string) apply_filters( Filters_View::LAYOUT_MODE, $layout_mode, $post );

        if ( $layout_mode === 'integrated' ) {
            // Theme owns the document. Integrated_Renderer's hooks contribute
            // the title, head meta, body classes, asset enqueues, stats, and
            // the gallery markup itself (via the_content).
            return $template;
        }

        $override = locate_template(
            array(
                'fotogrids/single-' . $post->post_type . '.php',
                'fotogrids/single.php',
            )
        );
        if ( $override ) {
            return $override;
        }

        /**
         * Filter the shell template path.
         *
         * @since 1.0.0
         * @param string   $path
         * @param \WP_Post $post
         */
        return apply_filters(
            Filters_View::TEMPLATE,
            FOTOGRIDS_PLUGIN_DIR . 'includes/modules/ViewCollections/templates/view-collection.php',
            $post
        );
    }

    /**
     * The collection resolved for the current view page request.
     *
     * @since 1.0.0
     * @return \WP_Post|null
     */
    public static function current_post(): ?\WP_Post {
        return self::$current_post;
    }
}
