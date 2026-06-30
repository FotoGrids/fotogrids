<?php
namespace FotoGrids\Tools\Migration;

use FotoGrids\Tools\Abstract_Tool;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Migration Tool
 *
 * Brings galleries created in WordPress core ([gallery] shortcodes and
 * gallery blocks) and in other gallery/slider plugins into FotoGrids.
 *
 * The WordPress core source imports for real; competitor gallery and slider
 * plugins are registered for discoverability and report whether their data is
 * present, but their import readers are not implemented yet.
 *
 * REST routes:
 *   GET  /fotogrids/v1/admin/tools/migration/sources
 *   GET  /fotogrids/v1/admin/tools/migration/scan
 *   POST /fotogrids/v1/admin/tools/migration/import
 *   GET  /fotogrids/v1/admin/tools/migration/log
 *
 * @since 1.0.0
 */
class Migration_Tool extends Abstract_Tool {

	public function get_id(): string {
		return 'migration';
	}

	public function get_label(): string {
		return __( 'Migrate from other plugins', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Import existing galleries from other plugins or WordPress core into FotoGrids, without rebuilding them manually.', 'fotogrids' );
	}

	public function get_icon(): string {
		return 'import';
	}

	public function get_image_bg_color(): ?string {
		return 'var(--fg-interactive-selected-bg-darker)';
	}

	/**
	 * {@inheritdoc}
	 *
	 * Grouped with Import / Export - both are data-movement tools.
	 *
	 * @since 1.0.0
	 */
	public function get_group(): string {
		return 'data';
	}

	/**
	 * {@inheritdoc}
	 *
	 * Custom capability so the Permissions Manager can expose per-tool
	 * access control independently of the global manage_fotogrids gate.
	 *
	 * @since 1.0.0
	 */
	public function get_capability(): string {
		return 'fotogrids_migration';
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function is_available(): bool {
		return true;
	}

	/**
	 * Absolute URL to the compiled tool script.
	 * Webpack entry: 'tool-migration'
	 * Output: dist/includes/tools/migration/assets/migration.js
	 */
	public function get_script_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/migration/assets/migration.js';
	}

	/**
	 * Absolute URL to the compiled tool stylesheet.
	 * Output: dist/includes/tools/migration/assets/migration.css
	 */
	public function get_style_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/migration/assets/migration.css';
	}

	/**
	 * {@inheritdoc}
	 *
	 * Loads and registers the migration sources, then registers the
	 * tool's REST routes.
	 *
	 * @since 1.0.0
	 */
	public function init(): void {
		$this->load_sources();

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/migration/sources',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( Migration_Data::class, 'sources' ),
				'permission_callback' => array( $this, 'check_permission' ),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/migration/scan',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( Migration_Data::class, 'scan' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'source' => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/migration/import',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( Migration_Data::class, 'import' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'source'   => array(
						'type'     => 'string',
						'required' => true,
					),
					'refs'     => array(
						'type'     => 'array',
						'items'    => array( 'type' => 'string' ),
						'required' => true,
					),
					'conflict' => array(
						'type'    => 'string',
						'enum'    => array( 'skip', 'duplicate' ),
						'default' => 'skip',
					),
				),
			)
		);

		register_rest_route(
			'fotogrids/v1',
			'/admin/tools/migration/log',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( Migration_Data::class, 'log' ),
				'permission_callback' => array( $this, 'check_permission' ),
			)
		);
	}

	/**
	 * Require the source layer and register every source.
	 *
	 * Registration order is the order the cards appear in the picker:
	 * WordPress core first, then gallery plugins, then slider plugins.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private function load_sources(): void {
		$dir = __DIR__ . '/sources/';

		require_once $dir . 'interface-source.php';
		require_once $dir . 'class-abstract-source.php';
		require_once $dir . 'class-source-registry.php';
		require_once $dir . 'class-gallery-writer.php';
		require_once $dir . 'class-wp-core-source.php';
		require_once $dir . 'class-nextgen-source.php';
		require_once $dir . 'class-envira-source.php';
		require_once $dir . 'class-foogallery-source.php';
		require_once $dir . 'class-modula-source.php';
		require_once $dir . 'class-tenweb-photo-gallery-source.php';
		require_once $dir . 'class-meow-gallery-source.php';
		require_once $dir . 'class-visual-portfolio-source.php';
		require_once $dir . 'class-responsive-lightbox-source.php';
		require_once $dir . 'class-robo-gallery-source.php';
		require_once $dir . 'class-bestwebsoft-gallery-source.php';
		require_once $dir . 'class-slider-revolution-source.php';
		require_once $dir . 'class-layerslider-source.php';
		require_once $dir . 'class-smart-slider-source.php';
		require_once $dir . 'class-metaslider-source.php';
		require_once __DIR__ . '/class-migration-data.php';

		$ns = 'FotoGrids\\Tools\\Migration\\Sources\\';

		$sources = array(
			$ns . 'WP_Core_Source',
			$ns . 'NextGen_Source',
			$ns . 'Envira_Source',
			$ns . 'FooGallery_Source',
			$ns . 'Modula_Source',
			$ns . 'TenWeb_Photo_Gallery_Source',
			$ns . 'Meow_Gallery_Source',
			$ns . 'Visual_Portfolio_Source',
			$ns . 'Responsive_Lightbox_Source',
			$ns . 'Robo_Gallery_Source',
			$ns . 'BestWebSoft_Gallery_Source',
			$ns . 'Slider_Revolution_Source',
			$ns . 'LayerSlider_Source',
			$ns . 'Smart_Slider_Source',
			$ns . 'MetaSlider_Source',
		);

		foreach ( $sources as $class ) {
			Sources\Source_Registry::register( new $class() );
		}
	}
}
