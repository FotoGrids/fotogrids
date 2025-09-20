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
        // Meta box saving is handled by class-meta-boxes.php
        
        // Disable Gutenberg for our post types
        add_filter( 'use_block_editor_for_post_type', array( __CLASS__, 'disable_gutenberg' ), 10, 2 );
    }
    
    /**
     * Register custom post types
     */
    public static function register_cpts() {
        // Register Gallery CPT
        self::register_gallery_cpt();
        
        // Register Album CPT
        self::register_album_cpt();
    }
    
    /**
     * Register Gallery Custom Post Type
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
            'featured_image'        => _x( 'Gallery Featured Image', 'Overrides the "Featured Image" phrase', 'fotogrids' ),
            'set_featured_image'    => _x( 'Set featured image', 'Overrides the "Set featured image" phrase', 'fotogrids' ),
            'remove_featured_image' => _x( 'Remove featured image', 'Overrides the "Remove featured image" phrase', 'fotogrids' ),
            'use_featured_image'    => _x( 'Use as featured image', 'Overrides the "Use as featured image" phrase', 'fotogrids' ),
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
            'show_in_menu'          => false, // We'll add our own menu
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
            'featured_image'        => _x( 'Album Featured Image', 'Overrides the "Featured Image" phrase', 'fotogrids' ),
            'set_featured_image'    => _x( 'Set featured image', 'Overrides the "Set featured image" phrase', 'fotogrids' ),
            'remove_featured_image' => _x( 'Remove featured image', 'Overrides the "Remove featured image" phrase', 'fotogrids' ),
            'use_featured_image'    => _x( 'Use as featured image', 'Overrides the "Use as featured image" phrase', 'fotogrids' ),
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
            'show_in_menu'          => false, // We'll add our own menu
            'query_var'             => true,
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
     */
    public static function add_meta_boxes() {
        // Gallery meta boxes are handled by class-meta-boxes.php
        
        add_meta_box(
            'fotogrids_gallery_shortcode',
            __( 'Gallery Shortcode', 'fotogrids' ),
            array( __CLASS__, 'gallery_shortcode_meta_box' ),
            'fotogrids_gallery',
            'side',
            'high'
        );
        
        // Album meta boxes
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
     * Gallery shortcode meta box callback
     */
    public static function gallery_shortcode_meta_box( $post ) {
        if ( $post->post_status === 'publish' ) {
            $shortcode = '[fotogrids_gallery id="' . $post->ID . '"]';
            ?>
            <p><?php _e( 'Use this shortcode to display the gallery:', 'fotogrids' ); ?></p>
            <div class="fotogrids-shortcode-container" style="display: flex; gap: 10px; align-items: center;">
                <input type="text" value="<?php echo esc_attr( $shortcode ); ?>" 
                       readonly onclick="this.select();" style="flex: 1;" />
                <button type="button" class="button fotogrids-copy-shortcode" 
                        data-shortcode="<?php echo esc_attr( $shortcode ); ?>"
                        title="<?php esc_attr_e( 'Copy shortcode to clipboard', 'fotogrids' ); ?>">
                    <?php _e( 'Copy', 'fotogrids' ); ?>
                </button>
            </div>
            <p class="description">
                <?php _e( 'Click "Copy" to copy the shortcode to your clipboard, or click the shortcode field to select it manually.', 'fotogrids' ); ?>
            </p>
            <?php
        } else {
            ?>
            <p><?php _e( 'Publish the gallery to get the shortcode.', 'fotogrids' ); ?></p>
            <?php
        }
    }
    
    /**
     * Album galleries meta box callback
     */
    public static function album_galleries_meta_box( $post ) {
        // Add nonce for security
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
     */
    public static function album_settings_meta_box( $post ) {
        // Add nonce for security
        wp_nonce_field( 'fotogrids_album_settings', 'fotogrids_album_settings_nonce' );
        
        // Get current values
        $layout = get_post_meta( $post->ID, 'fotogrids_album_layout', true ) ?: 'grid';
        $featured_gallery = get_post_meta( $post->ID, 'fotogrids_featured_gallery', true );
        
        // Get assigned galleries for featured gallery dropdown
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
     * @param bool $current_status Current block editor status
     * @param string $post_type Post type being checked
     * @return bool Whether to use block editor
     */
    public static function disable_gutenberg( $current_status, $post_type ) {
        // Disable Gutenberg for our custom post types
        if ( in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album' ) ) ) {
            return false;
        }
        
        return $current_status;
    }
}
