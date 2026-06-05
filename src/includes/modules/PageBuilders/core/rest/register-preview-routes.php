<?php
/**
 * Registers the Page Builders preview + picker REST routes.
 *
 * @package FotoGrids\Modules\PageBuilders\REST
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\REST;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Route registration. Bound from `Module::register_rest_routes()` on
 * `rest_api_init`.
 *
 * Routes (all under `fotogrids/v1`):
 *
 *   POST /preview/gallery/{id}    safe-preview render of a gallery
 *   POST /preview/album/{id}      safe-preview render of an album
 *   GET  /picker/items            paged + searched listing for the picker
 *
 * Every route is admin-gated; the preview pipeline intentionally bypasses
 * the password gate, which would be a privacy hole if exposed
 * unauthenticated.
 *
 * @since 1.0.0
 */
final class Register_Preview_Routes {

    /**
     * Register every Page Builders REST route.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register(): void {
        self::register_gallery_preview_route();
        self::register_album_preview_route();
        self::register_picker_items_route();
        self::register_import_core_gallery_route();
    }

    /**
     * POST /import/core-gallery
     *
     * Powers the `core/gallery` -> `fotogrids/gallery` block transform.
     *
     * @since 1.0.0
     * @return void
     */
    private static function register_import_core_gallery_route(): void {
        register_rest_route( 'fotogrids/v1', '/import/core-gallery', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ Preview_Data::class, 'import_core_gallery' ],
                'permission_callback' => [ Preview_Permissions::class, 'check_preview_read' ],
                'args'                => [
                    'attachment_ids' => [
                        'required'          => true,
                        'sanitize_callback' => static function ( $value ) {
                            if ( ! is_array( $value ) ) {
                                return [];
                            }
                            return array_values( array_filter( array_map( 'absint', $value ) ) );
                        },
                        'validate_callback' => static fn( $value ) => is_array( $value ),
                    ],
                    'title'          => [
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ] );
    }

    /**
     * POST /preview/gallery/{id}
     *
     * @since 1.0.0
     * @return void
     */
    private static function register_gallery_preview_route(): void {
        register_rest_route( 'fotogrids/v1', '/preview/gallery/(?P<id>\d+)', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ Preview_Data::class, 'render_gallery_preview' ],
                'permission_callback' => [ Preview_Permissions::class, 'check_preview_read' ],
                'args'                => [
                    'id'      => [
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => static fn( $param ) => is_numeric( $param ) && (int) $param > 0,
                    ],
                    'version' => [
                        'default'           => 2,
                        'sanitize_callback' => 'absint',
                    ],
                    'preview_options' => [
                        'default'           => [],
                        'sanitize_callback' => static function ( $value ) {
                            return is_array( $value ) ? $value : [];
                        },
                    ],
                ],
            ],
        ] );
    }

    /**
     * POST /preview/album/{id}
     *
     * @since 1.0.0
     * @return void
     */
    private static function register_album_preview_route(): void {
        register_rest_route( 'fotogrids/v1', '/preview/album/(?P<id>\d+)', [
            [
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => [ Preview_Data::class, 'render_album_preview' ],
                'permission_callback' => [ Preview_Permissions::class, 'check_preview_read' ],
                'args'                => [
                    'id' => [
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                        'validate_callback' => static fn( $param ) => is_numeric( $param ) && (int) $param > 0,
                    ],
                    'preview_options' => [
                        'default'           => [],
                        'sanitize_callback' => static function ( $value ) {
                            return is_array( $value ) ? $value : [];
                        },
                    ],
                ],
            ],
        ] );
    }

    /**
     * GET /picker/items
     *
     * @since 1.0.0
     * @return void
     */
    private static function register_picker_items_route(): void {
        register_rest_route( 'fotogrids/v1', '/picker/items', [
            [
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => [ Preview_Data::class, 'get_picker_items' ],
                'permission_callback' => [ Preview_Permissions::class, 'check_preview_read' ],
                'args'                => [
                    'type'     => [
                        'default'           => 'gallery',
                        'sanitize_callback' => static function ( $value ) {
                            $value = is_string( $value ) ? strtolower( $value ) : 'gallery';
                            return in_array( $value, [ 'gallery', 'album' ], true ) ? $value : 'gallery';
                        },
                    ],
                    'page'     => [
                        'default'           => 1,
                        'sanitize_callback' => 'absint',
                    ],
                    'per_page' => [
                        'default'           => 24,
                        'sanitize_callback' => 'absint',
                    ],
                    'search'   => [
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'orderby'  => [
                        'default'           => 'newest',
                        'sanitize_callback' => static function ( $value ) {
                            $value = is_string( $value ) ? strtolower( $value ) : 'newest';
                            $allowed = [ 'newest', 'oldest', 'title', 'modified' ];
                            return in_array( $value, $allowed, true ) ? $value : 'newest';
                        },
                    ],
                ],
            ],
        ] );
    }
}
