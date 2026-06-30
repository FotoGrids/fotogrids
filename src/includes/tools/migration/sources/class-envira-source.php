<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Envira Gallery migration source.
 *
 * Stores galleries as a custom post type. Registered for discoverability;
 * import is not implemented yet.
 *
 * @since 1.0.0
 */
class Envira_Source extends Abstract_Source {

	public function get_id(): string {
		return 'envira';
	}

	public function get_label(): string {
		return __( 'Envira Gallery', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Galleries stored as Envira posts, with per-image captions and links.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#00AC53';
	}

	public function is_detected(): bool {
		return $this->post_type_has_posts( 'envira' );
	}
}
