<?php
namespace FotoGrids\Tools\RegenThumbnails;

use FotoGrids\Tools\Abstract_Tool;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Regenerate Thumbnails Tool
 *
 * Rebuilds FotoGrids image derivatives (fotogrids_thumbnail, fotogrids_full,
 * and any gallery-custom sizes) for all attachment images used in galleries.
 *
 * REST routes (registered in init()):
 *   GET  /fotogrids/v1/admin/tools/regen-thumbnails/status
 *   POST /fotogrids/v1/admin/tools/regen-thumbnails/regenerate
 *
 * @since 1.0.0
 */
class Regen_Thumbnails_Tool extends Abstract_Tool {

	public function get_id(): string {
		return 'regen-thumbnails';
	}

	public function get_label(): string {
		return __( 'Regenerate Thumbnails', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Rebuild FotoGrids image derivatives for all gallery images. Run this after changing image size settings to apply the new dimensions to existing uploads.', 'fotogrids' );
	}

	public function get_icon(): string {
		return 'image';
	}

	public function get_group(): string {
		return 'maintenance';
	}

	/**
	 * Custom capability so the Permissions Manager can expose
	 * per-tool access control independently of the global
	 * manage_fotogrids gate.
	 */
	public function get_capability(): string {
		return 'fotogrids_regen_thumbnails';
	}

	/**
	 * Absolute URL to the compiled tool script.
	 * Webpack entry: 'tool-regen-thumbnails'
	 * Output: dist/includes/tools/regen-thumbnails/assets/regen-thumbnails.js
	 */
	public function get_script_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/regen-thumbnails/assets/regen-thumbnails.js';
	}

	public function init(): void {
		require_once __DIR__ . '/class-regen-thumbnails-data.php';

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/regen-thumbnails/status',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ Regen_Thumbnails_Data::class, 'get_status' ],
					'permission_callback' => [ $this, 'check_permission' ],
				],
			]
		);

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/regen-thumbnails/regenerate',
			[
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ Regen_Thumbnails_Data::class, 'regenerate_attachment' ],
					'permission_callback' => [ $this, 'check_permission' ],
					'args'                => [
						'attachment_id' => [
							'type'     => 'integer',
							'minimum'  => 1,
							'required' => true,
						],
					],
				],
			]
		);
	}

}
