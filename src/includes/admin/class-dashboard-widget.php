<?php
namespace FotoGrids\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Dashboard Widget Class
 *
 * Handles the WordPress dashboard widget for FotoGrids
 */
class Dashboard_Widget {

    /*
     * ---------------------------------------------------------------------
     * PHPCS: WPDB direct-query sniffs disabled for this class.
     * ---------------------------------------------------------------------
     * This class is part of the FotoGrids custom-table data layer. Every
     * interpolated table name is built as `$wpdb->prefix . 'fotogrids_*'`
     * (or a WP core table such as $wpdb->posts) -- a trusted identifier that
     * WP placeholders cannot bind. All user-supplied *values* are passed
     * through $wpdb->prepare(); where SQL is assembled incrementally or uses
     * a generated %d IN() list, the prepare call is a separate statement the
     * sniff cannot follow. Custom tables have no WP_Query / core-API
     * equivalent and no object-cache layer applies at this level.
     * ---------------------------------------------------------------------
     */
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

    /**
     * Initialize the dashboard widget
     */
    public static function init() {
        add_action( 'wp_dashboard_setup', array( __CLASS__, 'add_dashboard_widget' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
    }

    /**
     * Add the dashboard widget
     */
    public static function add_dashboard_widget() {
        if ( ! current_user_can( 'manage_fotogrids' ) ) {
            return;
        }

        wp_add_dashboard_widget(
            'fotogrids_overview',
            __( 'FotoGrids Overview', 'fotogrids' ),
            array( __CLASS__, 'render_widget' )
        );
    }

    /**
     * Enqueue assets for the dashboard widget
     */
    public static function enqueue_assets( $hook ) {
        if ( $hook !== 'index.php' ) {
            return;
        }

        // Try to enqueue CSS - check both possible locations
        $css_paths = array(
            FOTOGRIDS_PLUGIN_DIR . 'assets/css/dashboard-widget-styles.css', // Webpack output name
            FOTOGRIDS_PLUGIN_DIR . 'assets/css/dashboard-widget.css',
        );

        foreach ( $css_paths as $css_path ) {
            if ( file_exists( $css_path ) ) {
                $css_url = FOTOGRIDS_PLUGIN_URL . str_replace( FOTOGRIDS_PLUGIN_DIR, '', $css_path );
                wp_enqueue_style(
                    'fotogrids-dashboard-widget',
                    $css_url,
                    array(),
                    FOTOGRIDS_VERSION
                );
                break;
            }
        }

        // Try to enqueue JS - check both possible locations
        $js_paths = array(
            FOTOGRIDS_PLUGIN_DIR . 'assets/js/dashboard-widget.js',
        );

        foreach ( $js_paths as $js_path ) {
            if ( file_exists( $js_path ) ) {
                $js_url = FOTOGRIDS_PLUGIN_URL . str_replace( FOTOGRIDS_PLUGIN_DIR, '', $js_path );
                wp_enqueue_script(
                    'fotogrids-dashboard-widget',
                    $js_url,
                    array( 'wp-api-fetch' ),
                    FOTOGRIDS_VERSION,
                    true
                );

                wp_localize_script( 'fotogrids-dashboard-widget', 'fotogridsDashboard', array(
                    'restUrl' => 'fotogrids/v1/',
                    'restNonce' => wp_create_nonce( 'wp_rest' ),
                    'pluginUrl' => FOTOGRIDS_PLUGIN_URL,
                    'version' => FOTOGRIDS_VERSION,
                ) );
                break;
            }
        }
    }

    /**
     * Render the dashboard widget
     */
    public static function render_widget() {
        $logo_svg = self::get_logo_svg();
        $version = FOTOGRIDS_VERSION;
        $create_gallery_url = admin_url( 'post-new.php?post_type=fotogrids_gallery' );
        $dashboard_url = admin_url( 'admin.php?page=fotogrids-dashboard' );
        $docs_url = 'https://go.fotogrids.com/docs/?utm_campaign=liteplugin&utm_source=WordPress&utm_medium=dashboard_widget&utm_content=docs&utm_locale=' . get_locale();
        $support_url = 'https://wordpress.org/support/plugin/fotogrids/';
        $upgrade_url = 'https://go.fotogrids.com/upgrade/?utm_campaign=liteplugin&utm_source=WordPress&utm_medium=dashboard_widget&utm_content=upgrade&utm_locale=' . get_locale();

        $stats = self::get_stats();
        $recently_edited = self::get_recently_edited();

        $stat_cards = array(
            array(
                'key' => 'galleries',
                'icon' => 'layout_3x3',
                'label' => __( 'Galleries', 'fotogrids' ),
                'value' => $stats['galleries'],
                'url' => admin_url( 'edit.php?post_type=fotogrids_gallery' ),
                'color' => 'blue',
            ),
            array(
                'key' => 'albums',
                'icon' => 'layout_2x2',
                'label' => __( 'Albums', 'fotogrids' ),
                'value' => $stats['albums'],
                'url' => admin_url( 'edit.php?post_type=fotogrids_album' ),
                'color' => 'red',
            ),
            array(
                'key' => 'items',
                'icon' => 'image',
                'label' => __( 'Items', 'fotogrids' ),
                'value' => $stats['items'],
                'url' => admin_url( 'admin.php?page=fotogrids-stats' ),
                'color' => 'yellow',
            ),
            array(
                'key' => 'interactions',
                'icon' => 'click',
                'label' => __( 'Interactions', 'fotogrids' ),
                'value' => $stats['views'],
                'url' => admin_url( 'admin.php?page=fotogrids-stats' ),
                'color' => 'grey',
            ),
        );
        ?>
        <div class="fotogrids-dashboard-widget">
            <div class="fotogrids-dw-header">
                <div class="fotogrids-dw-header-left">
                    <div class="fotogrids-dw-logo">
                        <?php \FotoGrids\Svg::render( $logo_svg ); ?>
                    </div>
                    <span class="fotogrids-dw-version">FotoGrids v<?php echo esc_html( $version ); ?></span>
                </div>
                <div class="fotogrids-dw-header-right">
                    <a href="<?php echo esc_url( $create_gallery_url ); ?>" class="button button-primary">
                        <?php esc_html_e( 'Create new Gallery', 'fotogrids' ); ?>
                    </a>
                    <a href="<?php echo esc_url( $dashboard_url ); ?>" class="button button-secondary">
                        <?php esc_html_e( 'Dashboard', 'fotogrids' ); ?>
                    </a>
                </div>
            </div>

            <div class="fotogrids-dw-stats">
                <?php foreach ( $stat_cards as $card ) : ?>
                    <a href="<?php echo esc_url( $card['url'] ); ?>" class="fotogrids-dw-stat-card" data-stat="<?php echo esc_attr( $card['key'] ); ?>" data-color="<?php echo esc_attr( $card['color'] ); ?>">
                        <div class="fotogrids-dw-stat-icon">
                            <?php \FotoGrids\Svg::render( self::get_icon( $card['icon'] ) ); ?>
                        </div>
                        <div class="fotogrids-dw-stat-content">
                            <span class="fotogrids-dw-stat-number"><?php echo esc_html( number_format_i18n( $card['value'] ) ); ?></span>
                            <?php echo esc_html( $card['label'] ); ?>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>

            <div class="fotogrids-dw-recent">
                <h3><?php esc_html_e( 'Recently Edited', 'fotogrids' ); ?></h3>
                <div class="fotogrids-dw-recent-list" id="fotogrids-dw-recent-list">
                    <?php if ( ! empty( $recently_edited ) ) : ?>
                        <?php foreach ( $recently_edited as $item ) : ?>
                            <div class="fotogrids-dw-recent-item">
                                <div class="fotogrids-dw-recent-item-title">
                                    <a href="<?php echo esc_url( $item['edit_url'] ); ?>">
                                        <?php echo esc_html( $item['title'] ); ?>
                                        <span class="dashicons dashicons-edit" />
                                    </a>
                                </div>
                                <div class="fotogrids-dw-recent-item-date">
                                    <?php echo esc_html( $item['modified_formatted'] ); ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php else : ?>
                        <div class="fotogrids-dw-empty"><?php esc_html_e( 'No recently edited galleries or albums.', 'fotogrids' ); ?></div>
                    <?php endif; ?>
                </div>
            </div>

            <div class="fotogrids-dw-news">
                <h3><?php esc_html_e( 'News & Updates', 'fotogrids' ); ?></h3>
                <div class="fotogrids-dw-news-list" id="fotogrids-dw-news-list">
                    <div class="fotogrids-dw-loading"><?php esc_html_e( 'Loading...', 'fotogrids' ); ?></div>
                </div>
            </div>

            <div class="fotogrids-dw-footer">
                <div class="fotogrids-dw-footer-links">
                    <a href="<?php echo esc_url( $docs_url ); ?>" target="_blank" rel="noopener noreferrer">
                        <?php esc_html_e( 'Docs', 'fotogrids' ); ?>
                        <span class="screen-reader-text"> (opens in a new tab)</span>
                        <span aria-hidden="true" class="dashicons dashicons-external"></span>
                    </a>
                    <a href="<?php echo esc_url( $support_url ); ?>" target="_blank" rel="noopener noreferrer">
                        <?php esc_html_e( 'Support', 'fotogrids' ); ?>
                        <span class="screen-reader-text"> (opens in a new tab)</span>
                        <span aria-hidden="true" class="dashicons dashicons-external"></span>
                    </a>
                </div>
                <div class="fotogrids-dw-footer-upgrade">
                    <a href="<?php echo esc_url( $upgrade_url ); ?>" target="_blank" rel="noopener noreferrer" class="button button-primary">
                        <?php esc_html_e( 'Upgrade', 'fotogrids' ); ?>
                    </a>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Get statistics
     *
     * @return array Statistics data
     */
    private static function get_stats() {
        global $wpdb;

        $gallery_counts = wp_count_posts( 'fotogrids_gallery' );
        $galleries_count = (int) ( array_sum( (array) $gallery_counts ) ?? 0 );

        $album_counts = wp_count_posts( 'fotogrids_album' );
        $albums_count = (int) ( array_sum( (array) $album_counts ) ?? 0 );

        $items_table = $wpdb->prefix . 'fotogrids_item_meta';
        $items_count = 0;

        if ( $wpdb->get_var( "SHOW TABLES LIKE '$items_table'" ) === $items_table ) {
            $items_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $items_table" );
        }

        $total_views = 0;
        $stats_table = $wpdb->prefix . 'fotogrids_statistics';
        if ( $wpdb->get_var( "SHOW TABLES LIKE '$stats_table'" ) === $stats_table ) {
            $stats_totals = \FotoGrids\Statistics::get_totals();
            $total_views = (int) ( $stats_totals['total_views'] ?? 0 );
        }

        return array(
            'galleries' => $galleries_count,
            'albums' => $albums_count,
            'items' => $items_count,
            'views' => $total_views,
        );
    }

    /**
     * Get recently edited galleries and albums
     *
     * @return array Recently edited items
     */
    private static function get_recently_edited() {
        $limit = 5;

        $galleries = get_posts( array(
            'post_type' => 'fotogrids_gallery',
            'post_status' => array( 'publish', 'draft', 'private' ),
            'posts_per_page' => $limit,
            'orderby' => 'modified',
            'order' => 'DESC',
        ) );

        $albums = get_posts( array(
            'post_type' => 'fotogrids_album',
            'post_status' => array( 'publish', 'draft', 'private' ),
            'posts_per_page' => $limit,
            'orderby' => 'modified',
            'order' => 'DESC',
        ) );

        $recent = array();

        foreach ( $galleries as $gallery ) {
            $recent[] = array(
                'id' => $gallery->ID,
                'title' => $gallery->post_title,
                'type' => 'gallery',
                'edit_url' => get_edit_post_link( $gallery->ID, 'raw' ),
                'modified' => $gallery->post_modified,
                'modified_formatted' => date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), strtotime( $gallery->post_modified ) ),
            );
        }

        foreach ( $albums as $album ) {
            $recent[] = array(
                'id' => $album->ID,
                'title' => $album->post_title,
                'type' => 'album',
                'edit_url' => get_edit_post_link( $album->ID, 'raw' ),
                'modified' => $album->post_modified,
                'modified_formatted' => date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), strtotime( $album->post_modified ) ),
            );
        }

