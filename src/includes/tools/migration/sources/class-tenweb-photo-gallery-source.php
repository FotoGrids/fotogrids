<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Photo Gallery by 10Web migration source.
 *
 * Stores galleries and albums in its own database tables. Registered for
 * discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class TenWeb_Photo_Gallery_Source extends Abstract_Source {

	public function get_id(): string {
		return 'photo-gallery-10web';
	}

	public function get_label(): string {
		return __( 'Photo Gallery by 10Web', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Galleries and albums stored in the Photo Gallery plugin’s own tables.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#3339F1';
	}

	public function is_detected(): bool {
		return $this->table_exists( 'bwg_gallery' );
	}
}
