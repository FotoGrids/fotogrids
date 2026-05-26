<?php
namespace FotoGrids\Tools\RegenerateThumbnails;

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
 *   GET  /fotogrids/v1/admin/tools/regenerate-thumbnails/status
 *   POST /fotogrids/v1/admin/tools/regenerate-thumbnails/regenerate
 *
 * @since 1.0.0
 */
class Regenerate_Thumbnails_Tool extends Abstract_Tool {

	public function get_id(): string {
		return 'regenerate-thumbnails';
	}

	public function get_label(): string {
		return __( 'Regenerate Thumbnails', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Regenerate image derivatives for all gallery images. Run this after changing size settings so existing uploads use the new dimensions.', 'fotogrids' );
	}

	public function get_icon(): string {
		return 'image';
	}

	public function get_image_bg_color(): ?string {
		return 'var(--fg-interactive-selected-bg-darker)';
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
		return 'fotogrids_regenerate_thumbnails';
	}

	/**
	 * Absolute URL to the compiled tool script.
	 * Webpack entry: 'tool-regenerate-thumbnails'
	 * Output: dist/includes/tools/regenerate-thumbnails/assets/regenerate-thumbnails.js
	 */
	public function get_script_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/regenerate-thumbnails/assets/regenerate-thumbnails.js';
	}

	/**
	 * Absolute URL to the compiled tool stylesheet.
	 * Webpack entry: 'tool-regenerate-thumbnails' (SCSS imported from the JS entry,
	 * extracted by MiniCssExtractPlugin).
	 * Output: dist/includes/tools/regenerate-thumbnails/assets/regenerate-thumbnails.css
	 */
	public function get_style_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/regenerate-thumbnails/assets/regenerate-thumbnails.css';
	}

	public function init(): void {
		require_once __DIR__ . '/class-regenerate-thumbnails-data.php';

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/regenerate-thumbnails/status',
			[
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ Regenerate_Thumbnails_Data::class, 'get_status' ],
					'permission_callback' => [ $this, 'check_permission' ],
					'args'                => [
						'include_unused' => [
							'type'              => 'boolean',
							'default'           => false,
							'sanitize_callback' => 'rest_sanitize_boolean',
						],
						'page'           => [
							'type'    => 'integer',
							'minimum' => 1,
							'default' => 1,
						],
						'per_page'       => [
							'type'    => 'integer',
							'minimum' => 1,
							'maximum' => 200,
							'default' => 50,
						],
					],
				],
			]
		);

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/regenerate-thumbnails/regenerate',
			[
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ Regenerate_Thumbnails_Data::class, 'regenerate_attachment' ],
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
