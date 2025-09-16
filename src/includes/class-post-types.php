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
        add_action( 'save_post', array( __CLASS__, 'save_meta_boxes' ) );
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
            'supports'              => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
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
            'supports'              => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
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
        // Gallery meta boxes
        add_meta_box(
            'fotogrids_gallery_settings',
            __( 'Gallery Settings', 'fotogrids' ),
            array( __CLASS__, 'gallery_settings_meta_box' ),
            'fotogrids_gallery',
            'side',
            'high'
        );
        
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
            'fotogrids_album_settings',
            __( 'Album Settings', 'fotogrids' ),
            array( __CLASS__, 'album_settings_meta_box' ),
            'fotogrids_album',
            'side',
            'high'
        );
    }
    
    /**
     * Gallery settings meta box callback
     */
    public static function gallery_settings_meta_box( $post ) {
        // Add nonce for security
        wp_nonce_field( 'fotogrids_gallery_settings', 'fotogrids_gallery_settings_nonce' );
        
        // Get current values
        $layout = get_post_meta( $post->ID, 'fotogrids_layout', true ) ?: 'grid';
        $columns = get_post_meta( $post->ID, 'fotogrids_columns', true ) ?: 3;
        $album_id = get_post_meta( $post->ID, 'fotogrids_album_id', true );
        
        // Get albums for dropdown
        $albums = get_posts( array(
            'post_type' => 'fotogrids_album',
            'numberposts' => -1,
            'post_status' => 'publish',
        ) );
        
        ?>
        <table class="form-table">
            <tr>
                <th scope="row">
                    <label for="fotogrids_layout"><?php _e( 'Layout', 'fotogrids' ); ?></label>
                </th>
                <td>
                    <select name="fotogrids_layout" id="fotogrids_layout">
                        <option value="grid" <?php selected( $layout, 'grid' ); ?>><?php _e( 'Grid', 'fotogrids' ); ?></option>
                        <option value="masonry" <?php selected( $layout, 'masonry' ); ?>><?php _e( 'Masonry', 'fotogrids' ); ?></option>
                        <option value="justified" <?php selected( $layout, 'justified' ); ?>><?php _e( 'Justified', 'fotogrids' ); ?></option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="fotogrids_columns"><?php _e( 'Columns', 'fotogrids' ); ?></label>
                </th>
                <td>
                    <input type="number" name="fotogrids_columns" id="fotogrids_columns" 
                           value="<?php echo esc_attr( $columns ); ?>" min="1" max="12" />
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="fotogrids_album_id"><?php _e( 'Album', 'fotogrids' ); ?></label>
                </th>
                <td>
                    <select name="fotogrids_album_id" id="fotogrids_album_id">
                        <option value=""><?php _e( 'No Album', 'fotogrids' ); ?></option>
                        <?php foreach ( $albums as $album ) : ?>
                            <option value="<?php echo esc_attr( $album->ID ); ?>" 
                                    <?php selected( $album_id, $album->ID ); ?>>
                                <?php echo esc_html( $album->post_title ); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
        </table>
        <?php
    }
    
    /**
     * Gallery shortcode meta box callback
     */
    public static function gallery_shortcode_meta_box( $post ) {
        if ( $post->post_status === 'publish' ) {
            $shortcode = '[fotogrids_gallery id="' . $post->ID . '"]';
            ?>
            <p><?php _e( 'Use this shortcode to display the gallery:', 'fotogrids' ); ?></p>
            <input type="text" value="<?php echo esc_attr( $shortcode ); ?>" 
                   readonly onclick="this.select();" style="width: 100%;" />
            <p class="description">
                <?php _e( 'Click the shortcode to select it, then copy and paste it into your post or page.', 'fotogrids' ); ?>
            </p>
            <?php
        } else {
            ?>
            <p><?php _e( 'Publish the gallery to get the shortcode.', 'fotogrids' ); ?></p>
            <?php
        }
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
        
        // Get galleries for dropdown
        $galleries = get_posts( array(
            'post_type' => 'fotogrids_gallery',
            'numberposts' => -1,
            'post_status' => 'publish',
        ) );
        
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
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="fotogrids_featured_gallery"><?php _e( 'Featured Gallery', 'fotogrids' ); ?></label>
                </th>
                <td>
                    <select name="fotogrids_featured_gallery" id="fotogrids_featured_gallery">
                        <option value=""><?php _e( 'No Featured Gallery', 'fotogrids' ); ?></option>
                        <?php foreach ( $galleries as $gallery ) : ?>
                            <option value="<?php echo esc_attr( $gallery->ID ); ?>" 
                                    <?php selected( $featured_gallery, $gallery->ID ); ?>>
                                <?php echo esc_html( $gallery->post_title ); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
        </table>
        <?php
    }
    
    /**
     * Save meta box data
     */
    public static function save_meta_boxes( $post_id ) {
        // Check if this is an autosave
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }
        
        // Check user permissions
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }
        
        $post_type = get_post_type( $post_id );
        
        // Save gallery settings
        if ( $post_type === 'fotogrids_gallery' ) {
            if ( ! isset( $_POST['fotogrids_gallery_settings_nonce'] ) || 
                 ! wp_verify_nonce( $_POST['fotogrids_gallery_settings_nonce'], 'fotogrids_gallery_settings' ) ) {
                return;
            }
            
            $fields = array( 'fotogrids_layout', 'fotogrids_columns', 'fotogrids_album_id' );
            foreach ( $fields as $field ) {
                if ( isset( $_POST[ $field ] ) ) {
                    update_post_meta( $post_id, $field, sanitize_text_field( $_POST[ $field ] ) );
                }
            }
        }
        
        // Save album settings
        if ( $post_type === 'fotogrids_album' ) {
            if ( ! isset( $_POST['fotogrids_album_settings_nonce'] ) || 
                 ! wp_verify_nonce( $_POST['fotogrids_album_settings_nonce'], 'fotogrids_album_settings' ) ) {
                return;
            }
            
            $fields = array( 'fotogrids_album_layout', 'fotogrids_featured_gallery' );
            foreach ( $fields as $field ) {
                if ( isset( $_POST[ $field ] ) ) {
                    update_post_meta( $post_id, $field, sanitize_text_field( $_POST[ $field ] ) );
                }
            }
        }
    }
}
