<?php
/**
 * FotoGrids gallery module for Beaver Builder.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules
 * @since   1.3.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules;

use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Module as Beaver_Builder_Module;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;
use FotoGrids\Render\Api\Request_Source;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Beaver Builder module that renders a FotoGrids gallery.
 *
 * @since 1.3.0
 */
final class Gallery_Module extends Module_Base {

	/**
	 * Setting key holding the gallery ID.
	 *
	 * @var string
	 */
	public const SETTING_ID = 'gallery_id';

	/**
	 * Setting key of the gallery source (picker or dynamic).
	 *
	 * @var string
	 */
	public const SOURCE_SETTING = 'gallery_source';

	/**
	 * Setting key of the dynamic gallery ID.
	 *
	 * @var string
	 */
	public const DYNAMIC_SETTING = 'gallery_id_dynamic';

	/**
	 * Field key of the create button shown in dynamic mode.
	 *
	 * @var string
	 */
	public const CREATE_FIELD = 'gallery_create';

	/**
	 * Module panel icon: the FotoGrids gallery mark, drawn in the panel's text colour.
	 *
	 * @var string
	 */
	private const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="4" height="4" rx="0.2"/><rect x="10" y="3" width="4" height="4" rx="0.2"/><rect x="17" y="3" width="4" height="4" rx="0.2"/><rect x="3" y="10" width="4" height="4" rx="0.2"/><rect x="10" y="10" width="4" height="4" rx="0.2"/><rect x="17" y="10" width="4" height="4" rx="0.2"/><rect x="3" y="17" width="4" height="4" rx="0.2"/><rect x="10" y="17" width="4" height="4" rx="0.2"/><rect x="17" y="17" width="4" height="4" rx="0.2"/></svg>';

	/**
	 * Build the module.
	 *
	 * @since 1.3.0
	 */
	public function __construct() {
		parent::__construct(
			array(
				'name'        => __( 'Gallery', 'fotogrids' ),
				'description' => __( 'Display a FotoGrids gallery.', 'fotogrids' ),
				'slug'        => Beaver_Builder_Module::GALLERY_MODULE,
				'icon'        => self::ICON,
			)
		);
	}

	/**
	 * Settings form of the module.
	 *
	 * @since 1.3.0
	 * @return array<string,mixed>
	 */
	public static function get_form(): array {
		return array(
			'general'           => array(
				'title'    => __( 'Gallery', 'fotogrids' ),
				'sections' => array(
					'collection' => array(
						'title'  => '',
						'fields' => array(
							self::SOURCE_SETTING  => array(
								'type'    => 'select',
								'label'   => __( 'Source', 'fotogrids' ),
								'default' => 'picker',
								'options' => array(
									'picker'  => __( 'Gallery Picker', 'fotogrids' ),
									'dynamic' => __( 'Dynamic', 'fotogrids' ),
								),
								'toggle'  => array(
									'picker'  => array( 'fields' => array( self::SETTING_ID ) ),
									'dynamic' => array( 'fields' => array( self::DYNAMIC_SETTING, self::CREATE_FIELD ) ),
								),
								'preview' => array( 'type' => 'refresh' ),
							),
							self::SETTING_ID      => array(
								'type'    => Beaver_Builder_Module::FIELD_TYPE,
								'label'   => __( 'Gallery', 'fotogrids' ),
								'kind'    => 'gallery',
								'preview' => array( 'type' => 'refresh' ),
							),
							self::DYNAMIC_SETTING => array(
								'type'        => 'text',
								'label'       => __( 'Dynamic Gallery ID', 'fotogrids' ),
								'help'        => __( 'Bind a dynamic source that outputs a gallery ID.', 'fotogrids' ),
								'connections' => array( 'string', 'custom_field' ),
								'preview'     => array( 'type' => 'refresh' ),
							),
							self::CREATE_FIELD    => array(
								'type'    => 'raw',
								'label'   => '',
								'content' => '<div class="fg-pb-bb-picker" data-fg-picker-kind="gallery" data-fg-picker-mode="create"></div>',
							),
						),
					),
				),
			),
			'fotogrids_preview' => self::get_preview_tab(),
		);
	}

	/**
	 * Collection kind rendered by the module.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	protected function get_kind(): string {
		return 'gallery';
	}

	/**
	 * Gallery ID chosen in the module settings.
	 *
	 * @since 1.3.0
	 * @return int
	 */
	protected function get_collection_id(): int {
		if ( 'dynamic' === $this->get_setting( self::SOURCE_SETTING ) ) {
			return absint( $this->get_setting( self::DYNAMIC_SETTING ) );
		}

		return absint( $this->get_setting( self::SETTING_ID ) );
	}

	/**
	 * Number of items in the gallery.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Gallery post ID.
	 * @return int
	 */
	protected function get_item_count( int $collection_id ): int {
		return class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
			? count( (array) \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $collection_id ) )
			: 0;
	}

	/**
	 * Builder placeholder shown before a gallery is chosen.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	protected function get_empty_prompt(): string {
		return __( 'Choose a gallery in the module settings.', 'fotogrids' );
	}

	/**
	 * Description of the "Make items clickable" preview setting.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	protected static function get_click_preview_description(): string {
		return __( 'When disabled, item clicks open the module settings in the builder instead of opening the gallery action. Published pages are not affected.', 'fotogrids' );
	}

	/**
	 * Render the gallery through the shortcode pipeline.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Gallery post ID.
	 * @return string
	 */
	protected function render_collection( int $collection_id ): string {
		return (string) \FotoGrids\Public_Render::gallery_shortcode(
			array(
				'id'      => $collection_id,
				'_source' => Request_Source::BEAVER_BUILDER,
			)
		);
	}

	/**
	 * Render the gallery for the builder.
	 *
	 * @since 1.3.0
	 * @param int                                          $collection_id   Gallery post ID.
	 * @param array{click_behavior: bool, pagination: bool} $preview_options Normalised preview settings.
	 * @return string
	 */
	protected function render_preview( int $collection_id, array $preview_options ): string {
		return Preview_Renderer::render_gallery_html( $collection_id, $preview_options, (string) $this->node );
	}
}
