<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Smart Slider 3 migration source.
 *
 * Stores sliders and slides in its own database tables. Grouped under sliders
 * and registered for discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class Smart_Slider_Source extends Abstract_Source {

	public function get_id(): string {
		return 'smart-slider-3';
	}

	public function get_label(): string {
		return __( 'Smart Slider 3', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Sliders and slides stored in Smart Slider 3’s own tables.', 'fotogrids' );
	}

	public function get_group(): string {
		return 'slider';
	}

	public function get_brand_color(): string {
		return '#06C018';
	}

	public function is_detected(): bool {
		return $this->table_exists( 'nextend2_smartslider3_sliders' );
	}
}
