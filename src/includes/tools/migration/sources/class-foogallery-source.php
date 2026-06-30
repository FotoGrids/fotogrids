<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * FooGallery migration source.
 *
 * Stores galleries as a custom post type, with album support. Registered for
 * discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class FooGallery_Source extends Abstract_Source {

	public function get_id(): string {
		return 'foogallery';
	}

	public function get_label(): string {
		return __( 'FooGallery', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Galleries stored as FooGallery posts, with album support.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#5ECAF9';
	}

	public function is_detected(): bool {
		return $this->post_type_has_posts( 'foogallery' );
	}
}
