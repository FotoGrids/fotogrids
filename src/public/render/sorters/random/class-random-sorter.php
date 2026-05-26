<?php
declare(strict_types=1);

namespace FotoGrids\Render\Sorters\Random;

use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Sorter;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Random sorter - shuffles the item list on every public render.
 *
 * Note: random sort intentionally disables HTML caching (documented in
 * sorting.json). That is handled at the caching layer, not here.
 *
 * @package FotoGrids\Render\Sorters\Random
 * @since   1.0.0
 */
final class Random_Sorter implements Sorter {

    public function id(): string {
        return 'fotogrids/sort/random';
    }

    public function origin(): string {
        return 'fotogrids';
    }

    public function replaces(): ?string {
        return null;
    }

    public function extends_id(): ?string {
        return null;
    }

    /**
     * Active when default_sort_order is 'random' on a public render.
     *
     * @since  1.0.0
     */
    public function supports( Render_Context $render_context ): bool {
        if ( $render_context->meta->is_preview ) {
            return false;
        }

        return ( $render_context->settings['default_sort_order'] ?? '' ) === 'random';
    }

    /**
     * Returns a shuffled copy of $item_ids.
     *
     * @since  1.0.0
     */
    public function sort( array $item_ids, Render_Context $render_context ): array {
        $shuffled = $item_ids;
        shuffle( $shuffled );
        return $shuffled;
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets();
    }
}
