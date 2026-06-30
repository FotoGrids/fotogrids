<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Modula migration source.
 *
 * Stores grid, masonry, and custom galleries as a custom post type with
 * per-image metadata. Registered for discoverability; import is not
 * implemented yet.
 *
 * @since 1.0.0
 */
class Modula_Source extends Abstract_Source {

	public function get_id(): string {
		return 'modula';
	}

	public function get_label(): string {
		return __( 'Modula', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Grid, masonry, and custom galleries with per-image metadata.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#E85D45';
	}

	public function is_detected(): bool {
		return $this->post_type_has_posts( 'modula-gallery' );
	}
}
