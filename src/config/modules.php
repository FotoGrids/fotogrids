<?php
/**
 * Module Registry
 *
 * Explicit list of FotoGrids modules. No auto-discovery.
 * Add or remove module class names here to control what loads.
 *
 * @since 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

return [
    FotoGrids\Modules\Metaboxes\Module::class,
    FotoGrids\Modules\Templates\Module::class,
];
