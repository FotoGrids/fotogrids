<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

use FotoGrids\Admin_Helpers;

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

        // Suppress admin notices on FotoGrids pages
        add_action( 'admin_head', array( __CLASS__, 'suppress_admin_notices' ) );

        // Fix menu highlighting for custom post types
        add_action( 'admin_head', array( __CLASS__, 'fix_menu_highlighting' ) );

        if ( ! fotogrids_has_pro() ) {
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
        if ( ! fotogrids_has_pro() ) {
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
            array( __CLASS__, 'templates_page' )
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
            __( 'License', 'fotogrids' ),
            __( 'License', 'fotogrids' ),
            'manage_fotogrids_settings',
            'fotogrids-license',
            array( __CLASS__, 'license_page' )
        );

        // Add upgrade submenu only for non-Pro users
        if ( ! fotogrids_has_pro() ) {
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

        wp_enqueue_script(
            'fotogrids-admin',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/admin.js',
            array( 'wp-element', 'wp-components', 'wp-data', 'wp-api-fetch', 'wp-i18n', 'media-upload', 'fotogrids-icons' ),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-loading-icons',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/js/loading-icons.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-icons',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/js/icons.js',
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

        // Enqueue Google Fonts - Poppins
        wp_enqueue_style(
            'fotogrids-google-fonts',
            'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
            array(),
            null
        );

        // Add preconnect links for Google Fonts in admin
        add_action( 'admin_head', function() {
            echo '<link rel="preconnect" href="https://fonts.googleapis.com">' . "\n";
            echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n";
        } );

        // Enqueue admin styles
        wp_enqueue_style(
            'fotogrids-admin',
            FOTOGRIDS_PLUGIN_URL . 'assets/css/admin.css',
            array( 'wp-components', 'fotogrids-google-fonts' ),
            FOTOGRIDS_VERSION
        );

        // Localize script with data
        wp_localize_script( 'fotogrids-admin', 'fotogridsAdmin', array(
            'nonce' => wp_create_nonce( 'fotogrids_admin' ),
            'settingsNonce' => wp_create_nonce( 'fotogrids_settings-options' ),
            'restUrl' => 'fotogrids/v1/',
            'restNonce' => wp_create_nonce( 'wp_rest' ),
            'pluginUrl' => FOTOGRIDS_PLUGIN_URL,
            'apiUrl' => home_url( '/wp-json/' ),
            'currentUser' => wp_get_current_user(),
            'shareStatistics' => (bool) get_option( 'fotogrids_share_statistics', false ),
            'autosave' => (bool) get_option( 'fotogrids_autosave', '0' ),
            'isFotoGridsPage' => Admin_Helpers::is_fotogrids_page( $hook ),
            'capabilities' => array(
                'manage_fotogrids' => current_user_can( 'manage_fotogrids' ),
                'edit_fotogrids' => current_user_can( 'edit_fotogrids' ),
                'view_fotogrids_stats' => current_user_can( 'view_fotogrids_stats' ),
            ),
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

        // Enqueue stats-specific scripts only on stats page
        if ( $hook === 'fotogrids_page_fotogrids-stats' || strpos( $hook, 'fotogrids-stats' ) !== false ) {
            wp_enqueue_script(
                'chartjs',
                'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js',
                array(),
                '4.4.0',
                true
            );
        }

        // Enqueue settings-specific scripts only on settings page
        if ( $hook === 'fotogrids_page_fotogrids-settings' || strpos( $hook, 'fotogrids-settings' ) !== false ) {
            fotogrids_enqueue_collection_settings_scripts( true, false );

            // Determine post type from subtab parameter, default to gallery
            $subtab = isset( $_GET['subtab'] ) ? sanitize_text_field( $_GET['subtab'] ) : 'gallery';
            $post_type = ( $subtab === 'album' ) ? 'album' : 'gallery';

            $localized_data = Admin_Helpers::get_collection_settings_localized_data( array(
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
        register_setting( 'fotogrids_settings', 'fotogrids_general_settings' );
        register_setting( 'fotogrids_settings', 'fotogrids_permission_settings' );
        register_setting( 'fotogrids_settings', 'fotogrids_integration_settings' );
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

        $defaults = fotogrids_get_default_gallery_settings();
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
     * Sanitize share statistics setting
     *
     * Handles checkbox value - if not present in POST, it's false
     *
     * @param mixed $value Input value
     * @return bool Sanitized boolean value
     */
    public static function sanitize_share_statistics( $value ) {
        if ( ! isset( $_POST['fotogrids_share_statistics'] ) ) {
            return false;
        }
        return (bool) $value;
    }

    /**
     * Sanitize autosave setting
     *
     * Handles checkbox value - if not present in POST, it's false
     *
     * @param mixed $value Input value
     * @return bool Sanitized boolean value
     */
    public static function sanitize_autosave( $value ) {
        if ( ! isset( $_POST['fotogrids_autosave'] ) ) {
            return false;
        }
        return (bool) $value;
    }

    /**
     * AJAX handler to update plugin setting
     */
    public static function ajax_update_plugin_setting() {
        check_ajax_referer( 'fotogrids_admin', 'nonce' );

        if ( ! current_user_can( 'manage_fotogrids_settings' ) ) {
            wp_send_json_error( array( 'message' => __( 'Insufficient permissions', 'fotogrids' ) ) );
        }

        $setting = isset( $_POST['setting'] ) ? sanitize_text_field( $_POST['setting'] ) : '';
        $value = isset( $_POST['value'] ) ? $_POST['value'] : '';

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
        $icon_path = FOTOGRIDS_PLUGIN_DIR . 'assets/admin/items/fotogrids-icon-color.svg';
        $icon_svg = '';
        if ( file_exists( $icon_path ) ) {
            $icon_svg = file_get_contents( $icon_path );
        }

        $pages_with_icon = array( 'stats', 'settings', 'license' );
        $show_icon = in_array( $page_id, $pages_with_icon );
        $show_header = $page_id !== 'main';

        ?>
        <div class="wrap">
            <?php if ( $show_header ) : ?>
            <div class="fotogrids-page-header">
                <h1 class="fotogrids-heading-inline">
                    <?php if ( $show_icon && $icon_svg ) : ?>
                        <span class="fotogrids-page-icon"><?php echo $icon_svg; ?></span>
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
     * Templates admin page
     */
    public static function templates_page() {
        self::render_admin_page( 'templates' );
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
     * Upgrade redirect - redirects to external upgrade URL
     */
    public static function upgrade_redirect() {
        wp_redirect( 'https://go.fotogrids.com/upgrade' );
        exit;
    }

    /**
     * Check if current page is a FotoGrids admin page
     */
    private static function is_fotogrids_admin_page( $hook ) {
        return Admin_Helpers::is_fotogrids_page( $hook );
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
            $error = sanitize_text_field( $_REQUEST['bulk_error'] );
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

        ?>
        <div id="fotogrids-bulk-album-selector" style="display: none">
            <label for="fotogrids-album-select">
                <?php _e( 'Select Album:', 'fotogrids' ); ?>
            </label>
            <select name="album_id" id="fotogrids-album-select" style="margin-left: 10px;">
                <option value=""><?php _e( 'Choose an album...', 'fotogrids' ); ?></option>
                <?php foreach ( $albums as $album ) : ?>
                    <option value="<?php echo esc_attr( $album->ID ); ?>">
                        <?php echo esc_html( $album->post_title ); ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <script type="text/javascript">
        document.addEventListener('DOMContentLoaded', function() {
            var bulkActionTop = document.getElementById('bulk-action-selector-top');
            var bulkActionBottom = document.getElementById('bulk-action-selector-bottom');
            var albumSelector = document.getElementById('fotogrids-bulk-album-selector');
            var albumSelect = document.getElementById('fotogrids-album-select');

            function toggleAlbumSelector() {
                var selectedTop = bulkActionTop ? bulkActionTop.value : '';
                var selectedBottom = bulkActionBottom ? bulkActionBottom.value : '';

                if (selectedTop === 'assign_to_album' || selectedBottom === 'assign_to_album') {
                    if (albumSelector) {
                        albumSelector.style.display = 'block';
                    }
                } else {
                    if (albumSelector) {
                        albumSelector.style.display = 'none';
                    }
                }
            }

            // Show/hide album selector based on bulk action selection
            if (bulkActionTop) {
                bulkActionTop.addEventListener('change', toggleAlbumSelector);
            }
            if (bulkActionBottom) {
                bulkActionBottom.addEventListener('change', toggleAlbumSelector);
            }

            // Validate album selection before form submission
            var postsFilter = document.getElementById('posts-filter');
            if (postsFilter) {
                postsFilter.addEventListener('submit', function(e) {
                    var selectedTop = bulkActionTop ? bulkActionTop.value : '';
                    var selectedBottom = bulkActionBottom ? bulkActionBottom.value : '';
                    var albumId = albumSelect ? albumSelect.value : '';

                    if ((selectedTop === 'assign_to_album' || selectedBottom === 'assign_to_album') && !albumId) {
                        e.preventDefault();
                        alert('<?php echo esc_js( __( 'Please select an album to assign galleries to.', 'fotogrids' ) ); ?>');
                        return false;
                    }
                });
            }

            // Insert album selector after bulk actions
            var tablenavPages = document.querySelector('.tablenav-pages');
            if (tablenavPages && albumSelector) {
                tablenavPages.insertAdjacentElement('afterend', albumSelector);
                albumSelector.style.display = 'block';
            }
        });
        </script>
        <?php
    }

    /**
     * Suppress admin notices on FotoGrids pages
     * Removes all admin notices except FotoGrids' own notices
     */
    public static function suppress_admin_notices() {
        if ( ! Admin_Helpers::is_fotogrids_page() ) {
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
