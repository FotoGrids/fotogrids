<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Custom Post Types Class
 * 
 * Registers and manages FotoGrids custom post types
 */
class Post_Types {
    
    /**
     * Initialize the class
     */
    public static function init() {
        add_action( 'init', array( __CLASS__, 'register_cpts' ) );
        add_action( 'add_meta_boxes', array( __CLASS__, 'add_meta_boxes' ) );
        
        add_filter( 'use_block_editor_for_post_type', array( __CLASS__, 'disable_gutenberg' ), 10, 2 );
    }
    
    /**
     * Register custom post types
     * 
     * Registers both Gallery and Album custom post types with their
     * respective labels, capabilities, and settings.
     * 
     * @since 1.0.0
     */
    public static function register_cpts() {
        self::register_gallery_cpt();
        
        self::register_album_cpt();
    }
    
    /**
     * Register Gallery Custom Post Type
     * 
     * Creates the fotogrids_gallery post type with appropriate labels,
     * capabilities, and REST API support. Post type is private but
     * accessible through the admin interface.
     * 
     * @since 1.0.0
     */
    private static function register_gallery_cpt() {
        $labels = array(
            'name'                  => _x( 'Galleries', 'Post type general name', 'fotogrids' ),
            'singular_name'         => _x( 'Gallery', 'Post type singular name', 'fotogrids' ),
            'menu_name'             => _x( 'Galleries', 'Admin Menu text', 'fotogrids' ),
            'name_admin_bar'        => _x( 'Gallery', 'Add New on Toolbar', 'fotogrids' ),
            'add_new'               => __( 'Add New', 'fotogrids' ),
            'add_new_item'          => __( 'Add New Gallery', 'fotogrids' ),
            'new_item'              => __( 'New Gallery', 'fotogrids' ),
            'edit_item'             => __( 'Edit Gallery', 'fotogrids' ),
            'view_item'             => __( 'View Gallery', 'fotogrids' ),
            'all_items'             => __( 'All Galleries', 'fotogrids' ),
            'search_items'          => __( 'Search Galleries', 'fotogrids' ),
            'parent_item_colon'     => __( 'Parent Galleries:', 'fotogrids' ),
            'not_found'             => __( 'No galleries found.', 'fotogrids' ),
            'not_found_in_trash'    => __( 'No galleries found in Trash.', 'fotogrids' ),
            'featured_item'        => _x( 'Gallery Featured Item', 'Overrides the "Featured Item" phrase', 'fotogrids' ),
            'set_featured_item'    => _x( 'Set featured item', 'Overrides the "Set featured item" phrase', 'fotogrids' ),
            'remove_featured_item' => _x( 'Remove featured item', 'Overrides the "Remove featured item" phrase', 'fotogrids' ),
            'use_featured_item'    => _x( 'Use as featured item', 'Overrides the "Use as featured item" phrase', 'fotogrids' ),
            'archives'              => _x( 'Gallery archives', 'The post type archive label', 'fotogrids' ),
            'insert_into_item'      => _x( 'Insert into gallery', 'Overrides the "Insert into post" phrase', 'fotogrids' ),
            'uploaded_to_this_item' => _x( 'Uploaded to this gallery', 'Overrides the "Uploaded to this post" phrase', 'fotogrids' ),
            'filter_items_list'     => _x( 'Filter galleries list', 'Screen reader text for the filter links', 'fotogrids' ),
            'items_list_navigation' => _x( 'Galleries list navigation', 'Screen reader text for the pagination', 'fotogrids' ),
            'items_list'            => _x( 'Galleries list', 'Screen reader text for the items list', 'fotogrids' ),
        );
        
        $args = array(
            'labels'                => $labels,
            'public'                => false,
            'publicly_queryable'    => false,
            'show_ui'               => true,
            'show_in_menu'          => false,
            'query_var'             => true,
            'rewrite'               => array( 'slug' => 'fotogrids-gallery' ),
            'capability_type'       => array( 'fotogrids_gallery', 'fotogrids_galleries' ),
            'map_meta_cap'          => true,
            'has_archive'           => false,
            'hierarchical'          => false,
            'menu_position'         => null,
            'menu_icon'             => 'dashicons-format-gallery',
            'supports'              => array( 'title', 'thumbnail' ),
            'show_in_rest'          => true,
            'rest_base'             => 'fotogrids-galleries',
            'rest_controller_class' => 'WP_REST_Posts_Controller',
        );
        
        register_post_type( 'fotogrids_gallery', $args );
    }
    
