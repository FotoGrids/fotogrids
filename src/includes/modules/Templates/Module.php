<?php
namespace FotoGrids\Modules\Templates;

use FotoGrids\Hooks\Filters_Templates;
use FotoGrids\Modules\Abstract_Module;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Templates Module
 *
 * Fully self-contained Free templates feature. The module owns:
 *   - REST routes        (FotoGrids\REST\Templates\Register_Templates_Routes)
 *   - the editor metabox (register + render + localize + assets)
 *   - the admin page     (render container + assets; menu stays in Admin_Init)
 *   - its own assets      (co-located under assets/, built by module-* webpack
 *                          entries into assets/templates-metabox.{js,css} and
 *                          assets/templates-page.{js,css})
 *
 * Pattern C (Free shell + Pro engine): the Free shell renders everything,
 * including the Save-as-Template slot. Pro supplies the save engine via the
 * fotogrids/templates/save_as_template_button filter, returning a JS component
 * id registered on window.fotogridsProComponents before the metabox renders.
 *
 * @since 1.0.0
 */
class Module extends Abstract_Module {

    /**
     * Admin page hook suffix for the Templates page. Used to scope enqueues.
     *
     * @var string
     */
    private const PAGE_HOOK = 'fotogrids_page_fotogrids-templates';

    public function get_id(): string {
        return 'templates';
    }

    public function get_name(): string {
        return __( 'Templates', 'fotogrids' );
    }

    public function get_description(): string {
        return __( 'Apply ready-made designs to galleries and albums.', 'fotogrids' );
    }

    /**
     * Admin (metabox + page) and REST (route registration). Never frontend.
     */
    public function get_contexts(): array {
        return [ 'admin', 'rest' ];
    }

    /**
     * Wire up REST routes and the editor metabox. Asset enqueueing is handled
     * centrally by Module_Registry::enqueue_all() -> enqueue_assets().
     */
    public function init(): void {
        // REST routes self-register on rest_api_init so module boot timing is
        // decoupled from REST timing.
        add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );

