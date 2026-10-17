<?php
namespace FotoGrids\REST\Album;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Registers the album REST API routes.
 *
 * @since 1.0.0
 */
class Register_Album_Routes {

	/**
	 * Registers all album REST API routes.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function register() {
		// Single album endpoint
		register_rest_route(
			'fotogrids/v1',
			'/album/(?P<id>\d+)',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( '\FotoGrids\REST\Album\Album_Data', 'get_album' ),
					'args'                => array(
						'id' => array(
							'required'          => true,
							'sanitize_callback' => 'absint',
							'validate_callback' => function ( $param ) {
								return is_numeric( $param ) && $param > 0;
							},
						),
					),
					'permission_callback' => array( '\FotoGrids\REST\Album\Album_Permissions', 'check_album_read' ),
				),
			)
		);

		// Featured gallery endpoint
		register_rest_route(
			'fotogrids/v1',
			'/album/(?P<id>\d+)/featured-gallery',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( '\FotoGrids\REST\Album\Album_Data', 'set_featured_gallery' ),
					'permission_callback' => array( '\FotoGrids\REST\Album\Album_Permissions', 'check_featured_gallery_write' ),
					'args'                => array(
						'id'         => array(
							'required'          => true,
							'sanitize_callback' => 'absint',
							'validate_callback' => function ( $param ) {
								return is_numeric( $param ) && $param > 0;
							},
						),
						'gallery_id' => array(
							'required'          => false,
							'default'           => null,
							'sanitize_callback' => function ( $value ) {
								if ( null === $value || '' === $value ) {
									return null;
								}
								return absint( $value );
							},
						),
					),
				),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/album/(?P<id>\d+)/unlock',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( '\FotoGrids\REST\Album\Album_Data', 'unlock_album' ),
					'permission_callback' => array( '\FotoGrids\REST\Album\Album_Permissions', 'check_album_unlock' ),
					'args'                => array(
						'id'          => array(
							'required'          => true,
							'sanitize_callback' => 'absint',
							'validate_callback' => function ( $param ) {
								return is_numeric( $param ) && $param > 0;
							},
						),
						'password'    => array(
							'required'          => true,
							'sanitize_callback' => function ( $value ) {
								return wp_strip_all_tags( (string) $value );
							},
						),
						'instance_id' => array(
							'type'              => 'string',
							'default'           => '',
							'validate_callback' => function ( $param, $request ) {
								return '' === $param
									|| ( is_string( $param )
										&& \FotoGrids\Render\Internal\Instance_Id_Factory::matches( (int) $request['id'], $param ) );
							},
						),
						'template'    => array(
							'type'              => 'string',
							'default'           => '',
							'validate_callback' => function ( $param ) {
								return '' === $param || \FotoGrids\Public_Render::is_layout_key( $param );
							},
						),
					),
				),
			)
		);

		// Albums list endpoint
		register_rest_route(
			'fotogrids/v1',
			'/albums',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( '\FotoGrids\REST\Album\Album_Data', 'get_albums_list' ),
					'permission_callback' => array( '\FotoGrids\REST\Album\Album_Permissions', 'check_albums_list' ),
				),
			)
		);
	}
}
