<?php
namespace FotoGrids\Tools\Migration;

use FotoGrids\Tools\Migration\Sources\Source_Registry;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Migration Data
 *
 * REST handlers for the Migration tool:
 *
 *   GET  /fotogrids/v1/admin/tools/migration/sources
 *   GET  /fotogrids/v1/admin/tools/migration/scan
 *   POST /fotogrids/v1/admin/tools/migration/import
 *   GET  /fotogrids/v1/admin/tools/migration/log
 *
 * Each handler delegates the actual reading/writing to the selected source;
 * this class only validates input, dispatches, and records the operation log.
 *
 * @since 1.0.0
 */
class Migration_Data {

	/**
	 * Option key holding the recent-operations log.
	 *
	 * @var string
	 */
	const LOG_OPTION = 'fotogrids_migration_log';

	/**
	 * Maximum number of log entries retained.
	 *
	 * @var int
	 */
	const LOG_MAX = 50;

	/**
	 * GET /admin/tools/migration/sources
	 *
	 * Returns the source manifest: id, label, description, icon, group,
	 * available, detected.
	 *
	 * @since 1.0.0
	 * @return \WP_REST_Response
	 */
	public static function sources(): \WP_REST_Response {
		$manifest = array();

		foreach ( Source_Registry::all() as $source ) {
			$manifest[] = array(
				'id'          => $source->get_id(),
				'label'       => $source->get_label(),
				'description' => $source->get_description(),
				'icon'        => $source->get_icon(),
				'brand_color' => $source->get_brand_color(),
				'group'       => $source->get_group(),
				'available'   => $source->is_available(),
				'detected'    => $source->is_detected(),
			);
		}

		return new \WP_REST_Response( $manifest, 200 );
	}

	/**
	 * GET /admin/tools/migration/scan?source=<id>
	 *
	 * Returns a preview of galleries the source would import.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function scan( \WP_REST_Request $request ) {
		$source = self::resolve_available_source( $request->get_param( 'source' ) );
		if ( is_wp_error( $source ) ) {
			return $source;
		}

		return new \WP_REST_Response(
			array(
				'source'    => $source->get_id(),
				'galleries' => $source->scan(),
			),
			200
		);
	}

	/**
	 * POST /admin/tools/migration/import
	 *
	 * Body: source (string), refs (string[]), conflict ('skip' | 'duplicate').
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function import( \WP_REST_Request $request ) {
		$source = self::resolve_available_source( $request->get_param( 'source' ) );
		if ( is_wp_error( $source ) ) {
			return $source;
		}

		$refs     = array_map( 'sanitize_text_field', (array) $request->get_param( 'refs' ) );
		$conflict = sanitize_key( (string) $request->get_param( 'conflict' ) );
		if ( ! in_array( $conflict, array( 'skip', 'duplicate' ), true ) ) {
			$conflict = 'skip';
		}

		if ( empty( $refs ) ) {
			return new \WP_Error(
				'fotogrids_migration_no_selection',
				__( 'Select at least one gallery to import.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$result = $source->import( $refs, $conflict );

		self::record_log(
			$source->get_id(),
			$source->get_label(),
			(int) $result['imported'],
			(int) $result['skipped']
		);

		return new \WP_REST_Response( $result, 200 );
	}

	/**
	 * GET /admin/tools/migration/log
	 *
	 * @since 1.0.0
	 * @return \WP_REST_Response
	 */
	public static function log(): \WP_REST_Response {
		return new \WP_REST_Response( (array) get_option( self::LOG_OPTION, array() ), 200 );
	}

	/**
	 * Resolve a source id to an available source, or a WP_Error.
	 *
	 * @since 1.0.0
	 * @param mixed $source_id Requested source id.
	 * @return \FotoGrids\Tools\Migration\Sources\Source_Interface|\WP_Error
	 */
	private static function resolve_available_source( $source_id ) {
		$source = Source_Registry::get( sanitize_key( (string) $source_id ) );

		if ( ! $source ) {
			return new \WP_Error(
				'fotogrids_migration_unknown_source',
				__( 'Unknown migration source.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		if ( ! $source->is_available() ) {
			return new \WP_Error(
				'fotogrids_migration_unavailable_source',
				__( 'Import for this source is not available yet.', 'fotogrids' ),
				array( 'status' => 409 )
			);
		}

		return $source;
	}

	/**
	 * Prepend an entry to the recent-operations log, trimmed to LOG_MAX.
	 *
	 * @since 1.0.0
	 * @param string $source_id    Source id.
	 * @param string $source_label Source label.
	 * @param int    $imported     Galleries imported.
	 * @param int    $skipped      Galleries skipped.
	 * @return void
	 */
	private static function record_log( string $source_id, string $source_label, int $imported, int $skipped ): void {
		$log = (array) get_option( self::LOG_OPTION, array() );

		array_unshift(
			$log,
			array(
				'time'     => current_time( 'mysql' ),
				'source'   => $source_id,
				'label'    => $source_label,
				'imported' => $imported,
				'skipped'  => $skipped,
				'user'     => get_current_user_id(),
			)
		);

		update_option( self::LOG_OPTION, array_slice( $log, 0, self::LOG_MAX ), false );
	}
}
