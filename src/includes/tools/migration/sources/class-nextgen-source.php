<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * NextGEN Gallery migration source.
 *
 * Stores galleries and albums in its own database tables. Registered for
 * discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class NextGen_Source extends Abstract_Source {

	public function get_id(): string {
		return 'nextgen';
	}

	public function get_label(): string {
		return __( 'NextGEN Gallery', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Galleries and albums stored in NextGEN’s own database tables.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#9EBC1C';
	}

	public function is_detected(): bool {
		return $this->table_exists( 'ngg_gallery' );
	}
}
