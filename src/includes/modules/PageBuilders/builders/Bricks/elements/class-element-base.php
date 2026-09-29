<?php
/**
 * Shared base for the FotoGrids Bricks elements.
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
 * Base Bricks element for a FotoGrids collection.
 *
 * Holds the collection ID in a text control and renders the collection
 * through the shortcode pipeline on the front end.
 *
 * @since 1.2.0
 */
abstract class Element_Base extends \Bricks\Element {

	/**
	 * Setting key holding the collection ID.
	 *
	 * @var string
	 */
	public const SETTING_ID = 'fgCollectionId';

	/**
	 * Builder panel category.
	 *
	 * @var string
	 */
	public $category = Bricks_Module::CATEGORY;

	/**
	 * Label of the collection ID control.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	abstract protected function get_id_label(): string;

	/**
	 * Builder placeholder title shown before a collection is chosen.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	abstract protected function get_empty_title(): string;

	/**
	 * Builder placeholder title shown for a chosen collection.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Collection post ID.
	 * @return string
	 */
	abstract protected function get_selected_title( int $collection_id ): string;

	/**
	 * Render the collection markup for the front end.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Collection post ID.
	 * @return string
	 */
	abstract protected function render_collection( int $collection_id ): string;

	/**
	 * Search keywords for the builder panel.
	 *
	 * @since 1.2.0
	 * @return array<int,string>
	 */
	public function get_keywords() {
		return array( 'fotogrids', 'gallery', 'album', 'photo', 'image' );
	}

	/**
	 * Register the element controls.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public function set_controls() {
		$this->controls[ self::SETTING_ID ] = array(
			'tab'      => 'content',
			'type'     => 'text',
			'label'    => $this->get_id_label(),
			'rerender' => true,
		);
	}

	/**
	 * Render the element.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public function render() {
		$collection_id = absint( $this->settings[ self::SETTING_ID ] ?? 0 );

		if ( ! $this->is_frontend ) {
			$title = $collection_id ? $this->get_selected_title( $collection_id ) : $this->get_empty_title();
			$this->render_element_placeholder( array( 'title' => $title ) );
			return;
		}

		if ( ! $collection_id ) {
			return;
		}

		$markup = $this->render_collection( $collection_id );
		if ( '' === $markup ) {
			return;
		}

		echo '<div ' . $this->render_attributes( '_root' ) . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Bricks escapes each attribute value in render_attributes().
		echo wp_kses( $markup, \FotoGrids\Kses::rules( $markup ) );
		echo '</div>';
	}
}
