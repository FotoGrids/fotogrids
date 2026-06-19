<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Robo Gallery migration source.
 *
 * Stores responsive galleries as a custom post type. Registered for
 * discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class Robo_Gallery_Source extends Abstract_Source {

	public function get_id(): string {
		return 'robo';
	}

	public function get_label(): string {
		return __( 'Robo Gallery', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Responsive galleries stored as Robo Gallery posts.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#FBBD08';
	}

	public function is_detected(): bool {
		return $this->post_type_has_posts( 'robo_gallery_table' );
	}
}
