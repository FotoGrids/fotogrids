<?php
namespace FotoGrids\Tools\ImportExport;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Import / Export Data
 *
 * REST handler stubs for the Import / Export tool.
 * Returns 501 Not Implemented until the feature is built.
 *
 * @since 1.0.0
 */
class Import_Export_Data {

	/**
	 * GET /fotogrids/v1/admin/tools/import-export/export
	 *
	 * @param  \WP_REST_Request $request
	 * @return \WP_Error
	 */
	public static function export( \WP_REST_Request $request ): \WP_Error {
		return new \WP_Error(
			'not_implemented',
			__( 'Import / Export is not yet available.', 'fotogrids' ),
			[ 'status' => 501 ]
		);
	}

	/**
	 * POST /fotogrids/v1/admin/tools/import-export/import
	 *
	 * @param  \WP_REST_Request $request
	 * @return \WP_Error
	 */
	public static function import( \WP_REST_Request $request ): \WP_Error {
		return new \WP_Error(
			'not_implemented',
			__( 'Import / Export is not yet available.', 'fotogrids' ),
			[ 'status' => 501 ]
		);
	}
}
