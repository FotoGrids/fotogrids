<?php
/**
 * FotoGrids Gallery Bricks element.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Bricks\Elements
 * @since   1.2.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\Bricks\Elements;

use FotoGrids\Modules\PageBuilders\Builders\Bricks\Module as Bricks_Module;
use FotoGrids\Render\Api\Request_Source;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Renders a FotoGrids gallery inside Bricks.
 *
 * @since 1.2.0
 */
class Element_Gallery extends Element_Base {

	/**
	 * Bricks element name.
	 *
	 * @var string
	 */
	public $name = Bricks_Module::GALLERY_ELEMENT;

	/**
	 * Builder panel icon class.
	 *
	 * @var string
	 */
	public $icon = 'ti-gallery';

	/**
	 * Element label in the builder panel.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	public function get_label() {
		return esc_html__( 'FotoGrids Gallery', 'fotogrids' );
	}

	/**
	 * Collection kind rendered by the element.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_kind(): string {
		return 'gallery';
	}

	/**
	 * Number of items in the gallery.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Gallery post ID.
	 * @return int
	 */
	protected function get_item_count( int $collection_id ): int {
		return class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
			? count( (array) \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $collection_id ) )
			: 0;
	}

	/**
	 * Label of the collection ID control.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_id_label(): string {
		return esc_html__( 'Gallery ID', 'fotogrids' );
	}

	/**
	 * Builder placeholder title shown before a gallery is chosen.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_empty_title(): string {
		return esc_html__( 'Enter a gallery ID in the element settings.', 'fotogrids' );
	}

	/**
	 * Builder placeholder title shown for a chosen gallery.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Gallery post ID.
	 * @return string
	 */
	protected function get_selected_title( int $collection_id ): string {
		/* translators: %d: gallery ID. */
		return sprintf( esc_html__( 'FotoGrids gallery #%d', 'fotogrids' ), $collection_id );
	}

	/**
	 * Render the gallery through the shortcode pipeline.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Gallery post ID.
	 * @return string
	 */
	protected function render_collection( int $collection_id ): string {
		return (string) \FotoGrids\Public_Render::gallery_shortcode(
			array(
				'id'      => $collection_id,
				'_source' => Request_Source::BRICKS,
			)
		);
	}
}
