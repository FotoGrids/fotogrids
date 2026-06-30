<?php
/**
 * REST route registration for Permissions.
 *
 * @package FotoGrids\REST\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\REST\Permissions;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Two endpoints today; Pro registers additional ones in its own namespace.
 *
 * @since 1.0.0
 */
final class Register_Permissions_Routes {

	public static function register(): void {
		register_rest_route(
			'fotogrids/v1',
			'/permissions/registry',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( Permissions_Data::class, 'get_registry' ),
					'permission_callback' => array( Permissions_Permissions::class, 'check_read' ),
				),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/permissions/options',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( Permissions_Data::class, 'set_option' ),
					'permission_callback' => array( Permissions_Permissions::class, 'check_write_simple' ),
					'args'                => array(
						'key'   => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_key',
						),
						'value' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/permissions/simple',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( Permissions_Data::class, 'set_simple' ),
					'permission_callback' => array( Permissions_Permissions::class, 'check_write_simple' ),
					'args'                => array(
						'key'         => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_key',
						),
						'lowest_role' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_key',
						),
					),
				),
			)
		);
	}
}
