<?php
/**
 * FotoGrids Album Bricks element.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Bricks\Elements
 * @since   1.2.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\Bricks\Elements;

use FotoGrids\Modules\PageBuilders\Builders\Bricks\Module as Bricks_Module;
if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Renders a FotoGrids album inside Bricks.
 *
 * @since 1.2.0
 */
class Element_Album extends Element_Base {

	/**
	 * Bricks element name.
	 *
	 * @var string
	 */
	public $name = Bricks_Module::ALBUM_ELEMENT;

	/**
	 * Builder panel icon class.
	 *
	 * @var string
	 */
	public $icon = 'ti-folder';

	/**
	 * Element label in the builder panel.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	public function get_label() {
		return esc_html__( 'FotoGrids Album', 'fotogrids' );
	}

	/**
	 * Collection kind rendered by the element.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_kind(): string {
		return 'album';
	}

	/**
	 * Number of galleries in the album.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Album post ID.
	 * @return int
	 */
	protected function get_item_count( int $collection_id ): int {
		return class_exists( '\FotoGrids\Gallery_Album_Relations' )
			? count( (array) \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $collection_id ) )
			: 0;
	}

	/**
	 * Label of the collection ID control.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_id_label(): string {
		return esc_html__( 'Album ID', 'fotogrids' );
	}

	/**
	 * Builder placeholder title shown before an album is chosen.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_empty_title(): string {
		return esc_html__( 'Enter an album ID in the element settings.', 'fotogrids' );
	}

	/**
	 * Builder placeholder title shown for a chosen album.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Album post ID.
	 * @return string
	 */
	protected function get_selected_title( int $collection_id ): string {
		/* translators: %d: album ID. */
		return sprintf( esc_html__( 'FotoGrids album #%d', 'fotogrids' ), $collection_id );
	}

	/**
	 * Render the album through the shortcode pipeline.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Album post ID.
	 * @return string
	 */
	protected function render_collection( int $collection_id ): string {
		return (string) \FotoGrids\Public_Render::album_shortcode( array( 'id' => $collection_id ) );
	}
}
