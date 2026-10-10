<?php
/**
 * FotoGrids album module for Beaver Builder.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules
 * @since   1.3.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules;

use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Module as Beaver_Builder_Module;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Beaver Builder module that renders a FotoGrids album.
 *
 * @since 1.3.0
 */
final class Album_Module extends Module_Base {

	/**
	 * Setting key holding the album ID.
	 *
	 * @var string
	 */
	public const SETTING_ID = 'album_id';

	/**
	 * Module panel icon: the FotoGrids album mark, drawn in the panel's text colour.
	 *
	 * @var string
	 */
	private const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>';

	/**
	 * Build the module.
	 *
	 * @since 1.3.0
	 */
	public function __construct() {
		parent::__construct(
			array(
				'name'        => __( 'Album', 'fotogrids' ),
				'description' => __( 'Display a FotoGrids album.', 'fotogrids' ),
				'slug'        => Beaver_Builder_Module::ALBUM_MODULE,
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
				'title'    => __( 'Album', 'fotogrids' ),
				'sections' => array(
					'collection' => array(
						'title'  => '',
						'fields' => array(
							self::SETTING_ID => array(
								'type'    => Beaver_Builder_Module::FIELD_TYPE,
								'label'   => __( 'Album', 'fotogrids' ),
								'kind'    => 'album',
								'preview' => array( 'type' => 'refresh' ),
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
		return 'album';
	}

	/**
	 * Album ID chosen in the module settings.
	 *
	 * @since 1.3.0
	 * @return int
	 */
	protected function get_collection_id(): int {
		return absint( $this->get_setting( self::SETTING_ID ) );
	}

	/**
	 * Number of galleries in the album.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Album post ID.
	 * @return int
	 */
	protected function get_item_count( int $collection_id ): int {
		return class_exists( '\FotoGrids\Gallery_Album_Relations' )
			? count( (array) \FotoGrids\Gallery_Album_Relations::get_visible_galleries_for_album( $collection_id ) )
			: 0;
	}

	/**
	 * Builder placeholder shown before an album is chosen.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	protected function get_empty_prompt(): string {
		return __( 'Choose an album in the module settings.', 'fotogrids' );
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
	 * Render the album through the shortcode pipeline.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Album post ID.
	 * @return string
	 */
	protected function render_collection( int $collection_id ): string {
		return (string) \FotoGrids\Public_Render::album_shortcode( array( 'id' => $collection_id ) );
	}

	/**
	 * Render the album for the builder.
	 *
	 * @since 1.3.0
	 * @param int                                          $collection_id   Album post ID.
	 * @param array{click_behavior: bool, pagination: bool} $preview_options Normalised preview settings.
	 * @return string
	 */
	protected function render_preview( int $collection_id, array $preview_options ): string {
		return Preview_Renderer::render_album_html( $collection_id, $preview_options, (string) $this->node );
	}
}