    /**
     * Register Album Custom Post Type
     * 
     * Creates the fotogrids_album post type with appropriate labels,
     * capabilities, and REST API support. Albums serve as containers
     * for organizing multiple galleries.
     * 
     * @since 1.0.0
     */
    private static function register_album_cpt() {
        $labels = array(
            'name'                  => _x( 'Albums', 'Post type general name', 'fotogrids' ),
            'singular_name'         => _x( 'Album', 'Post type singular name', 'fotogrids' ),
            'menu_name'             => _x( 'Albums', 'Admin Menu text', 'fotogrids' ),
            'name_admin_bar'        => _x( 'Album', 'Add New on Toolbar', 'fotogrids' ),
            'add_new'               => __( 'Add New', 'fotogrids' ),
            'add_new_item'          => __( 'Add New Album', 'fotogrids' ),
            'new_item'              => __( 'New Album', 'fotogrids' ),
            'edit_item'             => __( 'Edit Album', 'fotogrids' ),
            'view_item'             => __( 'View Album', 'fotogrids' ),
            'all_items'             => __( 'All Albums', 'fotogrids' ),
            'search_items'          => __( 'Search Albums', 'fotogrids' ),
            'parent_item_colon'     => __( 'Parent Albums:', 'fotogrids' ),
            'not_found'             => __( 'No albums found.', 'fotogrids' ),
            'not_found_in_trash'    => __( 'No albums found in Trash.', 'fotogrids' ),
            'featured_item'        => _x( 'Album Featured Item', 'Overrides the "Featured Item" phrase', 'fotogrids' ),
            'set_featured_item'    => _x( 'Set featured item', 'Overrides the "Set featured item" phrase', 'fotogrids' ),
            'remove_featured_item' => _x( 'Remove featured item', 'Overrides the "Remove featured item" phrase', 'fotogrids' ),
            'use_featured_item'    => _x( 'Use as featured item', 'Overrides the "Use as featured item" phrase', 'fotogrids' ),
            'archives'              => _x( 'Album archives', 'The post type archive label', 'fotogrids' ),
            'insert_into_item'      => _x( 'Insert into album', 'Overrides the "Insert into post" phrase', 'fotogrids' ),
            'uploaded_to_this_item' => _x( 'Uploaded to this album', 'Overrides the "Uploaded to this post" phrase', 'fotogrids' ),
            'filter_items_list'     => _x( 'Filter albums list', 'Screen reader text for the filter links', 'fotogrids' ),
            'items_list_navigation' => _x( 'Albums list navigation', 'Screen reader text for the pagination', 'fotogrids' ),
            'items_list'            => _x( 'Albums list', 'Screen reader text for the items list', 'fotogrids' ),
        );
        
        $args = array(
            'labels'                => $labels,
            'public'                => false,
            'publicly_queryable'    => false,
            'show_ui'               => true,
            'show_in_menu'          => false,            'query_var'             => true,
            'rewrite'               => array( 'slug' => 'fotogrids-album' ),
            'capability_type'       => array( 'fotogrids_album', 'fotogrids_albums' ),
            'map_meta_cap'          => true,
            'has_archive'           => false,
            'hierarchical'          => false,
            'menu_position'         => null,
            'menu_icon'             => 'dashicons-album',
            'supports'              => array( 'title', 'thumbnail' ),
            'show_in_rest'          => true,
            'rest_base'             => 'fotogrids-albums',
            'rest_controller_class' => 'WP_REST_Posts_Controller',
        );
        
        register_post_type( 'fotogrids_album', $args );
    }
    
    /**
     * Add meta boxes to post edit screens
     * 
     * Registers meta boxes for both gallery and album post types.
     * Gallery meta boxes include shortcode display, while album meta boxes
     * include gallery management, settings, and shortcode display.
     * 
     * @since 1.0.0
     */
    public static function add_meta_boxes() {
        add_meta_box(
            'fotogrids_gallery_shortcode',
            __( 'Gallery Shortcode', 'fotogrids' ),
            array( __CLASS__, 'shortcode_meta_box' ),
            'fotogrids_gallery',
            'side',
            'high'
        );
        
        add_meta_box(
            'fotogrids_album_shortcode',
            __( 'Album Shortcode', 'fotogrids' ),
            array( __CLASS__, 'shortcode_meta_box' ),
            'fotogrids_album',
            'side',
            'high'
        );
        
        add_meta_box(
            'fotogrids_album_galleries',
            __( 'Galleries', 'fotogrids' ),
            array( __CLASS__, 'album_galleries_meta_box' ),
            'fotogrids_album',
            'normal',
            'high'
        );
        
        add_meta_box(
            'fotogrids_album_settings',
            __( 'Album Settings', 'fotogrids' ),
            array( __CLASS__, 'album_settings_meta_box' ),
            'fotogrids_album',
            'normal',
            'default'
        );
    }
    
    
    /**
     * Shared shortcode meta box callback
     * 
     * Displays the appropriate shortcode for both galleries and albums.
     * Determines the post type and generates the correct shortcode format.
     * Includes copy functionality for easy shortcode usage.
     * 
     * @since 1.0.0
     * 
     * @param WP_Post $post The post object
     */
    public static function shortcode_meta_box( $post ) {
        if ( $post->post_status === 'publish' ) {
            $post_type = get_post_type( $post );
            
            if ( $post_type === 'fotogrids_gallery' ) {
                $shortcode = '[fotogrids_gallery id="' . $post->ID . '"]';
                $type_label = __( 'gallery', 'fotogrids' );
            } else {
                $shortcode = '[fotogrids_album id="' . $post->ID . '"]';
                $type_label = __( 'album', 'fotogrids' );
            }
            
            ?>
            <p class="fotogrids-shortcode-title"><?php printf( __( 'Use this shortcode to display the %s', 'fotogrids' ), $type_label ); ?></p>
            <div class="fotogrids-shortcode-container">
                <input type="text" value="<?php echo esc_attr( $shortcode ); ?>" 
                       readonly onclick="this.select();" class="fotogrids-shortcode-input" />
                <button type="button" class="fotogrids-button fotogrids-button--accent fotogrids-shortcode-copy" 
                        data-shortcode="<?php echo esc_attr( $shortcode ); ?>"
                        title="<?php esc_attr_e( 'Copy shortcode to clipboard', 'fotogrids' ); ?>">
                    <?php _e( 'Copy', 'fotogrids' ); ?>
                </button>
            </div>
            <div class="fotogrids-shortcode-copy-success">
                <?php _e( 'Shortcode copied to clipboard!', 'fotogrids' ); ?>
            </div>
            <p class="description">
                <?php _e( 'Click "Copy" to copy the shortcode to your clipboard, or click the shortcode field to select it manually.', 'fotogrids' ); ?>
            </p>
            <?php
        } else {
            $post_type = get_post_type( $post );
            $type_label = $post_type === 'fotogrids_gallery' ? __( 'gallery', 'fotogrids' ) : __( 'album', 'fotogrids' );
            ?>
            <p><?php printf( __( 'Publish the %s to get the shortcode.', 'fotogrids' ), $type_label ); ?></p>
            <?php
        }
    }
    
