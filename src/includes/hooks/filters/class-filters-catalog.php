<?php
/**
 * Catalog source-list filter hooks.
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Catalog filter hooks.
 */
final class Filters_Catalog {

    /**
     * List of JSON source files merged into the catalog.
     *
     * Pro hooks here to inject the Pro catalog.
     *
     * @since 1.0.0
     * @param string[] $json_file_paths Absolute paths to JSON files.
     */
    public const JSON_FILES = 'fotogrids/catalog/json_files';
}
