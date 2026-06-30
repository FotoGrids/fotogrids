<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * MetaSlider migration source.
 *
 * Stores sliders as a custom post type with attachment-based slides. Grouped
 * under sliders and registered for discoverability; import is not implemented
 * yet.
 *
 * @since 1.0.0
 */
class MetaSlider_Source extends Abstract_Source {

	public function get_id(): string {
		return 'metaslider';
	}

	public function get_label(): string {
		return __( 'MetaSlider', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Sliders stored as MetaSlider posts with attachment-based slides.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#DD6923';
	}

	public function get_group(): string {
		return 'slider';
	}

	public function is_detected(): bool {
		return $this->post_type_has_posts( 'ml-slider' );
	}
}