        // Editor metabox for both galleries and albums.
        add_action( 'add_meta_boxes', [ $this, 'register_metabox' ] );
    }

    // -------------------------------------------------------------------------
    // REST
    // -------------------------------------------------------------------------

    /**
     * Register the templates REST routes.
     *
     * @since 1.0.0
     * @return void
     */
    public function register_rest_routes(): void {
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/templates/templates-permissions.php';
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/templates/templates-data.php';
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/templates/register-templates-routes.php';

        \FotoGrids\REST\Templates\Register_Templates_Routes::register();
    }

    // -------------------------------------------------------------------------
    // Metabox
    // -------------------------------------------------------------------------

    /**
     * Register the Templates metabox on both CPTs.
     *
     * @since 1.0.0
     * @return void
     */
    public function register_metabox(): void {
        global $post;

        foreach ( [ 'fotogrids_gallery', 'fotogrids_album' ] as $post_type ) {
            // Templates are settings (applying overrides every setting). Same
            // visibility rule as the Collection Settings metabox.
            $settings_cap = \FotoGrids\Permissions\Permission_Gate::settings_cap_for( $post_type );
            $post_id      = ( $post instanceof \WP_Post && $post->post_type === $post_type ) ? (int) $post->ID : 0;
            $can_settings = $settings_cap === null
                || ( $post_id > 0
                    ? \FotoGrids\Permissions\Permission_Check::can( $settings_cap, $post_id )
                    : \FotoGrids\Permissions\Permission_Check::can( $settings_cap ) );

            if ( ! $can_settings && \FotoGrids\Permissions\Permission_Options::get_unauthorised_visibility() === 'hidden' ) {
                continue;
            }

            add_meta_box(
                $post_type . '_templates',
                __( 'Templates', 'fotogrids' ),
                [ $this, 'render_metabox' ],
                $post_type,
                'side',
                'default'
            );
        }
    }

    /**
     * Render the Templates metabox container and localize its data.
     *
     * @since 1.0.0
     * @param \WP_Post $post The post being edited.
     * @return void
     */
    public function render_metabox( $post ): void {
        $post_type = $post->post_type === 'fotogrids_gallery' ? 'gallery' : 'album';

        /**
         * Save-as-Template button component id. Pro returns its component id
         * here; Free leaves it null and the shell renders the upgrade CTA.
         *
         * @since 1.0.0
         * @param string|null $component_id
         * @param \WP_Post    $post
         */
        $save_as_template_button = apply_filters(
            Filters_Templates::SAVE_AS_TEMPLATE_BUTTON,
            null,
            $post
        );

        $settings_cap       = \FotoGrids\Permissions\Permission_Gate::settings_cap_for( $post->post_type );
        $editable           = $settings_cap === null
            || \FotoGrids\Permissions\Permission_Check::can( $settings_cap, (int) $post->ID );

        wp_localize_script(
            'fotogrids-module-templates-metabox',
            'fotogridsTemplatesMetabox',
            [
                'postId'               => $post->ID,
                'postType'             => $post_type,
                'isPro'                => \FotoGrids\License_Manager::has_pro(),
                'nonce'                => wp_create_nonce( 'wp_rest' ),
                'restUrl'              => 'fotogrids/v1/',
                'templatesUrl'         => admin_url( 'admin.php?page=fotogrids-templates' ),
                'saveAsTemplateButton' => $save_as_template_button,
                'editable'             => $editable,
                'unauthorisedNotice'   => __( 'You\'re viewing templates in read-only mode. Ask a site administrator if a different template should be applied.', 'fotogrids' ),
                'strings'              => $this->metabox_strings(),
            ]
        );
        ?>
        <div id="fotogrids-templates-metabox"></div>
        <?php
    }

    // -------------------------------------------------------------------------
    // Admin page
    // -------------------------------------------------------------------------

    /**
     * Render the Templates admin page container. The menu item is registered
     * by Admin_Init; this emits the React mount point and the same page chrome
     * (header + container class) the shared admin renderer used, so appearance
     * and any styles targeting .fotogrids-admin-page are preserved.
     *
     * @since 1.0.0
     * @return void
     */
    public function render_page(): void {
        ?>
        <div class="wrap">
            <div class="fotogrids-page-header">
                <h1 class="fotogrids-heading-inline">
                    <?php echo esc_html( get_admin_page_title() ); ?>
                </h1>
            </div>
            <div id="fotogrids-templates-page" class="fotogrids-admin-page">
                <!-- Templates React page mounts here (module page bundle). -->
            </div>
        </div>
        <?php
    }

    // -------------------------------------------------------------------------
    // Assets
    // -------------------------------------------------------------------------

    /**
     * Enqueue the module's metabox and page assets, each guarded to its screen.
     *
     * @since 1.0.0
     * @param string $hook Current admin page hook suffix.
     * @return void
     */
    public function enqueue_assets( string $hook ): void {
        $this->maybe_enqueue_metabox( $hook );
        $this->maybe_enqueue_page( $hook );
    }

    /**
     * Enqueue metabox assets on the gallery/album edit screens only.
     *
     * @since 1.0.0
     * @param string $hook Current admin page hook suffix.
     * @return void
     */
    private function maybe_enqueue_metabox( string $hook ): void {
        if ( ! in_array( $hook, [ 'post.php', 'post-new.php' ], true ) ) {
            return;
        }

        $screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
        if ( ! $screen || ! in_array( $screen->post_type, [ 'fotogrids_gallery', 'fotogrids_album' ], true ) ) {
            return;
        }

        wp_enqueue_script(
            'fotogrids-module-templates-metabox',
            $this->module_asset_url( 'assets/templates-metabox.js' ),
            [ 'wp-element', 'wp-api-fetch', 'wp-i18n' ],
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_style(
            'fotogrids-module-templates-metabox',
            $this->module_asset_url( 'assets/templates-metabox.css' ),
            [],
            FOTOGRIDS_VERSION
        );

        // Frontend CSS is used to render template previews inside the metabox.
        wp_enqueue_style(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids.css',
            [],
            FOTOGRIDS_VERSION
        );
    }

    /**
     * Enqueue admin-page assets on the Templates page only.
     *
     * @since 1.0.0
     * @param string $hook Current admin page hook suffix.
     * @return void
     */
    private function maybe_enqueue_page( string $hook ): void {
        if ( $hook !== self::PAGE_HOOK ) {
            return;
        }

        // Depend on fotogrids-admin so the shared admin runtime + design-system
        // CSS load alongside the page bundle (parity with how Tools depend on
        // it). Admin_Init enqueues fotogrids-admin at priority 10; this runs at
        // 20, so the dependency resolves.
        wp_enqueue_script(
            'fotogrids-module-templates-page',
            $this->module_asset_url( 'assets/templates-page.js' ),
            [ 'wp-element', 'wp-api-fetch', 'wp-i18n', 'fotogrids-admin' ],
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_style(
            'fotogrids-module-templates-page',
            $this->module_asset_url( 'assets/templates-page.css' ),
            [ 'fotogrids-admin' ],
            FOTOGRIDS_VERSION
        );
    }

    // -------------------------------------------------------------------------
    // Strings
    // -------------------------------------------------------------------------

    /**
     * Translated strings passed to the metabox React tree.
     *
     * @since 1.0.0
     * @return array<string,string>
     */
    private function metabox_strings(): array {
        return [
            'selectTemplate'              => __( 'Select Template', 'fotogrids' ),
            'saveAsTemplate'              => __( 'Save current settings as Template', 'fotogrids' ),
            'applyTemplate'               => __( 'Apply Template', 'fotogrids' ),
            'templatesNoticeDescription'  => __( 'Apply beautiful, ready-to-use designs to your galleries and albums instantly. Browse the Templates Library to explore what\'s available.', 'fotogrids' ),
            'proSaveDescriptionGallery'   => __( 'With a {pro_badge} license, you will be able to save the current gallery settings as a reusable template and apply it across multiple galleries.', 'fotogrids' ),
            'proSaveDescriptionAlbum'     => __( 'With a {pro_badge} license, you will be able to save the current album settings as a reusable template and apply it across multiple albums.', 'fotogrids' ),
            'dismiss'                     => __( 'Dismiss', 'fotogrids' ),
            'upgradeToPro'                => __( 'Upgrade to Pro', 'fotogrids' ),
            'loading'                     => __( 'Loading templates...', 'fotogrids' ),
            'noTemplates'                 => __( 'No templates available', 'fotogrids' ),
            'templateApplied'             => __( 'Template applied successfully', 'fotogrids' ),
            'templateSaved'               => __( 'Template saved successfully', 'fotogrids' ),
            'confirmApply'                => __( 'This will override your current settings. Are you sure?', 'fotogrids' ),
            'templateName'                => __( 'Template Name', 'fotogrids' ),
            'templateDescription'         => __( 'Description (optional)', 'fotogrids' ),
            'save'                        => __( 'Save', 'fotogrids' ),
            'saving'                      => __( 'Saving...', 'fotogrids' ),
            'cancel'                      => __( 'Cancel', 'fotogrids' ),
            'applying'                    => __( 'Applying...', 'fotogrids' ),
            'myTemplate'                  => __( 'My Template', 'fotogrids' ),
            'userTemplates'               => __( 'User Templates', 'fotogrids' ),
            'fotogridsTemplates'          => __( 'FotoGrids Templates', 'fotogrids' ),
            'templatesLibrary'            => __( 'Templates Library', 'fotogrids' ),
            'templateNameRequired'        => __( 'Template name is required.', 'fotogrids' ),
            'failedToLoadTemplates'       => __( 'Failed to load templates.', 'fotogrids' ),
            'failedToApplyTemplate'       => __( 'Failed to apply template.', 'fotogrids' ),
            'failedToSaveTemplate'        => __( 'Failed to save template.', 'fotogrids' ),
        ];
    }
}
