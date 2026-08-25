<?php
/**
 * REST handlers for the System Info tool.
 *
 * @package FotoGrids\Tools\SystemInfo
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Tools\SystemInfo;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * System Info Data
 *
 * REST layer over the diagnostics classes.
 *
 * @since 1.0.0
 */
class System_Info_Data {

	/**
	 * Returns the system report as structured sections plus a plain-text
	 * rendering of the same data for the clipboard and the .txt download.
	 *
	 * @since  1.0.0
	 * @return \WP_REST_Response
	 */
	public static function get_report(): \WP_REST_Response {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/diagnostics/class-system-report.php';

		$sections = \FotoGrids\Diagnostics\System_Report::get_sections();

		return new \WP_REST_Response(
			array(
				'sections'     => $sections,
				'text'         => \FotoGrids\Diagnostics\System_Report::to_text( $sections ),
				'generated_at' => gmdate( 'c' ),
			),
			200
		);
	}

	/**
	 * Returns captured errors of one type.
	 *
	 * @since  1.0.0
	 * @param  \WP_REST_Request $request Incoming request.
	 * @return \WP_REST_Response
	 */
	public static function get_errors( \WP_REST_Request $request ): \WP_REST_Response {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/diagnostics/class-error-store.php';

		$type    = (string) $request->get_param( 'type' );
		$entries = \FotoGrids\Diagnostics\Error_Store::get_all( $type );

		return new \WP_REST_Response(
			array(
				'items' => $entries,
				'total' => count( $entries ),
			),
			200
		);
	}

	/**
	 * Deletes captured errors of one type.
	 *
	 * @since  1.0.0
	 * @param  \WP_REST_Request $request Incoming request.
	 * @return \WP_REST_Response
	 */
	public static function clear_errors( \WP_REST_Request $request ): \WP_REST_Response {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/diagnostics/class-error-store.php';

		$type = (string) $request->get_param( 'type' );

		return new \WP_REST_Response(
			array( 'cleared' => \FotoGrids\Diagnostics\Error_Store::clear( $type ) ),
			200
		);
	}

	/**
	 * Returns the tail of the WordPress debug log.
	 *
	 * @since  1.0.0
	 * @param  \WP_REST_Request $request Incoming request.
	 * @return \WP_REST_Response
	 */
	public static function get_debug_log( \WP_REST_Request $request ): \WP_REST_Response {
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/diagnostics/class-error-store.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/diagnostics/class-debug-log-reader.php';

		$lines = (int) $request->get_param( 'lines' );

		return new \WP_REST_Response(
			\FotoGrids\Diagnostics\Debug_Log_Reader::tail( $lines > 0 ? $lines : 200 ),
			200
		);
	}
}
