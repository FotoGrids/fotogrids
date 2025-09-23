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
        
        // Fix menu highlighting for custom post types
        add_action( 'admin_head', array( __CLASS__, 'fix_menu_highlighting' ) );
        
        // Initialize admin columns
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/admin/class-admin-columns.php';
        \FotoGrids\Admin\Admin_Columns::init();
        
        // Add bulk actions for gallery-album relationships
        add_filter( 'bulk_actions-edit-fotogrids_gallery', array( __CLASS__, 'gallery_bulk_actions' ) );
        add_filter( 'handle_bulk_actions-edit-fotogrids_gallery', array( __CLASS__, 'handle_gallery_bulk_actions' ), 10, 3 );
        add_action( 'admin_notices', array( __CLASS__, 'bulk_action_admin_notices' ) );
        add_action( 'admin_footer-edit.php', array( __CLASS__, 'bulk_action_album_selector' ) );
        
        // Initialize meta boxes
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-meta-boxes.php';
        Meta_Boxes::init();
    }
    
    /**
     * Add admin menu and submenus
     */
    public static function add_admin_menu() {
        // Main menu page
        add_menu_page(
            __( 'FotoGrids', 'fotogrids' ),
            __( 'FotoGrids', 'fotogrids' ),
            'manage_fotogrids',
            'fotogrids',
            array( __CLASS__, 'main_page' ),
            self::get_menu_icon(),
            30
        );
        
        // Dashboard submenu (same as main page)
        add_submenu_page(
            'fotogrids',
            __( 'Dashboard', 'fotogrids' ),
            __( 'Dashboard', 'fotogrids' ),
            'manage_fotogrids',
            'fotogrids', // Same slug as main menu
            array( __CLASS__, 'main_page' )
        );
        
        // Galleries submenu (WordPress native)
        add_submenu_page(
            'fotogrids',
            __( 'Galleries', 'fotogrids' ),
            __( 'Galleries', 'fotogrids' ),
            'edit_fotogrids_galleries',
            'edit.php?post_type=fotogrids_gallery',
            ''
        );
        
        // Albums submenu (WordPress native)
        add_submenu_page(
            'fotogrids',
            __( 'Albums', 'fotogrids' ),
            __( 'Albums', 'fotogrids' ),
            'edit_fotogrids_albums',
            'edit.php?post_type=fotogrids_album',
            ''
        );
        
        // Templates submenu
        add_submenu_page(
            'fotogrids',
            __( 'Templates', 'fotogrids' ),
            __( 'Templates', 'fotogrids' ),
            'manage_fotogrids',
            'fotogrids-templates',
            array( __CLASS__, 'templates_page' )
        );
        
        // Statistics submenu
        add_submenu_page(
            'fotogrids',
            __( 'Statistics', 'fotogrids' ),
            __( 'Statistics', 'fotogrids' ),
            'view_fotogrids_stats',
            'fotogrids-stats',
            array( __CLASS__, 'statistics_page' )
        );
        
        // Settings submenu
        add_submenu_page(
            'fotogrids',
            __( 'Settings', 'fotogrids' ),
            __( 'Settings', 'fotogrids' ),
            'manage_fotogrids_settings',
            'fotogrids-settings',
            array( __CLASS__, 'settings_page' )
        );
        
        // License submenu
        add_submenu_page(
            'fotogrids',
            __( 'License', 'fotogrids' ),
            __( 'License', 'fotogrids' ),
            'manage_fotogrids_settings',
            'fotogrids-license',
            array( __CLASS__, 'license_page' )
        );
        
        // Remove the duplicate main menu item
        remove_submenu_page( 'fotogrids', 'fotogrids' );
    }
    
    /**
     * Enqueue admin scripts and styles
     */
    public static function enqueue_admin_scripts( $hook ) {
        // Only load on FotoGrids pages
        if ( ! self::is_fotogrids_admin_page( $hook ) ) {
            return;
        }
        
        // Enqueue WordPress media scripts
        wp_enqueue_media();
        
        // Enqueue React and other WordPress dependencies
        wp_enqueue_script( 'wp-element' );
        wp_enqueue_script( 'wp-components' );
        wp_enqueue_script( 'wp-data' );
        wp_enqueue_script( 'wp-api-fetch' );
        wp_enqueue_script( 'wp-i18n' );
        wp_enqueue_script( 'wp-url' );
        
        // Enqueue our admin scripts
        wp_enqueue_script(
            'fotogrids-admin',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/admin.js',
            array( 'wp-element', 'wp-components', 'wp-data', 'wp-api-fetch', 'wp-i18n', 'media-upload' ),
            FOTOGRIDS_VERSION,
            true
        );
        
        // Enqueue admin styles
        wp_enqueue_style(
            'fotogrids-admin',
            FOTOGRIDS_PLUGIN_URL . 'assets/css/admin.css',
            array( 'wp-components' ),
            FOTOGRIDS_VERSION
        );
        
        // Localize script with data
        wp_localize_script( 'fotogrids-admin', 'fotogridsAdmin', array(
            'nonce' => wp_create_nonce( 'fotogrids_admin' ),
            'restUrl' => 'fotogrids/v1/',
            'restNonce' => wp_create_nonce( 'wp_rest' ),
            'pluginUrl' => FOTOGRIDS_PLUGIN_URL,
            'apiUrl' => home_url( '/wp-json/' ),
            'currentUser' => wp_get_current_user(),
            'capabilities' => array(
                'manage_fotogrids' => current_user_can( 'manage_fotogrids' ),
                'edit_fotogrids' => current_user_can( 'edit_fotogrids' ),
                'view_fotogrids_stats' => current_user_can( 'view_fotogrids_stats' ),
            ),
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
            
            // Load Chart.js from CDN
            wp_enqueue_script(
                'chartjs',
                'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js',
                array(),
                '4.4.0',
                true
            );
            
            // Load icons for stats page
            wp_enqueue_script(
                'fotogrids-icons',
                FOTOGRIDS_PLUGIN_URL . 'assets/admin/js/icons.js',
                array(),
                FOTOGRIDS_VERSION,
                true
            );
            
            wp_enqueue_script(
                'fotogrids-stats',
                FOTOGRIDS_PLUGIN_URL . 'assets/js/stats.js',
                array( 'wp-api-fetch', 'wp-element', 'chartjs', 'fotogrids-icons' ),
                FOTOGRIDS_VERSION,
                true
            );
        }
    }
    
    /**
     * Admin initialization
     */
    public static function admin_init() {
        // Register settings
        register_setting( 'fotogrids_settings', 'fotogrids_general_settings' );
        register_setting( 'fotogrids_settings', 'fotogrids_permission_settings' );
        register_setting( 'fotogrids_settings', 'fotogrids_integration_settings' );
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
        
        // Pages that should show the colorful icon
        $pages_with_icon = array( 'stats', 'settings', 'license' );
        $show_icon = in_array( $page_id, $pages_with_icon );
        
        ?>
        <div class="wrap">
            <div id="fotogrids-admin-header">
                <h1>
                    <?php if ( $show_icon && $icon_svg ) : ?>
                        <span class="fotogrids-page-icon"><?php echo $icon_svg; ?></span>
                    <?php endif; ?>
                    <?php echo esc_html( get_admin_page_title() ); ?>
                </h1>
            </div>
            <div id="fotogrids-<?php echo esc_attr( $page_id ); ?>-page" class="fotogrids-admin-page">
                <!-- React component will be mounted here -->
            </div>
        </div>
        <?php
    }
    
    /**
     * Main admin page
     */
    public static function main_page() {
        self::render_admin_page( 'admin-root' );
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
     * Check if current page is a FotoGrids admin page
     */
    private static function is_fotogrids_admin_page( $hook ) {
        // Main FotoGrids pages
        $fotogrids_pages = array(
            'toplevel_page_fotogrids',
            'fotogrids_page_fotogrids-templates',
            'fotogrids_page_fotogrids-stats',
            'fotogrids_page_fotogrids-settings',
            'fotogrids_page_fotogrids-license',
        );
        
        if ( in_array( $hook, $fotogrids_pages ) ) {
            return true;
        }
        
        // Post type pages
        global $post_type;
        if ( in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album' ) ) ) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Get custom menu icon
     */
    private static function get_menu_icon() {
        // Custom SVG icon as base64 data URI
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 59.53 59.53" fill="currentColor"><rect x="1.42" y="1.42" width="56.69" height="14.17"/><rect x="1.42" y="22.68" width="35.43" height="14.17"/><rect x="1.42" y="43.94" width="14.17" height="14.17"/><rect x="22.68" y="43.94" width="14.17" height="14.17"/><rect x="43.94" y="22.68" width="14.17" height="35.43"/></svg>';
        return 'data:image/svg+xml;base64,' . base64_encode( $svg );
    }
    
    /**
     * Add bulk actions for galleries
     */
    public static function gallery_bulk_actions( $bulk_actions ) {
        // Get all albums for the dropdown
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
                // Check if album ID is provided
                $album_id = isset( $_REQUEST['album_id'] ) ? absint( $_REQUEST['album_id'] ) : 0;
                if ( ! $album_id ) {
                    // If no album ID, redirect with error
                    $redirect_to = add_query_arg( 'bulk_error', 'no_album_selected', $redirect_to );
                    break;
                }
                
                // Verify album exists
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
                        // Get all albums this gallery is assigned to
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
        
        // Handle bulk assignment success
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
        
        // Handle bulk removal success
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
        
        // Handle bulk action errors
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
        
        // Get all albums for the dropdown
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
        <div id="fotogrids-bulk-album-selector" style="display: none; margin-top: 10px;">
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
        jQuery(document).ready(function($) {
            var $bulkActionTop = $('#bulk-action-selector-top');
            var $bulkActionBottom = $('#bulk-action-selector-bottom');
            var $albumSelector = $('#fotogrids-bulk-album-selector');
            var $albumSelect = $('#fotogrids-album-select');
            
            function toggleAlbumSelector() {
                var selectedTop = $bulkActionTop.val();
                var selectedBottom = $bulkActionBottom.val();
                
                if (selectedTop === 'assign_to_album' || selectedBottom === 'assign_to_album') {
                    $albumSelector.show();
                } else {
                    $albumSelector.hide();
                }
            }
            
            // Show/hide album selector based on bulk action selection
            $bulkActionTop.on('change', toggleAlbumSelector);
            $bulkActionBottom.on('change', toggleAlbumSelector);
            
            // Validate album selection before form submission
            $('form#posts-filter').on('submit', function(e) {
                var selectedTop = $bulkActionTop.val();
                var selectedBottom = $bulkActionBottom.val();
                var albumId = $albumSelect.val();
                
                if ((selectedTop === 'assign_to_album' || selectedBottom === 'assign_to_album') && !albumId) {
                    e.preventDefault();
                    alert('<?php echo esc_js( __( 'Please select an album to assign galleries to.', 'fotogrids' ) ); ?>');
                    return false;
                }
            });
            
            // Insert album selector after bulk actions
            $albumSelector.insertAfter('.tablenav-pages').show();
        });
        </script>
        <?php
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
}
