<?php
namespace FotoGrids\Modules\Templates;

use FotoGrids\Modules\ModuleInterface;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Templates Module
 *
 * Handles template listing, applying, and the Save-as-Template extension point.
 * Free: list and apply templates; save action shows upgrade CTA.
 *
 * Pro extension: Add filter fotogrids/templates/save_as_template_button returning
 * a component ID. Register that component on window.fotogridsProComponents[id]
 * before the Templates metabox renders. See docs/MODULES_ARCHITECTURE.md.
 *
 * This module is a placeholder. Template logic remains in Meta_Boxes, REST,
 * admin pages. Refactor incrementally by moving logic here over time.
 *
 * @since 1.0.0
 */
class Module implements ModuleInterface {

    public function get_id(): string {
        return 'templates';
    }

    public function get_name(): string {
        return __( 'Templates', 'fotogrids' );
    }

    public function is_active(): bool {
        return true;
    }

    public function init(): void {
        // Placeholder. Template logic remains in Meta_Boxes, REST, admin pages.
        // Extension point for Save-as-Template is in Meta_Boxes::templates_meta_box().
    }

    public function get_dependencies(): array {
        return [];
    }
}
