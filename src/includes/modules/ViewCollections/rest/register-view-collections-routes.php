<?php
/**
 * Route registration for the view collections REST resource.
 *
 * @package FotoGrids\Modules\ViewCollections\REST
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections\REST;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Registers the view page REST routes under fotogrids/v1.
 *
 * @since 1.0.0
 */
class Register_View_Collections_Routes {

	/**
	 * Register all view page routes.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function register() {
		register_rest_route(
			'fotogrids/v1',
			'/view/(?P<id>\d+)/settings',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( '\FotoGrids\Modules\ViewCollections\REST\View_Collections_Data', 'get_settings' ),
					'permission_callback' => array( '\FotoGrids\Modules\ViewCollections\REST\View_Collections_Permissions', 'check_read' ),
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
			)
		);
	}
}
