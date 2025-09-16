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
        
        // Add custom columns to post list tables
        add_filter( 'manage_fotogrids_gallery_posts_columns', array( __CLASS__, 'gallery_columns' ) );
        add_action( 'manage_fotogrids_gallery_posts_custom_column', array( __CLASS__, 'gallery_column_content' ), 10, 2 );
        
        add_filter( 'manage_fotogrids_album_posts_columns', array( __CLASS__, 'album_columns' ) );
        add_action( 'manage_fotogrids_album_posts_custom_column', array( __CLASS__, 'album_column_content' ), 10, 2 );
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
            'dashicons-format-gallery',
            30
        );
        
        // Galleries submenu
        add_submenu_page(
            'fotogrids',
            __( 'Galleries', 'fotogrids' ),
            __( 'Galleries', 'fotogrids' ),
            'edit_fotogrids',
            'edit.php?post_type=fotogrids_gallery'
        );
        
        // Albums submenu
        add_submenu_page(
            'fotogrids',
            __( 'Albums', 'fotogrids' ),
            __( 'Albums', 'fotogrids' ),
            'edit_fotogrids',
            'edit.php?post_type=fotogrids_album'
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
            'restUrl' => rest_url( 'fotogrids/v1/' ),
            'pluginUrl' => FOTOGRIDS_PLUGIN_URL,
            'currentUser' => wp_get_current_user(),
            'capabilities' => array(
                'manage_fotogrids' => current_user_can( 'manage_fotogrids' ),
                'edit_fotogrids' => current_user_can( 'edit_fotogrids' ),
                'view_fotogrids_stats' => current_user_can( 'view_fotogrids_stats' ),
            ),
        ) );
        
        // Set up translations
        wp_set_script_translations( 'fotogrids-admin', 'fotogrids', FOTOGRIDS_PLUGIN_DIR . 'languages' );
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
     * Main admin page
     */
    public static function main_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <div id="fotogrids-main-page">
                <!-- React component will be mounted here -->
            </div>
        </div>
        <?php
    }
    
    /**
     * Templates admin page
     */
    public static function templates_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <div id="fotogrids-templates-page">
                <!-- React component will be mounted here -->
            </div>
        </div>
        <?php
    }
    
    /**
     * Statistics admin page
     */
    public static function statistics_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <div id="fotogrids-stats-page">
                <!-- React component will be mounted here -->
            </div>
        </div>
        <?php
    }
    
    /**
     * Settings admin page
     */
    public static function settings_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <div id="fotogrids-settings-page">
                <!-- React component will be mounted here -->
            </div>
        </div>
        <?php
    }
    
    /**
     * License admin page
     */
    public static function license_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <div id="fotogrids-license-page">
                <!-- React component will be mounted here -->
            </div>
        </div>
        <?php
    }
    
    /**
     * Add custom columns to gallery list table
     */
    public static function gallery_columns( $columns ) {
        // Remove date column temporarily
        $date = $columns['date'];
        unset( $columns['date'] );
        
        // Add custom columns
        $columns['fotogrids_shortcode'] = __( 'Shortcode', 'fotogrids' );
        $columns['fotogrids_album'] = __( 'Album', 'fotogrids' );
        $columns['fotogrids_layout'] = __( 'Layout', 'fotogrids' );
        $columns['fotogrids_images'] = __( 'Images', 'fotogrids' );
        $columns['fotogrids_stats'] = __( 'Views/Shares', 'fotogrids' );
        
        // Re-add date column at the end
        $columns['date'] = $date;
        
        return $columns;
    }
    
    /**
     * Display content for custom gallery columns
     */
    public static function gallery_column_content( $column, $post_id ) {
        switch ( $column ) {
            case 'fotogrids_shortcode':
                if ( get_post_status( $post_id ) === 'publish' ) {
                    $shortcode = '[fotogrids_gallery id="' . $post_id . '"]';
                    echo '<input type="text" value="' . esc_attr( $shortcode ) . '" readonly onclick="this.select();" style="width: 100%; font-size: 11px;" />';
                } else {
                    echo '<em>' . __( 'Publish to get shortcode', 'fotogrids' ) . '</em>';
                }
                break;
                
            case 'fotogrids_album':
                $album_id = get_post_meta( $post_id, 'fotogrids_album_id', true );
                if ( $album_id ) {
                    $album = get_post( $album_id );
                    if ( $album ) {
                        echo '<a href="' . get_edit_post_link( $album_id ) . '">' . esc_html( $album->post_title ) . '</a>';
                    }
                } else {
                    echo '—';
                }
                break;
                
            case 'fotogrids_layout':
                $layout = get_post_meta( $post_id, 'fotogrids_layout', true ) ?: 'grid';
                echo '<span class="fotogrids-layout-badge layout-' . esc_attr( $layout ) . '">' . esc_html( ucfirst( $layout ) ) . '</span>';
                break;
                
            case 'fotogrids_images':
                $image_count = fotogrids_get_gallery_image_count( $post_id );
                echo '<strong>' . $image_count . '</strong>';
                break;
                
            case 'fotogrids_stats':
                $stats = Statistics::get( 'gallery', $post_id );
                if ( $stats ) {
                    echo '<div class="fotogrids-stats">';
                    echo '<span class="views">' . number_format( $stats['views'] ) . ' ' . __( 'views', 'fotogrids' ) . '</span><br>';
                    echo '<span class="shares">' . number_format( $stats['shares'] ) . ' ' . __( 'shares', 'fotogrids' ) . '</span>';
                    echo '</div>';
                } else {
                    echo '0 ' . __( 'views', 'fotogrids' ) . '<br>0 ' . __( 'shares', 'fotogrids' );
                }
                break;
        }
    }
    
    /**
     * Add custom columns to album list table
     */
    public static function album_columns( $columns ) {
        // Remove date column temporarily
        $date = $columns['date'];
        unset( $columns['date'] );
        
        // Add custom columns
        $columns['fotogrids_shortcode'] = __( 'Shortcode', 'fotogrids' );
        $columns['fotogrids_galleries'] = __( 'Galleries', 'fotogrids' );
        $columns['fotogrids_stats'] = __( 'Views/Shares', 'fotogrids' );
        
        // Re-add date column at the end
        $columns['date'] = $date;
        
        return $columns;
    }
    
    /**
     * Display content for custom album columns
     */
    public static function album_column_content( $column, $post_id ) {
        switch ( $column ) {
            case 'fotogrids_shortcode':
                if ( get_post_status( $post_id ) === 'publish' ) {
                    $shortcode = '[fotogrids_album id="' . $post_id . '"]';
                    echo '<input type="text" value="' . esc_attr( $shortcode ) . '" readonly onclick="this.select();" style="width: 100%; font-size: 11px;" />';
                } else {
                    echo '<em>' . __( 'Publish to get shortcode', 'fotogrids' ) . '</em>';
                }
                break;
                
            case 'fotogrids_galleries':
                $galleries = get_posts( array(
                    'post_type' => 'fotogrids_gallery',
                    'meta_query' => array(
                        array(
                            'key' => 'fotogrids_album_id',
                            'value' => $post_id,
                            'compare' => '=',
                        ),
                    ),
                    'numberposts' => -1,
                ) );
                echo '<strong>' . count( $galleries ) . '</strong>';
                break;
                
            case 'fotogrids_stats':
                $stats = Statistics::get( 'album', $post_id );
                if ( $stats ) {
                    echo '<div class="fotogrids-stats">';
                    echo '<span class="views">' . number_format( $stats['views'] ) . ' ' . __( 'views', 'fotogrids' ) . '</span><br>';
                    echo '<span class="shares">' . number_format( $stats['shares'] ) . ' ' . __( 'shares', 'fotogrids' ) . '</span>';
                    echo '</div>';
                } else {
                    echo '0 ' . __( 'views', 'fotogrids' ) . '<br>0 ' . __( 'shares', 'fotogrids' );
                }
                break;
        }
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
}
