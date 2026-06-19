<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Visual Portfolio migration source.
 *
 * Stores portfolios and galleries as a custom post type. Registered for
 * discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class Visual_Portfolio_Source extends Abstract_Source {

	public function get_id(): string {
		return 'visual-portfolio';
	}

	public function get_label(): string {
		return __( 'Visual Portfolio', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Portfolios and galleries stored as Visual Portfolio layout posts.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#000000';
	}

	public function is_detected(): bool {
		return $this->post_type_has_posts( 'vp_lists' );
	}
}
