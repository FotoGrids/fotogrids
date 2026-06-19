<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * LayerSlider migration source.
 *
 * Stores sliders in its own database table. Grouped under sliders and
 * registered for discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class LayerSlider_Source extends Abstract_Source {

	public function get_id(): string {
		return 'layerslider';
	}

	public function get_label(): string {
		return __( 'LayerSlider', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Sliders stored in LayerSlider’s own database table.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#FD3C5C';
	}

	public function get_group(): string {
		return 'slider';
	}

	public function is_detected(): bool {
		return $this->table_exists( 'layerslider' );
	}
}
