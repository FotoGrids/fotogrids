<?php
namespace FotoGrids\Modules\Metaboxes;

use FotoGrids\Modules\Abstract_Module;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Metaboxes Module
 *
 * Thin wrapper around the existing Meta_Boxes class. Handles gallery items,
 * collection settings, album assignment, and templates metaboxes.
 *
 * Runs in 'admin' and 'rest' contexts but not 'frontend': Meta_Boxes::init()
 * registers add_meta_boxes / save_post (wp-admin) AND wp_ajax_* handlers
 * (AJAX) - and save_post also fires on Gutenberg REST saves - so both the
 * 'admin' and 'rest' contexts are required. It never needs to boot on a
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
        return [ 'admin', 'rest' ];
    }

    public function init(): void {
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-meta-boxes.php';
        \FotoGrids\Meta_Boxes::init();
    }
}
