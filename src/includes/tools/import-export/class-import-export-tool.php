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
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ Import_Export_Data::class, 'export' ],
					'permission_callback' => [ $this, 'check_permission' ],
					'args'                => [
						'include' => [
							'type'    => 'array',
							'items'   => [ 'type' => 'string' ],
							'default' => [ 'galleries', 'albums', 'items', 'tags', 'settings', 'statistics', 'templates' ],
						],
						'format'  => [
							'type'    => 'string',
							'enum'    => [ 'json', 'xml' ],
							'default' => 'json',
						],
					],
				],
			]
		);

		// Import - analyse or execute phase.
		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/import-export/import',
			[
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ Import_Export_Data::class, 'import' ],
					'permission_callback' => [ $this, 'check_permission' ],
					'args'                => [
						'phase'  => [
							'type'     => 'string',
							'enum'     => [ 'analyse', 'execute' ],
							'required' => true,
						],
						'file'   => [
							'type'     => 'string',
							'required' => true,
						],
						'format' => [
							'type' => 'string',
							'enum' => [ 'json', 'xml' ],
						],
						// Execute-only params.
						'include'   => [
							'type'  => 'array',
							'items' => [ 'type' => 'string' ],
						],
						'galleries' => [
							'type' => 'string',
							'enum' => [ 'skip', 'overwrite', 'duplicate' ],
						],
						'albums'    => [
							'type' => 'string',
							'enum' => [ 'skip', 'overwrite', 'duplicate' ],
						],
					],
				],
			]
		);

		// Operation log.
		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/import-export/log',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ Import_Export_Data::class, 'log' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
	}
}
