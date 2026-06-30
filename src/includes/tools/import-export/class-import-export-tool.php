<?php
namespace FotoGrids\Tools\ImportExport;

use FotoGrids\Tools\Abstract_Tool;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Import / Export Tool
 *
 * Allows exporting gallery and album data to a portable JSON or XML file and
 * importing it back - useful for migrations, staging, and site cloning.
 *
 * REST routes:
 *   GET  /fotogrids/v1/admin/tools/import-export/export
 *   POST /fotogrids/v1/admin/tools/import-export/import  (phase: analyse | execute)
 *   GET  /fotogrids/v1/admin/tools/import-export/log
 *
 * @since 1.0.0
 */
class Import_Export_Tool extends Abstract_Tool {

	public function get_id(): string {
		return 'import-export';
	}

	public function get_label(): string {
		return __( 'Import / Export', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Move gallery data between sites, or keep a safe copy of your galleries, albums, items, statistics, and settings.', 'fotogrids' );
	}

	public function get_icon(): string {
		return 'switch_horizontal';
	}

	public function get_group(): string {
		return 'data';
	}

	public function get_capability(): string {
		return 'fotogrids_import_export';
	}

	public function is_available(): bool {
		return true;
	}

	/**
	 * Absolute URL to the compiled tool script.
	 * Webpack entry: 'tool-import-export'
	 * Output: dist/includes/tools/import-export/assets/import-export.js
	 */
	public function get_script_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/import-export/assets/import-export.js';
	}

	public function get_style_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/import-export/assets/import-export.css';
	}

	public function init(): void {
		require_once __DIR__ . '/class-import-export-data.php';

		// Export - sends a file download, bypasses normal REST response flow.
		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/import-export/export',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( Import_Export_Data::class, 'export' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => array(
						'include' => array(
							'type'    => 'array',
							'items'   => array( 'type' => 'string' ),
							'default' => array( 'galleries', 'albums', 'items', 'tags', 'settings', 'statistics', 'templates' ),
						),
						'format'  => array(
							'type'    => 'string',
							'enum'    => array( 'json', 'xml' ),
							'default' => 'json',
						),
					),
				),
			)
		);

		// Import - analyse or execute phase.
		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/import-export/import',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( Import_Export_Data::class, 'import' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => array(
						'phase'     => array(
							'type'     => 'string',
							'enum'     => array( 'analyse', 'execute' ),
							'required' => true,
						),
						'file'      => array(
							'type'     => 'string',
							'required' => true,
						),
						'format'    => array(
							'type' => 'string',
							'enum' => array( 'json', 'xml' ),
						),
						// Execute-only params.
						'include'   => array(
							'type'  => 'array',
							'items' => array( 'type' => 'string' ),
						),
						'galleries' => array(
							'type' => 'string',
							'enum' => array( 'skip', 'overwrite', 'duplicate' ),
						),
						'albums'    => array(
							'type' => 'string',
							'enum' => array( 'skip', 'overwrite', 'duplicate' ),
						),
					),
				),
			)
		);

		// Operation log.
		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/import-export/log',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( Import_Export_Data::class, 'log' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
			)
		);
	}
}
