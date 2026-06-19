<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Responsive Lightbox & Gallery migration source.
 *
 * Stores galleries as a custom post type. Registered for discoverability;
 * import is not implemented yet.
 *
 * @since 1.0.0
 */
class Responsive_Lightbox_Source extends Abstract_Source {

	public function get_id(): string {
		return 'responsive-lightbox';
	}

	public function get_label(): string {
		return __( 'Responsive Lightbox & Gallery', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Galleries stored by the Responsive Lightbox & Gallery plugin.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#24C8FF';
	}

	public function is_detected(): bool {
		return $this->post_type_has_posts( 'rl_gallery' );
	}
}
