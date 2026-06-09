<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}


/**
 * Admin Interface Initialization Class
 *
 * Handles WordPress admin interface setup for FotoGrids
 */
class Admin_Init {

    /**
     * Initialize the admin interface
     */
    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'add_admin_menu' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_scripts' ) );
        add_action( 'admin_init', array( __CLASS__, 'admin_init' ) );

        // Allow wp_safe_redirect() to reach the external hosts FotoGrids links
        // out to (review page, upgrade/marketing). Keeps redirects on the
        // safe-redirect path while permitting our own known destinations.
        add_filter( 'allowed_redirect_hosts', array( __CLASS__, 'allowed_redirect_hosts' ) );

        // Suppress admin notices on FotoGrids pages
        add_action( 'admin_head', array( __CLASS__, 'suppress_admin_notices' ) );

        // Fix menu highlighting for custom post types
        add_action( 'admin_head', array( __CLASS__, 'fix_menu_highlighting' ) );

        if ( ! \FotoGrids\License_Manager::has_pro() ) {
            add_action( 'admin_head', array( __CLASS__, 'add_upgrade_menu_styles' ) );
        }

        // AJAX handlers for plugin settings
        add_action( 'wp_ajax_fotogrids_update_plugin_setting', array( __CLASS__, 'ajax_update_plugin_setting' ) );

        // Initialize admin columns
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-admin-columns.php';
        \FotoGrids\Admin\Admin_Columns::init();

        // Add bulk actions for gallery-album relationships
        add_filter( 'bulk_actions-edit-fotogrids_gallery', array( __CLASS__, 'gallery_bulk_actions' ) );
        add_filter( 'handle_bulk_actions-edit-fotogrids_gallery', array( __CLASS__, 'handle_gallery_bulk_actions' ), 10, 3 );
        add_action( 'admin_notices', array( __CLASS__, 'bulk_action_admin_notices' ) );
        add_action( 'admin_footer-edit.php', array( __CLASS__, 'bulk_action_album_selector' ) );

        // Initialize upgrade modal integration (for non-Pro users)
        if ( ! \FotoGrids\License_Manager::has_pro() ) {
            require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-upgrade-modal-integration.php';
            require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-upgrade-modal.php';
            \FotoGrids_Upgrade_Modal_Integration::init();
        }

        // Initialize admin header
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-admin-header.php';

        // Initialize dashboard widget
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-dashboard-widget.php';
        \FotoGrids\Admin\Dashboard_Widget::init();

