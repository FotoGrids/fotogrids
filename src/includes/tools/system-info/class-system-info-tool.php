<?php
/**
 * System Info tool registration and REST routes.
 *
 * @package FotoGrids\Tools\SystemInfo
 * @since   1.0.0
 */

namespace FotoGrids\Tools\SystemInfo;

use FotoGrids\Tools\Abstract_Tool;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * System Info Tool
 *
 * Reports environment and FotoGrids state for support, and surfaces the
 * captured FotoGrids error log.
 *
 * REST routes (registered in init()):
 *   GET    /fotogrids/v1/admin/tools/system-info/report
 *   GET    /fotogrids/v1/admin/tools/system-info/errors
 *   DELETE /fotogrids/v1/admin/tools/system-info/errors
 *   GET    /fotogrids/v1/admin/tools/system-info/debug-log
 *
 * @since 1.0.0
 */
class System_Info_Tool extends Abstract_Tool {

	/**
	 * {@inheritdoc}
	 */
	public function get_id(): string {
		return 'system-info';
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_label(): string {
		return __( 'System Info', 'fotogrids' );
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_description(): string {
		return __( 'Check your site environment and FotoGrids setup at a glance. Copy the report into a support request so nothing needs chasing up.', 'fotogrids' );
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_icon(): string {
		return 'info_circle';
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_image_bg_color(): ?string {
		return 'var(--fg-interactive-selected-bg)';
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_group(): string {
		return 'maintenance';
	}

	/**
	 * {@inheritdoc}
	 *
	 * Custom capability so the Permissions Manager can grant read access to
	 * the system report without granting the rest of the FotoGrids admin.
	 */
	public function get_capability(): string {
		return 'fotogrids_view_system_info';
	}

	/**
	 * {@inheritdoc}
	 *
	 * Webpack entry: 'tool-system-info'
	 * Output: dist/includes/tools/system-info/assets/system-info.js
	 */
	public function get_script_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/system-info/assets/system-info.js';
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_style_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/system-info/assets/system-info.css';
	}

	/**
	 * {@inheritdoc}
	 */
	public function init(): void {
		require_once __DIR__ . '/class-system-info-data.php';

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/system-info/report',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( System_Info_Data::class, 'get_report' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
			)
		);

		$type_arg = array(
			'type'              => 'string',
			'default'           => '',
			'enum'              => array( '', 'php', 'js' ),
			'sanitize_callback' => 'sanitize_key',
		);

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/system-info/errors',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( System_Info_Data::class, 'get_errors' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => array( 'type' => $type_arg ),
				),
				array(
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => array( System_Info_Data::class, 'clear_errors' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => array( 'type' => $type_arg ),
				),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/system-info/debug-log',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( System_Info_Data::class, 'get_debug_log' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => array(
						'lines' => array(
							'type'    => 'integer',
							'minimum' => 10,
							'maximum' => 1000,
							'default' => 200,
						),
					),
				),
			)
		);
	}
}
