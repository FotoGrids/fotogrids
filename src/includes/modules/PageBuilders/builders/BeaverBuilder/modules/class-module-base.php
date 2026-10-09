<?php
/**
 * Shared base for the FotoGrids Beaver Builder modules.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules
 * @since   1.3.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules;

use FotoGrids\Modules\PageBuilders\Preview_Options;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Base Beaver Builder module for a FotoGrids collection.
 *
 * The collection renders through the shortcode pipeline on the front end
 * and through Preview_Renderer in the builder. Module directories are passed
 * explicitly so templates resolve on symlinked installs, where the class file
 * path does not sit under ABSPATH.
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
	 * Number of items (gallery) or child galleries (album) in the collection.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Collection post ID.
	 * @return int
	 */
	abstract protected function get_item_count( int $collection_id ): int;

	/**
	 * Builder placeholder shown before a collection is chosen.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	abstract protected function get_empty_prompt(): string;

	/**
	 * Description of the "Make items clickable" preview setting.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	abstract protected static function get_click_preview_description(): string;

	/**
	 * Render the collection markup for the front end.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Collection post ID.
	 * @return string
	 */
	abstract protected function render_collection( int $collection_id ): string;

	/**
	 * Render the collection markup for the builder.
	 *
	 * @since 1.3.0
	 * @param int                                          $collection_id   Collection post ID.
	 * @param array{click_behavior: bool, pagination: bool} $preview_options Normalised preview settings.
	 * @return string
	 */
	abstract protected function render_preview( int $collection_id, array $preview_options ): string;

	/**
	 * Settings tab holding the builder-only preview settings.
	 *
	 * @since 1.3.0
	 * @return array<string,mixed>
	 */
	protected static function get_preview_tab(): array {
		$options = array(
			'0' => __( 'Off', 'fotogrids' ),
			'1' => __( 'On', 'fotogrids' ),
		);

		return array(
			'title'    => __( 'Preview', 'fotogrids' ),
			'sections' => array(
				'preview' => array(
					'title'  => '',
					'fields' => array(
						Preview_Options::ATTR_CLICK_BEHAVIOR => array(
							'type'    => 'select',
							'label'   => __( 'Make items clickable', 'fotogrids' ),
							'help'    => static::get_click_preview_description(),
							'default' => '0',
							'options' => $options,
							'preview' => array( 'type' => 'refresh' ),
						),
						Preview_Options::ATTR_PAGINATION => array(
							'type'    => 'select',
							'label'   => __( 'Enable pagination controls', 'fotogrids' ),
							'help'    => __( 'When disabled, pagination controls stay visible but inactive in the builder. Published pages are not affected.', 'fotogrids' ),
							'default' => '0',
							'options' => $options,
							'preview' => array( 'type' => 'refresh' ),
						),
					),
				),
			),
		);
	}

	/**
	 * Print the module output. Called from the module's `includes/frontend.php`.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public function render_output(): void {
		$collection_id = $this->get_collection_id();

		if ( class_exists( 'FLBuilderModel' ) && \FLBuilderModel::is_builder_active() ) {
			$this->render_builder_output( $collection_id );
			return;
		}

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
	 * Print the builder output: a placeholder, an empty-state panel, or the
	 * collection rendered with the preview settings.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Collection post ID.
	 * @return void
	 */
	private function render_builder_output( int $collection_id ): void {
		if ( ! $collection_id ) {
			echo '<div class="fg-pb-bb-placeholder">' . esc_html( $this->get_empty_prompt() ) . '</div>';
			return;
		}

		if ( 0 === $this->get_item_count( $collection_id ) ) {
			$markup = '<div class="fg-pb-bb-preview fg-pb-bb-preview--empty">'
				. Preview_Renderer::render_empty_state_html( $this->get_kind(), $collection_id )
				. '</div>';
			echo wp_kses( $markup, array_merge( \FotoGrids\Kses::rules( $markup ), array( 'style' => array() ) ) );
			return;
		}

		$preview_options = Preview_Options::normalise( is_object( $this->settings ) ? get_object_vars( $this->settings ) : array() );

		$markup = sprintf(
			'<div class="fg-pb-bb-preview%1$s">%2$s</div>',
			$preview_options['pagination'] ? '' : ' is-fg-pb-pagination-frozen',
			$this->render_preview( $collection_id, $preview_options )
		);
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
