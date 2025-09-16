<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Taxonomies Class
 * 
 * Registers and manages FotoGrids custom taxonomies
 */
class Taxonomies {
    
    /**
     * Initialize the class
     */
    public static function init() {
        add_action( 'init', array( __CLASS__, 'register_taxonomies' ) );
    }
    
    /**
     * Register custom taxonomies
     */
    public static function register_taxonomies() {
        // Register Tag taxonomy
        self::register_tag_taxonomy();
        
        // Register Person taxonomy
        self::register_person_taxonomy();
        
        // Register Location taxonomy
        self::register_location_taxonomy();
    }
    
    /**
     * Register Tag taxonomy for images and galleries
     */
    private static function register_tag_taxonomy() {
        $labels = array(
            'name'                       => _x( 'FG Tags', 'Taxonomy General Name', 'fotogrids' ),
            'singular_name'              => _x( 'FG Tag', 'Taxonomy Singular Name', 'fotogrids' ),
            'menu_name'                  => __( 'FG Tags', 'fotogrids' ),
            'all_items'                  => __( 'All FG Tags', 'fotogrids' ),
            'parent_item'                => __( 'Parent FG Tag', 'fotogrids' ),
            'parent_item_colon'          => __( 'Parent FG Tag:', 'fotogrids' ),
            'new_item_name'              => __( 'New FG Tag Name', 'fotogrids' ),
            'add_new_item'               => __( 'Add New FG Tag', 'fotogrids' ),
            'edit_item'                  => __( 'Edit FG Tag', 'fotogrids' ),
            'update_item'                => __( 'Update FG Tag', 'fotogrids' ),
            'view_item'                  => __( 'View FG Tag', 'fotogrids' ),
            'separate_items_with_commas' => __( 'Separate tags with commas', 'fotogrids' ),
            'add_or_remove_items'        => __( 'Add or remove tags', 'fotogrids' ),
            'choose_from_most_used'      => __( 'Choose from the most used', 'fotogrids' ),
            'popular_items'              => __( 'Popular FG Tags', 'fotogrids' ),
            'search_items'               => __( 'Search FG Tags', 'fotogrids' ),
            'not_found'                  => __( 'Not Found', 'fotogrids' ),
            'no_terms'                   => __( 'No tags', 'fotogrids' ),
            'items_list'                 => __( 'FG Tags list', 'fotogrids' ),
            'items_list_navigation'      => __( 'FG Tags list navigation', 'fotogrids' ),
        );
        
        $args = array(
            'labels'                     => $labels,
            'hierarchical'               => false,
            'public'                     => false,
            'show_ui'                    => true,
            'show_admin_column'          => true,
            'show_in_nav_menus'          => false,
            'show_tagcloud'              => false,
            'show_in_rest'               => true,
            'rest_base'                  => 'fotogrids-tags',
            'rest_controller_class'      => 'WP_REST_Terms_Controller',
            'rewrite'                    => array( 'slug' => 'fg-tag' ),
            'capabilities'               => array(
                'manage_terms' => 'manage_fotogrids',
                'edit_terms'   => 'edit_fotogrids',
                'delete_terms' => 'delete_fotogrids',
                'assign_terms' => 'edit_fotogrids',
            ),
        );
        
        register_taxonomy( 'fotogrids_tag', array( 'attachment', 'fotogrids_gallery' ), $args );
    }
    
    /**
     * Register Person taxonomy for tagging people in images
     */
    private static function register_person_taxonomy() {
        $labels = array(
            'name'                       => _x( 'People', 'Taxonomy General Name', 'fotogrids' ),
            'singular_name'              => _x( 'Person', 'Taxonomy Singular Name', 'fotogrids' ),
            'menu_name'                  => __( 'People', 'fotogrids' ),
            'all_items'                  => __( 'All People', 'fotogrids' ),
            'parent_item'                => __( 'Parent Person', 'fotogrids' ),
            'parent_item_colon'          => __( 'Parent Person:', 'fotogrids' ),
            'new_item_name'              => __( 'New Person Name', 'fotogrids' ),
            'add_new_item'               => __( 'Add New Person', 'fotogrids' ),
            'edit_item'                  => __( 'Edit Person', 'fotogrids' ),
            'update_item'                => __( 'Update Person', 'fotogrids' ),
            'view_item'                  => __( 'View Person', 'fotogrids' ),
            'separate_items_with_commas' => __( 'Separate people with commas', 'fotogrids' ),
            'add_or_remove_items'        => __( 'Add or remove people', 'fotogrids' ),
            'choose_from_most_used'      => __( 'Choose from the most used', 'fotogrids' ),
            'popular_items'              => __( 'Popular People', 'fotogrids' ),
            'search_items'               => __( 'Search People', 'fotogrids' ),
            'not_found'                  => __( 'Not Found', 'fotogrids' ),
            'no_terms'                   => __( 'No people', 'fotogrids' ),
            'items_list'                 => __( 'People list', 'fotogrids' ),
            'items_list_navigation'      => __( 'People list navigation', 'fotogrids' ),
        );
        
        $args = array(
            'labels'                     => $labels,
            'hierarchical'               => false,
            'public'                     => false,
            'show_ui'                    => true,
            'show_admin_column'          => true,
            'show_in_nav_menus'          => false,
            'show_tagcloud'              => false,
            'show_in_rest'               => true,
            'rest_base'                  => 'fotogrids-people',
            'rest_controller_class'      => 'WP_REST_Terms_Controller',
            'rewrite'                    => array( 'slug' => 'fg-person' ),
            'capabilities'               => array(
                'manage_terms' => 'manage_fotogrids',
                'edit_terms'   => 'edit_fotogrids',
                'delete_terms' => 'delete_fotogrids',
                'assign_terms' => 'edit_fotogrids',
            ),
        );
        
        register_taxonomy( 'fotogrids_person', array( 'attachment' ), $args );
    }
    