    /**
     * Album galleries meta box callback
     * 
     * Renders the React component container for managing gallery assignments
     * within an album. The actual functionality is handled by the React component.
     * 
     * @since 1.0.0
     * 
     * @param WP_Post $post The album post object
     */
    public static function album_galleries_meta_box( $post ) {
        wp_nonce_field( 'fotogrids_album_galleries', 'fotogrids_album_galleries_nonce' );
        
        ?>
        <div id="fotogrids-album-galleries-root">
            <!-- React Album Gallery Manager component will mount here -->
            <div class="fotogrids-loading">
                <span class="spinner is-active"></span>
                <?php _e( 'Loading gallery manager...', 'fotogrids' ); ?>
            </div>
        </div>
        <?php
    }
    
    /**
     * Album settings meta box callback
     * 
     * Renders form fields for album-specific settings including layout type
     * and featured gallery selection. Only galleries assigned to the album
     * are available for featured gallery selection.
     * 
     * @since 1.0.0
     * 
     * @param WP_Post $post The album post object
     */
    public static function album_settings_meta_box( $post ) {
        wp_nonce_field( 'fotogrids_album_settings', 'fotogrids_album_settings_nonce' );
        
        $layout = get_post_meta( $post->ID, 'fotogrids_album_layout', true ) ?: 'grid';
        $featured_gallery = get_post_meta( $post->ID, 'fotogrids_featured_gallery', true );
        
        $assigned_galleries = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $post->ID );
        
        ?>
        <table class="form-table">
            <tr>
                <th scope="row">
                    <label for="fotogrids_album_layout"><?php _e( 'Layout', 'fotogrids' ); ?></label>
                </th>
                <td>
                    <select name="fotogrids_album_layout" id="fotogrids_album_layout">
                        <option value="grid" <?php selected( $layout, 'grid' ); ?>><?php _e( 'Grid', 'fotogrids' ); ?></option>
                        <option value="list" <?php selected( $layout, 'list' ); ?>><?php _e( 'List', 'fotogrids' ); ?></option>
                    </select>
                    <p class="description"><?php _e( 'Choose how galleries are displayed in this album.', 'fotogrids' ); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="fotogrids_featured_gallery"><?php _e( 'Featured Gallery', 'fotogrids' ); ?></label>
                </th>
                <td>
                    <select name="fotogrids_featured_gallery" id="fotogrids_featured_gallery">
                        <option value=""><?php _e( 'No Featured Gallery', 'fotogrids' ); ?></option>
                        <?php foreach ( $assigned_galleries as $gallery ) : ?>
                            <option value="<?php echo esc_attr( $gallery->ID ); ?>" 
                                    <?php selected( $featured_gallery, $gallery->ID ); ?>>
                                <?php echo esc_html( $gallery->post_title ); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description"><?php _e( 'Select a gallery to be featured for this album. Only assigned galleries are available.', 'fotogrids' ); ?></p>
                </td>
            </tr>
        </table>
        <?php
    }
    
    /**
     * Disable Gutenberg block editor for FotoGrids post types
     * 
     * Prevents the block editor from being used on FotoGrids custom post types
     * since they use custom meta boxes and React components for content management.
     * 
     * @since 1.0.0
     * 
     * @param bool   $current_status Current block editor status
     * @param string $post_type      Post type being checked
     * @return bool Whether to use block editor
     */
    public static function disable_gutenberg( $current_status, $post_type ) {
        if ( in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album' ) ) ) {
            return false;
        }
        
        return $current_status;
    }
}
