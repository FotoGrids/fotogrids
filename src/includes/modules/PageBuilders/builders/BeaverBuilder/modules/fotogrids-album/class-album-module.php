<?php
/**
 * FotoGrids album module for Beaver Builder.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules
 * @since   1.3.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules;

use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Module as Beaver_Builder_Module;

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
	 * Build the module.
	 *
	 * @since 1.3.0
	 */
	public function __construct() {
		parent::__construct(
			array(
				'name'        => __( 'FotoGrids Album', 'fotogrids' ),
				'description' => __( 'Display a FotoGrids album.', 'fotogrids' ),
				'slug'        => Beaver_Builder_Module::ALBUM_MODULE,
				'icon'        => 'grid.svg',
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
				'title'    => __( 'Album', 'fotogrids' ),
				'sections' => array(
					'collection' => array(
						'title'  => '',
						'fields' => array(
							self::SETTING_ID => array(
								'type'    => 'text',
								'label'   => __( 'Album ID', 'fotogrids' ),
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
	 * Render the album through the shortcode pipeline.
	 *
	 * @since 1.3.0
	 * @param int $collection_id Album post ID.
	 * @return string
	 */
	protected function render_collection( int $collection_id ): string {
		return (string) \FotoGrids\Public_Render::album_shortcode( array( 'id' => $collection_id ) );
	}
}
