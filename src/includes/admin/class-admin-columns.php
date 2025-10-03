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
        add_action( 'manage_fotogrids_gallery_posts_custom_column', array( __CLASS__, 'gallery_column_content' ), 10, 2 );
        
        add_filter( 'manage_fotogrids_album_posts_columns', array( __CLASS__, 'album_columns' ) );
        add_action( 'manage_fotogrids_album_posts_custom_column', array( __CLASS__, 'album_column_content' ), 10, 2 );
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
        $columns['fotogrids_stats'] = __( 'Views/Shares', 'fotogrids' );
        
        $columns['date'] = $date;
        
        return $columns;
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
                if ( get_post_status( $post_id ) === 'publish' ) {
                    $shortcode = '[fotogrids_gallery id="' . $post_id . '"]';
                    echo '<input type="text" value="' . esc_attr( $shortcode ) . '" readonly onclick="this.select();" style="width: 100%; font-size: 11px;" />';
                } else {
                    echo '<em>' . __( 'Publish to get shortcode', 'fotogrids' ) . '</em>';
                }
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
                echo '<span class="fotogrids-layout-badge layout-' . esc_attr( $layout ) . '">' . esc_html( ucfirst( $layout ) ) . '</span>';
                break;
                
            case 'fotogrids_items':
                $item_count = fotogrids_get_gallery_item_count( $post_id );
                echo '<strong>' . $item_count . '</strong>';
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
        $columns['fotogrids_stats'] = __( 'Views/Shares', 'fotogrids' );
        
        $columns['date'] = $date;
        
        return $columns;
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
                if ( get_post_status( $post_id ) === 'publish' ) {
                    $shortcode = '[fotogrids_album id="' . $post_id . '"]';
                    echo '<input type="text" value="' . esc_attr( $shortcode ) . '" readonly onclick="this.select();" style="width: 100%; font-size: 11px;" />';
                } else {
                    echo '<em>' . __( 'Publish to get shortcode', 'fotogrids' ) . '</em>';
                }
                break;
                
            case 'fotogrids_galleries':
                $galleries = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $post_id );
                $count = count( $galleries );
                
                if ( $count > 0 ) {
                    echo '<strong>' . $count . '</strong>';
                    
                    $gallery_names = array_map( function( $gallery ) {
                        return $gallery->post_title;
                    }, $galleries );
                    
                    if ( count( $gallery_names ) <= 3 ) {
                        echo '<div style="font-size: 11px; color: #666; margin-top: 2px;">' . 
                             implode( ', ', $gallery_names ) . '</div>';
                    } else {
                        echo '<div style="font-size: 11px; color: #666; margin-top: 2px;" title="' . 
                             esc_attr( implode( ', ', $gallery_names ) ) . '">' . 
                             implode( ', ', array_slice( $gallery_names, 0, 2 ) ) . 
                             ' and ' . ( count( $gallery_names ) - 2 ) . ' more...</div>';
                    }
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
