<?php
namespace FotoGrids\Modules\Metaboxes;

use FotoGrids\Metaboxes\Collection_Save_Pipeline;
use FotoGrids\Metaboxes\Item_Ajax_Endpoints;
use FotoGrids\Metaboxes\Metabox_Registrar;
use FotoGrids\Modules\Abstract_Module;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Metaboxes Module
 *
 * Composes three single-purpose classes that together own the gallery /
 * album edit screens:
 *
 *   - Metabox_Registrar         - UI shells, render functions, asset enqueue
 *   - Item_Ajax_Endpoints       - per-item `wp_ajax_*` endpoints
 *   - Collection_Save_Pipeline  - `save_post` + `wp_ajax_fotogrids_save_collection`
 *
 * Runs in 'admin' and 'rest' contexts but not 'frontend': the save and AJAX
 * paths fire from admin and REST (Gutenberg's `save_post`), never from a
 * public frontend render.
 *
 * @since 1.0.0
 */
class Module extends Abstract_Module {

	public function get_id(): string {
		return 'metaboxes';
	}

	public function get_name(): string {
		return __( 'Metaboxes', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Gallery and album editing metaboxes in the post editor.', 'fotogrids' );
	}

	public function get_contexts(): array {
		return array( 'admin', 'rest' );
	}

	public function init(): void {
		Metabox_Registrar::init();
		Item_Ajax_Endpoints::init();
		Collection_Save_Pipeline::init();
	}
}
