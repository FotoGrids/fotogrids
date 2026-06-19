<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Meow Gallery migration source.
 *
 * Renders galleries from attachments and [gallery] shortcodes. Registered for
 * discoverability; import is not implemented yet.
 *
 * @since 1.0.0
 */
class Meow_Gallery_Source extends Abstract_Source {

	public function get_id(): string {
		return 'meow';
	}

	public function get_label(): string {
		return __( 'Meow Gallery', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Galleries built from [gallery] shortcodes rendered by Meow Gallery.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#4E6FC3';
	}

	public function is_detected(): bool {
		return $this->plugin_active( 'meow-gallery/meow-gallery.php' );
	}
}
