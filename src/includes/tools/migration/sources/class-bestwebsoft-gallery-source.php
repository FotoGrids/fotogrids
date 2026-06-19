<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Gallery by BestWebSoft migration source.
 *
 * Stores galleries as a custom post type. Registered for discoverability;
 * import is not implemented yet.
 *
 * @since 1.0.0
 */
class BestWebSoft_Gallery_Source extends Abstract_Source {

	public function get_id(): string {
		return 'bestwebsoft';
	}

	public function get_label(): string {
		return __( 'Gallery by BestWebSoft', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Galleries stored as BestWebSoft Gallery posts.', 'fotogrids' );
	}

	public function get_brand_color(): string {
		return '#CF4500';
	}

	public function is_detected(): bool {
		return $this->post_type_has_posts( 'gallery' )
			&& $this->plugin_active( 'gallery-plugin/gallery-plugin.php' );
	}
}
