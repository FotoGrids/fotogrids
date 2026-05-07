<?php
namespace FotoGrids\Modules\Metaboxes;

use FotoGrids\Modules\ModuleInterface;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Metaboxes Module
 *
 * Thin wrapper around the existing Meta_Boxes class.
 * Handles gallery items, collection settings, album assignment, and templates metaboxes.
 *
 * @since 1.0.0
 */
class Module implements ModuleInterface {

    public function get_id(): string {
        return 'metaboxes';
    }

    public function get_name(): string {
        return __( 'Metaboxes', 'fotogrids' );
    }

    public function is_active(): bool {
        return true;
    }

    public function init(): void {
        require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-meta-boxes.php';
        \FotoGrids\Meta_Boxes::init();
    }

    public function get_dependencies(): array {
        return [];
    }
}