    /**
     * Register Location taxonomy for geographical tagging
     */
    private static function register_location_taxonomy() {
        $labels = array(
            'name'                       => _x( 'Locations', 'Taxonomy General Name', 'fotogrids' ),
            'singular_name'              => _x( 'Location', 'Taxonomy Singular Name', 'fotogrids' ),
            'menu_name'                  => __( 'Locations', 'fotogrids' ),
            'all_items'                  => __( 'All Locations', 'fotogrids' ),
            'parent_item'                => __( 'Parent Location', 'fotogrids' ),
            'parent_item_colon'          => __( 'Parent Location:', 'fotogrids' ),
            'new_item_name'              => __( 'New Location Name', 'fotogrids' ),
            'add_new_item'               => __( 'Add New Location', 'fotogrids' ),
            'edit_item'                  => __( 'Edit Location', 'fotogrids' ),
            'update_item'                => __( 'Update Location', 'fotogrids' ),
            'view_item'                  => __( 'View Location', 'fotogrids' ),
            'separate_items_with_commas' => __( 'Separate locations with commas', 'fotogrids' ),
            'add_or_remove_items'        => __( 'Add or remove locations', 'fotogrids' ),
            'choose_from_most_used'      => __( 'Choose from the most used', 'fotogrids' ),
            'popular_items'              => __( 'Popular Locations', 'fotogrids' ),
            'search_items'               => __( 'Search Locations', 'fotogrids' ),
            'not_found'                  => __( 'Not Found', 'fotogrids' ),
            'no_terms'                   => __( 'No locations', 'fotogrids' ),
            'items_list'                 => __( 'Locations list', 'fotogrids' ),
            'items_list_navigation'      => __( 'Locations list navigation', 'fotogrids' ),
        );
        
        $args = array(
            'labels'                     => $labels,
            'hierarchical'               => true,
            'public'                     => false,
            'show_ui'                    => true,
            'show_admin_column'          => true,
            'show_in_nav_menus'          => false,
            'show_tagcloud'              => false,
            'show_in_rest'               => true,
            'rest_base'                  => 'fotogrids-locations',
            'rest_controller_class'      => 'WP_REST_Terms_Controller',
            'rewrite'                    => array( 'slug' => 'fg-location' ),
            'capabilities'               => array(
                'manage_terms' => 'manage_fotogrids',
                'edit_terms'   => 'edit_fotogrids',
                'delete_terms' => 'delete_fotogrids',
                'assign_terms' => 'edit_fotogrids',
            ),
        );
        
        register_taxonomy( 'fotogrids_location', array( 'attachment' ), $args );
    }
    
    /**
     * Get all terms for a specific taxonomy with caching
     */
    public static function get_taxonomy_terms( $taxonomy, $args = array() ) {
        $cache_key = 'fotogrids_' . $taxonomy . '_terms_' . md5( serialize( $args ) );
        $terms = get_transient( $cache_key );
        
        if ( false === $terms ) {
            $default_args = array(
                'taxonomy' => $taxonomy,
                'hide_empty' => false,
                'orderby' => 'name',
                'order' => 'ASC',
            );
            
            $args = wp_parse_args( $args, $default_args );
            $terms = get_terms( $args );
            
            // Cache for 1 hour
            set_transient( $cache_key, $terms, HOUR_IN_SECONDS );
        }
        
        return $terms;
    }
    
    /**
     * Clear taxonomy caches when terms are updated
     */
    public static function clear_taxonomy_cache( $term_id, $tt_id, $taxonomy ) {
        if ( in_array( $taxonomy, array( 'fotogrids_tag', 'fotogrids_person', 'fotogrids_location' ) ) ) {
            // Clear all cached terms for this taxonomy
            global $wpdb;
            $wpdb->query( 
                $wpdb->prepare(
                    "DELETE FROM {$wpdb->options} 
                     WHERE option_name LIKE %s",
                    '_transient_fotogrids_' . $taxonomy . '_terms_%'
                )
            );
        }
    }
}

// Hook to clear cache when terms are updated
add_action( 'created_term', array( 'FotoGrids\Taxonomies', 'clear_taxonomy_cache' ), 10, 3 );
add_action( 'edited_term', array( 'FotoGrids\Taxonomies', 'clear_taxonomy_cache' ), 10, 3 );
add_action( 'delete_term', array( 'FotoGrids\Taxonomies', 'clear_taxonomy_cache' ), 10, 3 );
