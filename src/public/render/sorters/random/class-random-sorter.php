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
     * Returns a shuffled copy of $item_ids using a deterministic shuffle
     * seeded by Render_Meta::random_seed.
     *
     * Why deterministic? Because pagination + filtering rebuild the
     * Render_Context per request. With a non-seeded shuffle, page 2
     * would draw from a different random permutation than page 1 — items
     * that appeared on page 1 could reappear on page 2, and others would
     * never show up. The seed travels with every paginated request (set
     * once on the initial render, sent back by the client thereafter)
     * so all pages of one visitor's session draw from the same shuffle.
     *
     * Implementation: Fisher-Yates with mt_srand. We don't use the older
     * srand()/array_rand() path; mt_srand gives reproducible output
     * cross-platform.
     *
     * @since  1.0.0
     */
    public function sort( array $item_ids, Render_Context $render_context ): array {
        $shuffled = array_values( $item_ids );
        $count    = count( $shuffled );
        if ( $count < 2 ) {
            return $shuffled;
        }

        $seed = $render_context->meta->random_seed;
        if ( $seed === null ) {
            // No seed inherited — fall back to a non-deterministic shuffle.
            shuffle( $shuffled );
            return $shuffled;
        }

        // Seed once and consume mt_rand() values. mt_srand resets the
        // global PHP Mersenne Twister state — fine here because the
        // renderer runs synchronously per request.
        mt_srand( (int) $seed );
        for ( $i = $count - 1; $i > 0; $i-- ) {
            $j = mt_rand( 0, $i );
            $tmp           = $shuffled[ $i ];
            $shuffled[ $i ] = $shuffled[ $j ];
            $shuffled[ $j ] = $tmp;
        }
        // Re-seed from time so any later mt_rand() callers aren't
        // pinned to our seed.
        mt_srand();

        return $shuffled;
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets();
    }
}
