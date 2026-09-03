<?php
/**
 * Route registration for the media import endpoints.
 *
 * @package FotoGrids\REST\Media
 * @since   1.1.0
 */

namespace FotoGrids\REST\Media;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Media Import REST Routes Registration
 *
 * @since 1.1.0
 */
class Register_Media_Routes {

	/**
	 * Register the uploads-folder and ZIP import routes.
	 *
	 * @since 1.1.0
	 * @return void
	 */
	public static function register() {
		register_rest_route(
			'fotogrids/v1',
			'/media/folders',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( '\FotoGrids\REST\Media\Folder_Data', 'browse' ),
					'permission_callback' => array( '\FotoGrids\REST\Media\Media_Permissions', 'check_media_write' ),
					'args'                => array(
						'gallery_id' => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
							'description'       => __( 'The gallery being edited.', 'fotogrids' ),
						),
						'path'     => array(
							'default'     => '',
							'type'        => 'string',
							'description' => __( 'Folder path relative to the uploads folder.', 'fotogrids' ),
						),
						'page'     => array(
							'default'           => 1,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'per_page' => array(
							'default'           => 100,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
					),
				),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/media/folders/import',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( '\FotoGrids\REST\Media\Folder_Data', 'import' ),
					'permission_callback' => array( '\FotoGrids\REST\Media\Media_Permissions', 'check_media_write' ),
					'args'                => array(
						'gallery_id' => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
							'description'       => __( 'The gallery being edited.', 'fotogrids' ),
						),
						'files' => array(
							'required'    => true,
							'type'        => 'array',
							'items'       => array( 'type' => 'string' ),
							'description' => __( 'File paths relative to the uploads folder.', 'fotogrids' ),
						),
					),
				),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/media/zip',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( '\FotoGrids\REST\Media\Zip_Data', 'import' ),
					'permission_callback' => array( '\FotoGrids\REST\Media\Media_Permissions', 'check_media_write' ),
					'args'                => array(
						'gallery_id' => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
							'description'       => __( 'The gallery being edited.', 'fotogrids' ),
						),
					),
				),
			)
		);
	}
}
