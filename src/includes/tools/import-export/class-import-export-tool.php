<?php
namespace FotoGrids\Tools\ImportExport;

use FotoGrids\Tools\Abstract_Tool;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Import / Export Tool
 *
 * Allows exporting gallery and album data to a portable format and
 * importing it back — useful for migrations, backups, and staging workflows.
 *
 * Status: not yet implemented. Registered so it appears in the Tools grid
 * as a coming-soon card. is_available() returns false.
 *
 * REST routes (registered but not yet implemented):
 *   GET  /fotogrids/v1/admin/tools/import-export/export
 *   POST /fotogrids/v1/admin/tools/import-export/import
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
		return __( 'Export your galleries, albums, and settings to a portable file. Import them on another site or after a fresh install.', 'fotogrids' );
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

	/**
	 * Not yet implemented — renders as a coming-soon card in the grid.
	 */
	public function is_available(): bool {
		return false;
	}

	/**
	 * Absolute URL to the compiled tool script.
	 * Webpack entry: 'tool-import-export'
	 * Output: dist/includes/tools/import-export/assets/import-export.js
	 */
	public function get_script_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/import-export/assets/import-export.js';
	}

	public function init(): void {
		require_once __DIR__ . '/class-import-export-data.php';

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/import-export/export',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ Import_Export_Data::class, 'export' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/import-export/import',
			[
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ Import_Export_Data::class, 'import' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);
	}

}