        // Initialize review prompt
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-review-prompt.php';
        \FotoGrids\Admin\Review_Prompt::init();
    }

    /**
     * Add admin menu and submenus
     */
    public static function add_admin_menu() {
        add_menu_page(
            __( 'FotoGrids', 'fotogrids' ),
            __( 'FotoGrids', 'fotogrids' ),
            'manage_fotogrids',
            'fotogrids',
            array( __CLASS__, 'dashboard_page' ),
            self::get_menu_icon(),
            30
        );

        add_submenu_page(
            'fotogrids',
            __( 'FotoGrids Setup Wizard', 'fotogrids' ),
            __( 'Setup Wizard', 'fotogrids' ),
            'manage_fotogrids',
            'fotogrids-setup',
            array( __CLASS__, 'setup_wizard_page' )
        );

        add_submenu_page(
            'fotogrids',
            __( 'Dashboard', 'fotogrids' ),
            __( 'Dashboard', 'fotogrids' ),
            'manage_fotogrids',
            'fotogrids-dashboard',
            array( __CLASS__, 'dashboard_page' )
        );

        add_submenu_page(
            'fotogrids',
            __( 'Galleries', 'fotogrids' ),
            __( 'Galleries', 'fotogrids' ),
            'edit_fotogrids_galleries',
            'edit.php?post_type=fotogrids_gallery',
            ''
        );

        add_submenu_page(
            'fotogrids',
            __( 'Albums', 'fotogrids' ),
            __( 'Albums', 'fotogrids' ),
            'edit_fotogrids_albums',
            'edit.php?post_type=fotogrids_album',
            ''
        );

        add_submenu_page(
            'fotogrids',
            __( 'Templates', 'fotogrids' ),
            __( 'Templates', 'fotogrids' ),
            'manage_fotogrids',
            'fotogrids-templates',
            array( __CLASS__, 'templates_page' ) // Render delegated to Templates module - see templates_page().
        );

        add_submenu_page(
            'fotogrids',
            __( 'Library', 'fotogrids' ),
            __( 'Library', 'fotogrids' ),
            'manage_fotogrids_library',
            'fotogrids-library',
            array( __CLASS__, 'library_page' )
        );

        add_submenu_page(
            'fotogrids',
            __( 'Statistics', 'fotogrids' ),
            __( 'Statistics', 'fotogrids' ),
            'view_fotogrids_stats',
            'fotogrids-stats',
            array( __CLASS__, 'statistics_page' )
        );

        add_submenu_page(
            'fotogrids',
            __( 'Settings', 'fotogrids' ),
            __( 'Settings', 'fotogrids' ),
            'manage_fotogrids_settings',
            'fotogrids-settings',
            array( __CLASS__, 'settings_page' )
        );

        add_submenu_page(
            'fotogrids',
            __( 'Tools', 'fotogrids' ),
            __( 'Tools', 'fotogrids' ),
            'manage_fotogrids',
            'fotogrids-tools',
            array( __CLASS__, 'tools_page' )
        );

        add_submenu_page(
            'fotogrids',
            __( 'License', 'fotogrids' ),
            __( 'License', 'fotogrids' ),
            'manage_fotogrids_settings',
            'fotogrids-license',
            array( __CLASS__, 'license_page' )
        );

        // Add upgrade submenu only for non-Pro users
        if ( ! \FotoGrids\License_Manager::has_pro() ) {
            add_submenu_page(
                'fotogrids',
                __( 'Upgrade to Pro', 'fotogrids' ),
                __( 'Upgrade to Pro', 'fotogrids' ),
                'manage_fotogrids',
                'fotogrids-upgrade',
                array( __CLASS__, 'upgrade_redirect' )
            );
        }

        remove_submenu_page( 'fotogrids', 'fotogrids' );

        $current_page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
        if ( $current_page !== 'fotogrids-setup' ) {
            remove_submenu_page( 'fotogrids', 'fotogrids-setup' );
        }
    }

    /**
     * Enqueue admin scripts and styles
     */
    public static function enqueue_admin_scripts( $hook ) {
        if ( ! self::is_fotogrids_admin_page( $hook ) ) {
            return;
        }

        wp_enqueue_media();

        wp_enqueue_script( 'wp-element' );
        wp_enqueue_script( 'wp-components' );
        wp_enqueue_script( 'wp-data' );
        wp_enqueue_script( 'wp-api-fetch' );
        wp_enqueue_script( 'wp-i18n' );
        wp_enqueue_script( 'wp-url' );

        // UI state manager - must load before admin bundle and collection-settings.
        wp_enqueue_script(
            'fotogrids-ui-state-manager',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/ui-state-manager.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        // vendors.js is the webpack shared-chunk for node_modules code split out
        // of admin.js. admin.js's entry module is deferred behind this chunk via
        // __webpack_require__.O - if vendors.js hasn't run first, admin.js never
        // executes its own entry point and window.FotoGridsToolsComponents is never set.
        wp_enqueue_script(
            'fotogrids-vendors',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/vendors.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-admin',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/admin.js',
            array( 'wp-element', 'wp-components', 'wp-data', 'wp-api-fetch', 'wp-i18n', 'fotogrids-icons', 'fotogrids-ui-state-manager', 'fotogrids-vendors' ),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-loading-icons',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/loading-icons.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-icons',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/icons.js',
            array( 'fotogrids-loading-icons' ),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-codemirror-init',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/codemirror-init.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-toast-init',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/toast-init.js',
            array( 'fotogrids-admin' ),
            FOTOGRIDS_VERSION,
            true
        );

        // Enqueue Poppins - self-hosted (SIL OFL), no external CDN. The
        // @font-face rules reference .ttf files relative to the stylesheet's
        // own directory, so no path rewriting is needed.
        wp_enqueue_style(
            'fotogrids-google-fonts',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/fonts/poppins/poppins.css',
            array(),
            FOTOGRIDS_VERSION
        );

        // Enqueue admin styles
        wp_enqueue_style(
            'fotogrids-admin',
            FOTOGRIDS_PLUGIN_URL . 'assets/css/admin.css',
            array( 'wp-components', 'fotogrids-google-fonts' ),
            FOTOGRIDS_VERSION
        );

        // @font-face rules for the bundled watermark fonts, so the Watermark
        // settings font picker can preview each option in its own typeface.
        wp_add_inline_style(
            'fotogrids-admin',
            \FotoGrids\Settings\Watermark_Settings_Store::font_face_css()
        );

        // Localize script with data
        wp_localize_script( 'fotogrids-admin', 'fotogridsAdmin', array(
            'nonce' => wp_create_nonce( 'fotogrids_admin' ),
            'settingsNonce' => wp_create_nonce( 'fotogrids_settings-options' ),
            'restUrl' => 'fotogrids/v1/',
            'restNonce' => wp_create_nonce( 'wp_rest' ),
            'pluginUrl' => FOTOGRIDS_PLUGIN_URL,
            'apiUrl' => home_url( '/wp-json/' ),
            'generalSettings' => self::get_general_settings(),
            'sharingSettings' => \FotoGrids\Settings\Sharing_Settings_Store::get(),
            'watermarkSettings' => \FotoGrids\Settings\Watermark_Settings_Store::get(),
            'seoSettings' => \FotoGrids\Settings\SEO_Settings_Store::get(),
            'viewSettings' => \FotoGrids\Settings\View_Settings_Store::get(),
            'currentUser' => wp_get_current_user(),
            'shareStatistics' => (bool) get_option( 'fotogrids_share_statistics', false ),
            'autosave' => (bool) get_option( 'fotogrids_autosave', '0' ),
            'customJsAllowDynamicExecution' => (bool) get_option( 'fotogrids_custom_js_allow_dynamic_execution', false ),
            // Surfaced to the Plugin Settings > Maintenance tab so the Debug
            // Log panel only renders when WP_DEBUG is actually on.
            'wpDebug' => defined( 'WP_DEBUG' ) && WP_DEBUG,
            'settingsBaseUrl' => admin_url( 'admin.php?page=fotogrids-settings' ),
            'isFotoGridsPage' => \FotoGrids\Admin\Admin_Screen::is_fotogrids( $hook ),
            // Snapshot of every FotoGrids atomic capability the current user
            // holds, sourced from Permission_Registry. New caps added by Free
            // tools/modules, Pro, or 3rd-party plugins flow through here
            // automatically - no hand-curated list to keep in sync.
            'capabilities' => self::get_current_user_capabilities_snapshot(),
        ) );

        wp_localize_script( 'fotogrids-loading-icons', 'fotogridsAdmin', array(
            'pluginUrl' => FOTOGRIDS_PLUGIN_URL,
        ) );

        // Configure wp.apiFetch with nonce
        wp_add_inline_script( 'wp-api-fetch', sprintf(
            'wp.apiFetch.use( wp.apiFetch.createNonceMiddleware( %s ) );',
            wp_json_encode( wp_create_nonce( 'wp_rest' ) )
        ), 'after' );

        // Set up translations
        wp_set_script_translations( 'fotogrids-admin', 'fotogrids', FOTOGRIDS_PLUGIN_DIR . 'languages' );

        // Enqueue Chart.js on stats page and library page (both use Chart.js charts).
        if (
            $hook === 'fotogrids_page_fotogrids-stats'  || strpos( $hook, 'fotogrids-stats' ) !== false ||
            $hook === 'fotogrids_page_fotogrids-library' || strpos( $hook, 'fotogrids-library' ) !== false
        ) {
            wp_enqueue_script(
                'chartjs',
                FOTOGRIDS_PLUGIN_URL . 'assets/admin/vendor/chartjs/chart.umd.js',
                array(),
                '4.4.0',
                true
            );
        }

        // Localize Library page data only on the Library admin screen.
        // Exposes the entity-type registry and the initial active tab so the
        // React side does not have to make a separate roundtrip on mount.
        if ( $hook === 'fotogrids_page_fotogrids-library' || strpos( $hook, 'fotogrids-library' ) !== false ) {
            $entity_types = \FotoGrids\REST\Metadata\Library_Data::get_entity_types();
            $tab_slugs    = array_keys( $entity_types );
            $requested    = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : '';
            $initial_tab  = in_array( $requested, $tab_slugs, true ) ? $requested : ( $tab_slugs[0] ?? 'tags' );

            wp_localize_script( 'fotogrids-admin', 'fotogridsLibrary', array(
                'restBase'    => 'fotogrids/v1/library',
                'restNonce'   => wp_create_nonce( 'wp_rest' ),
                'initialTab'  => $initial_tab,
                'entityTypes' => array_values( $entity_types ),
                'perPage'     => 50,
                'canManage'   => current_user_can( 'manage_fotogrids_library' )
                    || current_user_can( 'manage_fotogrids' ),
            ) );
        }

        // Enqueue settings-specific scripts only on settings page
        if ( $hook === 'fotogrids_page_fotogrids-settings' || strpos( $hook, 'fotogrids-settings' ) !== false ) {
            \FotoGrids\Assets\Collection_Settings_Assets::enqueue( true, false );

            // Determine post type from subtab parameter, default to gallery
            $subtab = isset( $_GET['subtab'] ) ? sanitize_text_field( wp_unslash( $_GET['subtab'] ) ) : 'gallery';
            $post_type = ( $subtab === 'album' ) ? 'album' : 'gallery';

            $localized_data = \FotoGrids\Admin\Settings_Localizer::data_for_collection( array(
                'post_id' => 0,
                'post_type' => $post_type,
                'is_defaults' => true,
            ) );

            wp_localize_script( 'fotogrids-collection-settings', 'fotogridsSettings', $localized_data );
        }
    }

    /**
     * Admin initialization
     */
    public static function admin_init() {
        register_setting(
            'fotogrids_settings',
            'fotogrids_general_settings',
            array(
                'type' => 'array',
                'default' => self::get_general_settings_defaults(),
                'sanitize_callback' => array( __CLASS__, 'sanitize_general_settings' ),
            )
        );
        register_setting( 'fotogrids_settings', 'fotogrids_permission_settings', array(
            'type'              => 'array',
            'default'           => array(),
            'sanitize_callback' => array( __CLASS__, 'sanitize_settings_array' ),
        ) );
        register_setting( 'fotogrids_settings', 'fotogrids_integration_settings', array(
            'type'              => 'array',
            'default'           => array(),
            'sanitize_callback' => array( __CLASS__, 'sanitize_settings_array' ),
        ) );
        register_setting( 'fotogrids_settings', 'fotogrids_share_statistics', array(
            'type' => 'boolean',
            'default' => false,
            'sanitize_callback' => array( __CLASS__, 'sanitize_share_statistics' ),
        ) );
        register_setting( 'fotogrids_settings', 'fotogrids_autosave', array(
            'type' => 'boolean',
            'default' => false,
            'sanitize_callback' => array( __CLASS__, 'sanitize_autosave' ),
        ) );
        register_setting( 'fotogrids_settings', 'fotogrids_custom_js_allow_dynamic_execution', array(
            'type' => 'boolean',
            'default' => false,
            'sanitize_callback' => array( __CLASS__, 'sanitize_custom_js_allow_dynamic_execution' ),
        ) );
        register_setting(
            'fotogrids_settings',
            'fotogrids_gallery_defaults',
            array(
                'sanitize_callback' => array( __CLASS__, 'sanitize_gallery_defaults' ),
            )
        );
    }

    /**
     * Sanitize gallery defaults option
     *
     * @param array $input Raw input data
     * @return array Sanitized data
     */
    public static function sanitize_gallery_defaults( $input ) {
        if ( ! is_array( $input ) ) {
            return array();
        }

        $defaults = \FotoGrids\Collection_Defaults::resolve_gallery();
        $sanitized = array();

        foreach ( $defaults as $key => $default_value ) {
            if ( ! isset( $input[$key] ) ) {
                continue;
            }

            $value = $input[$key];

            if ( is_array( $default_value ) ) {
                if ( is_string( $value ) ) {
                    $decoded = json_decode( stripslashes( $value ), true );
                    if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) {
                        $sanitized[$key] = $decoded;
                    } else {
                        $sanitized[$key] = $default_value;
                    }
                } else if ( is_array( $value ) ) {
                    $sanitized[$key] = $value;
                } else {
                    $sanitized[$key] = $default_value;
                }
            } else if ( is_bool( $default_value ) ) {
                $sanitized[$key] = ( $value === '1' || $value === 'true' || $value === true || $value === 'on' );
            } else if ( is_numeric( $default_value ) ) {
                $sanitized[$key] = is_numeric( $value ) ? $value : $default_value;
            } else {
                $sanitized[$key] = sanitize_text_field( $value );
            }
        }

        return $sanitized;
    }

    /**
     * Return default values for general settings.
     *
     * @return array<string, mixed>
     */
    private static function get_general_settings_defaults() {
        return \FotoGrids\Settings\Plugin_Settings_Store::general_defaults();
    }

    /**
     * Snapshot of every FotoGrids atomic cap the current user holds.
     *
     * Reads the full atomic-cap list from Permission_Registry and calls
     * current_user_can() on each. Localised to the React side as
     * `fotogrids.capabilities` so client components can render the right
     * controls (enabled / disabled / hidden) without making per-cap REST
     * roundtrips.
     *
     * @since 1.0.0
     * @return array<string, bool>
     */
    private static function get_current_user_capabilities_snapshot() {
        $snapshot = array();

        if ( ! class_exists( '\FotoGrids\Permissions\Permission_Registry' ) ) {
            return $snapshot;
        }

        \FotoGrids\Permissions\Permission_Registry::boot();
        foreach ( \FotoGrids\Permissions\Permission_Registry::get_all() as $def ) {
            if ( $def->is_logical() || $def->is_meta_cap ) {
                // Logical caps are not real WP caps. Meta caps require a
                // post id - calling current_user_can on them globally
                // triggers a _doing_it_wrong notice in WP 6.1+.
                continue;
            }
            $snapshot[ $def->key ] = current_user_can( $def->key );
        }
        return $snapshot;
    }

    /**
     * Return general settings merged with defaults.
     *
     * Public so the REST settings endpoints can read the same canonical
     * shape the Settings API and the frontend renderer use.
     *
     * @return array<string, mixed>
     */
    public static function get_general_settings() {
        return \FotoGrids\Settings\Plugin_Settings_Store::get_general();
    }

    /**
     * Return the advanced (boolean) settings as a single map.
     *
     * These live as separate top-level options but are read/written together
     * by the Advanced settings tab via REST.
     *
     * @return array<string, bool>
     */
    public static function get_advanced_settings() {
        return \FotoGrids\Settings\Plugin_Settings_Store::get_advanced();
    }

    /**
     * Sanitize general settings option.
     *
     * @param mixed $value Raw option value.
     * @return array<string, mixed>
     */
    public static function sanitize_general_settings( $value ) {
        return \FotoGrids\Settings\Plugin_Settings_Store::sanitize_general( $value );
    }

    /**
     * Generic array-settings sanitizer.
     *
     * Recursively sanitises an arbitrary settings array: scalar values are
     * passed through sanitize_text_field() and nested arrays are walked. Used
     * for option groups that do not (yet) have a typed per-key sanitizer of
     * their own. Non-array input collapses to an empty array.
     *
     * @since  1.0.0
     * @param  mixed $value Raw option value from options.php.
     * @return array<string, mixed>
     */
    public static function sanitize_settings_array( $value ): array {
        if ( ! is_array( $value ) ) {
            return array();
        }

        $sanitized = array();
        foreach ( $value as $key => $item ) {
            $clean_key = sanitize_key( (string) $key );
            if ( is_array( $item ) ) {
                $sanitized[ $clean_key ] = self::sanitize_settings_array( $item );
            } elseif ( is_bool( $item ) ) {
                $sanitized[ $clean_key ] = $item;
            } elseif ( is_int( $item ) || is_float( $item ) ) {
                $sanitized[ $clean_key ] = $item;
            } else {
                $sanitized[ $clean_key ] = sanitize_text_field( (string) $item );
            }
        }

        return $sanitized;
    }

    /**
     * Sanitize a boolean setting submitted via a Toggle component.
     *
     * Toggle uses a hidden input that is always present in POST with value
     * '1' (on) or '0' (off), so absence-from-POST is not a valid signal.
     * We cast the raw value directly.
     *
     * @since  1.0.0
     * @param  mixed $value Raw option value from options.php.
     * @return bool
     */
    private static function sanitize_boolean_setting( $value ): bool {
        return $value === '1' || $value === 1 || $value === true;
    }

    /**
     * Sanitize share statistics setting.
     *
     * @param mixed $value Input value.
     * @return bool
     */
    public static function sanitize_share_statistics( $value ): bool {
        return self::sanitize_boolean_setting( $value );
    }

    /**
     * Sanitize autosave setting.
     *
     * @param mixed $value Input value.
     * @return bool
     */
    public static function sanitize_autosave( $value ): bool {
        return self::sanitize_boolean_setting( $value );
    }

    /**
     * Sanitize the custom JS allow dynamic execution setting.
     *
     * @since  1.0.0
     * @param  mixed $value Input value.
     * @return bool
     */
    public static function sanitize_custom_js_allow_dynamic_execution( $value ): bool {
        return self::sanitize_boolean_setting( $value );
    }

    /**
     * AJAX handler to update plugin setting
     */
    public static function ajax_update_plugin_setting() {
        check_ajax_referer( 'fotogrids_admin', 'nonce' );

        if ( ! current_user_can( 'manage_fotogrids_settings' ) ) {
            wp_send_json_error( array( 'message' => __( 'Insufficient permissions', 'fotogrids' ) ) );
        }

        $setting = isset( $_POST['setting'] ) ? sanitize_text_field( wp_unslash( $_POST['setting'] ) ) : '';
        $value = isset( $_POST['value'] ) ? sanitize_text_field( wp_unslash( $_POST['value'] ) ) : '';

        $allowed_settings = array( 'fotogrids_autosave', 'fotogrids_auto_clear_cache', 'fotogrids_enable_statistics' );
        if ( ! in_array( $setting, $allowed_settings, true ) ) {
            wp_send_json_error( array( 'message' => __( 'Invalid setting', 'fotogrids' ) ) );
        }

        if ( in_array( $setting, array( 'fotogrids_autosave', 'fotogrids_auto_clear_cache', 'fotogrids_enable_statistics' ), true ) ) {
            $sanitized_bool = ( $value === '1' || $value === 'true' || $value === true || $value === 'on' );
            $sanitized_value = $sanitized_bool ? '1' : '0';

            global $wpdb;
            $option_exists = $wpdb->get_var( $wpdb->prepare(
                "SELECT option_id FROM {$wpdb->options} WHERE option_name = %s",
                $setting
            ) ) !== null;

            remove_all_filters( 'pre_update_option_' . $setting );
            remove_all_filters( 'update_option_' . $setting );
            remove_all_filters( 'sanitize_option_' . $setting );

            if ( ! $option_exists ) {
                $result = add_option( $setting, $sanitized_value, '', 'yes' );
            } else {
                $result = update_option( $setting, $sanitized_value, true );
            }

            if ( $result ) {
                wp_send_json_success( array( 'value' => $sanitized_bool ) );
            } else {
                $current_value = get_option( $setting, false );
                $current_bool = ( $current_value === '1' || $current_value === 1 || $current_value === true );

                if ( $current_bool === $sanitized_bool ) {
                    wp_send_json_success( array( 'value' => $sanitized_bool ) );
                } else {
                    wp_send_json_error( array( 'message' => __( 'Failed to save setting', 'fotogrids' ) ) );
                }
            }
        }

        wp_send_json_error( array( 'message' => __( 'Failed to update setting', 'fotogrids' ) ) );
    }

    /**
     * Unified admin page renderer
     *
     * @param string $page_id The unique page identifier for the React mount point
     */
    private static function render_admin_page( $page_id ) {
        // Get the SVG icon content
        $icon_path = FOTOGRIDS_PLUGIN_DIR . 'assets/admin/images/fotogrids-icon-color.svg';
        $icon_svg = '';
        if ( file_exists( $icon_path ) ) {
            $icon_svg = file_get_contents( $icon_path );
        }

        $pages_with_icon = array( 'stats', 'settings', 'license' );
        $show_icon = in_array( $page_id, $pages_with_icon );
        // The Setup Wizard renders its own brand header inside the React
        // tree, so suppress the default page header on that page.
        $show_header = $page_id !== 'main' && $page_id !== 'setup';

        ?>
        <div class="wrap">
            <?php if ( $show_header ) : ?>
            <div class="fotogrids-page-header">
                <h1 class="fotogrids-heading-inline">
                    <?php if ( $show_icon && $icon_svg ) : ?>
                        <span class="fotogrids-page-icon"><?php \FotoGrids\Svg::render( $icon_svg ); ?></span>
                    <?php endif; ?>
                    <?php echo esc_html( get_admin_page_title() ); ?>
                </h1>
            </div>
            <?php endif; ?>
            <div id="fotogrids-<?php echo esc_attr( $page_id ); ?>-page" class="fotogrids-admin-page">
                <!-- React component will be mounted here -->
            </div>
        </div>
        <?php
    }

    /**
     * Main admin page
     */
    public static function dashboard_page() {
        self::render_admin_page( 'main' );
    }

    /**
     * Templates admin page.
     *
     * Render is owned by the Templates module. The menu item stays here so
     * submenu ordering is centralized, but the page body is delegated to the
     * module's render_page(). Falls back to the shared renderer if the module
     * is unavailable (defensive - should not happen in normal operation).
     */
    public static function templates_page() {
        $entry = \FotoGrids\Modules\Module_Registry::get_by_id( 'templates' );
        if ( $entry && $entry['module'] instanceof \FotoGrids\Modules\Templates\Module ) {
            $entry['module']->render_page();
            return;
        }
        self::render_admin_page( 'templates' );
    }

    /**
     * Library admin page
     *
     * Mounts the React Library Manager into #fotogrids-library-page.
     * The active tab is read from the `tab` query parameter and exposed
     * to React via the `fotogridsLibrary` localised global.
     */
    public static function library_page() {
        self::render_admin_page( 'library' );
    }

    /**
     * Statistics admin page
     */
    public static function statistics_page() {
        self::render_admin_page( 'stats' );
    }

    /**
     * Settings admin page
     */
    public static function settings_page() {
        self::render_admin_page( 'settings' );
    }

    /**
     * License admin page
     */
    public static function license_page() {
        self::render_admin_page( 'license' );
    }

    /**
     * Tools admin page
     */
    public static function tools_page() {
        self::render_admin_page( 'tools' );
    }

    /**
     * Setup Wizard admin page
     *
     * Hidden submenu (registered with a null parent slug) reached at
     * ?page=fotogrids-setup. Renders a React mount point — the wizard UI is
     * a self-contained tree in src/assets/admin/src/components/pages/SetupWizardPage.jsx
     * and lives inside the existing admin.js bundle.
     */
    public static function setup_wizard_page() {
        self::render_admin_page( 'setup' );
    }

    /**
     * Allow FotoGrids' own external hosts through wp_safe_redirect().
     *
     * @param string[] $hosts Allowed redirect hostnames.
     * @return string[]
     */
    public static function allowed_redirect_hosts( $hosts ) {
        $hosts[] = 'wordpress.org';
        $hosts[] = 'fotogrids.com';
        $hosts[] = 'go.fotogrids.com';

        return $hosts;
    }

    /**
     * Upgrade redirect - redirects to external upgrade URL
     */
    public static function upgrade_redirect() {
        wp_safe_redirect( 'https://go.fotogrids.com/upgrade' );
        exit;
    }

    /**
     * Check if current page is a FotoGrids admin page
     */
    private static function is_fotogrids_admin_page( $hook ) {
        return \FotoGrids\Admin\Admin_Screen::is_fotogrids( $hook );
    }

    /**
     * Get custom menu icon
     */
    private static function get_menu_icon() {
        // Custom SVG icon as base64 data URI
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 59.53 59.53" fill="currentColor"><rect fill="#a7aaad" x="1.42" y="1.42" width="56.69" height="14.17"/><rect fill="#a7aaad" x="1.42" y="22.68" width="35.43" height="14.17"/><rect fill="#a7aaad" x="1.42" y="43.94" width="14.17" height="14.17"/><rect fill="#a7aaad" x="22.68" y="43.94" width="14.17" height="14.17"/><rect fill="#a7aaad" x="43.94" y="22.68" width="14.17" height="35.43"/></svg>';
        return 'data:image/svg+xml;base64,' . base64_encode( $svg );
    }

    /**
     * Add bulk actions for galleries
     */
    public static function gallery_bulk_actions( $bulk_actions ) {
        $albums = get_posts( array(
            'post_type' => 'fotogrids_album',
            'numberposts' => -1,
            'post_status' => array( 'publish', 'draft', 'private' ),
            'orderby' => 'title',
            'order' => 'ASC',
        ) );

        if ( ! empty( $albums ) ) {
            $bulk_actions['assign_to_album'] = __( 'Assign to Album', 'fotogrids' );
            $bulk_actions['remove_from_albums'] = __( 'Remove from All Albums', 'fotogrids' );
        }

        return $bulk_actions;
    }

    /**
     * Handle bulk actions for galleries
     */
    public static function handle_gallery_bulk_actions( $redirect_to, $doaction, $post_ids ) {
        if ( ! in_array( $doaction, array( 'assign_to_album', 'remove_from_albums' ) ) ) {
            return $redirect_to;
        }

        if ( empty( $post_ids ) ) {
            return $redirect_to;
        }

        $processed = 0;
        $errors = 0;

        switch ( $doaction ) {
            case 'assign_to_album':
                $album_id = isset( $_REQUEST['album_id'] ) ? absint( $_REQUEST['album_id'] ) : 0;
                if ( ! $album_id ) {
                    $redirect_to = add_query_arg( 'bulk_error', 'no_album_selected', $redirect_to );
                    break;
                }

                if ( ! get_post( $album_id ) || get_post_type( $album_id ) !== 'fotogrids_album' ) {
                    $redirect_to = add_query_arg( 'bulk_error', 'invalid_album', $redirect_to );
                    break;
                }

                foreach ( $post_ids as $post_id ) {
                    if ( get_post_type( $post_id ) === 'fotogrids_gallery' ) {
                        $result = \FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $post_id, $album_id );
                        if ( $result ) {
                            $processed++;
                        } else {
                            $errors++;
                        }
                    }
                }

                $redirect_to = add_query_arg( array(
                    'bulk_assigned' => $processed,
                    'bulk_errors' => $errors,
                    'album_id' => $album_id,
                ), $redirect_to );
                break;

            case 'remove_from_albums':
                foreach ( $post_ids as $post_id ) {
                    if ( get_post_type( $post_id ) === 'fotogrids_gallery' ) {
                        $albums = \FotoGrids\Gallery_Album_Relations::get_albums_for_gallery( $post_id );
                        $removed_count = 0;

                        foreach ( $albums as $album ) {
                            $result = \FotoGrids\Gallery_Album_Relations::remove_gallery_from_album( $post_id, $album->ID );
                            if ( $result ) {
                                $removed_count++;
                            }
                        }

                        if ( $removed_count > 0 ) {
                            $processed++;
                        } else {
                            $errors++;
                        }
                    }
                }

                $redirect_to = add_query_arg( array(
                    'bulk_removed' => $processed,
                    'bulk_errors' => $errors,
                ), $redirect_to );
                break;
        }

        return $redirect_to;
    }

    /**
     * Display admin notices for bulk actions
     */
    public static function bulk_action_admin_notices() {
        global $post_type, $pagenow;

        if ( $pagenow !== 'edit.php' || $post_type !== 'fotogrids_gallery' ) {
            return;
        }

        if ( isset( $_REQUEST['bulk_assigned'] ) ) {
            $assigned = absint( $_REQUEST['bulk_assigned'] );
            $errors = isset( $_REQUEST['bulk_errors'] ) ? absint( $_REQUEST['bulk_errors'] ) : 0;
            $album_id = isset( $_REQUEST['album_id'] ) ? absint( $_REQUEST['album_id'] ) : 0;

            $album_name = '';
            if ( $album_id ) {
                $album = get_post( $album_id );
                $album_name = $album ? $album->post_title : __( 'Unknown Album', 'fotogrids' );
            }

            if ( $assigned > 0 ) {
                $message = sprintf(
                    /* translators: 1: number of galleries assigned, 2: album name. */
                    _n(
                        '%1$d gallery assigned to "%2$s".',
                        '%1$d galleries assigned to "%2$s".',
                        $assigned,
                        'fotogrids'
                    ),
                    $assigned,
                    $album_name
                );

                if ( $errors > 0 ) {
                    $message .= ' ' . sprintf(
                        /* translators: %d: number of galleries that could not be assigned. */
                        _n(
                            '%d gallery could not be assigned.',
                            '%d galleries could not be assigned.',
                            $errors,
                            'fotogrids'
                        ),
                        $errors
                    );
                }

                echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
            } elseif ( $errors > 0 ) {
                $message = sprintf(
                    /* translators: %d: number of galleries that could not be assigned. */
                    _n(
                        '%d gallery could not be assigned.',
                        '%d galleries could not be assigned.',
                        $errors,
                        'fotogrids'
                    ),
                    $errors
                );
                echo '<div class="notice notice-error is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
            }
        }

        if ( isset( $_REQUEST['bulk_removed'] ) ) {
            $removed = absint( $_REQUEST['bulk_removed'] );
            $errors = isset( $_REQUEST['bulk_errors'] ) ? absint( $_REQUEST['bulk_errors'] ) : 0;

            if ( $removed > 0 ) {
                $message = sprintf(
                    /* translators: %d: number of galleries removed from all albums. */
                    _n(
                        '%d gallery removed from all albums.',
                        '%d galleries removed from all albums.',
                        $removed,
                        'fotogrids'
                    ),
                    $removed
                );

                if ( $errors > 0 ) {
                    $message .= ' ' . sprintf(
                        /* translators: %d: number of galleries that could not be processed. */
                        _n(
                            '%d gallery could not be processed.',
                            '%d galleries could not be processed.',
                            $errors,
                            'fotogrids'
                        ),
                        $errors
                    );
                }

                echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
            } elseif ( $errors > 0 ) {
                $message = sprintf(
                    /* translators: %d: number of galleries that could not be processed. */
                    _n(
                        '%d gallery could not be processed.',
                        '%d galleries could not be processed.',
                        $errors,
                        'fotogrids'
                    ),
                    $errors
                );
                echo '<div class="notice notice-error is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
            }
        }

        if ( isset( $_REQUEST['bulk_error'] ) ) {
            $error = sanitize_text_field( wp_unslash( $_REQUEST['bulk_error'] ) );
            $message = '';

            switch ( $error ) {
                case 'no_album_selected':
                    $message = __( 'Please select an album to assign galleries to.', 'fotogrids' );
                    break;
                case 'invalid_album':
                    $message = __( 'The selected album is invalid or no longer exists.', 'fotogrids' );
                    break;
                default:
                    $message = __( 'An error occurred during bulk operation.', 'fotogrids' );
            }

            if ( $message ) {
                echo '<div class="notice notice-error is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
            }
        }
    }

    /**
     * Add album selector for bulk actions
     *
     * Renders two hidden selector blocks (one for the top bulk-action row,
     * one for the bottom) and inserts each inside its sibling `.bulkactions`
     * container, right next to the Apply button. Visibility is driven by the
     * corresponding bulk action dropdown's value. The two selects are kept
     * in sync so picking an album on either row submits the same value.
     */
    public static function bulk_action_album_selector() {
        global $post_type;

        if ( $post_type !== 'fotogrids_gallery' ) {
            return;
        }

        $albums = get_posts( array(
            'post_type' => 'fotogrids_album',
            'numberposts' => -1,
            'post_status' => array( 'publish', 'draft', 'private' ),
            'orderby' => 'title',
            'order' => 'ASC',
        ) );

        if ( empty( $albums ) ) {
            return;
        }

        $render_selector = function( $which ) use ( $albums ) {
            $id = 'fotogrids-bulk-album-selector-' . $which;
            $select_id = 'fotogrids-album-select-' . $which;
            ?>
            <span id="<?php echo esc_attr( $id ); ?>" class="fotogrids-bulk-album-selector" style="display: none; margin-left: 6px;">
                <label for="<?php echo esc_attr( $select_id ); ?>" class="screen-reader-text">
                    <?php esc_html_e( 'Select Album:', 'fotogrids' ); ?>
                </label>
                <select name="album_id" id="<?php echo esc_attr( $select_id ); ?>" data-fg-album-select="<?php echo esc_attr( $which ); ?>">
                    <option value=""><?php esc_html_e( 'Choose an album...', 'fotogrids' ); ?></option>
                    <?php foreach ( $albums as $album ) : ?>
                        <option value="<?php echo esc_attr( $album->ID ); ?>">
                            <?php echo esc_html( $album->post_title ); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </span>
            <?php
        };

        ?>
        <div id="fotogrids-bulk-album-selector-templates" style="display: none">
            <?php $render_selector( 'top' ); ?>
            <?php $render_selector( 'bottom' ); ?>
        </div>

        <script type="text/javascript">
        (function () {
            document.addEventListener('DOMContentLoaded', function () {
                var rows = ['top', 'bottom'];

                rows.forEach(function (which) {
                    var actionSelect = document.getElementById('bulk-action-selector-' + which);
                    var selector = document.getElementById('fotogrids-bulk-album-selector-' + which);
                    if (!actionSelect || !selector) {
                        return;
                    }

                    // Place the selector next to the Apply button.
                    var bulkActions = actionSelect.closest('.bulkactions');
                    if (bulkActions) {
                        bulkActions.appendChild(selector);
                    }

                    var updateVisibility = function () {
                        selector.style.display = actionSelect.value === 'assign_to_album'
                            ? 'inline-block'
                            : 'none';
                    };

                    actionSelect.addEventListener('change', updateVisibility);
                    updateVisibility();
                });

                // Keep top/bottom selects in sync so submitting from either row
                // posts the user's pick.
                var albumSelects = document.querySelectorAll('select[data-fg-album-select]');
                albumSelects.forEach(function (sel) {
                    sel.addEventListener('change', function () {
                        albumSelects.forEach(function (other) {
                            if (other !== sel) {
                                other.value = sel.value;
                            }
                        });
                    });
                });

                // Disable the unused (hidden) select on submit so only one
                // album_id field is sent — the one tied to the row the user
                // actually used to submit.
                var postsFilter = document.getElementById('posts-filter');
                if (!postsFilter) {
                    return;
                }

                postsFilter.addEventListener('submit', function (e) {
                    var topAction = document.getElementById('bulk-action-selector-top');
                    var bottomAction = document.getElementById('bulk-action-selector-bottom');
                    var topVal = topAction ? topAction.value : '';
                    var bottomVal = bottomAction ? bottomAction.value : '';
                    var assigning = topVal === 'assign_to_album' || bottomVal === 'assign_to_album';

                    if (!assigning) {
                        return;
                    }

                    // Determine which row submitted: WordPress disables the
                    // non-submitting row's hidden inputs via the bulk action
                    // logic, but to be safe, prefer the row whose action is
                    // assign_to_album.
                    var activeWhich = topVal === 'assign_to_album' ? 'top' : 'bottom';
                    var activeSelect = document.querySelector('select[data-fg-album-select="' + activeWhich + '"]');
                    var albumId = activeSelect ? activeSelect.value : '';

                    if (!albumId) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        window.alert('<?php echo esc_js( __( 'Please select an album to assign galleries to.', 'fotogrids' ) ); ?>');
                        if (activeSelect) {
                            activeSelect.focus();
                        }
                        return false;
                    }

                    // Disable the other album_id select so only one value posts.
                    var otherWhich = activeWhich === 'top' ? 'bottom' : 'top';
                    var otherSelect = document.querySelector('select[data-fg-album-select="' + otherWhich + '"]');
                    if (otherSelect) {
                        otherSelect.disabled = true;
                    }
                });
            });
        })();
        </script>
        <?php
    }

    /**
     * Suppress admin notices on FotoGrids pages
     * Removes all admin notices except FotoGrids' own notices
     */
    public static function suppress_admin_notices() {
        if ( ! \FotoGrids\Admin\Admin_Screen::is_fotogrids() ) {
            return;
        }

        global $wp_filter;

        foreach ( [ 'admin_notices', 'all_admin_notices', 'network_admin_notices' ] as $action ) {
            if ( empty( $wp_filter[ $action ] ) ) {
                continue;
            }

            foreach ( $wp_filter[ $action ]->callbacks as $priority => $callbacks ) {
                foreach ( $callbacks as $key => $callback ) {
                    if ( self::is_suppressible_notice_callback( $callback ) ) {
                        unset( $wp_filter[ $action ]->callbacks[ $priority ][ $key ] );
                    }
                }
            }
        }
    }

    /**
     * Whether an admin_notices callback is one we want to suppress on
     * FotoGrids admin pages. Targets third-party / vendor SDK notices
     * (Freemius, generic "rate us" prompts) and leaves WordPress-core
     * messages intact.
     *
     * @since  1.0.0
     * @param  array $callback A WP filter/action callback registration.
     * @return bool
     */
    private static function is_suppressible_notice_callback( array $callback ): bool {
        $func = $callback['function'] ?? null;
        if ( ! $func ) {
            return false;
        }

        if ( is_array( $func ) && isset( $func[1] ) ) {
            $method = (string) $func[1];

            if ( in_array( $method, [
                '_admin_notices_hook',
                '_maybe_add_gdpr_optin_ajax_handler',
            ], true ) ) {
                return true;
            }

            if ( is_object( $func[0] ) && stripos( get_class( $func[0] ), 'Freemius' ) !== false ) {
                return true;
            }
        }

        if ( is_string( $func ) && stripos( $func, 'freemius' ) !== false ) {
            return true;
        }

        return false;
    }

    /**
     * Fix menu highlighting for FotoGrids custom post types
     */
    public static function fix_menu_highlighting() {
        global $parent_file, $submenu_file, $post_type;

        // Check if we're editing/viewing FotoGrids post types
        if ( in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album' ) ) ) {
            $parent_file = 'fotogrids';

            // Set submenu highlighting based on post type
            if ( $post_type === 'fotogrids_gallery' ) {
                $submenu_file = 'edit.php?post_type=fotogrids_gallery';
            } elseif ( $post_type === 'fotogrids_album' ) {
                $submenu_file = 'edit.php?post_type=fotogrids_album';
            }
        }
    }

    /**
     * Add custom styles for upgrade menu item
     */
    public static function add_upgrade_menu_styles() {
        ?>
        <style>
        #adminmenu .wp-submenu a[href*="fotogrids-upgrade"] {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px 12px;
            margin: 4px 8px ;
            border: 1px solid transparent;
            border-radius: 4px;
            background-color: #3c46f0;
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.5;
            transition: all 0.2s ease;
        }

        #adminmenu .wp-submenu a[href*="fotogrids-upgrade"]:hover,
        #adminmenu .wp-submenu a[href*="fotogrids-upgrade"]:active,
        #adminmenu .wp-submenu a[href*="fotogrids-upgrade"]:focus {
            background-color: #4f5af3;
            box-shadow: none;
        }
        </style>
        <?php
    }
}
