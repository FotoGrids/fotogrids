<?php
namespace FotoGrids\REST\Gallery;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Gallery REST Routes Registration
 *
 * Handles registration of all gallery-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Gallery_Routes {

    /**
     * Register all gallery-related REST API routes
     *
     * Registers endpoints for gallery data retrieval, gallery listing,
     * and gallery item endpoints for both public and admin use.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register() {
        // Single gallery endpoint
        register_rest_route( 'fotogrids/v1', '/gallery/(?P<id>\d+)', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'get_gallery' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'preview' => array(
                        'default' => false,
                        'sanitize_callback' => 'rest_sanitize_boolean',
                    ),
                ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_read' ),
            ),
        ) );

        // Gallery password reveal endpoint (admin eye-button - permission-gated).
        register_rest_route( 'fotogrids/v1', '/gallery/(?P<id>\d+)/password', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'get_gallery_password' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_password_read' ),
                'args'                => array(
                    'id' => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
            ),
        ) );

        // Gallery unlock endpoint (public - visitor submits password to unlock).
        register_rest_route( 'fotogrids/v1', '/gallery/(?P<id>\d+)/unlock', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'unlock_gallery' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_unlock' ),
                'args'                => array(
                    'id' => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'password' => array(
                        'required'          => true,
                        'sanitize_callback' => function ( $value ) {
                            // Preserve special characters - strip_tags only.
                            return wp_strip_all_tags( (string) $value );
                        },
                    ),
                ),
            ),
        ) );

        // Gallery render endpoint — returns the rendered HTML and the
        // CSS-handle map for a gallery. Two distinct callers:
        //   1. Album_To_Gallery_Ajax (full render, no page param → server
        //      renders page 1 with the full wrapper).
        //   2. Pagination JS (page > 1 + partial='items_only' → server
        //      returns the layout's inner HTML only, plus pagination
        //      metadata for the client).
        // Public (same as gallery read) since albums and paginated
        // galleries can be embedded anywhere a visitor can already see
        // them.
        register_rest_route( 'fotogrids/v1', '/gallery/render', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'render_gallery' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_read' ),
                'args'                => array(
                    'gallery_id'     => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'page'           => array(
                        'default'           => 1,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ( $param ) {
                            return is_numeric( $param ) && (int) $param >= 1;
                        },
                    ),
                    'items_per_page' => array(
                        'default'           => 0,
                        'sanitize_callback' => 'absint',
                    ),
                    'breakpoint'     => array(
                        'default'           => 'desktop',
                        'sanitize_callback' => 'sanitize_key',
                        'validate_callback' => function ( $param ) {
                            return in_array( $param, array( 'desktop', 'tablet', 'mobile' ), true );
                        },
                    ),
                    'partial'        => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_key',
                        'validate_callback' => function ( $param ) {
                            return in_array( $param, array( '', 'items_only' ), true );
                        },
                    ),
                    // Random-sort seed echoed back by the client. Set
                    // on the initial render via data-fg-random-seed,
                    // sent on every paginated request so the shuffle
                    // stays stable across pages. 0/missing = let the
                    // server pick a fresh seed.
                    'random_seed'    => array(
                        'default'           => 0,
                        'sanitize_callback' => function ( $value ) {
                            if ( ! is_numeric( $value ) ) {
                                return 0;
                            }
                            $i = (int) $value;
                            return $i > 0 ? $i : 0;
                        },
                    ),
                    // Selected filter values per source arg key. Shape:
                    // { tags: ['nature', 'sky'], people: [...] }. Empty
                    // or missing keys are treated as "no filter" for
                    // that source. Sanitisation: keys → sanitize_key,
                    // each value → sanitize_text_field. Unknown keys
                    // ignored downstream by Context_Builder (only
                    // registered filter sources are consulted).
                    'filters'        => array(
                        'default'           => array(),
                        'sanitize_callback' => function ( $value ) {
                            if ( ! is_array( $value ) ) {
                                return array();
                            }
                            $out = array();
                            foreach ( $value as $k => $v ) {
                                $key = sanitize_key( (string) $k );
                                if ( $key === '' || ! is_array( $v ) ) {
                                    continue;
                                }
                                $vals = array();
                                foreach ( $v as $entry ) {
                                    if ( is_scalar( $entry ) ) {
                                        $vals[] = sanitize_text_field( (string) $entry );
                                    }
                                }
                                if ( ! empty( $vals ) ) {
                                    $out[ $key ] = array_values( array_unique( $vals ) );
                                }
                            }
                            return $out;
                        },
                    ),
                    // Visit-context album. The Album → Gallery AJAX
                    // decorator stamps the source album on each trigger;
                    // the JS client forwards it here so the rendered
                    // gallery's Collection_Header can build a back link /
                    // breadcrumb pointing at the originating album. 0 /
                    // missing means "no visit context", and the renderer
                    // falls through to Breadcrumb_Resolver's single-album
                    // fallback.
                    'via_album_id'   => array(
                        'default'           => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
        ) );

        // Lightbox slides endpoint — returns flat slide metadata
        // (no HTML) for a range of items in the gallery's filtered +
        // sorted sequence. Used by the lightbox to lazy-fetch slides
        // beyond the currently-loaded page. Same filter/seed semantics
        // as /gallery/render so the lightbox sees the same items in
        // the same order as the grid.
        register_rest_route( 'fotogrids/v1', '/gallery/lightbox/slides', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Gallery\Lightbox_Slides_Data', 'get_lightbox_slides' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_read' ),
                'args'                => array(
                    'gallery_id'  => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'offset'      => array(
                        'default'           => 0,
                        'sanitize_callback' => 'absint',
                    ),
                    'limit'       => array(
                        'default'           => 20,
                        'sanitize_callback' => function ( $value ) {
                            $n = is_numeric( $value ) ? (int) $value : 20;
                            return max( 1, min( 100, $n ) );
                        },
                    ),
                    'random_seed' => array(
                        'default'           => 0,
                        'sanitize_callback' => function ( $value ) {
                            if ( ! is_numeric( $value ) ) {
                                return 0;
                            }
                            $i = (int) $value;
                            return $i > 0 ? $i : 0;
                        },
                    ),
                    'filters'     => array(
                        'default'           => array(),
                        'sanitize_callback' => function ( $value ) {
                            if ( ! is_array( $value ) ) {
                                return array();
                            }
                            $out = array();
                            foreach ( $value as $k => $v ) {
                                $key = sanitize_key( (string) $k );
                                if ( $key === '' || ! is_array( $v ) ) {
                                    continue;
                                }
                                $vals = array();
                                foreach ( $v as $entry ) {
                                    if ( is_scalar( $entry ) ) {
                                        $vals[] = sanitize_text_field( (string) $entry );
                                    }
                                }
                                if ( ! empty( $vals ) ) {
                                    $out[ $key ] = array_values( array_unique( $vals ) );
                                }
                            }
                            return $out;
                        },
                    ),
                ),
            ),
        ) );

        // Featured item endpoint — sets or clears `_thumbnail_id` for the gallery.
        register_rest_route( 'fotogrids/v1', '/gallery/(?P<id>\d+)/featured-item', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'set_featured_item' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_featured_item_write' ),
                'args'                => array(
                    'id' => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'item_id' => array(
                        'required'          => false,
                        'default'           => null,
                        'sanitize_callback' => function ( $value ) {
                            if ( $value === null || $value === '' ) {
                                return null;
                            }
                            return absint( $value );
                        },
                    ),
                ),
            ),
        ) );

        // Gallery cache status endpoint (admin UI).
        register_rest_route( 'fotogrids/v1', '/gallery/(?P<id>\d+)/cache-status', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'get_cache_status' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_cache_status_read' ),
                'args'                => array(
                    'id' => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
            ),
        ) );

        // Gallery cache flush endpoint (admin UI).
        register_rest_route( 'fotogrids/v1', '/gallery/(?P<id>\d+)/cache', array(
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'flush_cache' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_cache_flush' ),
                'args'                => array(
                    'id' => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function ( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                ),
            ),
        ) );

        // Galleries list endpoint (for Gutenberg block)
        register_rest_route( 'fotogrids/v1', '/galleries', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'get_galleries_list' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_read' ),
                'args' => array(
                    'per_page' => array(
                        'default' => 20,
                        'sanitize_callback' => 'absint',
                    ),
                    'page' => array(
                        'default' => 1,
                        'sanitize_callback' => 'absint',
                    ),
                    'search' => array(
                        'default' => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
        ) );

        // Gallery items endpoint (for Gutenberg block)
        register_rest_route( 'fotogrids/v1', '/galleries/(?P<id>\d+)/items', array(
            array(
                'methods'  => \WP_REST_Server::READABLE,
                'callback' => array( '\FotoGrids\REST\Gallery\Gallery_Data', 'get_gallery_items_endpoint' ),
                'permission_callback' => array( '\FotoGrids\REST\Gallery\Gallery_Permissions', 'check_gallery_read' ),
                'args' => array(
                    'id' => array(
                        'required' => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => function( $param ) {
                            return is_numeric( $param ) && $param > 0;
                        },
                    ),
                    'limit' => array(
                        'default' => -1,
                        'sanitize_callback' => 'absint',
                    ),
                    'offset' => array(
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
        ) );
    }
}
