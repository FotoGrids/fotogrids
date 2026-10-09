<?php
/**
 * FotoGrids gallery module for Beaver Builder.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules
 * @since   1.3.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules;

use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Module as Beaver_Builder_Module;
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
	 * Build the module.
	 *
	 * @since 1.3.0
	 */
	public function __construct() {
		parent::__construct(
			array(
				'name'        => __( 'FotoGrids Gallery', 'fotogrids' ),
				'description' => __( 'Display a FotoGrids gallery.', 'fotogrids' ),
				'slug'        => Beaver_Builder_Module::GALLERY_MODULE,
				'icon'        => 'format-gallery.svg',
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
			'general' => array(
				'title'    => __( 'Gallery', 'fotogrids' ),
				'sections' => array(
					'collection' => array(
						'title'  => '',
						'fields' => array(
							self::SETTING_ID => array(
								'type'    => 'text',
								'label'   => __( 'Gallery ID', 'fotogrids' ),
								'preview' => array( 'type' => 'refresh' ),
							),
						),
					),
				),
			),
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
		return absint( $this->get_setting( self::SETTING_ID ) );
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
}
