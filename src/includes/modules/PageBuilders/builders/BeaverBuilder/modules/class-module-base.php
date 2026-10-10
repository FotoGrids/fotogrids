<?php
/**
 * Shared base for the FotoGrids Beaver Builder modules.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules
 * @since   1.3.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Base Beaver Builder module for a FotoGrids collection.
 *
 * The collection itself renders through the shortcode pipeline. Module
 * directories are passed explicitly so templates resolve on symlinked
 * installs, where the class file path does not sit under ABSPATH.
 *
 * @since 1.3.0
 */
abstract class Module_Base extends \FLBuilderModule {

	/**
	 * Build the module.
	 *
	 * @since 1.3.0
	 * @param array<string,mixed> $params Module parameters.
	 */
	public function __construct( array $params ) {
		$slug = (string) $params['slug'];

		parent::__construct(
			array_merge(
				array(
					'category'        => \FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Module::get_category_label(),
					'partial_refresh' => true,
					'editor_export'   => false,
					'include_wrapper' => true,
					'dir'             => __DIR__ . '/' . $slug . '/',
					'url'             => FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/builders/BeaverBuilder/modules/' . $slug . '/',
				),
				$params
			)
		);
	}

	/**
	 * Collection kind rendered by the module.
	 *
	 * @since 1.3.0
	 * @return string 'gallery' or 'album'.
	 */
	abstract protected function get_kind(): string;

	/**
	 * Collection ID chosen in the module settings.
	 *
	 * @since 1.3.0
	 * @return int
	 */
	abstract protected function get_collection_id(): int;

	/**
	 * Render the collection markup for the front end.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Collection post ID.
	 * @return string
	 */
	abstract protected function render_collection( int $collection_id ): string;

	/**
	 * Print the module output. Called from the module's `includes/frontend.php`.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public function render_output(): void {
		$collection_id = $this->get_collection_id();
		if ( ! $collection_id ) {
			return;
		}

		$markup = $this->render_collection( $collection_id );
		if ( '' === $markup ) {
			return;
		}

		echo wp_kses( $markup, \FotoGrids\Kses::rules( $markup ) );
	}

	/**
	 * Read one module setting as a string.
	 *
	 * @since 1.3.0
	 * @param string $key Setting key.
	 * @return string
	 */
	protected function get_setting( string $key ): string {
		$settings = is_object( $this->settings ) ? get_object_vars( $this->settings ) : array();
		$value    = $settings[ $key ] ?? '';

		return is_scalar( $value ) ? (string) $value : '';
	}
}
