<?php
namespace FotoGrids\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Admin Columns Class
 * 
 * Handles custom columns for FotoGrids post types in admin list tables
 */
class Admin_Columns {
    
    /**
     * Initialize the admin columns
     * 
     * Sets up WordPress hooks for custom columns in gallery and album list tables.
     * Registers column headers and content handlers for both post types.
     * 
     * @since 1.0.0
     */
    public static function init() {
        add_filter( 'manage_fotogrids_gallery_posts_columns', array( __CLASS__, 'gallery_columns' ) );
        add_filter( 'manage_fotogrids_gallery_posts_columns', array( __CLASS__, 'gallery_columns_whitelist' ), 9999 );
        add_action( 'manage_fotogrids_gallery_posts_custom_column', array( __CLASS__, 'gallery_column_content' ), 10, 2 );

        add_filter( 'manage_fotogrids_album_posts_columns', array( __CLASS__, 'album_columns' ) );
        add_filter( 'manage_fotogrids_album_posts_columns', array( __CLASS__, 'album_columns_whitelist' ), 9999 );
        add_action( 'manage_fotogrids_album_posts_custom_column', array( __CLASS__, 'album_column_content' ), 10, 2 );

        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_shortcode_column_script' ) );
    }

    /**
     * Enqueue shortcode column script and icons on gallery/album list table.
     */
    public static function enqueue_shortcode_column_script( $hook ) {
        $screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
        if ( ! $screen || ! in_array( $screen->id, array( 'edit-fotogrids_gallery', 'edit-fotogrids_album' ), true ) ) {
            return;
        }
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
            'fotogrids-shortcode-column-init',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/shortcode-column-init.js',
            array( 'fotogrids-icons' ),
            FOTOGRIDS_VERSION,
            true
        );
        wp_localize_script( 'fotogrids-shortcode-column-init', 'fotogridsShortcodeColumn', array(
            'copiedMessage'     => __( 'Shortcode copied to clipboard', 'fotogrids' ),
            'copyErrorMessage'  => __( 'Failed to copy Shortcode', 'fotogrids' ),
        ) );
    }
    
    /**
     * Add custom columns to gallery list table
     * 
     * Modifies the default WordPress columns for the gallery post type list table.
     * Adds custom columns for shortcode, album association, layout type, item count,
     * and statistics while preserving the date column at the end.
     * 
     * @since 1.0.0
     * 
     * @param array $columns Associative array of column IDs and labels
     * @return array Modified columns array with custom FotoGrids columns
     */
    public static function gallery_columns( $columns ) {
        $date = $columns['date'];
        unset( $columns['date'] );
        
        $columns['fotogrids_shortcode'] = __( 'Shortcode', 'fotogrids' );
        $columns['fotogrids_album'] = __( 'Album', 'fotogrids' );
        $columns['fotogrids_layout'] = __( 'Layout', 'fotogrids' );
        $columns['fotogrids_items'] = __( 'Items', 'fotogrids' );
        $columns['fotogrids_stats'] = __( 'Interactions', 'fotogrids' );
        
        $columns['date'] = $date;
        
        return $columns;
    }

    /**
     * Whitelist gallery columns to prevent other plugins from adding theirs
     *
     * Runs at priority 9999 so it executes after all other column filters.
     *
     * @since 1.0.0
     * @param array $columns Columns passed by previous filters
     * @return array Only allowed columns
     */
    /**
     * Render shortcode column: input-looking div (selectable) + copy button with icon.
     * Icon is injected by JS from window.FotoGridsIcons; copy handled by shortcode-column-init.js.
     *
     * @param int    $post_id       Post ID
     * @param string $shortcode_tag Shortcode tag (e.g. fotogrids_gallery, fotogrids_album)
     */
    private static function render_shortcode_column( $post_id, $shortcode_tag ) {
        $shortcode = '[' . $shortcode_tag . ' id="' . (int) $post_id . '"]';
        ?>
        <div class="fotogrids-shortcode-cell">
            <div class="fotogrids-shortcode-text" tabindex="0"><?php echo esc_html( $shortcode ); ?></div>
            <button type="button" class="fotogrids-button fotogrids-button--small fotogrids-button--secondary fotogrids-button--outline fotogrids-button--icon-only fotogrids-shortcode-copy-btn" data-shortcode="<?php echo esc_attr( $shortcode ); ?>" title="<?php esc_attr_e( 'Copy shortcode', 'fotogrids' ); ?>">
                <span class="fotogrids-icon" data-icon="clipboard"></span>
            </button>
        </div>
        <?php
    }

    public static function gallery_columns_whitelist( $columns ) {
        $allowed = array( 'cb', 'title', 'fotogrids_shortcode', 'fotogrids_album', 'fotogrids_layout', 'fotogrids_items', 'fotogrids_stats', 'date' );
        return array_intersect_key( $columns, array_flip( $allowed ) );
    }

    /**
     * Display content for custom gallery columns
     * 
     * Renders the content for each custom column in the gallery list table.
     * Handles shortcode display, album associations, layout badges, item counts,
     * and statistics for each gallery.
     * 
     * @since 1.0.0
     * 
     * @param string $column  The column ID being rendered
     * @param int    $post_id The ID of the post (gallery) being processed
     */
    public static function gallery_column_content( $column, $post_id ) {
        switch ( $column ) {
            case 'fotogrids_shortcode':
                self::render_shortcode_column( $post_id, 'fotogrids_gallery' );
                break;
                
            case 'fotogrids_album':
                $albums = \FotoGrids\Gallery_Album_Relations::get_albums_for_gallery( $post_id );
                if ( ! empty( $albums ) ) {
                    $album_links = array();
                    foreach ( $albums as $album ) {
                        $album_links[] = '<a href="' . get_edit_post_link( $album->ID ) . '">' . esc_html( $album->post_title ) . '</a>';
                    }
                    echo implode( ', ', $album_links );
                    
                    if ( count( $albums ) > 1 ) {
                        echo '<br><small style="color: #666;">(' . sprintf( __( '%d albums', 'fotogrids' ), count( $albums ) ) . ')</small>';
                    }
                } else {
                    echo '—';
                }
                break;
                
            case 'fotogrids_layout':
                $layout = get_post_meta( $post_id, 'fotogrids_layout', true ) ?: 'grid';
                echo '<span class="fotogrids-layout-badge layout-' . esc_attr( $layout ) . '">' . esc_html( str_replace( '-', ' ', ucfirst( $layout ) ) ) . '</span>';
                break;
                
            case 'fotogrids_items':
                $item_count = fotogrids_get_gallery_item_count( $post_id );
                echo $item_count === 0
                    ? '<span class="fotogrids-text--error">0</span>'
                    : esc_html( (string) $item_count );
                break;
                
            case 'fotogrids_stats':
                $stats = \FotoGrids\Statistics::get( 'gallery', $post_id );
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
     * 
     * Modifies the default WordPress columns for the album post type list table.
     * Adds custom columns for shortcode, associated galleries count, and statistics
     * while preserving the date column at the end.
     * 
     * @since 1.0.0
     * 
     * @param array $columns Associative array of column IDs and labels
     * @return array Modified columns array with custom FotoGrids columns
     */
    public static function album_columns( $columns ) {
        $date = $columns['date'];
        unset( $columns['date'] );
        
        $columns['fotogrids_shortcode'] = __( 'Shortcode', 'fotogrids' );
        $columns['fotogrids_galleries'] = __( 'Galleries', 'fotogrids' );
        $columns['fotogrids_stats'] = __( 'Interactions', 'fotogrids' );
        
        $columns['date'] = $date;
        
        return $columns;
    }

    /**
     * Whitelist album columns to prevent other plugins from adding theirs
     *
     * Runs at priority 9999 so it executes after all other column filters.
     *
     * @since 1.0.0
     * @param array $columns Columns passed by previous filters
     * @return array Only allowed columns
     */
    public static function album_columns_whitelist( $columns ) {
        $allowed = array( 'cb', 'title', 'fotogrids_shortcode', 'fotogrids_galleries', 'fotogrids_stats', 'date' );
        return array_intersect_key( $columns, array_flip( $allowed ) );
    }

    /**
     * Display content for custom album columns
     * 
     * Renders the content for each custom column in the album list table.
     * Handles shortcode display, gallery associations with counts and names,
     * and statistics for each album.
     * 
     * @since 1.0.0
     * 
     * @param string $column  The column ID being rendered
     * @param int    $post_id The ID of the post (album) being processed
     */
    public static function album_column_content( $column, $post_id ) {
        switch ( $column ) {
            case 'fotogrids_shortcode':
                self::render_shortcode_column( $post_id, 'fotogrids_album' );
                break;
                
            case 'fotogrids_galleries':
                $galleries = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $post_id );
                $count = count( $galleries );
                
                if ( $count > 0 ) {
                    echo '<strong>' . $count . '</strong>';
                } else {
                    echo '<span style="color: #999;">0</span>';
                }
                break;
                
            case 'fotogrids_stats':
                $stats = \FotoGrids\Statistics::get( 'album', $post_id );
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
}