        usort( $recent, function( $a, $b ) {
            return strtotime( $b['modified'] ) - strtotime( $a['modified'] );
        } );

        return array_slice( $recent, 0, $limit );
    }

    /**
     * Get icon SVG code
     *
     * @param string $icon_name Icon name
     * @return string Icon SVG
     */
    private static function get_icon( $icon_name ) {
        $icons = array(
            'layout_3x3' => '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="3" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="3" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="10" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="10" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="10" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="17" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="17" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="17" width="4" height="4" rx="0.4" stroke="currentColor" stroke-width="1.5"/></svg>',
            'layout_2x2' => '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="2"/></svg>',
            'image' => '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.27209 20.7279L10.8686 14.1314C11.2646 13.7354 11.4627 13.5373 11.691 13.4632C11.8918 13.3979 12.1082 13.3979 12.309 13.4632C12.5373 13.5373 12.7354 13.7354 13.1314 14.1314L19.6839 20.6839M14 15L16.8686 12.1314C17.2646 11.7354 17.4627 11.5373 17.691 11.4632C17.8918 11.3979 18.1082 11.3979 18.309 11.4632C18.5373 11.5373 18.7354 11.7354 19.1314 12.1314L22 15M10 9C10 10.1046 9.10457 11 8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9ZM6.8 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V7.8C22 6.11984 22 5.27976 21.673 4.63803C21.3854 4.07354 20.9265 3.6146 20.362 3.32698C19.7202 3 18.8802 3 17.2 3H6.8C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8V16.2C2 17.8802 2 18.7202 2.32698 19.362C2.6146 19.9265 3.07354 20.3854 3.63803 20.673C4.27976 21 5.11984 21 6.8 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            'click' => '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3.5V2M5.06066 5.06066L4 4M5.06066 13L4 14.0607M13 5.06066L14.0607 4M3.5 9H2M8.5 8.5L12.6111 21.2778L15.5 18.3889L19.1111 22L22 19.1111L18.3889 15.5L21.2778 12.6111L8.5 8.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        );

        return isset( $icons[ $icon_name ] ) ? $icons[ $icon_name ] : '';
    }

    /**
     * Get logo SVG
     */
    private static function get_logo_svg() {
        return \FotoGrids\Svg::fotogrids_icon( array( 'size' => 20 ) );
    }

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
