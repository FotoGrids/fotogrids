<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Slider Revolution migration source.
 *
 * Stores slides in its own database tables. Grouped under sliders and
 * registered for discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class Slider_Revolution_Source extends Abstract_Source {

	public function get_id(): string {
		return 'slider-revolution';
	}

	public function get_label(): string {
		return __( 'Slider Revolution', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Slides stored in Slider Revolution’s own database tables.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#5C24FF';
	}

	public function get_group(): string {
		return 'slider';
	}

	public function is_detected(): bool {
		return $this->table_exists( 'revslider_sliders' );
	}
}
